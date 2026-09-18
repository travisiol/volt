"use client";

import { fmtAgo, fmtDuration } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { deriveCycles, deriveStreak } from "@/lib/reserve/cycles";
import { useVolt } from "@/lib/store/volt";

/** ACTIVE CYCLE · AVG CHARGE TIME · LAST PURCHASE — movement without gamification. */
export function Streak({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const purchases = useVolt((s) => s.purchases);
  const battery = useVolt((s) => s.battery);
  const now = useNow();
  const streak = deriveStreak(deriveCycles(purchases, battery), now);

  const items = [
    { label: "ACTIVE CYCLE", value: streak.activeCycleMs != null ? fmtDuration(streak.activeCycleMs) : "—" },
    { label: "AVG CHARGE TIME", value: streak.avgCycleMs != null ? fmtDuration(streak.avgCycleMs) : "—", note: streak.sampleSize ? `${streak.sampleSize} cycles` : undefined },
    { label: "LAST PURCHASE", value: streak.lastPurchaseAt && now ? fmtAgo(streak.lastPurchaseAt, now) : "—" },
  ];

  return (
    <dl className={`grid ${compact ? "grid-cols-1 gap-3" : "grid-cols-3 gap-4"} ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="border-l border-metal pl-4">
          <dt className="label text-[10px]">{it.label}</dt>
          <dd className="mono mt-2 text-[15px] text-ink sm:text-lg">{it.value}</dd>
          {it.note ? <dd className="mono mt-0.5 text-[10px] text-muted">{it.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
