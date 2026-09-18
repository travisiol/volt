import { voltConfig } from "@/config/volt";
import { isSequenceRunning, runPurchaseSequence } from "@/lib/battery/machine";
import { fetchPrices } from "@/lib/pricing/client";
import { useVolt, type VoltStore } from "@/lib/store/volt";
import type { PriceBook } from "@/types/price";
import type { ReservePurchase } from "@/types/reserve";
import { logNormal, type Rng } from "./prng";
import { buildPreviewSeed } from "./seed";

/**
 * PRE-LAUNCH PREVIEW. Runs only while no token and reserve wallet are
 * configured: simulates the loop end to end — trades, fees, the battery
 * filling, the purchase, the reset — on the same store the chain sync feeds
 * later, so every screen behaves identically once the site goes live.
 * Prices are real (from the price layer); nothing here carries a transaction
 * hash, and the status badge says PREVIEW.
 */
export class PreviewEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private priceTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private rng: Rng = Math.random;
  private tslaPrice: number = voltConfig.preview.fallbackTslaPrice;
  private ethPrice: number = voltConfig.preview.fallbackEthPrice;
  private tradesSinceCheckpoint = 0;
  private onVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  constructor(private readonly store: () => VoltStore = useVolt.getState) {}

  get isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    // Real prices first, when the price layer answers; the seed is built on them.
    let book: PriceBook = {};
    try {
      book = await fetchPrices(["TSLA", "ETH"]);
    } catch {
      book = {};
    }
    if (!this.running) return;
    if (book.TSLA) this.tslaPrice = book.TSLA.price;
    if (book.ETH) this.ethPrice = book.ETH.price;
    const seed = buildPreviewSeed(Date.now(), this.tslaPrice, this.ethPrice);
    this.rng = seed.rng;
    useVolt.setState({
      source: "preview",
      status: "ok",
      error: null,
      battery: seed.battery,
      phase: "charging",
      phaseSince: Date.now(),
      reserve: seed.reserve,
      purchases: seed.purchases,
      activity: seed.activity,
      trades: seed.trades,
      fees: [],
      prices: book,
      volt: seed.volt,
      feeData: seed.feeData,
    });
    this.schedule(1_800);
    this.priceTimer = setInterval(() => void this.refreshPrices(), voltConfig.polling.priceMs);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  stop() {
    this.running = false;
    this.pause();
    if (this.priceTimer) clearInterval(this.priceTimer);
    this.priceTimer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private pause() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private resume() {
    if (this.running && !this.timer) this.schedule(1_200);
  }

  private schedule(ms?: number) {
    if (!this.running) return;
    const [lo, hi] = voltConfig.preview.tradeGapMs;
    const gap = ms ?? lo + this.rng() * (hi - lo);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), gap);
  }

  private tick() {
    this.timer = null;
    const s = this.store();
    if (!this.running || s.source !== "preview") return;
    if (s.phase !== "charging" || isSequenceRunning()) {
      this.schedule(1_500);
      return;
    }
    const target = s.battery.targetChargeUsd;
    const remaining = Math.max(0, target - s.battery.currentChargeUsd);
    let fee = Math.round(logNormal(this.rng, 11, 0.75) * 100) / 100;
    fee = Math.min(Math.max(fee, 1.2), 64);
    // The trade that tops the battery lands exactly on the target.
    if (fee >= remaining - 0.005) fee = Math.round(remaining * 100) / 100;
    const quoteEth = fee / this.ethPrice / 0.007;
    const at = Date.now();
    s.applyFee(fee, { at });
    s.pushTrade({ id: `preview-trade-${at}`, side: this.rng() > 0.42 ? "buy" : "sell", quoteEth, quoteUsd: quoteEth * this.ethPrice, feeToBatteryUsd: fee, trader: null, txHash: null, blockNumber: null, at });

    this.tradesSinceCheckpoint++;
    const after = this.store();
    if (after.battery.currentChargeUsd >= target - 1e-6) {
      this.tradesSinceCheckpoint = 0;
      const purchase: ReservePurchase = {
        id: `preview-cycle-${after.battery.currentCycle}`,
        cycle: after.battery.currentCycle,
        timestamp: Date.now() + 2_800,
        amountUsd: target,
        tslaAmount: target / this.tslaPrice,
        tslaPrice: this.tslaPrice,
        txHash: null,
        status: "confirmed",
      };
      void runPurchaseSequence(after, purchase).then(() => {
        const st = this.store();
        const balance = st.reserve.tslaTokenBalance + purchase.tslaAmount;
        st.setReserve({ tslaTokenBalance: balance, reserveValueUsd: balance * this.tslaPrice, totalFeesRouted: (st.reserve.totalFeesRouted ?? 0) + target, lastUpdated: Date.now() });
        this.schedule(2_500);
      });
      return;
    }
    if (this.tradesSinceCheckpoint >= 4) {
      this.tradesSinceCheckpoint = 0;
      s.pushActivity({ kind: "battery", title: "BATTERY", value: `${after.battery.percentage.toFixed(2)}%` });
    }
    this.schedule();
  }

  private async refreshPrices() {
    const s = this.store();
    if (!this.running || s.source !== "preview") return;
    try {
      const book = await fetchPrices(["TSLA", "ETH"]);
      if (book.TSLA) this.tslaPrice = book.TSLA.price;
      if (book.ETH) this.ethPrice = book.ETH.price;
      s.setPrices(book);
      s.setReserve({ reserveValueUsd: s.reserve.tslaTokenBalance * this.tslaPrice, lastUpdated: Date.now() });
    } catch {
      // keep the last prices
    }
  }
}
