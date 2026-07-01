import type { Box } from './geometry';

/** A guide line to draw while a drag is snapped. `axis:'x'` is a vertical line at
 *  x=`at` spanning y in [start,end]; `axis:'y'` is a horizontal line at y=`at`. */
export interface SnapGuide { axis: 'x' | 'y'; at: number; start: number; end: number; }
export interface Snap { dx: number; dy: number; guides: SnapGuide[]; }

const xLines = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w]; // left, center, right
const yLines = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h]; // top, middle, bottom

interface Hit { delta: number; at: number; other: Box; }

function bestAxisHit(movingLines: number[], statics: Box[], lines: (b: Box) => number[], tol: number): Hit | null {
  let best: Hit | null = null;
  for (const s of statics) {
    for (const ml of movingLines) {
      for (const sl of lines(s)) {
        const delta = sl - ml;
        if (Math.abs(delta) <= tol && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, at: sl, other: s };
        }
      }
    }
  }
  return best;
}

/**
 * Snap the `moving` box to the nearest edge/center line of any `statics` box within
 * `tol` (per axis, independently). Returns the offset (dx,dy) to apply and the guide
 * lines to draw. No match on an axis → 0 offset, no guide there.
 */
export function computeSnap(moving: Box, statics: Box[], tol: number): Snap {
  const bx = bestAxisHit(xLines(moving), statics, xLines, tol);
  const by = bestAxisHit(yLines(moving), statics, yLines, tol);
  const dx = bx ? bx.delta : 0;
  const dy = by ? by.delta : 0;
  const sm = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h };
  const guides: SnapGuide[] = [];
  if (bx) {
    const o = bx.other;
    guides.push({ axis: 'x', at: bx.at, start: Math.min(sm.y, o.y), end: Math.max(sm.y + sm.h, o.y + o.h) });
  }
  if (by) {
    const o = by.other;
    guides.push({ axis: 'y', at: by.at, start: Math.min(sm.x, o.x), end: Math.max(sm.x + sm.w, o.x + o.w) });
  }
  return { dx, dy, guides };
}
