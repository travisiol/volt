import { voltConfig } from "@/config/volt";
import type { BatteryState } from "@/types/battery";
import type { FeeData, ReservePurchase, ReserveState, VoltTokenInfo } from "@/types/reserve";
import type { ActivityItem, TradeEvent } from "@/types/transaction";
import { fmtCycle } from "@/lib/format";
import { gaussian, logNormal, mulberry32, type Rng } from "./prng";

const HOUR = 3_600_000;
const MIN = 60_000;

export interface PreviewSeed {
  battery: BatteryState;
  reserve: ReserveState;
  purchases: ReservePurchase[];
  activity: ActivityItem[];
  trades: TradeEvent[];
  volt: VoltTokenInfo;
  feeData: FeeData;
  rng: Rng;
}

/**
 * The opening state of the pre-launch preview: cycle 24 charging at 82.1 %,
 * 23 completed cycles behind it spread over the last few days, a short feed.
 * Prices are the real ones (passed in); everything else is generated from
 * the seed and carries no transaction hash.
 */
export function buildPreviewSeed(now: number, tslaPrice: number, ethPrice: number, seed = voltConfig.preview.seed): PreviewSeed {
  const rng = mulberry32(seed);
  const cfg = voltConfig.preview;
  const target = voltConfig.targetChargeUsd;
  const cycles = cfg.startCycle - 1;

  // Walk backwards from the current cycle start: each completed cycle took 1h–4h.
  const cycleStartedAt = now - (1 * HOUR + 52 * MIN);
  const purchases: ReservePurchase[] = [];
  let t = cycleStartedAt;
  let price = tslaPrice;
  for (let c = cycles; c >= 1; c--) {
    purchases.push({
      id: `preview-cycle-${c}`,
      cycle: c,
      timestamp: t,
      amountUsd: target,
      tslaAmount: target / price,
      tslaPrice: price,
      txHash: null,
      status: "confirmed",
    });
    price = price * (1 - 0.004 * gaussian(rng) - 0.0015);
    t -= (1.3 + rng() * 2.4) * HOUR;
  }
  const balance = purchases.reduce((s, p) => s + p.tslaAmount, 0);
  const reserve: ReserveState = {
    reserveValueUsd: balance * tslaPrice,
    tslaTokenBalance: balance,
    totalCycles: cycles,
    totalFeesRouted: cycles * target + cfg.startChargeUsd,
    lastPurchase: purchases[0],
    lastUpdated: now,
  };

  const battery: BatteryState = {
    currentChargeUsd: cfg.startChargeUsd,
    targetChargeUsd: target,
    percentage: (cfg.startChargeUsd / target) * 100,
    currentCycle: cfg.startCycle,
    lastUpdated: now,
    cycleStartedAt,
  };

  // A recent minute of feed: three trades, one checkpoint, the last purchase.
  const trades: TradeEvent[] = [];
  const activity: ActivityItem[] = [];
  for (const ago of [8_000, 19_000, 44_000]) {
    const fee = Math.round(logNormal(rng, 11, 0.7) * 100) / 100;
    const quoteEth = fee / ethPrice / 0.007;
    const at = now - ago;
    trades.push({ id: `preview-trade-${ago}`, side: rng() > 0.4 ? "buy" : "sell", quoteEth, quoteUsd: quoteEth * ethPrice, feeToBatteryUsd: fee, trader: null, txHash: null, blockNumber: null, at });
    activity.push({ id: `preview-act-trade-${ago}`, kind: "trade", title: "TRADE", value: `+$${fee.toFixed(2)} BATTERY`, at, txHash: null });
  }
  activity.push({ id: "preview-act-checkpoint", kind: "battery", title: "BATTERY", value: `${(battery.percentage - 1.3).toFixed(2)}%`, at: now - 31_000, txHash: null });
  activity.push({ id: "preview-act-purchase", kind: "purchase", title: "RESERVE PURCHASE", value: `+$${target.toLocaleString("en-US")} TSLA`, at: cycleStartedAt, txHash: null });
  activity.push({ id: "preview-act-cycle", kind: "cycle", title: "NEW CYCLE", value: `CYCLE ${fmtCycle(cfg.startCycle)} STARTED`, at: cycleStartedAt + 4_000, txHash: null });
  activity.sort((a, b) => b.at - a.at);

  const volt: VoltTokenInfo = {
    address: "0x0000000000000000000000000000000000000000",
    name: "VOLT",
    symbol: "VOLT",
    decimals: 18,
    totalSupply: 1_000_000_000,
    curve: null,
    graduated: null,
    priceEth: null,
  };

  // The split a Pons V2 launch implements: 1 % base fee, 70 % of it to the creator (the reserve), no extra tax.
  const feeData: FeeData = { feeBps: 100, creatorTaxBps: 0, protocolShareBps: 3000, toBatteryBps: 70, accruingOnCurveEth: null, claimableEth: null };

  return { battery, reserve, purchases, activity, trades, volt, feeData, rng };
}
