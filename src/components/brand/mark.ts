/**
 * The VOLT symbol: two sharp plates — the arms of a V — separated by a
 * diagonal electrical gap. The left plate carries the vertex; the right
 * plate is cut short by a slit parallel to the left plate's inner edge, so
 * the two never touch. The gap is negative space at 16 px and a thin red
 * line at large sizes. Coordinates live in a 64 × 64 box.
 */
export const MARK = {
  viewBox: "0 0 64 64",
  left: "M6 10H20L38 52H24Z",
  right: "M44 10H58L40.9 49.9L33.9 33.5Z",
  /** The energy inside the gap, from inner notch to vertex. */
  energy: { x1: 32.4, y1: 34.5, x2: 38.7, y2: 49.2 },
} as const;
