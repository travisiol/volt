"use client";

import { LiveCurrent } from "@/components/activity/LiveCurrent";
import { StateNotice } from "@/components/ui/StateNotice";
import { refreshLive } from "@/components/VoltRuntime";
import { fmtAgo, fmtUsd } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useVolt } from "@/lib/store/volt";

/** The landing's technical block: the feed, prices with their source, data health. */
export function ActivitySection() {
  const status = useVolt((s) => s.status);
  const error = useVolt((s) => s.error);
  const prices = useVolt((s) => s.prices);
  const trades = useVolt((s) => s.trades);
  const now = useNow();

  const recentFees = trades.slice(0, 20).reduce((s, t) => s + t.feeToBatteryUsd, 0);

  return (
    <section id="activity" className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="display text-[clamp(36px,5vw,64px)]">LIVE CURRENT</h2>
        <p className="label">TRANSACTIONS CREATE CHARGE.</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="panel p-5 md:p-6">
          <LiveCurrent limit={6} />
        </div>

        <div className="flex flex-col gap-4">
          {status === "error" ? <StateNotice kind="error" title="RESERVE DATA UNAVAILABLE" body={error ?? "Unable to retrieve the reserve state."} onRetry={refreshLive} /> : null}
          {status === "stale" ? <StateNotice kind="stale" title="PRICE FEED DELAYED" body={error ?? "The last price print is older than expected."} onRetry={refreshLive} /> : null}

          <dl className="panel grid grid-cols-2 gap-6 p-5 md:p-6">
            <Stat label="LAST 20 TRADES → BATTERY" value={fmtUsd(recentFees)} />
            <Stat label="TRADES SEEN" value={String(trades.length)} />
            <PriceStat label="TSLA PRICE" quote={prices.TSLA} now={now} />
            <PriceStat label="ETH PRICE" quote={prices.ETH} now={now} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label text-[10px]">{label}</dt>
      <dd className="num mt-2 text-2xl">{value}</dd>
    </div>
  );
}

function PriceStat({ label, quote, now }: { label: string; quote: { price: number; sourceLabel: string; publishedAt: number; stale: boolean } | undefined; now: number }) {
  return (
    <div>
      <dt className="label text-[10px]">{label}</dt>
      <dd className="num mt-2 text-2xl">{quote ? fmtUsd(quote.price) : <span className="text-muted">—</span>}</dd>
      <dd className="mono mt-1 text-[10px] text-muted">
        {quote ? (
          <>
            {quote.sourceLabel} · {now ? fmtAgo(quote.publishedAt, now) : "—"}
            {quote.stale ? <span className="ml-2 text-volt-hot">STALE</span> : null}
          </>
        ) : (
          "no source answering"
        )}
      </dd>
    </div>
  );
}
