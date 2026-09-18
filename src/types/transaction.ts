import type { Hex } from "viem";

export type ActivityKind = "trade" | "battery" | "purchase" | "cycle" | "system";

/** One row of the LIVE CURRENT feed. */
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** Short uppercase headline, e.g. "TRADE". */
  title: string;
  /** The figure, e.g. "+$18.42 BATTERY". */
  value: string;
  /** Epoch ms. */
  at: number;
  txHash?: Hex | null;
}

export interface TradeEvent {
  id: string;
  side: "buy" | "sell";
  /** Quote (ETH) that moved. */
  quoteEth: number;
  quoteUsd: number | null;
  /** The part of the fee that reached the battery, in USD. */
  feeToBatteryUsd: number;
  trader: Hex | null;
  txHash: Hex | null;
  blockNumber: number | null;
  at: number;
}
