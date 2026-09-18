"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bindPointer, signals } from "@/lib/battery/signals";
import { useInView, useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { getVolt } from "@/lib/store/volt";
import { chargeFragment, chargeVertex } from "./chargeShader";

/**
 * The hero cell. An original cylindrical industrial energy cell: brushed
 * aluminum casing with a sight window on the front, black ceramic caps, a
 * blue anodized ring, and inside the window a vertical blue-white energy
 * field whose height is the charge. No bloom pass — the glow is an additive
 * plane and a point light inside the cell.
 */
const CELL = { r: 1, h: 3.2, windowDeg: 84, ticks: 10 };
const CAM_Z = 7.4;
const FOV = 30;

type Quality = "high" | "low";

function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(170,240,255,0.55)");
    g.addColorStop(0.4, "rgba(53,216,255,0.32)");
    g.addColorStop(1, "rgba(53,216,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function BatteryCell({ quality, hideGlow = false }: { quality: Quality; hideGlow?: boolean }) {
  const seg = quality === "high" ? 96 : 48;
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.ShaderMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const innerLight = useRef<THREE.PointLight>(null);
  const keyLight = useRef<THREE.PointLight>(null);
  const tickMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const vis = useRef({ charge: 0, flash: 0, pulse: 0, yaw: 0, pitch: 0, scale: 1, speed: 1 });

  const uniforms = useMemo(
    () => ({
      uCharge: { value: 0 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uSpeed: { value: 1 },
      uPulse: { value: 0 },
      uRed: { value: new THREE.Color("#35D8FF") },
      uDeep: { value: new THREE.Color("#0B4F7A") },
      uWhite: { value: new THREE.Color("#ffffff") },
    }),
    [],
  );

  const geo = useMemo(() => {
    const win = THREE.MathUtils.degToRad(CELL.windowDeg);
    return {
      casing: new THREE.CylinderGeometry(CELL.r, CELL.r, CELL.h, seg, 1, true, win / 2, Math.PI * 2 - win),
      core: new THREE.CylinderGeometry(CELL.r * 0.86, CELL.r * 0.86, CELL.h * 0.94, seg, 1, false),
      glass: new THREE.CylinderGeometry(CELL.r * 0.985, CELL.r * 0.985, CELL.h * 0.985, Math.max(24, Math.round(seg / 3)), 1, true, -win / 2, win),
      capTop: new THREE.CylinderGeometry(CELL.r * 1.045, CELL.r * 1.0, 0.24, seg),
      capBottom: new THREE.CylinderGeometry(CELL.r * 1.0, CELL.r * 1.045, 0.24, seg),
      terminal: new THREE.CylinderGeometry(CELL.r * 0.34, CELL.r * 0.34, 0.14, Math.max(24, Math.round(seg / 2))),
      ring: new THREE.TorusGeometry(CELL.r * 1.0, 0.035, 12, seg),
      frame: new THREE.BoxGeometry(0.07, CELL.h, 0.06),
      lip: new THREE.BoxGeometry(CELL.r * 1.4, 0.06, 0.06),
      tick: new THREE.BoxGeometry(0.02, 0.014, 0.1),
      glowTex: makeGlowTexture(),
      winAngle: win / 2,
    };
  }, [seg]);

  useEffect(
    () => () => {
      const { winAngle: _w, ...rest } = geo;
      void _w;
      Object.values(rest).forEach((g) => g.dispose());
    },
    [geo],
  );

  useFrame((st, dt) => {
    const s = getVolt();
    const v = vis.current;
    const now = performance.now();
    const step = Math.min(dt, 0.05);

    const targetCharge = s.battery.percentage / 100;
    const resetting = s.phase === "resetting";
    v.charge += (targetCharge - v.charge) * (1 - Math.exp(-step * (resetting ? 2.4 : 5)));

    // White-hot for ~300 ms at 100 %, then a 350 ms fade — on the clock, not per frame.
    // flashAt is a Date.now() stamp from the store — compare on the same clock.
    const sinceFlash = s.flashAt > 0 ? Date.now() - s.flashAt : Infinity;
    v.flash = sinceFlash < 0 ? 0 : sinceFlash < 60 ? sinceFlash / 60 : sinceFlash < 320 ? 1 : Math.min(1, Math.max(0, 1 - (sinceFlash - 320) / 350));

    const charging = s.phase === "charging";
    const pulseTarget = s.phase === "full" || s.phase === "purchasing" ? 1 : charging && v.charge >= 0.9 ? (v.charge - 0.9) / 0.1 : 0;
    v.pulse += (pulseTarget - v.pulse) * (1 - Math.exp(-step * 4));

    const speedTarget = 0.7 + v.charge * 1.1 + (signals.hover ? 0.6 : 0) + (s.phase === "purchasing" ? 1.4 : 0);
    v.speed += (speedTarget - v.speed) * (1 - Math.exp(-step * 3));

    v.yaw += (signals.mouseX * 0.38 - v.yaw) * (1 - Math.exp(-step * 5));
    v.pitch += (-signals.mouseY * 0.1 - v.pitch) * (1 - Math.exp(-step * 5));
    v.scale += ((signals.hover ? 1.02 : 1) - v.scale) * (1 - Math.exp(-step * 6));

    if (core.current) {
      const u = core.current.uniforms;
      u.uCharge.value = v.charge;
      u.uTime.value = st.clock.elapsedTime;
      u.uFlash.value = v.flash;
      u.uSpeed.value = v.speed;
      u.uPulse.value = v.pulse;
    }
    if (group.current) {
      group.current.rotation.set(v.pitch, v.yaw, 0);
      group.current.scale.setScalar(v.scale);
      group.current.position.y = Math.sin(now / 1700) * 0.018;
    }
    if (innerLight.current) innerLight.current.intensity = 0.5 + v.charge * 12 + v.pulse * 3 + v.flash * 40;
    if (keyLight.current) keyLight.current.position.set(signals.mouseX * 3.2, 1.4 - signals.mouseY * 1.6, 3.4);
    if (glow.current && glowMat.current) {
      const hFill = Math.max(0.06, v.charge) * CELL.h * 0.94;
      glow.current.scale.set(2.1, hFill + 0.8, 1);
      glow.current.position.y = -CELL.h * 0.47 + hFill / 2;
      glowMat.current.opacity = Math.min(0.42, 0.02 + v.charge * 0.18 + v.pulse * 0.06 + v.flash * 0.22);
    }
    const mats = tickMats.current;
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m) continue;
      const lit = (i + 0.5) / CELL.ticks <= v.charge + 0.001 || v.flash > 0.5;
      m.color.set(lit ? "#9ef2ff" : "#2b2b30");
      m.emissive.set(lit ? "#35d8ff" : "#000000");
      m.emissiveIntensity = lit ? 1.4 + v.pulse : 0;
    }
  });

  const aluminum = {
    color: "#c6c9ce",
    metalness: 0.94,
    roughness: 0.36,
    anisotropy: quality === "high" ? 0.75 : 0,
    anisotropyRotation: Math.PI / 2,
    clearcoat: quality === "high" ? 0.12 : 0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.15,
  } as const;
  const ceramic = { color: "#0c0c0e", metalness: 0.08, roughness: 0.26, clearcoat: quality === "high" ? 0.9 : 0, clearcoatRoughness: 0.18, envMapIntensity: 0.9 } as const;

  const half = CELL.h / 2;
  const tickX = Math.sin(geo.winAngle + 0.1) * (CELL.r + 0.02);
  const tickZ = Math.cos(geo.winAngle + 0.1) * (CELL.r + 0.02);

  return (
    <group ref={group}>
      {/* Energy core, visible through the window. */}
      <mesh geometry={geo.core}>
        <shaderMaterial ref={core} vertexShader={chargeVertex} fragmentShader={chargeFragment} uniforms={uniforms} />
      </mesh>
      {/* Casing (opaque, open on the front). */}
      <mesh geometry={geo.casing}>
        <meshPhysicalMaterial {...aluminum} />
      </mesh>
      {/* Window frame: two vertical ceramic bars and two lips. */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={geo.frame} position={[Math.sin(side * geo.winAngle) * CELL.r, 0, Math.cos(side * geo.winAngle) * CELL.r]} rotation-y={side * geo.winAngle}>
          <meshPhysicalMaterial {...ceramic} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`lip${side}`} geometry={geo.lip} position={[0, side * (half - 0.03), CELL.r * 0.99]}>
          <meshPhysicalMaterial {...ceramic} />
        </mesh>
      ))}
      {/* Sight glass over the window. */}
      <mesh geometry={geo.glass} renderOrder={2}>
        <meshPhysicalMaterial color="#ffffff" metalness={0} roughness={0.06} transparent opacity={0.16} depthWrite={false} envMapIntensity={1.2} />
      </mesh>
      {/* Additive glow spilling out of the window. */}
      <mesh ref={glow} position={[0, -half * 0.5, CELL.r + 0.16]} renderOrder={3} visible={!hideGlow}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={glowMat} map={geo.glowTex} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Caps, terminal, electric ring. */}
      <mesh geometry={geo.capTop} position-y={half + 0.12}>
        <meshPhysicalMaterial {...ceramic} />
      </mesh>
      <mesh geometry={geo.capBottom} position-y={-half - 0.12}>
        <meshPhysicalMaterial {...ceramic} />
      </mesh>
      <mesh geometry={geo.terminal} position-y={half + 0.31}>
        <meshPhysicalMaterial {...aluminum} roughness={0.3} />
      </mesh>
      <mesh geometry={geo.ring} position-y={half - 0.02} rotation-x={Math.PI / 2}>
        <meshStandardMaterial color="#35d8ff" emissive="#0b4f7a" emissiveIntensity={0.5} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh geometry={geo.ring} position-y={-half + 0.02} rotation-x={Math.PI / 2}>
        <meshStandardMaterial color="#26262a" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* Graduations beside the window: lit up to the charge level. */}
      {Array.from({ length: CELL.ticks }, (_, i) => (
        <mesh key={i} geometry={geo.tick} position={[tickX, -half + 0.16 + (i + 0.5) * ((CELL.h - 0.32) / CELL.ticks), tickZ]} rotation-y={geo.winAngle + 0.1}>
          <meshStandardMaterial
            ref={(m) => {
              tickMats.current[i] = m;
            }}
            color="#2b2b30"
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}
      {/* Internal lighting rather than bloom. */}
      <pointLight ref={innerLight} color="#4fd8ff" intensity={2} distance={7} decay={2} position={[0, -0.3, 0]} />
      <pointLight ref={keyLight} color="#ffffff" intensity={2.2} distance={12} decay={2} position={[1.5, 1.4, 3.4]} />
    </group>
  );
}

/** A studio for brushed metal: bands behind the camera, a cool panel above, an electric strip to the right. */
const STRIPS: Array<[number, number, string, number]> = [
  [0.7, 1.5, "#ffffff", 0.7],
  [1.8, 0.8, "#e8eaee", 1.1],
  [3.4, 0.4, "#c3c7cd", 1.6],
  [-0.5, 0.1, "#5f636a", 0.5],
  [-1.7, 0.45, "#d0d3d8", 1.0],
  [-3.6, 0.7, "#ffffff", 1.8],
];

function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      {STRIPS.map(([y, intensity, color, h], i) => (
        <Lightformer key={i} form="rect" intensity={intensity} color={color} position={[0, y, 9]} target={[0, 0, 0]} scale={[18, h, 1]} />
      ))}
      <Lightformer form="rect" intensity={0.28} color="#d9dce2" position={[0, 0.5, 10]} target={[0, 0, 0]} scale={[30, 16, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#ffffff" position={[-7, 1, 2.5]} target={[0, 0, 0]} scale={[1.6, 9, 1]} />
      <Lightformer form="rect" intensity={0.75} color="#e6e8ec" position={[7.5, 2, 1.5]} target={[0, 0, 0]} scale={[1.2, 9, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#35d8ff" position={[6, -1.2, 5.5]} target={[0, 0, 0]} scale={[0.8, 5, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[14, 5, 1]} />
      <Lightformer form="rect" intensity={0.35} color="#b8bcc2" position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[14, 4, 1]} />
    </Environment>
  );
}

function makeFadeTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // alphaMap reads the green channel: white in the middle, black at the edge.
    // The pool must vanish well inside the canvas: fully gone at 45 % of the plane (≈ 1.35 units).
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.18, "#a0a0a0");
    g.addColorStop(0.36, "#202020");
    g.addColorStop(0.45, "#000000");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(c);
}

/** A dark floor that fades out well inside the frustum — it exists to catch the pool of light under the cell. */
function Ground() {
  const alpha = useMemo(() => makeFadeTexture(), []);
  useEffect(() => () => alpha.dispose(), [alpha]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-CELL.h / 2 - 0.36}>
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial color="#070708" metalness={0} roughness={0.85} envMapIntensity={0} transparent alphaMap={alpha} depthWrite={false} />
    </mesh>
  );
}

/** Dev only: lets a script advance the frame loop when rAF is throttled. */
function DevHook() {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __voltScene?: unknown }).__voltScene = { gl, advance: (t: number) => advance(t, true) };
  }, [advance, gl]);
  return null;
}

/** The hero canvas. Fills its container; pauses when scrolled away. */
/** Dev/QA: ?dbg=noglow | noground | nocore isolates one element in captures. */
const dbg = () => (process.env.NODE_ENV !== "production" && typeof location !== "undefined" ? new URLSearchParams(location.search).get("dbg") ?? "" : "");

export default function BatteryScene({ className = "" }: { className?: string }) {
  const low = useLowQuality();
  const flag = dbg();
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>("120px");

  useEffect(() => {
    bindPointer();
  }, []);

  const frameloop = reduced ? "demand" : inView ? "always" : "never";

  return (
    <div ref={ref} className={`relative ${className}`} aria-hidden>
      <Canvas
        dpr={low ? 1 : [1, 1.75]}
        frameloop={frameloop}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
        camera={{ position: [0, 1.25, CAM_Z], fov: FOV, near: 0.1, far: 60 }}
        onCreated={({ camera }) => camera.lookAt(0, -0.05, 0)}
        style={{ background: "transparent" }}
      >
        <Studio />
        <DevHook />
        <BatteryCell quality={low ? "low" : "high"} hideGlow={flag === "noglow"} />
        {flag === "noground" ? null : <Ground />}
      </Canvas>
    </div>
  );
}
