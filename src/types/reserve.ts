import type { Hex } from "viem";

export type PurchaseStatus = "confirmed" | "pending" | "failed";

/** One TSLA acquisition by the reserve. Fields that are not knowable stay null — never invented. */
export interface ReservePurchase {
  id: string;
  cycle: number;
  /** Epoch ms. */
  timestamp: number;
  /** USD spent, when it can be decoded from the venue; otherwise null. */
  amountUsd: number | null;
  tslaAmount: number;
  /** Acquisition price in USD per TSLA, when known. */
  tslaPrice: number | null;
  /** The transaction that moved the TSLA into the reserve. */
  txHash: Hex | null;
  status: PurchaseStatus;
  blockNumber?: number;
  /** Who sent the TSLA to the reserve (executor or venue). */
  from?: Hex;
}

export interface ReserveState {
  /** Balance × TSLA price. Null when no price source is available. */
  reserveValueUsd: number | null;
  tslaTokenBalance: number;
  totalCycles: number;
  /** Everything ever routed into the battery, in USD, when the history allows the sum. */
  totalFeesRouted: number | null;
  lastPurchase: ReservePurchase | null;
  lastUpdated: number;
}

export type CycleStatus = "current" | "complete";

/** A charge cycle: the current one, or a completed one that ended in a purchase. */
export interface ChargeCycle {
  number: number;
  status: CycleStatus;
  startedAt: number | null;
  completedAt: number | null;
  /** USD accumulated during the cycle (the target for completed ones, the live charge for the current). */
  feesAccumulatedUsd: number | null;
  targetUsd: number;
  tslaAmount: number | null;
  tslaPrice: number | null;
  txHash: Hex | null;
  purchase: ReservePurchase | null;
}

/** Facts about the VOLT token itself, read from its contract and bonding curve. */
export interface VoltTokenInfo {
  address: Hex;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  /** Pons V2 curve, when the token was launched there. */
  curve: Hex | null;
  graduated: boolean | null;
  /** Spot price in ETH per VOLT from the curve reserves, when available. */
  priceEth: number | null;
}

/** How a trade's fee is split, as implemented by the venue. Basis points of the trade's quote amount. */
export interface FeeData {
  /** Base venue fee on every trade. */
  feeBps: number;
  /** Extra creator tax configured at launch. */
  creatorTaxBps: number;
  /** Share of the base fee kept by the venue's protocol. */
  protocolShareBps: number;
  /** What reaches the battery per unit traded, in bps of the quote. */
  toBatteryBps: number;
  /** Fees accrued on the curve, not yet swept, in ETH. */
  accruingOnCurveEth: number | null;
  /** Fees swept to escrow and claimable by the reserve, in ETH. */
  claimableEth: number | null;
}
