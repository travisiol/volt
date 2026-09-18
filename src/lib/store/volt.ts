import { create } from "zustand";
import { voltConfig } from "@/config/volt";
import type { BatteryPhase, BatteryState, FeeEvent, SyncStatus } from "@/types/battery";
import type { PriceBook } from "@/types/price";
import type { FeeData, ReservePurchase, ReserveState, VoltTokenInfo } from "@/types/reserve";
import type { ActivityItem, TradeEvent } from "@/types/transaction";
import { clamp } from "@/lib/format";

const ACTIVITY_CAP = 80;
const FEE_POPUP_CAP = 6;
const TRADES_CAP = 200;

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const emptyBattery = (): BatteryState => ({
  currentChargeUsd: 0,
  targetChargeUsd: voltConfig.targetChargeUsd,
  percentage: 0,
  currentCycle: 1,
  lastUpdated: 0,
  cycleStartedAt: null,
});

export const emptyReserve = (): ReserveState => ({
  reserveValueUsd: null,
  tslaTokenBalance: 0,
  totalCycles: 0,
  totalFeesRouted: null,
  lastPurchase: null,
  lastUpdated: 0,
});

const withPercentage = (b: BatteryState): BatteryState => ({
  ...b,
  percentage: b.targetChargeUsd > 0 ? clamp((b.currentChargeUsd / b.targetChargeUsd) * 100, 0, 100) : 0,
});

/**
 * The one store every screen reads. The chain sync writes into it once the
 * site is configured, the pre-launch preview before that; the WebGL scenes
 * read it per frame without subscribing.
 */
/** Where the figures come from: the chain, or the pre-launch preview while nothing is configured. */
export type DataSource = "chain" | "preview";

export interface VoltStore {
  source: DataSource;
  status: SyncStatus;
  error: string | null;

  battery: BatteryState;
  phase: BatteryPhase;
  phaseSince: number;
  /** Set for ~300 ms when the battery reaches 100 %; the scene reads it for the white-hot flash. */
  flashAt: number;

  reserve: ReserveState;
  purchases: ReservePurchase[];
  trades: TradeEvent[];
  activity: ActivityItem[];
  /** Recent fee popups ("+$18.42") for the hero. */
  fees: FeeEvent[];
  prices: PriceBook;
  volt: VoltTokenInfo | null;
  feeData: FeeData | null;

  setStatus: (status: SyncStatus, error?: string | null) => void;
  setBattery: (patch: Partial<BatteryState>) => void;
  setPhase: (phase: BatteryPhase) => void;
  flash: () => void;
  /** A fee entered the battery: charge rises, a popup appears, the feed gets a row. */
  applyFee: (amountUsd: number, meta?: { txHash?: ActivityItem["txHash"]; at?: number; silent?: boolean }) => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "at"> & { at?: number }) => void;
  pushTrade: (trade: TradeEvent) => void;
  setReserve: (patch: Partial<ReserveState>) => void;
  setPurchases: (list: ReservePurchase[]) => void;
  addPurchase: (purchase: ReservePurchase) => void;
  setPrices: (book: PriceBook) => void;
  setVolt: (info: VoltTokenInfo | null) => void;
  setFeeData: (fd: FeeData | null) => void;
  /** Wipe everything data-related (a fresh sync). */
  resetData: () => void;
}

export const useVolt = create<VoltStore>()((set) => ({
  source: voltConfig.configured ? "chain" : "preview",
  status: voltConfig.configured ? "syncing" : "unconfigured",
  error: null,

  battery: emptyBattery(),
  phase: "charging",
  phaseSince: 0,
  flashAt: 0,

  reserve: emptyReserve(),
  purchases: [],
  trades: [],
  activity: [],
  fees: [],
  prices: {},
  volt: null,
  feeData: null,

  setStatus: (status, error = null) => set({ status, error }),
  setBattery: (patch) => set((s) => ({ battery: withPercentage({ ...s.battery, ...patch }) })),
  setPhase: (phase) => set({ phase, phaseSince: Date.now() }),
  flash: () => set({ flashAt: Date.now() }),

  applyFee: (amountUsd, meta = {}) => {
    if (!(amountUsd > 0)) return;
    const at = meta.at ?? Date.now();
    set((s) => {
      const battery = withPercentage({ ...s.battery, currentChargeUsd: s.battery.currentChargeUsd + amountUsd, lastUpdated: at });
      const fee: FeeEvent = { id: nextId("fee"), amountUsd, at };
      const row: ActivityItem = {
        id: nextId("act"),
        kind: "trade",
        title: "TRADE",
        value: `+$${amountUsd.toFixed(2)} BATTERY`,
        at,
        txHash: meta.txHash ?? null,
      };
      return {
        battery,
        fees: [...s.fees, fee].slice(-FEE_POPUP_CAP),
        activity: meta.silent ? s.activity : [row, ...s.activity].slice(0, ACTIVITY_CAP),
      };
    });
  },

  pushActivity: (item) =>
    set((s) => ({
      activity: [{ ...item, id: nextId("act"), at: item.at ?? Date.now() }, ...s.activity].slice(0, ACTIVITY_CAP),
    })),
  pushTrade: (trade) => set((s) => ({ trades: [trade, ...s.trades].slice(0, TRADES_CAP) })),

  setReserve: (patch) => set((s) => ({ reserve: { ...s.reserve, ...patch } })),
  setPurchases: (list) =>
    set((s) => {
      const sorted = [...list].sort((a, b) => b.timestamp - a.timestamp);
      return { purchases: sorted, reserve: { ...s.reserve, totalCycles: sorted.length, lastPurchase: sorted[0] ?? null } };
    }),
  addPurchase: (purchase) =>
    set((s) => {
      if (s.purchases.some((p) => p.id === purchase.id)) return {};
      const purchases = [purchase, ...s.purchases];
      return { purchases, reserve: { ...s.reserve, totalCycles: purchases.length, lastPurchase: purchase } };
    }),
  setPrices: (book) => set((s) => ({ prices: { ...s.prices, ...book } })),
  setVolt: (volt) => set({ volt }),
  setFeeData: (feeData) => set({ feeData }),

  resetData: () =>
    set({
      status: voltConfig.configured ? "syncing" : "unconfigured",
      error: null,
      battery: emptyBattery(),
      phase: "charging",
      phaseSince: 0,
      flashAt: 0,
      reserve: emptyReserve(),
      purchases: [],
      trades: [],
      activity: [],
      fees: [],
      prices: {},
      volt: null,
      feeData: null,
    }),
}));

/** Non-React access for engines and the WebGL frame loop (no re-render, no subscription). */
export const getVolt = () => useVolt.getState();

/** Derived: how much is left before the next purchase. */
export const remainingUsd = (b: BatteryState) => Math.max(0, b.targetChargeUsd - b.currentChargeUsd);
