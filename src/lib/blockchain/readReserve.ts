import { formatUnits, type Address, type Hex } from "viem";
import { TSLA_TOKEN } from "@/config/contracts";
import type { ReservePurchase } from "@/types/reserve";
import type { TradeEvent } from "@/types/transaction";
import { erc20Abi, ponsCurveAbi } from "./abis";
import { publicClient } from "./client";

export interface ReserveBalance {
  tslaTokenBalance: number;
  decimals: number;
  symbol: string;
}

/** TSLA Stock Token balance of the reserve wallet. */
export async function getReserveBalance(reserveWallet: Address, token: Address = TSLA_TOKEN): Promise<ReserveBalance> {
  const client = publicClient();
  const [raw, decimals, symbol] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [reserveWallet] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
  ]);
  return { tslaTokenBalance: Number(formatUnits(raw, decimals)), decimals, symbol };
}

/** The RPC times out on wide scans of a busy token (3M blocks → "log query timed out"); 400k answers. Shrinks further on refusal. */
const CHUNK = 400_000n;

async function* transfersTo(token: Address, to: Address, fromBlock: bigint, toBlock: bigint) {
  const client = publicClient();
  let start = fromBlock;
  let span = CHUNK;
  while (start <= toBlock) {
    const end = start + span - 1n > toBlock ? toBlock : start + span - 1n;
    try {
      const logs = await client.getLogs({ address: token, event: erc20Abi[5], args: { to }, fromBlock: start, toBlock: end });
      yield* logs;
      start = end + 1n;
    } catch (e) {
      if (span <= 25_000n) throw e;
      span /= 4n;
    }
  }
}

/** Block timestamps never change: one fetch per block, ever. */
const blockStamps = new Map<bigint, number>();
export async function blockTimestamp(bn: bigint): Promise<number> {
  const hit = blockStamps.get(bn);
  if (hit) return hit;
  const b = await publicClient().getBlock({ blockNumber: bn });
  const ms = Number(b.timestamp) * 1000;
  blockStamps.set(bn, ms);
  return ms;
}

export interface PurchaseScan {
  purchases: ReservePurchase[];
  /** The head block the scan covered — pass it back as `fromBlock + 1` next time. */
  toBlock: bigint;
}

/**
 * Every TSLA inflow to the reserve wallet is an acquisition for the reserve.
 * Decoded from Transfer logs; timestamps from the blocks. USD and price are
 * left null — the chain does not say what was paid, and we never guess.
 * Incremental: `cycleOffset` numbers purchases after the ones already known.
 */
export async function getReservePurchases(reserveWallet: Address, fromBlock: bigint, token: Address = TSLA_TOKEN, cycleOffset = 0): Promise<PurchaseScan> {
  const client = publicClient();
  const toBlock = await client.getBlockNumber();
  if (fromBlock > toBlock) return { purchases: [], toBlock };
  const decimals = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  const logs: Array<{ txHash: Hex; blockNumber: bigint; logIndex: number; from: Hex; value: bigint }> = [];
  for await (const log of transfersTo(token, reserveWallet, fromBlock, toBlock)) {
    if (!log.args.from || log.args.value == null || !log.transactionHash || log.blockNumber == null) continue;
    logs.push({ txHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex ?? 0, from: log.args.from, value: log.args.value });
  }
  logs.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));

  const blocks = [...new Set(logs.map((l) => l.blockNumber))];
  for (let i = 0; i < blocks.length; i += 6) await Promise.all(blocks.slice(i, i + 6).map(blockTimestamp));

  const purchases = logs.map((l, i) => ({
    id: `${l.txHash}-${l.logIndex}`,
    cycle: cycleOffset + i + 1,
    timestamp: blockStamps.get(l.blockNumber) ?? 0,
    amountUsd: null,
    tslaAmount: Number(formatUnits(l.value, decimals)),
    tslaPrice: null,
    txHash: l.txHash,
    status: "confirmed" as const,
    blockNumber: Number(l.blockNumber),
    from: l.from,
  }));
  return { purchases, toBlock };
}

export interface TradeScanInput {
  curve: Address;
  fromBlock: bigint;
  toBlock: bigint;
  /** Share of the quote that reaches the battery, in bps. */
  toBatteryBps: number;
  ethUsd: number | null;
}

/**
 * Trades on the VOLT curve in a block window, with the part of each fee that
 * charged the battery. This is what LIVE CURRENT is made of.
 */
export async function getReserveActivity(input: TradeScanInput): Promise<TradeEvent[]> {
  const client = publicClient();
  const [buys, sells] = await Promise.all([
    client.getLogs({ address: input.curve, event: ponsCurveAbi[9], fromBlock: input.fromBlock, toBlock: input.toBlock }),
    client.getLogs({ address: input.curve, event: ponsCurveAbi[10], fromBlock: input.fromBlock, toBlock: input.toBlock }),
  ]);
  const blocks = [...new Set([...buys, ...sells].map((l) => l.blockNumber).filter((b): b is bigint => b != null))];
  await Promise.all(blocks.slice(0, 40).map(blockTimestamp));
  const now = Date.now();
  const toTrade = (side: "buy" | "sell", log: (typeof buys)[number] | (typeof sells)[number]): TradeEvent | null => {
    const args = log.args as { sender?: Hex; quoteIn?: bigint; quoteOut?: bigint };
    const quote = side === "buy" ? args.quoteIn : args.quoteOut;
    if (quote == null || log.blockNumber == null || !log.transactionHash) return null;
    const quoteEth = Number(formatUnits(quote, 18));
    const quoteUsd = input.ethUsd != null ? quoteEth * input.ethUsd : null;
    return {
      id: `${log.transactionHash}-${log.logIndex}`,
      side,
      quoteEth,
      quoteUsd,
      feeToBatteryUsd: quoteUsd != null ? (quoteUsd * input.toBatteryBps) / 10_000 : 0,
      trader: args.sender ?? null,
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      at: blockStamps.get(log.blockNumber) ?? now,
    };
  };
  const all = [...buys.map((l) => toTrade("buy", l)), ...sells.map((l) => toTrade("sell", l))].filter((t): t is TradeEvent => t !== null);
  return all.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));
}
