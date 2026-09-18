"use client";

import dynamic from "next/dynamic";
import { SceneBoundary } from "@/components/ui/SceneBoundary";
import { BatteryFallback } from "./BatteryFallback";
import { FeePulse } from "./FeePulse";

const BatteryScene = dynamic(() => import("./BatteryScene"), {
  ssr: false,
  loading: () => <BatteryFallback className="h-full w-full" dim />,
});

/**
 * The cell with its fee popups. The WebGL scene loads lazily; until then
 * (and if WebGL fails) the SVG cell stands in with the same fill.
 */
export function BatteryStage({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <SceneBoundary fallback={<BatteryFallback className="h-full w-full" />}>
        <BatteryScene className="h-full w-full" />
      </SceneBoundary>
      <FeePulse side="right" />
    </div>
  );
}
