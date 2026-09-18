import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveCycles, deriveStreak, reserveSeries } from "@/lib/reserve/cycles";
import type { BatteryState } from "@/types/battery";
import type { ReservePurchase } from "@/types/reserve";

const H = 3_600_000;
const p = (cycle: number, timestamp: number, tsla: number, price: number | null = null): ReservePurchase => ({
  id: `p${cycle}`,
  cycle,
  timestamp,
  amountUsd: price != null ? tsla * price : null,
  tslaAmount: tsla,
  tslaPrice: price,
  txHash: null,
  status: "confirmed",
});
const battery = (over: Partial<BatteryState> = {}): BatteryState => ({ currentChargeUsd: 420, targetChargeUsd: 1000, percentage: 42, currentCycle: 4, lastUpdated: 0, cycleStartedAt: 3 * H, ...over });

test("cycles: the current one first, completed ones newest first, starts chained to the previous purchase", () => {
  const cycles = deriveCycles([p(1, 1 * H, 2), p(2, 2 * H, 2.5), p(3, 3 * H, 2.2)], battery());
  assert.equal(cycles[0].status, "current");
  assert.equal(cycles[0].number, 4);
  assert.equal(cycles[0].feesAccumulatedUsd, 420);
  assert.deepEqual(
    cycles.slice(1).map((c) => [c.number, c.startedAt, c.completedAt]),
    [
      [3, 2 * H, 3 * H],
      [2, 1 * H, 2 * H],
      [1, null, 1 * H],
    ],
  );
});

test("streak: active cycle from its start, average over cycles with a known start, last purchase", () => {
  const now = 3 * H + 41 * 60_000;
  const streak = deriveStreak(deriveCycles([p(1, 1 * H, 2), p(2, 2 * H, 2.5), p(3, 3 * H, 2.2)], battery()), now);
  assert.equal(streak.activeCycleMs, 41 * 60_000);
  assert.equal(streak.avgCycleMs, H);
  assert.equal(streak.sampleSize, 2);
  assert.equal(streak.lastPurchaseAt, 3 * H);
});

test("streak with nothing known reports nulls, never invented values", () => {
  const streak = deriveStreak(deriveCycles([], battery({ cycleStartedAt: null, currentCycle: 1 })), 10 * H);
  assert.deepEqual(streak, { activeCycleMs: null, avgCycleMs: null, lastPurchaseAt: null, sampleSize: 0 });
});

test("reserve series accumulates TSLA and values it at the acquisition price when known, else the mark", () => {
  const series = reserveSeries([p(2, 2 * H, 1), p(1, 1 * H, 1, 400)], 500);
  assert.deepEqual(
    series.map((s) => [s.cycle, s.tsla, s.usd]),
    [
      [1, 1, 400],
      [2, 2, 1000],
    ],
  );
  assert.equal(reserveSeries([p(1, H, 1)], null)[0].usd, null);
});
