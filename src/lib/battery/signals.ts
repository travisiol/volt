/**
 * Per-frame signals shared between the page (HTML) and the WebGL scenes,
 * outside React so nothing re-renders at pointer speed.
 */
export const signals = {
  /** Pointer in [-1, 1] over the viewport. */
  mouseX: 0,
  mouseY: 0,
  /** True while BUY VOLT is hovered — the battery reacts slightly. */
  hover: false,
  /** Set by the hero when the battery is near the viewport centre. */
  focus: 1,
};

let bound = false;
/** Idempotent: binds the pointer listener once per page. */
export function bindPointer() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      signals.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      signals.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );
}
