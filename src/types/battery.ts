/** Where the battery is in its cycle. `charging` is the resting state. */
export type BatteryPhase = "charging" | "full" | "purchasing" | "confirmed" | "resetting";

/** Data health, independent of the cycle phase. `unconfigured` = no token / reserve wallet set yet. */
export type SyncStatus = "unconfigured" | "syncing" | "ok" | "stale" | "error";

export interface BatteryState {
  /** Fees routed to the reserve and not yet converted, in USD. */
  currentChargeUsd: number;
  /** The charge level at which a TSLA purchase becomes eligible, in USD. */
  targetChargeUsd: number;
  /** 0–100, clamped. */
  percentage: number;
  /** 1-based index of the cycle currently charging. */
  currentCycle: number;
  /** Epoch ms of the last successful read. */
  lastUpdated: number;
  /** Epoch ms when the current cycle started, when known. */
  cycleStartedAt: number | null;
  /** The charge in ETH before conversion. */
  chargeEth?: number;
}

/** A fee that just entered the battery — drives the "+$18.42" popup. */
export interface FeeEvent {
  id: string;
  amountUsd: number;
  at: number;
}
