import { formatEther, type Address } from "viem";
import { PONS } from "@/config/contracts";
import type { BatteryState } from "@/types/battery";
import { ponsCurveAbi, ponsEscrowAbi } from "./abis";
import { publicClient } from "./client";

export interface BatteryReadInput {
  reserveWallet: Address;
  /** The VOLT curve; its unswept fees are counted at the creator's share. */
  curve: Address | null;
  /** Creator's share of the curve's base fee, in bps (10 000 − protocolFeeShareBps). */
  creatorShareBps: number;
  /** USD per ETH — from the price layer, never hardcoded. Null leaves the USD charge at 0; the caller flags it. */
  ethUsd: number | null;
  targetChargeUsd: number;
  /** Derived from the purchase history: completed cycles + 1. */
  currentCycle: number;
  cycleStartedAt: number | null;
}

export interface ChargeBreakdown {
  walletEth: number;
  escrowEth: number;
  curveEth: number;
}

/**
 * The charge is everything routed to the reserve and not yet converted:
 * ETH sitting in the reserve wallet, ETH swept to the venue's escrow for
 * it, and the creator's share of fees still accruing on the curve. Valued
 * at the current ETH price. Nothing else counts.
 */
export async function getBatteryState(input: BatteryReadInput): Promise<BatteryState & { breakdown: ChargeBreakdown }> {
  const client = publicClient();
  const [balance, claimable, accrued] = await Promise.all([
    client.getBalance({ address: input.reserveWallet }),
    client.readContract({ address: PONS.feeEscrow, abi: ponsEscrowAbi, functionName: "balanceOf", args: [input.reserveWallet] }).catch(() => 0n),
    input.curve ? client.readContract({ address: input.curve, abi: ponsCurveAbi, functionName: "quoteFeeBalance" }).catch(() => 0n) : Promise.resolve(0n),
  ]);
  const walletEth = Number(formatEther(balance));
  const escrowEth = Number(formatEther(claimable));
  const curveEth = (Number(formatEther(accrued)) * input.creatorShareBps) / 10_000;
  const chargeEth = walletEth + escrowEth + curveEth;
  const currentChargeUsd = input.ethUsd != null ? chargeEth * input.ethUsd : 0;
  const now = Date.now();
  return {
    currentChargeUsd,
    targetChargeUsd: input.targetChargeUsd,
    percentage: input.targetChargeUsd > 0 ? Math.min(100, Math.max(0, (currentChargeUsd / input.targetChargeUsd) * 100)) : 0,
    currentCycle: input.currentCycle,
    lastUpdated: now,
    cycleStartedAt: input.cycleStartedAt,
    chargeEth,
    breakdown: { walletEth, escrowEth, curveEth },
  };
}
