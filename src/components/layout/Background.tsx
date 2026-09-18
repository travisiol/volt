"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * The lab: a faint engineering grid, measurement marks down the left edge,
 * two soft radial pools of light, grain, and a pointer-driven highlight.
 * All fixed, all behind the page.
 */
export function Background() {
  const light = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let tx = x;
    let ty = y;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      raf = 0;
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      if (light.current) light.current.style.transform = `translate3d(${x - 400}px, ${y - 400}px, 0)`;
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 engineering-grid" />
      <div className="absolute -top-[30vh] left-1/2 h-[80vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(228,230,232,0.06),rgba(228,230,232,0))]" />
      <div className="absolute -bottom-[40vh] left-1/2 h-[70vh] w-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(53,216,255,0.07),rgba(53,216,255,0))]" />
      <div ref={light} className="absolute top-0 left-0 h-[800px] w-[800px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.035),rgba(255,255,255,0))] will-change-transform" />
      <Ticks />
      <div className="absolute inset-0 grain" />
    </div>
  );
}

/** Measurement marks: a long tick every 100 px, a short one every 20. */
function Ticks() {
  return (
    <svg className="absolute top-0 left-4 hidden h-full w-6 text-aluminum/20 md:block" aria-hidden>
      <defs>
        <pattern id="ticks" width="24" height="100" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0.5" x2="14" y2="0.5" stroke="currentColor" strokeWidth="1" />
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y + 0.5} x2="6" y2={y + 0.5} stroke="currentColor" strokeWidth="1" />
          ))}
        </pattern>
      </defs>
      <rect width="24" height="100%" fill="url(#ticks)" />
    </svg>
  );
}
