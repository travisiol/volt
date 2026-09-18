"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { explorer } from "@/config/chains";
import { Num } from "@/components/ui/Num";
import { fmtAmount, fmtCycle, fmtDateTime, fmtDuration, fmtUsd, shortHash } from "@/lib/format";
import { easeOutExpo } from "@/lib/motion";
import { deriveCycles } from "@/lib/reserve/cycles";
import { useVolt } from "@/lib/store/volt";
import type { ChargeCycle } from "@/types/reserve";

/**
 * CHARGE CYCLES: the current one on top, completed ones below. A completed
 * cycle opens to show what is actually known about it — nothing more.
 */
export function CycleList({ limit, className = "" }: { limit?: number; className?: string }) {
  const purchases = useVolt((s) => s.purchases);
  const battery = useVolt((s) => s.battery);
  const phase = useVolt((s) => s.phase);
  const cycles = deriveCycles(purchases, battery);
  const shown = limit ? cycles.slice(0, limit) : cycles;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h3 className="label">CHARGE CYCLES</h3>
        <span className="mono text-[11px] text-muted">{purchases.length} complete</span>
      </div>
      <ul className="mt-3 flex flex-col">
        {shown.map((c) => (
          <li key={`${c.status}-${c.number}`} className="border-t border-metal last:border-b">
            {c.status === "current" ? (
              <CurrentRow cycle={c} resetting={phase === "resetting"} />
            ) : (
              <CompletedRow cycle={c} open={open === c.number} onToggle={() => setOpen(open === c.number ? null : c.number)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurrentRow({ cycle, resetting }: { cycle: ChargeCycle; resetting: boolean }) {
  const pct = cycle.targetUsd > 0 ? Math.min(100, ((cycle.feesAccumulatedUsd ?? 0) / cycle.targetUsd) * 100) : 0;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
      <div className="mono w-24 text-[12px] text-ink">CYCLE {fmtCycle(cycle.number)}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="display-wide text-[11px] tracking-[0.16em] text-volt-hot">CURRENT</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-metal">
            <motion.span className="block h-full bg-volt" animate={{ width: `${resetting ? 0 : pct}%` }} transition={{ duration: 0.8, ease: easeOutExpo }} />
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="num text-lg leading-none">
          <Num value={resetting ? 0 : pct} format={(v) => `${v.toFixed(0)}%`} />
        </div>
        <div className="mono mt-1 text-[11px] text-muted">
          <Num value={resetting ? 0 : (cycle.feesAccumulatedUsd ?? 0)} format={(v) => fmtUsd(v, 0)} /> / {fmtUsd(cycle.targetUsd, 0)}
        </div>
      </div>
    </div>
  );
}

function CompletedRow({ cycle, open, onToggle }: { cycle: ChargeCycle; open: boolean; onToggle: () => void }) {
  const p = cycle.purchase;
  const headline = cycle.feesAccumulatedUsd != null ? `+${fmtUsd(cycle.feesAccumulatedUsd, 0)} TSLA` : `+${fmtAmount(cycle.tslaAmount, 4)} TSLA`;
  return (
    <div>
      <button type="button" className="metal-hover grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 py-4 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="mono w-24 text-[12px] text-silver">CYCLE {fmtCycle(cycle.number)}</div>
        <div className="flex items-center gap-3">
          <span className="display-wide text-[11px] tracking-[0.16em] text-muted">COMPLETE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-lg">{headline}</span>
          <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: easeOutExpo }} className="overflow-hidden">
            <dl className="mono grid grid-cols-2 gap-x-6 gap-y-3 pb-5 text-[12px] sm:grid-cols-3">
              <Field label="CYCLE START" value={cycle.startedAt ? fmtDateTime(cycle.startedAt) : "—"} />
              <Field label="COMPLETION" value={cycle.completedAt ? fmtDateTime(cycle.completedAt) : "—"} />
              <Field label="CHARGE TIME" value={cycle.startedAt && cycle.completedAt ? fmtDuration(cycle.completedAt - cycle.startedAt) : "—"} />
              <Field label="FEES ACCUMULATED" value={cycle.feesAccumulatedUsd != null ? fmtUsd(cycle.feesAccumulatedUsd) : "not reported"} />
              <Field label="TSLA PURCHASED" value={cycle.tslaAmount != null ? `${fmtAmount(cycle.tslaAmount, 4)} TSLA` : "—"} />
              <Field label="AVG ACQUISITION PRICE" value={cycle.tslaPrice != null ? fmtUsd(cycle.tslaPrice) : "not reported"} />
              <div className="col-span-2 sm:col-span-3">
                <dt className="label text-[9px]">TRANSACTION</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {p?.txHash ? (
                    <a href={explorer.tx(p.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-ink hover:text-volt-hot">
                      {shortHash(p.txHash)} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label text-[9px]">{label}</dt>
      <dd className="mt-1 text-silver">{value}</dd>
    </div>
  );
}
