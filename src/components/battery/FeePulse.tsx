"use client";

import { AnimatePresence, motion } from "framer-motion";
import { easeOutExpo } from "@/lib/motion";
import { useVolt } from "@/lib/store/volt";

/**
 * "+$18.42" appears beside the cell and a small pulse travels into it.
 * Subtle physical motion, no particles.
 */
export function FeePulse({ side = "right" }: { side?: "left" | "right" }) {
  const fees = useVolt((s) => s.fees);
  const recent = fees.slice(-3);
  const dir = side === "right" ? 1 : -1;
  return (
    <div className={`pointer-events-none absolute top-[38%] ${side === "right" ? "right-0" : "left-0"} h-16 w-40`} aria-live="polite">
      <AnimatePresence>
        {recent.map((f) => (
          <motion.div
            key={f.id}
            className={`absolute top-0 ${side === "right" ? "right-0 text-right" : "left-0 text-left"}`}
            initial={{ opacity: 0, x: 18 * dir, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], x: [18 * dir, 0, -26 * dir, -70 * dir], y: [10, 0, -4, -8] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, times: [0, 0.2, 0.7, 1], ease: easeOutExpo }}
          >
            <span className="mono text-[15px] text-ink">+${f.amountUsd.toFixed(2)}</span>
            <span className="label ml-2 text-[9px]">TO BATTERY</span>
            <motion.span
              className={`absolute top-1/2 h-px w-10 ${side === "right" ? "right-full mr-2" : "left-full ml-2"} bg-gradient-to-l from-volt-hot to-transparent`}
              initial={{ opacity: 0, scaleX: 0.2 }}
              animate={{ opacity: [0, 1, 0], scaleX: [0.2, 1, 1] }}
              transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" }}
              style={{ transformOrigin: side === "right" ? "100% 50%" : "0% 50%" }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
