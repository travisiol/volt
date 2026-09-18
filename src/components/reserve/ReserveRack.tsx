"use client";

import { Environment, Html, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fmtAmount, fmtCycle, fmtDateTime, fmtUsd } from "@/lib/format";
import { useInView, useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { rackInput } from "@/lib/battery/rackInput";
import { getVolt, useVolt } from "@/lib/store/volt";
import type { ReservePurchase } from "@/types/reserve";

/**
 * The reserve as a physical storage rack: black environment, silver modules,
 * one module per completed cycle, the next slot waiting. New modules lower
 * into place with a short mechanical lock. Rotates slightly with the pointer
 * and with a drag.
 */
const COLS = 4;
/** The rack shows the most recent modules; older cycles stay in the list. */
const MAX_MODULES = 40;
const MOD = { w: 1.05, h: 0.34, d: 0.72, gapX: 0.2, gapY: 0.14 };
const PITCH_X = MOD.w + MOD.gapX;
const PITCH_Y = MOD.h + MOD.gapY;

const slotPosition = (index: number, rows: number): [number, number, number] => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return [(col - (COLS - 1) / 2) * PITCH_X, (row - (rows - 1) / 2) * PITCH_Y, 0];
};

function Rack({ purchases, quality }: { purchases: ReservePurchase[]; quality: "high" | "low" }) {
  const chronological = useMemo(() => [...purchases].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_MODULES), [purchases]);
  const rows = Math.max(3, Math.ceil((chronological.length + 1) / COLS));
  const group = useRef<THREE.Group>(null);
  const modules = useRef<Map<string, THREE.Group>>(new Map());
  const arrivals = useRef<Map<string, number>>(new Map());
  const mounted = useRef(false);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const yaw = useRef(0);

  const geo = useMemo(
    () => ({
      module: new RoundedBoxGeometry(MOD.w, MOD.h, MOD.d, quality === "high" ? 4 : 2, 0.045),
      plate: new THREE.BoxGeometry(MOD.w * 0.62, MOD.h * 0.42, 0.02),
      ledBox: new THREE.BoxGeometry(0.05, 0.05, 0.02),
      post: new THREE.BoxGeometry(0.08, rows * PITCH_Y + 0.5, 0.08),
      shelf: new THREE.BoxGeometry(COLS * PITCH_X + 0.3, 0.035, MOD.d + 0.2),
      empty: new THREE.EdgesGeometry(new THREE.BoxGeometry(MOD.w, MOD.h, MOD.d)),
    }),
    [quality, rows],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  // Modules present at mount are already in place; later ones arrive from above.
  useEffect(() => {
    const arr = arrivals.current;
    for (const p of chronological) if (!arr.has(p.id)) arr.set(p.id, mounted.current ? 0 : 1);
    mounted.current = true;
  }, [chronological]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const d = rackInput;
    const targetYaw = d.active ? d.yaw : d.yaw * 0.9;
    if (!d.active) d.yaw = targetYaw;
    yaw.current += (targetYaw - yaw.current) * (1 - Math.exp(-step * 6));
    if (group.current) group.current.rotation.y = yaw.current + 0.35;

    chronological.forEach((p, i) => {
      const g = modules.current.get(p.id);
      if (!g) return;
      const a = arrivals.current.get(p.id) ?? 1;
      const next = Math.min(1, a + step / 1.1);
      arrivals.current.set(p.id, next);
      const [x, y, z] = slotPosition(i, rows);
      const e = 1 - Math.pow(1 - next, 3);
      g.position.set(x, y + (1 - e) * 2.6, z);
      // The lock: a 3 % settle just before the end.
      const settle = next > 0.86 && next < 1 ? 1 + 0.03 * Math.sin(((next - 0.86) / 0.14) * Math.PI) : 1;
      const lift = hovered === p.id ? 1.03 : 1;
      g.scale.setScalar(settle * lift);
      g.visible = next > 0.001;
    });

    if (led.current) {
      const s = getVolt();
      const charge = s.battery.percentage / 100;
      led.current.emissiveIntensity = 0.3 + charge * 1.6 + (charge > 0.9 ? 0.6 * (0.5 + 0.5 * Math.sin(performance.now() / 160)) : 0);
    }
  });

  const aluminum = { color: "#c2c5ca", metalness: 0.92, roughness: 0.4, clearcoat: quality === "high" ? 0.1 : 0, envMapIntensity: 1.0 } as const;
  const emptyIndex = chronological.length;
  const hoveredPurchase = hovered ? chronological.find((p) => p.id === hovered) : null;
  const hoveredIndex = hoveredPurchase ? chronological.indexOf(hoveredPurchase) : -1;

  const over = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(id);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHovered(null);
    document.body.style.cursor = "";
  };

  return (
    <group ref={group}>
      {/* Frame */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geo.post} position={[sx * ((COLS * PITCH_X) / 2 + 0.1), 0, sz * (MOD.d / 2 + 0.06)]}>
            <meshPhysicalMaterial color="#141416" metalness={0.6} roughness={0.5} />
          </mesh>
        )),
      )}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <mesh key={r} geometry={geo.shelf} position={[0, (r - rows / 2) * PITCH_Y, 0]}>
          <meshPhysicalMaterial color="#1c1c1f" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}

      {/* Modules */}
      {chronological.map((p, i) => (
        <group
          key={p.id}
          ref={(g) => {
            if (g) modules.current.set(p.id, g);
            else modules.current.delete(p.id);
          }}
          position={slotPosition(i, rows)}
          onPointerOver={over(p.id)}
          onPointerOut={out}
        >
          <mesh geometry={geo.module}>
            <meshPhysicalMaterial {...aluminum} />
          </mesh>
          <mesh geometry={geo.plate} position={[-0.08, 0, MOD.d / 2 + 0.005]}>
            <meshPhysicalMaterial color="#0c0c0e" metalness={0.2} roughness={0.35} clearcoat={quality === "high" ? 0.6 : 0} />
          </mesh>
          <mesh geometry={geo.ledBox} position={[MOD.w * 0.38, 0, MOD.d / 2 + 0.005]}>
            <meshStandardMaterial color="#9ef2ff" emissive="#35d8ff" emissiveIntensity={hovered === p.id ? 2.2 : i === chronological.length - 1 ? 1.4 : 0.6} />
          </mesh>
        </group>
      ))}

      {/* The slot the current cycle will fill */}
      <group position={slotPosition(emptyIndex, rows)}>
        <lineSegments geometry={geo.empty}>
          <lineBasicMaterial color="#3a3a40" />
        </lineSegments>
        <mesh geometry={geo.ledBox} position={[MOD.w * 0.38, 0, MOD.d / 2 + 0.005]}>
          <meshStandardMaterial ref={led} color="#9ef2ff" emissive="#35d8ff" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {hoveredPurchase ? (
        <Html position={[slotPosition(hoveredIndex, rows)[0], slotPosition(hoveredIndex, rows)[1] + MOD.h / 2 + 0.12, MOD.d / 2]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className="panel w-[210px] p-3 text-left shadow-[0_20px_40px_-20px_rgba(0,0,0,1)]">
            <div className="display-wide text-[11px] tracking-[0.18em]">CYCLE {fmtCycle(hoveredPurchase.cycle)}</div>
            <div className="num mt-1.5 text-xl">{hoveredPurchase.amountUsd != null ? fmtUsd(hoveredPurchase.amountUsd, 0) : `${fmtAmount(hoveredPurchase.tslaAmount, 4)} TSLA`}</div>
            <div className="label mt-1">TSLA ACQUISITION</div>
            <div className="mono mt-1.5 text-[11px] text-silver">{hoveredPurchase.timestamp ? fmtDateTime(hoveredPurchase.timestamp) : "—"}</div>
          </div>
        </Html>
      ) : null}

      <pointLight color="#ffffff" intensity={2.5} distance={16} decay={2} position={[3, 5, 5]} />
      <pointLight color="#35d8ff" intensity={0.8} distance={10} decay={2} position={[-3, -2, 3]} />
    </group>
  );
}

/** Keeps the whole rack in frame as rows are added: the camera prop is only read at creation. */
function CameraRig({ rows }: { rows: number }) {
  const camera = useThree((st) => st.camera);
  useEffect(() => {
    const rackHeight = rows * PITCH_Y + 0.6;
    // Visible height at distance d with fov 28 is ≈ 0.5·d; keep headroom for the tilt.
    const dist = Math.max(7, rackHeight * 2.35);
    camera.position.set(0.4, rackHeight * 0.12, dist);
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
  }, [camera, rows]);
  return null;
}

function Studio() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[0, 1.2, 8]} target={[0, 0, 0]} scale={[16, 0.8, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#dfe2e6" position={[0, 3.5, 8]} target={[0, 0, 0]} scale={[16, 1.6, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, -3, 8]} target={[0, 0, 0]} scale={[16, 1.4, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#35d8ff" position={[7, 0, 3]} target={[0, 0, 0]} scale={[1, 6, 1]} />
    </Environment>
  );
}

export default function ReserveRack({ className = "" }: { className?: string }) {
  const purchases = useVolt((s) => s.purchases);
  const low = useLowQuality();
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>("160px");
  const rows = Math.max(3, Math.ceil((Math.min(purchases.length, MAX_MODULES) + 1) / COLS));

  const onDown = (e: React.PointerEvent) => {
    rackInput.active = true;
    rackInput.lastX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = rackInput;
    if (d.active) {
      d.yaw = Math.max(-0.7, Math.min(0.7, d.yaw + (e.clientX - d.lastX) * 0.006));
      d.lastX = e.clientX;
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      d.yaw = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
    }
  };
  const onUp = () => {
    rackInput.active = false;
  };

  return (
    <div ref={ref} className={`relative touch-pan-y select-none ${className}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} role="img" aria-label={`Reserve rack: ${purchases.length} completed cycles`}>
      <Canvas dpr={low ? 1 : [1, 1.5]} frameloop={reduced ? "demand" : inView ? "always" : "never"} gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }} camera={{ position: [0.4, 0.5, 7], fov: 28, near: 0.1, far: 80 }} style={{ background: "transparent" }}>
        <CameraRig rows={rows} />
        <Studio />
        <Rack purchases={purchases} quality={low ? "low" : "high"} />
      </Canvas>
    </div>
  );
}
