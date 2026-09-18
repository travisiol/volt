"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { LiveCurrent } from "@/components/activity/LiveCurrent";
import { explorer } from "@/config/chains";
import { fmtAgo, fmtEth, fmtUsd, shortAddress, shortHash } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useVolt } from "@/lib/store/volt";
import type { ActivityKind } from "@/types/transaction";

const FILTERS: Array<{ id: ActivityKind | "all"; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "trade", label: "TRADES" },
  { id: "battery", label: "BATTERY" },
  { id: "purchase", label: "PURCHASES" },
  { id: "cycle", label: "CYCLES" },
];

/** /activity — the whole current, and the trades behind it. */
export function ActivityPage() {
  const activity = useVolt((s) => s.activity);
  const trades = useVolt((s) => s.trades);
  const source = useVolt((s) => s.source);
  const now = useNow();
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const rows = filter === "all" ? activity : activity.filter((a) => a.kind === filter);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-28 pb-24 md:px-8 md:pt-36">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-[clamp(44px,6vw,88px)]">ACTIVITY</h1>
          <p className="lead mt-3">Transactions create charge.</p>
        </div>
        <span className={`chip ${source === "chain" ? "chip-live" : ""}`}>{source === "chain" ? "ON-CHAIN" : "PRE-LAUNCH PREVIEW"}</span>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-16">
        <section>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter activity">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`chip h-8 px-3 ${filter === f.id ? "border-silver text-ink" : "hover:text-ink"}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="panel mt-4 p-5">
            <LiveCurrent limit={rows.length ? 40 : 0} showHeader={false} />
            {rows.length === 0 ? <p className="mono py-6 text-center text-[12px] text-muted">Nothing in this filter yet.</p> : null}
          </div>
        </section>

        <section>
          <h2 className="label">TRADES · FEE TO BATTERY</h2>
          <ol className="mt-4 border-t border-metal">
            {trades.length === 0 ? <li className="mono py-8 text-center text-[12px] text-muted">No trades seen yet.</li> : null}
            {trades.slice(0, 40).map((t) => (
              <li key={t.id} className="metal-hover grid grid-cols-[52px_1fr_auto] items-center gap-4 border-b border-metal py-3">
                <span className={`display-wide text-[10px] tracking-[0.16em] ${t.side === "buy" ? "text-ink" : "text-silver"}`}>{t.side.toUpperCase()}</span>
                <span className="mono min-w-0 truncate text-[12px] text-silver">
                  {fmtEth(t.quoteEth)}
                  {t.quoteUsd != null ? <span className="text-muted"> · {fmtUsd(t.quoteUsd)}</span> : null}
                  {t.trader ? <span className="text-muted"> · {shortAddress(t.trader)}</span> : null}
                  {t.txHash ? (
                    <a href={explorer.tx(t.txHash)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-muted hover:text-ink">
                      {shortHash(t.txHash)} <ExternalLink size={10} />
                    </a>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="mono block text-[13px] text-ink">+{fmtUsd(t.feeToBatteryUsd)}</span>
                  <span className="mono block text-[10px] text-muted">{now ? fmtAgo(t.at, now) : "—"}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
