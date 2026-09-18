"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CHAIN_ID, RPC_URL } from "@/config/chains";
import { configIssues } from "@/config/contracts";
import { fmtAgo } from "@/lib/format";
import { useMounted, useNow } from "@/lib/hooks";
import { easeOutExpo } from "@/lib/motion";
import { useVolt } from "@/lib/store/volt";
import type { SyncStatus } from "@/types/battery";

const LABEL: Record<SyncStatus, string> = {
  unconfigured: "NOT CONFIGURED",
  syncing: "SYNCING",
  ok: "LIVE",
  stale: "STALE",
  error: "OFFLINE",
};

/**
 * The data indicator in the navbar: LIVE when the chain answers, and the
 * honest word otherwise. Opens a small sheet with the details.
 */
export function StatusBadge() {
  const mounted = useMounted();
  const source = useVolt((s) => s.source);
  const status = useVolt((s) => s.status);
  const error = useVolt((s) => s.error);
  const lastUpdated = useVolt((s) => s.battery.lastUpdated);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const preview = source === "preview";
  const live = status === "ok" && !preview;
  const label = mounted ? (preview ? "PREVIEW" : LABEL[status]) : "…";

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={`chip h-9 px-3 ${live ? "chip-live" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Data status: ${label}`}>
        <span className={`dot ${live ? "dot-live" : ""} ${status === "syncing" || preview ? "animate-charge-pulse" : ""}`} />
        {label}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Data status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.28, ease: easeOutExpo }}
            className="panel absolute right-0 mt-2 w-[300px] p-4 text-sm shadow-[0_30px_60px_-30px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center justify-between">
              <span className="label">DATA</span>
              <span className="mono text-[11px] text-muted">{label}</span>
            </div>
            <p className="mt-3 leading-relaxed text-silver">
              {preview ? (
                <>
                  Pre-launch preview: trades, the battery and the purchases are simulated so the mechanism can be seen before the token exists; prices are real. Once <span className="mono text-ink">NEXT_PUBLIC_VOLT_TOKEN</span> and <span className="mono text-ink">NEXT_PUBLIC_RESERVE_WALLET</span> are set, every figure comes from Robinhood Chain.
                </>
              ) : status === "unconfigured" ? (
                <>
                  No VOLT token or reserve wallet is configured yet. Set <span className="mono text-ink">NEXT_PUBLIC_VOLT_TOKEN</span> and <span className="mono text-ink">NEXT_PUBLIC_RESERVE_WALLET</span>; every figure then comes from Robinhood Chain.
                </>
              ) : status === "error" ? (
                <>{error ?? "The RPC is not answering."}</>
              ) : status === "stale" ? (
                <>{error ?? "The last read is older than expected."}</>
              ) : (
                <>Every figure on this site is read from Robinhood Chain and the configured price source. Nothing is simulated.</>
              )}
            </p>
            <dl className="mono mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-metal pt-3 text-[10px] text-muted">
              <dt>CHAIN</dt>
              <dd className="text-silver">Robinhood Chain · {CHAIN_ID}</dd>
              <dt>RPC</dt>
              <dd className="truncate text-silver">{RPC_URL.replace(/^https?:\/\//, "")}</dd>
              <dt>UPDATED</dt>
              <dd className="text-silver">{lastUpdated && now ? fmtAgo(lastUpdated, now) : "—"}</dd>
            </dl>
            {configIssues.length ? <p className="mono mt-3 text-[10px] text-volt-hot">{configIssues[0].message}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
