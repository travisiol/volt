"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { voltConfig } from "@/config/volt";
import { runPurchaseSequence } from "@/lib/battery/machine";
import { LiveSync } from "@/lib/live/sync";
import { PreviewEngine } from "@/lib/preview/engine";
import { useVolt } from "@/lib/store/volt";

interface QaHooks {
  /** Push the charge to a percentage (visual QA of the fill). */
  fill: (pct: number) => void;
  /** Play the cycle-end sequence once with a synthetic purchase (visual QA of the signature moment). */
  purchase: () => Promise<void>;
  /** Drop a fee popup. */
  fee: (usd: number) => void;
}

declare global {
  interface Window {
    __volt?: { live: LiveSync; preview: PreviewEngine; store: typeof useVolt; qa: QaHooks };
  }
}

/**
 * Starts the chain sync once the token and reserve wallet are configured,
 * the pre-launch preview otherwise. Mounted once, inside the providers;
 * nothing renders. In development builds a QA hook is exposed on window so
 * the animations can be exercised on demand; it is absent from production.
 */
let active: LiveSync | null = null;

export function VoltRuntime() {
  const qc = useQueryClient();
  const live = useRef<LiveSync | null>(null);
  const preview = useRef<PreviewEngine | null>(null);

  useEffect(() => {
    if (!live.current) live.current = new LiveSync(qc);
    if (!preview.current) preview.current = new PreviewEngine();
    const sync = live.current;
    const pre = preview.current;
    active = sync;
    if (voltConfig.configured) sync.start();
    else void pre.start();
    if (process.env.NODE_ENV !== "production") {
      window.__volt = {
        live: sync,
        preview: pre,
        store: useVolt,
        qa: {
          fill: (pct) => useVolt.getState().setBattery({ currentChargeUsd: (useVolt.getState().battery.targetChargeUsd * pct) / 100, lastUpdated: Date.now() }),
          purchase: () => {
            const s = useVolt.getState();
            const price = s.prices.TSLA?.price ?? null;
            s.setBattery({ currentChargeUsd: s.battery.targetChargeUsd });
            return runPurchaseSequence(s, {
              id: `qa-${Date.now()}`,
              cycle: s.battery.currentCycle,
              timestamp: Date.now(),
              amountUsd: s.battery.targetChargeUsd,
              tslaAmount: price ? s.battery.targetChargeUsd / price : 1,
              tslaPrice: price,
              txHash: null,
              status: "confirmed",
            });
          },
          fee: (usd) => useVolt.getState().applyFee(usd),
        },
      };
    }
    return () => {
      sync.stop();
      pre.stop();
    };
  }, [qc]);

  return null;
}

/** RETRY handlers reach the sync through here. */
export function refreshLive() {
  return active?.refresh() ?? Promise.resolve();
}
