"use client";

import { useVolt } from "@/lib/store/volt";
import { useSmoothNumber } from "@/lib/hooks";

/**
 * The cell without WebGL: an SVG cylinder with the same fill, used while
 * the scene loads, when WebGL is unavailable, and in the final CTA.
 */
export function BatteryFallback({ className = "", dim = false }: { className?: string; dim?: boolean }) {
  const pct = useVolt((s) => s.battery.percentage);
  const phase = useVolt((s) => s.phase);
  const fill = useSmoothNumber(phase === "resetting" ? 0 : pct, 3) / 100;
  const h = 236;
  const y0 = 48;
  const fh = Math.max(0, h * fill);
  return (
    <svg viewBox="0 0 160 340" className={className} aria-hidden style={{ opacity: dim ? 0.5 : 1 }}>
      <defs>
        <linearGradient id="bf-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#5a5d63" />
          <stop offset="0.25" stopColor="#c6c9ce" />
          <stop offset="0.5" stopColor="#7d8085" />
          <stop offset="0.8" stopColor="#b8bcc2" />
          <stop offset="1" stopColor="#4a4d52" />
        </linearGradient>
        <linearGradient id="bf-energy" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0B4F7A" />
          <stop offset="0.8" stopColor="#35D8FF" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="62" y="14" width="36" height="14" rx="3" fill="url(#bf-metal)" />
      <rect x="22" y="28" width="116" height="18" rx="6" fill="#0c0c0e" stroke="#2a2a2e" />
      <rect x="26" y="46" width="108" height="240" fill="url(#bf-metal)" />
      <rect x="22" y="286" width="116" height="18" rx="6" fill="#0c0c0e" stroke="#2a2a2e" />
      <rect x="24" y="44" width="112" height="4" fill="#35d8ff" opacity="0.9" />
      {/* window */}
      <rect x="52" y={y0} width="56" height={h} fill="#08080a" />
      <rect x="52" y={y0 + h - fh} width="56" height={fh} fill="url(#bf-energy)" />
      <rect x="50" y={y0 - 2} width="3" height={h + 4} fill="#0c0c0e" />
      <rect x="107" y={y0 - 2} width="3" height={h + 4} fill="#0c0c0e" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x="116" y={y0 + h - (i + 0.5) * (h / 10)} width="8" height="2" fill={(i + 0.5) / 10 <= fill ? "#9ef2ff" : "#2b2b30"} />
      ))}
    </svg>
  );
}
