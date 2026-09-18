import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { RESERVE_WALLET, VOLT_TOKEN } from "@/config/contracts";
import { voltConfig } from "@/config/volt";
import { describeRpcError, getBatteryState, getFeeData, getReserveActivity, getReserveBalance, getReservePurchases, getVoltTokenInfo, publicClient } from "@/lib/blockchain";
import { isSequenceRunning, runPurchaseSequence } from "@/lib/battery/machine";
import { fetchPrices } from "@/lib/pricing/client";
import { useVolt, type VoltStore } from "@/lib/store/volt";
import type { ChargeBreakdown } from "@/lib/blockchain/readBattery";

/**
 * Polls the chain and the price layer on their own cadences and writes
 * normalized state into the store. Only actual on-chain values ever enter
 * the store from here — no simulation, no smoothing of the truth.
 *
 * The signature moment is triggered by what the chain shows: a new TSLA
 * inflow to the reserve wallet plays full → confirmed → reset.
 */
export class LiveSync {
  private running = false;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private lastTradeBlock: bigint | null = null;
  private scannedToBlock: bigint | null = null;
  private seeded = false;
  breakdown: ChargeBreakdown | null = null;

  constructor(
    private readonly qc: QueryClient,
    private readonly store: () => VoltStore = useVolt.getState,
  ) {}

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.running || !VOLT_TOKEN || !RESERVE_WALLET) return;
    this.running = true;
    this.store().setStatus("syncing");
    void this.boot();
  }

  /** Prices and token facts first — the battery cannot be valued without them — then the polling loops. */
  private async boot() {
    await Promise.allSettled([this.syncPrices(), this.syncToken()]);
    if (!this.running) return;
    void this.loop("prices", voltConfig.polling.priceMs, () => this.syncPrices());
    void this.loop("token", 60_000, () => this.syncToken());
    void this.loop("reserve", voltConfig.polling.reserveMs, () => this.syncReserve());
    void this.loop("battery", voltConfig.polling.batteryMs, () => this.syncBattery());
    void this.loop("trades", voltConfig.polling.tradesMs, () => this.syncTrades());
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** RETRY from an error notice: run every read once, now. */
  async refresh() {
    this.store().setStatus("syncing");
    await Promise.allSettled([this.syncPrices(), this.syncToken(), this.syncReserve(), this.syncBattery(), this.syncTrades()]);
  }

  private async loop(name: string, everyMs: number, fn: () => Promise<void>) {
    if (!this.running) return;
    try {
      await fn();
    } catch (e) {
      this.store().setStatus("error", describeRpcError(e));
    }
    if (!this.running) return;
    this.timers.push(setTimeout(() => void this.loop(name, everyMs, fn), everyMs));
  }

  private fetch<T>(key: unknown[], fn: () => Promise<T>, staleMs: number) {
    return this.qc.fetchQuery({ queryKey: key, queryFn: fn, staleTime: staleMs });
  }

  private async syncPrices() {
    const book = await this.fetch(["prices"], () => fetchPrices(["TSLA", "ETH"]), 20_000);
    const s = this.store();
    s.setPrices(book);
    const tsla = book.TSLA ?? s.prices.TSLA;
    if (tsla) s.setReserve({ reserveValueUsd: s.reserve.tslaTokenBalance * tsla.price, lastUpdated: Date.now() });
  }

  private async syncToken() {
    const info = await this.fetch(["volt", VOLT_TOKEN], () => getVoltTokenInfo(VOLT_TOKEN as Address), 30_000);
    const s = this.store();
    s.setVolt(info);
    if (info.curve) s.setFeeData(await this.fetch(["fees", info.curve], () => getFeeData(info.curve as Address, RESERVE_WALLET), 30_000));
  }

  private async syncReserve() {
    const wallet = RESERVE_WALLET as Address;
    // First pass scans from the configured start block; later passes only the blocks since.
    const fromBlock = this.scannedToBlock === null ? voltConfig.reserveStartBlock : this.scannedToBlock + 1n;
    const known = this.store().purchases.length;
    const [balance, scan] = await Promise.all([
      this.fetch(["reserveBalance", wallet], () => getReserveBalance(wallet), 5_000),
      this.fetch(["purchases", wallet, fromBlock.toString()], () => getReservePurchases(wallet, fromBlock, undefined, known), 5_000),
    ]);
    this.scannedToBlock = scan.toBlock;
    // Read the store after the awaits: prices may have landed meanwhile.
    const s = this.store();
    const tsla = s.prices.TSLA;
    const ids = new Set(s.purchases.map((p) => p.id));
    const fresh = scan.purchases.filter((p) => !ids.has(p.id));
    if (!this.seeded) {
      this.seeded = true;
      s.setPurchases(fresh);
    } else if (fresh.length > 0 && !isSequenceRunning()) {
      // The chain says a purchase happened: play the signature moment on the newest one, add the rest quietly.
      const newest = fresh[fresh.length - 1];
      fresh.slice(0, -1).forEach((p) => s.addPurchase(p));
      void runPurchaseSequence(s, newest, { skipPurchasing: true, nextCycleStartsAt: newest.timestamp });
    }
    const all = this.store().purchases;
    s.setReserve({
      tslaTokenBalance: balance.tslaTokenBalance,
      reserveValueUsd: tsla ? balance.tslaTokenBalance * tsla.price : null,
      totalCycles: all.length,
      lastPurchase: all[0] ?? null,
      lastUpdated: Date.now(),
    });
    s.setStatus("ok");
  }

  private async syncBattery() {
    const s = this.store();
    const wallet = RESERVE_WALLET as Address;
    const eth = s.prices.ETH?.price ?? null;
    const last = s.purchases[0] ?? null;
    const result = await this.fetch(
      ["battery", wallet, eth ?? "no-price", s.volt?.curve ?? "no-curve"],
      () =>
        getBatteryState({
          reserveWallet: wallet,
          curve: s.volt?.curve ?? null,
          creatorShareBps: s.feeData ? 10_000 - s.feeData.protocolShareBps : 7_000,
          ethUsd: eth,
          targetChargeUsd: voltConfig.targetChargeUsd,
          currentCycle: s.purchases.length + 1,
          cycleStartedAt: last?.timestamp ?? null,
        }),
      3_000,
    );
    const { breakdown, ...battery } = result;
    this.breakdown = breakdown;
    if (isSequenceRunning()) return;
    s.setBattery(battery);
    const st = this.store();
    if (eth == null) {
      st.setStatus("stale", "No ETH price source is answering; the charge cannot be valued.");
      return;
    }
    if (battery.currentChargeUsd >= battery.targetChargeUsd && st.phase === "charging") {
      st.setPhase("full");
      st.pushActivity({ kind: "battery", title: "BATTERY", value: "FULL — PURCHASE ELIGIBLE" });
    } else if (battery.currentChargeUsd < battery.targetChargeUsd && st.phase === "full") {
      st.setPhase("charging");
    }
    st.setStatus("ok");
  }

  private async syncTrades() {
    const s = this.store();
    const curve = s.volt?.curve;
    if (!curve) return;
    const client = publicClient();
    const head = await client.getBlockNumber();
    if (this.lastTradeBlock === null) {
      this.lastTradeBlock = head; // start from now: the feed shows what happens from here on
      return;
    }
    if (head <= this.lastTradeBlock) return;
    const trades = await getReserveActivity({
      curve,
      fromBlock: this.lastTradeBlock + 1n,
      toBlock: head,
      toBatteryBps: s.feeData?.toBatteryBps ?? 70,
      ethUsd: s.prices.ETH?.price ?? null,
    });
    this.lastTradeBlock = head;
    for (const t of trades) {
      s.pushTrade(t);
      if (t.feeToBatteryUsd > 0 && !isSequenceRunning()) s.applyFee(t.feeToBatteryUsd, { txHash: t.txHash, at: t.at });
    }
  }
}
