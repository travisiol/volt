import type { BatteryState } from "@/types/battery";
import type { ChargeCycle, ReservePurchase } from "@/types/reserve";

/**
 * Cycles are derived, never stored: every purchase closes one, the battery
 * is the open one. Completed cycles start where the previous purchase ended.
 */
export function deriveCycles(purchases: ReservePurchase[], battery: BatteryState): ChargeCycle[] {
  const chronological = [...purchases].sort((a, b) => a.timestamp - b.timestamp);
  const completed: ChargeCycle[] = chronological.map((p, i) => ({
    number: p.cycle,
    status: "complete",
    startedAt: i > 0 ? chronological[i - 1].timestamp : null,
    completedAt: p.timestamp,
    feesAccumulatedUsd: p.amountUsd,
    targetUsd: p.amountUsd ?? battery.targetChargeUsd,
    tslaAmount: p.tslaAmount,
    tslaPrice: p.tslaPrice,
    txHash: p.txHash,
    purchase: p,
  }));
  const current: ChargeCycle = {
    number: battery.currentCycle,
    status: "current",
    startedAt: battery.cycleStartedAt,
    completedAt: null,
    feesAccumulatedUsd: battery.currentChargeUsd,
    targetUsd: battery.targetChargeUsd,
    tslaAmount: null,
    tslaPrice: null,
    txHash: null,
    purchase: null,
  };
  return [current, ...completed.reverse()];
}

export interface StreakMetrics {
  /** Duration of the cycle in progress, ms, or null when its start is unknown. */
  activeCycleMs: number | null;
  /** Mean duration of completed cycles with a known start, ms. */
  avgCycleMs: number | null;
  lastPurchaseAt: number | null;
  sampleSize: number;
}

export function deriveStreak(cycles: ChargeCycle[], now: number): StreakMetrics {
  const current = cycles.find((c) => c.status === "current");
  const done = cycles.filter((c) => c.status === "complete" && c.startedAt != null && c.completedAt != null);
  const durations = done.map((c) => (c.completedAt as number) - (c.startedAt as number)).filter((d) => d > 0);
  const last = cycles.filter((c) => c.status === "complete").sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
  return {
    activeCycleMs: current?.startedAt != null && now > 0 ? Math.max(0, now - current.startedAt) : null,
    avgCycleMs: durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    lastPurchaseAt: last?.completedAt ?? null,
    sampleSize: durations.length,
  };
}

/** Reserve value history for the chart: cumulative TSLA after each purchase, valued at the acquisition price when known, else at `markPrice`. */
export function reserveSeries(purchases: ReservePurchase[], markPrice: number | null): Array<{ at: number; tsla: number; usd: number | null; cycle: number }> {
  const chronological = [...purchases].sort((a, b) => a.timestamp - b.timestamp);
  let tsla = 0;
  return chronological.map((p) => {
    tsla += p.tslaAmount;
    const price = p.tslaPrice ?? markPrice;
    return { at: p.timestamp, tsla, usd: price != null ? tsla * price : null, cycle: p.cycle };
  });
}
