"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CycleList } from "@/components/reserve/CycleList";
import { Streak } from "@/components/reserve/Streak";
import { Num } from "@/components/ui/Num";
import { SceneBoundary } from "@/components/ui/SceneBoundary";
import { fmtAmount, fmtUsd } from "@/lib/format";
import { useVolt } from "@/lib/store/volt";

const ReserveRack = dynamic(() => import("./ReserveRack"), { ssr: false, loading: () => <RackFallback /> });

/** THE RESERVE — the figure, the rack, the latest cycles, the streak. */
export function ReserveSection() {
  const reserve = useVolt((s) => s.reserve);
  const tsla = useVolt((s) => s.prices.TSLA);
  const count = useVolt((s) => s.purchases.length);

  return (
    <section id="reserve" className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col">
          <h2 className="display text-[clamp(40px,5.5vw,72px)]">THE RESERVE</h2>
          <p className="lead mt-3">Built one charge at a time.</p>

          <div className="mt-12">
            <div className="label">TSLA RESERVE</div>
            <div className="num mt-3 text-[clamp(52px,6vw,88px)] leading-none">{reserve.reserveValueUsd != null ? <Num value={reserve.reserveValueUsd} format={(v) => fmtUsd(v)} rate={4} /> : <span className="text-muted">—</span>}</div>
            <div className="mono mt-3 text-lg text-silver">
              <Num value={reserve.tslaTokenBalance} format={(v) => fmtAmount(v, 4)} rate={4} /> TSLA
              {tsla ? <span className="ml-3 text-muted">@ {fmtUsd(tsla.price)}</span> : null}
            </div>
          </div>

          <Streak className="mt-10" />

          <Link href="/reserve" className="btn btn-ghost mt-10 w-fit">
            OPEN THE RESERVE <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="flex flex-col gap-8">
          <div className="panel-metal relative h-[360px] overflow-hidden rounded-lg sm:h-[440px] lg:h-[520px]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.05),transparent_60%)]" />
            <SceneBoundary fallback={<RackFallback />}>
              <ReserveRack className="h-full w-full" />
            </SceneBoundary>
            <div className="label pointer-events-none absolute top-4 left-4">STORAGE RACK · ONE MODULE PER CYCLE{count > 40 ? ` · LAST 40 OF ${count}` : ""}</div>
            <div className="label pointer-events-none absolute right-4 bottom-4 hidden sm:block">DRAG TO ROTATE</div>
          </div>
          <CycleList limit={3} />
        </div>
      </div>
    </section>
  );
}

function RackFallback() {
  const n = useVolt((s) => s.purchases.length);
  return (
    <div className="flex h-full w-full items-end justify-center gap-2 p-8" aria-hidden>
      {Array.from({ length: 4 }, (_, c) => (
        <div key={c} className="flex flex-col-reverse gap-1.5">
          {Array.from({ length: 6 }, (_, r) => {
            const i = r * 4 + c;
            return <div key={r} className={`h-5 w-16 rounded-sm border ${i < n ? "border-silver/40 bg-gradient-to-b from-aluminum/60 to-silver/40" : "border-metal-2"}`} />;
          })}
        </div>
      ))}
    </div>
  );
}
