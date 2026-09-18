"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Num } from "@/components/ui/Num";
import { fmtCycle, fmtUsd } from "@/lib/format";
import { easeOutExpo } from "@/lib/motion";
import { useVolt } from "@/lib/store/volt";

/**
 * The words on the battery. Percentage and dollars glide; the phase line
 * narrates the signature moment: FULL → PURCHASING → +$1,000 → NEW CYCLE.
 */
export function BatteryHud({ compact = false, align = "center" }: { compact?: boolean; align?: "left" | "center" }) {
  const pct = useVolt((s) => s.battery.percentage);
  const charge = useVolt((s) => s.battery.currentChargeUsd);
  const target = useVolt((s) => s.battery.targetChargeUsd);
  const cycle = useVolt((s) => s.battery.currentCycle);
  const phase = useVolt((s) => s.phase);
  const last = useVolt((s) => s.purchases[0] ?? null);
  const status = useVolt((s) => s.status);
  const source = useVolt((s) => s.source);

  const showPct = phase === "resetting" ? 0 : pct;
  const showCharge = phase === "resetting" ? 0 : charge;
  const left = align === "left";

  return (
    <div className={`flex flex-col ${left ? "items-start text-left" : "items-center text-center"} ${compact ? "gap-1" : "gap-2"}`}>
      <div className="label flex items-center gap-3">
        {left ? null : (
          <>
            <span>BATTERY</span>
            <span className="text-muted-2">·</span>
          </>
        )}
        <span>CYCLE {fmtCycle(cycle)}</span>
        {source === "preview" ? (
          <>
            <span className="text-muted-2">·</span>
            <span className="text-muted-2">PREVIEW</span>
          </>
        ) : null}
      </div>
      <div className={`num text-ink ${compact ? "text-[56px]" : "text-[clamp(64px,7vw,104px)]"} leading-none`}>
        <Num value={showPct} format={(v) => `${v.toFixed(1)}%`} rate={phase === "resetting" ? 3 : 6} />
      </div>
      <div className="label mt-1">NEXT TSLA PURCHASE</div>
      <div className="mono text-[15px] text-aluminum">
        <Num value={showCharge} format={(v) => fmtUsd(v)} rate={phase === "resetting" ? 3 : 6} /> <span className="text-muted">/ {fmtUsd(target, 0)}</span>
      </div>

      <div className="relative mt-3 h-12 w-full">
        <AnimatePresence mode="wait">
          {phase !== "charging" || status === "syncing" || (status === "unconfigured" && source !== "preview") ? (
            <motion.div
              key={phase === "charging" ? status : phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: easeOutExpo }}
              className={`absolute inset-x-0 top-0 flex flex-col gap-1.5 ${left ? "items-start" : "items-center"}`}
              role="status"
              aria-live="polite"
            >
              {status === "syncing" && phase === "charging" ? (
                <>
                  <span className="display-wide text-[13px] tracking-[0.2em] text-silver">BATTERY SYNCING</span>
                  <span className="label normal-case tracking-normal">Waiting for the latest block.</span>
                </>
              ) : null}
              {status === "unconfigured" && source !== "preview" && phase === "charging" ? (
                <>
                  <span className="display-wide text-[13px] tracking-[0.2em] text-silver">AWAITING LAUNCH</span>
                  <span className="label normal-case tracking-normal">Token and reserve wallet not configured.</span>
                </>
              ) : null}
              {phase === "full" ? (
                <>
                  <span className="display-wide text-[15px] tracking-[0.22em] text-energy">BATTERY FULL</span>
                  <span className="label">PURCHASE ELIGIBLE · AWAITING EXECUTOR</span>
                </>
              ) : null}
              {phase === "purchasing" ? (
                <>
                  <span className="display-wide text-[15px] tracking-[0.22em] text-ink">PURCHASING TSLA</span>
                  <Processing />
                </>
              ) : null}
              {phase === "confirmed" ? (
                <>
                  <span className="display-wide text-[15px] tracking-[0.22em] text-volt-hot">{last?.amountUsd != null ? `+${fmtUsd(last.amountUsd, 0)} TSLA` : `+${last?.tslaAmount.toFixed(4) ?? "—"} TSLA`}</span>
                  <span className="label">RESERVE UPDATED</span>
                </>
              ) : null}
              {phase === "resetting" ? <span className="display-wide text-[13px] tracking-[0.22em] text-silver">NEW CYCLE STARTED</span> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A thin indeterminate line — the processing indicator. */
function Processing() {
  return (
    <span className="relative block h-px w-24 overflow-hidden bg-metal-2" aria-hidden>
      <motion.span className="absolute inset-y-0 w-10 bg-energy" initial={{ x: -48 }} animate={{ x: 104 }} transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }} />
    </span>
  );
}
