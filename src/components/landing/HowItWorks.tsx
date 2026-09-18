"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fmtUsd } from "@/lib/format";
import { easeInOutQuart, easeOutExpo } from "@/lib/motion";
import { useVolt } from "@/lib/store/volt";

/**
 * TRADE → CHARGE → BUY → BUILD as one horizontal machine. When it scrolls
 * into view the mechanism runs once: a pulse leaves the trade, the battery
 * fills, the purchase locks, a module lands on the reserve.
 */
const STEP = 1.05; // seconds between stages

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const feeData = useVolt((s) => s.feeData);
  const target = useVolt((s) => s.battery.targetChargeUsd);
  const run = inView ? "run" : "idle";

  const stages = [
    {
      n: "01",
      title: "TRADE",
      copy: "VOLT trades generate creator fees under the venue's fee mechanism.",
      detail: feeData ? `${(feeData.toBatteryBps / 100).toFixed(2)}% of every trade → battery` : null,
      icon: <TradeIcon state={run} />,
    },
    { n: "02", title: "CHARGE", copy: "The reserve's allocation accumulates inside the VOLT battery.", detail: `target ${fmtUsd(target, 0)} per cycle`, icon: <ChargeIcon state={run} /> },
    {
      n: "03",
      title: "BUY",
      copy: "At the target charge, the reserve executes the configured TSLA Stock Token purchase.",
      detail: "by the authorized executor",
      icon: <BuyIcon state={run} />,
    },
    { n: "04", title: "BUILD", copy: "The TSLA reserve grows. One charge at a time.", detail: "verifiable on-chain", icon: <BuildIcon state={run} /> },
  ];

  return (
    <section id="how" className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="display text-[clamp(36px,5vw,64px)]">HOW VOLT WORKS</h2>
        <p className="label">EVERY TRADE ADDS CHARGE.</p>
      </div>

      <div ref={ref} className="mt-14 grid grid-cols-1 gap-0 md:grid-cols-[1fr_72px_1fr_72px_1fr_72px_1fr] md:items-start">
        {stages.map((s, i) => (
          <div key={s.n} className="contents">
            <motion.div
              className="panel relative p-6 md:p-7"
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: i * STEP * 0.5, ease: easeOutExpo }}
            >
              <div className="flex items-start justify-between">
                <span className="label">STEP {s.n}</span>
                <span className="text-silver">{s.icon}</span>
              </div>
              <h3 className="display mt-6 text-3xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-silver">{s.copy}</p>
              {s.detail ? (
                <p className="mono mt-4 text-[11px] text-muted">{s.detail}</p>
              ) : null}
            </motion.div>
            {i < stages.length - 1 ? <Connector delay={i * STEP + 0.5} run={inView} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** An energy line between two stages: a static graphite rail, a bright pulse that crosses it once. */
function Connector({ delay, run }: { delay: number; run: boolean }) {
  return (
    <div className="relative mx-auto h-10 w-px bg-metal-2 md:mt-16 md:h-px md:w-full" aria-hidden>
      <motion.div
        className="absolute inset-0 origin-left bg-gradient-to-r from-transparent via-volt-hot to-energy md:origin-left"
        initial={{ opacity: 0, x: "-100%" }}
        animate={run ? { opacity: [0, 1, 1, 0], x: ["-100%", "0%", "60%", "110%"] } : {}}
        transition={{ duration: 0.8, delay, times: [0, 0.2, 0.75, 1], ease: easeInOutQuart }}
      />
    </div>
  );
}

function TradeIcon({ state }: { state: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 14h22M22 8l6 6-6 6" />
      <motion.path d="M34 26H12M18 20l-6 6 6 6" initial={{ opacity: 0.35 }} animate={state === "run" ? { opacity: [0.35, 1, 0.35] } : {}} transition={{ duration: 0.8, delay: 0.2 }} />
    </svg>
  );
}

function ChargeIcon({ state }: { state: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="13" y="6" width="14" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="3" width="6" height="3" fill="currentColor" />
      <motion.rect x="15.5" width="9" fill="#35D8FF" initial={{ y: 33.5, height: 0 }} animate={state === "run" ? { y: 8.5, height: 25 } : {}} transition={{ duration: 0.9, delay: STEP + 0.6, ease: easeOutExpo }} />
    </svg>
  );
}

function BuyIcon({ state }: { state: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <motion.rect x="5" y="12" width="30" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" initial={{ scale: 1 }} animate={state === "run" ? { scale: [1, 0.94, 1] } : {}} transition={{ duration: 0.5, delay: STEP * 2 + 0.7 }} style={{ transformOrigin: "50% 50%" }} />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="currentColor" letterSpacing="1">
        TSLA
      </text>
      <motion.path d="M30 6l3 3 5-5" stroke="#35D8FF" strokeWidth="1.8" initial={{ pathLength: 0, opacity: 0 }} animate={state === "run" ? { pathLength: 1, opacity: 1 } : {}} transition={{ duration: 0.4, delay: STEP * 2 + 0.9 }} />
    </svg>
  );
}

function BuildIcon({ state }: { state: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="28" width="28" height="6" rx="1" />
      <rect x="6" y="19" width="28" height="6" rx="1" />
      <motion.rect x="6" y="10" width="28" height="6" rx="1" stroke="#35D8FF" initial={{ opacity: 0, y: 4 }} animate={state === "run" ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: STEP * 3 + 0.8, ease: easeOutExpo }} />
    </svg>
  );
}
