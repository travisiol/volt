"use client";

import Link from "next/link";
import { BatteryFallback } from "@/components/battery/BatteryFallback";
import { TradeButton } from "./Hero";

/** Almost empty. The cell, large and dim, behind four words. */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-32 md:px-8 md:py-44">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <BatteryFallback className="h-[110%] w-auto opacity-[0.11] blur-[1.5px] saturate-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,5,5,0.2)_10%,rgba(5,5,5,0.95)_62%)]" />
      </div>
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center text-center">
        <h2 className="display text-[clamp(44px,8vw,120px)]">POWER THE RESERVE.</h2>
        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <TradeButton />
          <Link href="/reserve" className="btn btn-ghost w-full sm:w-auto">
            VIEW RESERVE
          </Link>
        </div>
        <p className="display-wide mt-16 text-[11px] tracking-[0.3em] text-muted">VOLT · TRADE. CHARGE. BUILD.</p>
      </div>
    </section>
  );
}
