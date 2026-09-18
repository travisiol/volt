import { MARK } from "./mark";

interface Props {
  /** Pixel size of the square. */
  size?: number;
  /** Plate colour. */
  color?: string;
  /** Show the red energy line inside the gap (off below ~24 px, it is sub-pixel anyway). */
  energy?: boolean;
  className?: string;
  title?: string;
}

/** The VOLT symbol as an inline SVG. */
export function VoltMark({ size = 24, color = "currentColor", energy, className, title }: Props) {
  const showEnergy = energy ?? size >= 28;
  return (
    <svg width={size} height={size} viewBox={MARK.viewBox} className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={MARK.left} fill={color} />
      <path d={MARK.right} fill={color} />
      {showEnergy ? <line x1={MARK.energy.x1} y1={MARK.energy.y1} x2={MARK.energy.x2} y2={MARK.energy.y2} stroke="#35D8FF" strokeWidth={1.6} strokeLinecap="round" /> : null}
    </svg>
  );
}
