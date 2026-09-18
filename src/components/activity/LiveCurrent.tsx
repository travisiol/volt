"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { explorer } from "@/config/chains";
import { fmtAgo, shortHash } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { easeOutExpo } from "@/lib/motion";
import { useVolt } from "@/lib/store/volt";
import type { ActivityItem } from "@/types/transaction";

const KIND_COLOR: Record<ActivityItem["kind"], string> = {
  trade: "text-ink",
  battery: "text-silver",
  purchase: "text-volt-hot",
  cycle: "text-aluminum",
  system: "text-muted",
};

/**
 * LIVE CURRENT: the last few things that happened, sliding up as new ones
 * arrive. Five rows, no chaos.
 */
export function LiveCurrent({ limit = 5, className = "", showHeader = true }: { limit?: number; className?: string; showHeader?: boolean }) {
  const activity = useVolt((s) => s.activity);
  const status = useVolt((s) => s.status);
  const now = useNow();
  const rows = activity.slice(0, limit);

  return (
    <div className={className}>
      {showHeader ? (
        <div className="flex items-center justify-between">
          <h3 className="label flex items-center gap-2">
            <span className={`dot ${status === "ok" ? "dot-live" : ""}`} /> LIVE CURRENT
          </h3>
          <Link href="/activity" className="label hover:text-ink">
            ALL ACTIVITY →
          </Link>
        </div>
      ) : null}
      <ul className={`${showHeader ? "mt-3" : ""} overflow-hidden`} aria-live="polite">
        <AnimatePresence initial={false}>
          {rows.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="grid grid-cols-[92px_1fr_auto] items-center gap-3 border-t border-metal py-3 first:border-t-0 sm:grid-cols-[120px_1fr_auto]"
            >
              <span className="display-wide truncate text-[10px] tracking-[0.16em] text-muted">{a.title}</span>
              <span className={`mono flex min-w-0 items-center gap-2 text-[13px] ${KIND_COLOR[a.kind]}`}>
                <span className="truncate">{a.value}</span>
                {a.txHash ? (
                  <a href={explorer.tx(a.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink" aria-label="View transaction">
                    {shortHash(a.txHash)} <ExternalLink size={10} />
                  </a>
                ) : null}
              </span>
              <span className="mono text-[11px] text-muted">{now ? fmtAgo(a.at, now) : "—"}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {rows.length === 0 ? <li className="mono py-6 text-center text-[12px] text-muted">{status === "unconfigured" ? "Starting the preview…" : "Waiting for the first trade."}</li> : null}
      </ul>
    </div>
  );
}
