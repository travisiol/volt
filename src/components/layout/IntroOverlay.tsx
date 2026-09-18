"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { introOverride, introSeen, markIntroSeen } from "@/lib/intro";
import { easeInOutQuart, easeOutExpo } from "@/lib/motion";

/**
 * The opening: 2.4 seconds, then the product.
 *   0.0  black
 *   0.2  a thin white energy line draws across
 *   0.7  a mechanical click — the line snaps to a short bright segment
 *   0.8  a cylindrical cell becomes visible
 *   1.4  one electric segment activates
 *   1.6  VOLT
 *   2.1  fade to the application
 * Plays once per browser (localStorage), skippable, never with reduced motion.
 */
const TOTAL_MS = 2_400;

function shouldPlay(): boolean {
  const override = introOverride();
  if (override !== null) return override;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return !introSeen();
}

export default function IntroOverlay() {
  const [playing, setPlaying] = useState<boolean>(() => shouldPlay());

  const finish = useCallback(() => {
    markIntroSeen();
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(finish, TOTAL_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [playing, finish]);

  return (
    <AnimatePresence>
      {playing ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: easeInOutQuart } }}
          onClick={finish}
          role="presentation"
        >
          {/* The energy line. */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-px w-[min(60vw,520px)] -translate-x-1/2 bg-energy"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1, 0.08, 0.08], opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: 1.1, delay: 0.2, times: [0, 0.4, 0.55, 0.62, 1], ease: easeOutExpo }}
            style={{ transformOrigin: "50% 50%" }}
          />
          {/* The click: a one-frame flash at the centre. */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-2 w-8 -translate-x-1/2 -translate-y-1/2 bg-energy"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.16, delay: 0.7, times: [0, 0.3, 1] }}
          />

          {/* The cell. */}
          <motion.svg
            width="64"
            height="132"
            viewBox="0 0 64 132"
            className="absolute"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: easeOutExpo }}
            aria-hidden
          >
            <rect x="24" y="2" width="16" height="8" rx="1.5" fill="#B8BCC2" />
            <rect x="6" y="10" width="52" height="118" rx="7" fill="#0A0A0B" stroke="#4a4d52" strokeWidth="1.5" />
            <rect x="9" y="13" width="46" height="112" rx="5" fill="#141416" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect key={i} x="14" y={20 + i * 12.5} width="36" height="9" rx="1.5" fill="#1C1C1F" />
            ))}
            <motion.rect x="14" y="107.5" width="36" height="9" rx="1.5" fill="#35D8FF" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.75, 1] }} transition={{ duration: 0.5, delay: 1.4 }} />
          </motion.svg>

          {/* VOLT */}
          <motion.div
            className="display absolute mt-[210px] text-[clamp(2.5rem,7vw,5rem)] text-ink"
            initial={{ opacity: 0, letterSpacing: "0.3em" }}
            animate={{ opacity: 1, letterSpacing: "0.02em" }}
            transition={{ duration: 0.6, delay: 1.6, ease: easeOutExpo }}
          >
            VOLT
          </motion.div>

          <button type="button" className="label absolute right-6 bottom-6 hover:text-ink" onClick={finish}>
            SKIP →
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
