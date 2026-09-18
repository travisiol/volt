"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { BatteryHud } from "@/components/battery/BatteryHud";
import { BatteryStage } from "@/components/battery/BatteryStage";
import { Num } from "@/components/ui/Num";
import { voltConfig } from "@/config/volt";
import { signals } from "@/lib/battery/signals";
import { fmtAmount, fmtUsd } from "@/lib/format";
import { remainingUsd, useVolt } from "@/lib/store/volt";

/**
 * Full viewport. VOLT, the line, the cell in the middle, the two figures
 * that matter beside it, two buttons. Nothing else.
 */
export function Hero() {
  const battery = useVolt((s) => s.battery);
  const reserve = useVolt((s) => s.reserve);
  const status = useVolt((s) => s.status);
  const phase = useVolt((s) => s.phase);
  const remaining = phase === "resetting" ? battery.targetChargeUsd : remainingUsd(battery);

  return (
    <section id="battery" className="relative flex min-h-svh flex-col justify-between px-5 pt-24 pb-10 md:px-8 md:pt-28 lg:pb-12">
      {/* Title block */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center text-center animate-fade-up">
        <h1 className="display text-[clamp(64px,9vw,120px)] text-ink">VOLT</h1>
        <p className="display-wide mt-3 text-[clamp(13px,1.3vw,17px)] tracking-[0.28em] text-aluminum">
          <span className="md:hidden">
            TRADE. CHARGE.
            <br />
            BUILD TSLA.
          </span>
          <span className="hidden md:inline">{voltConfig.site.tagline}</span>
        </p>
        <p className="lead mt-3">{voltConfig.site.line}</p>
      </div>

      {/* Cell + figures */}
      <div className="mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 items-center gap-6 py-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
        {/* Left: current charge (desktop) */}
        <div className="order-2 hidden min-w-0 lg:block">
          <div className="label">CURRENT CHARGE</div>
          <BatteryHud align="left" />
        </div>

        {/* Centre: the battery */}
        <div className="order-1 flex min-w-0 flex-col items-center lg:order-2">
          <BatteryStage className="aspect-[3/4] h-[min(380px,48svh)] sm:h-[min(440px,50svh)] lg:h-[min(520px,56svh)]" />
          <div className="mt-2 lg:hidden">
            <BatteryHud compact align="center" />
          </div>
        </div>

        {/* Right: the reserve */}
        <div className="order-3 flex min-w-0 flex-col items-center text-center lg:items-end lg:text-right">
          <Link href="/reserve" className="metal-hover -m-3 block rounded-md p-3" aria-label="Open the reserve">
            <div className="label">TSLA RESERVE</div>
            <div className="num mt-2 text-[clamp(40px,4.4vw,60px)] leading-none text-ink">
              {reserve.reserveValueUsd != null ? <Num value={reserve.reserveValueUsd} format={(v) => fmtUsd(v, v >= 100_000 ? 0 : 2)} rate={4} /> : <span className="text-muted">—</span>}
            </div>
            <div className="mono mt-2 text-[15px] text-silver">
              <Num value={reserve.tslaTokenBalance} format={(v) => fmtAmount(v, 2)} rate={4} /> TSLA
            </div>
            {reserve.reserveValueUsd == null && status === "ok" ? <div className="label mt-2 text-volt-hot">PRICE UNAVAILABLE</div> : null}
          </Link>
          <div className="mt-6 hidden lg:block">
            <div className="label">NEXT PURCHASE</div>
            <div className="mono mt-1.5 text-[15px] text-aluminum">
              <Num value={remaining} format={(v) => fmtUsd(v)} rate={6} /> <span className="text-muted">remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <TradeButton />
        <Link href="/reserve" className="btn btn-ghost w-full sm:w-auto">
          VIEW RESERVE
        </Link>
      </div>
    </section>
  );
}

/**
 * TRADE VOLT goes to the configured venue — never a fake swap. Without a
 * venue the button says so and does nothing.
 */
export function TradeButton({ className = "" }: { className?: string }) {
  const url = voltConfig.tradeUrl;
  const hover = { onPointerEnter: () => (signals.hover = true), onPointerLeave: () => (signals.hover = false) };
  if (!url) {
    return (
      <span className={`flex w-full flex-col items-center gap-1.5 sm:w-auto ${className}`}>
        <button type="button" className="btn btn-primary w-full sm:w-auto" disabled aria-disabled title="No trading venue configured yet">
          TRADE VOLT
        </button>
        <span className="label text-[9px]">VENUE NOT CONFIGURED</span>
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`btn btn-primary w-full sm:w-auto ${className}`} {...hover}>
      <span>TRADE VOLT</span>
      <ArrowUpRight size={14} />
    </a>
  );
}
