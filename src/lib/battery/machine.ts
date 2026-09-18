import type { BatteryPhase } from "@/types/battery";
import type { ReservePurchase } from "@/types/reserve";
import type { VoltStore } from "@/lib/store/volt";
import { fmtAmount, fmtCycle, fmtUsd } from "@/lib/format";

/**
 * The battery state machine.
 *
 *   charging ──(charge ≥ target)──▶ full ──(purchase executed)──▶ purchasing
 *   purchasing ──(tx confirmed)──▶ confirmed ──▶ resetting ──▶ charging (next cycle)
 *
 * `full` waits for the authorized executor (the site never buys anything
 * itself); a new TSLA inflow to the reserve wallet is what moves the machine
 * on to `confirmed`. The purchasing step is only shown when a pending
 * transaction is actually known.
 */

export type BatteryEvent = "charge_reached" | "purchase_started" | "purchase_confirmed" | "purchase_failed" | "reset_done" | "charge_dropped";

export function nextPhase(phase: BatteryPhase, event: BatteryEvent): BatteryPhase {
  switch (phase) {
    case "charging":
      return event === "charge_reached" ? "full" : phase;
    case "full":
      if (event === "purchase_started") return "purchasing";
      if (event === "purchase_confirmed") return "confirmed";
      if (event === "charge_dropped") return "charging";
      return phase;
    case "purchasing":
      if (event === "purchase_confirmed") return "confirmed";
      if (event === "purchase_failed") return "full";
      return phase;
    case "confirmed":
      return event === "reset_done" ? "resetting" : phase;
    case "resetting":
      return event === "reset_done" ? "charging" : phase;
  }
}

/** Timeline of the signature moment, in milliseconds. Slow enough to feel expensive, fast enough to stay responsive. */
export const SEQUENCE = {
  /** BATTERY FULL is shown, the cell goes white-hot for ~300 ms. */
  fullMs: 900,
  /** PURCHASING TSLA with a processing indicator (only when a pending transaction is known). */
  purchasingMs: 1_900,
  /** +$1,000 TSLA · RESERVE UPDATED, the lock animation. */
  confirmedMs: 1_700,
  /** The charge drains back to 0 %. */
  resettingMs: 1_500,
} as const;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))), { once: true });
  });

let current: AbortController | null = null;

export const isSequenceRunning = () => current !== null;

/**
 * Plays the full cycle end on the store: full → purchasing → confirmed →
 * resetting → charging. `purchase` is what actually happened on the chain.
 * Returns when the new cycle has started.
 */
export async function runPurchaseSequence(
  store: Pick<VoltStore, "setPhase" | "flash" | "pushActivity" | "addPurchase" | "setReserve" | "setBattery" | "phase" | "battery" | "reserve">,
  purchase: ReservePurchase,
  opts: { skipPurchasing?: boolean; nextCycleStartsAt?: number } = {},
): Promise<void> {
  current?.abort();
  const ctrl = new AbortController();
  current = ctrl;
  const { signal } = ctrl;
  try {
    store.setPhase("full");
    store.flash();
    store.pushActivity({ kind: "battery", title: "BATTERY", value: "FULL — 100%" });
    await sleep(SEQUENCE.fullMs, signal);

    if (!opts.skipPurchasing) {
      store.setPhase("purchasing");
      store.pushActivity({ kind: "purchase", title: "PURCHASING", value: "TSLA STOCK TOKEN" });
      await sleep(SEQUENCE.purchasingMs, signal);
    }

    store.setPhase("confirmed");
    store.addPurchase(purchase);
    const value = purchase.amountUsd != null ? `+${fmtUsd(purchase.amountUsd, 0)} TSLA` : `+${fmtAmount(purchase.tslaAmount, 4)} TSLA`;
    store.pushActivity({ kind: "purchase", title: "RESERVE PURCHASE", value, txHash: purchase.txHash, at: purchase.timestamp });
    await sleep(SEQUENCE.confirmedMs, signal);

    store.setPhase("resetting");
    store.setBattery({ currentChargeUsd: 0 });
    await sleep(SEQUENCE.resettingMs, signal);

    const startedAt = opts.nextCycleStartsAt ?? Date.now();
    store.setBattery({ currentCycle: purchase.cycle + 1, cycleStartedAt: startedAt, lastUpdated: startedAt });
    store.setPhase("charging");
    store.pushActivity({ kind: "cycle", title: "NEW CYCLE", value: `CYCLE ${fmtCycle(purchase.cycle + 1)} STARTED`, at: startedAt });
  } catch (e) {
    if ((e as Error).message !== "aborted") throw e;
  } finally {
    if (current === ctrl) current = null;
  }
}

export function cancelSequence() {
  current?.abort();
  current = null;
}
