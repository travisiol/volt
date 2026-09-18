// Runs every read the site makes against Robinhood Chain, on real addresses, and
// checks the invariants the UI relies on. Node side (direct RPC), no browser.
//
//   npm run live-check                       → uses the fixture addresses below
//   VOLT_TOKEN=0x… RESERVE_WALLET=0x… npm run live-check
//
// Fixtures (2026-09-18): an active Pons V2 token (its curve trades every few
// minutes) and a contract that receives TSLA Stock Tokens every few minutes.
import assert from "node:assert/strict";
import type { Address } from "viem";
import { getBatteryState, getFeeData, getReserveActivity, getReserveBalance, getReservePurchases, getVoltTokenInfo, publicClient } from "@/lib/blockchain";
import { getPrices } from "@/lib/pricing";
import { pythOnchainProvider } from "@/lib/pricing/providers/pythOnchain";
import { finish } from "@/lib/pricing/types";
import { deriveCycles, deriveStreak } from "@/lib/reserve/cycles";
import { emptyBattery } from "@/lib/store/volt";

const VOLT = (process.env.VOLT_TOKEN ?? "0x5Fa6Aad2863B6Cb92882cb491D5602C1C0BdE373") as Address;
const RESERVE = (process.env.RESERVE_WALLET ?? "0x058a0d1fb0d75000ba0d57e479e5c298aca9fbcd") as Address;

const line = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
const t0 = Date.now();

const client = publicClient();
const head = await client.getBlockNumber();
line("head block", head);

// 1. Prices — the server chain, then the on-chain last resort with its age.
const prices = await getPrices(["TSLA", "ETH"]);
assert.ok(prices.TSLA && prices.TSLA.price > 50 && prices.TSLA.price < 5000, "TSLA price in a sane range");
assert.ok(prices.ETH && prices.ETH.price > 100 && prices.ETH.price < 50_000, "ETH price in a sane range");
line("TSLA price", `${prices.TSLA.price} via ${prices.TSLA.source} stale=${prices.TSLA.stale}`);
line("ETH price", `${prices.ETH.price} via ${prices.ETH.source} stale=${prices.ETH.stale}`);
const onchainEth = finish(pythOnchainProvider, await pythOnchainProvider.fetch("ETH"));
line("Pyth on-chain ETH", onchainEth ? `${onchainEth.price} published ${new Date(onchainEth.publishedAt).toISOString()} stale=${onchainEth.stale}` : "none");
assert.ok(onchainEth?.stale === true || onchainEth === null, "the on-chain Pyth print is flagged stale or absent, never shown as fresh");

// 2. Token + fee data.
const volt = await getVoltTokenInfo(VOLT);
line("token", `${volt.name} (${volt.symbol}) supply ${volt.totalSupply} curve ${volt.curve} graduated ${volt.graduated}`);
assert.ok(volt.curve, "a Pons token exposes its curve");
assert.ok(volt.priceEth && volt.priceEth > 0, "curve reserves give a spot price");
const fees = await getFeeData(volt.curve as Address, RESERVE);
line("fees", fees);
assert.equal(fees.feeBps, 100);
assert.equal(fees.protocolShareBps, 3000);
assert.equal(fees.toBatteryBps, 70 + fees.creatorTaxBps);

// 3. Reserve: balance + purchase history from Transfer logs, incremental second pass.
const balance = await getReserveBalance(RESERVE);
line("reserve balance", `${balance.tslaTokenBalance} ${balance.symbol}`);
assert.equal(balance.symbol, "TSLA");
const from = head - 60_000n;
const first = await getReservePurchases(RESERVE, from);
line("purchases (60k blocks)", `${first.purchases.length} inflows, scanned to ${first.toBlock}`);
assert.ok(first.purchases.length > 0, "the fixture receives TSLA regularly");
for (const p of first.purchases) {
  assert.ok(p.txHash && p.txHash.startsWith("0x"), "every purchase carries its real tx hash");
  assert.ok(p.timestamp > 0, "every purchase has a block timestamp");
  assert.equal(p.amountUsd, null, "USD paid is never invented");
}
assert.deepEqual(
  first.purchases.map((p) => p.cycle),
  first.purchases.map((_, i) => i + 1),
  "cycles are numbered chronologically",
);
const second = await getReservePurchases(RESERVE, first.toBlock + 1n, undefined, first.purchases.length);
line("incremental pass", `${second.purchases.length} new since ${first.toBlock + 1n}`);
if (second.purchases[0]) assert.equal(second.purchases[0].cycle, first.purchases.length + 1, "incremental numbering continues");
const last = first.purchases[first.purchases.length - 1];
line("latest inflow", `${last.tslaAmount} TSLA at ${new Date(last.timestamp).toISOString()} tx ${last.txHash}`);

// 4. Trades on the curve → fees to the battery.
const trades = await getReserveActivity({ curve: volt.curve as Address, fromBlock: head - 30_000n, toBlock: head, toBatteryBps: fees.toBatteryBps, ethUsd: prices.ETH.price });
line("curve trades (30k blocks)", trades.length);
const feeSum = trades.reduce((s, t) => s + t.feeToBatteryUsd, 0);
line("fees to battery (USD)", feeSum.toFixed(4));
for (const t of trades) assert.ok(Math.abs(t.feeToBatteryUsd - (t.quoteUsd ?? 0) * (fees.toBatteryBps / 10_000)) < 1e-9, "fee = quote × share");

// 5. Battery charge = wallet ETH + escrow + creator share of unswept curve fees, valued in USD.
const battery = await getBatteryState({ reserveWallet: RESERVE, curve: volt.curve, creatorShareBps: 10_000 - fees.protocolShareBps, ethUsd: prices.ETH.price, targetChargeUsd: 1000, currentCycle: first.purchases.length + 1, cycleStartedAt: last.timestamp });
line("battery", `${battery.percentage.toFixed(4)}% = $${battery.currentChargeUsd.toFixed(4)} (${battery.chargeEth} ETH: wallet ${battery.breakdown.walletEth} + escrow ${battery.breakdown.escrowEth} + curve share ${battery.breakdown.curveEth})`);
assert.ok(Math.abs(battery.breakdown.walletEth + battery.breakdown.escrowEth + battery.breakdown.curveEth - (battery.chargeEth ?? 0)) < 1e-12);
assert.ok(Math.abs(battery.breakdown.curveEth - (fees.accruingOnCurveEth ?? 0) * 0.7) < 1e-9, "curve share = 70 % of quoteFeeBalance");

// 6. Derived cycles and streak on the real history.
const cycles = deriveCycles(first.purchases, { ...emptyBattery(), currentCycle: first.purchases.length + 1, cycleStartedAt: last.timestamp });
const streak = deriveStreak(cycles, Date.now());
line("cycles", `${cycles.length} (1 current + ${cycles.length - 1} complete)`);
line("streak", `active ${streak.activeCycleMs != null ? Math.round(streak.activeCycleMs / 1000) + "s" : "—"}, avg ${streak.avgCycleMs != null ? Math.round(streak.avgCycleMs / 1000) + "s" : "—"} over ${streak.sampleSize}`);

console.log(`\nlive-check OK in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
