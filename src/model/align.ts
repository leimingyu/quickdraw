import type { Box } from './geometry';

/** Horizontal (X-axis) and vertical (Y-axis) alignment targets. */
export type AlignOp = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';
/** Even-gap distribution along the horizontal or vertical axis. */
export type DistributeOp = 'hspace' | 'vspace';
export interface Delta { dx: number; dy: number; }

const ZERO: Delta = { dx: 0, dy: 0 };

/**
 * Per-box offsets that align every box to the selection's bounding box: left/right/top/bottom
 * to that edge, hcenter/vmiddle to the box's center line. One axis moves, the other stays 0.
 * Fewer than two boxes has nothing to align against → all-zero deltas.
 */
export function alignDeltas(boxes: Box[], op: AlignOp): Delta[] {
  if (boxes.length < 2) return boxes.map(() => ({ ...ZERO }));
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return boxes.map((b) => {
    switch (op) {
      case 'left': return { dx: minX - b.x, dy: 0 };
      case 'right': return { dx: maxX - (b.x + b.w), dy: 0 };
      case 'hcenter': return { dx: cx - (b.x + b.w / 2), dy: 0 };
      case 'top': return { dx: 0, dy: minY - b.y };
      case 'bottom': return { dx: 0, dy: maxY - (b.y + b.h) };
      case 'vmiddle': return { dx: 0, dy: cy - (b.y + b.h / 2) };
    }
  });
}

/**
 * Per-box offsets that spread boxes with equal edge-to-edge gaps along one axis, pinning the
 * two extreme boxes. Fewer than three boxes has no interior gap to equalize → all-zero deltas.
 * Deltas are returned in the input order (boxes need not be pre-sorted).
 */
export function distributeDeltas(boxes: Box[], op: DistributeOp): Delta[] {
  const deltas: Delta[] = boxes.map(() => ({ ...ZERO }));
  if (boxes.length < 3) return deltas;
  const horiz = op === 'hspace';
  const lo = (b: Box) => (horiz ? b.x : b.y);
  const size = (b: Box) => (horiz ? b.w : b.h);
  const order = boxes.map((_, i) => i).sort((a, b) => lo(boxes[a]) - lo(boxes[b]));
  const first = boxes[order[0]];
  const last = boxes[order[order.length - 1]];
  const span = lo(last) + size(last) - lo(first);
  const sumSize = boxes.reduce((s, b) => s + size(b), 0);
  const gap = (span - sumSize) / (boxes.length - 1);
  let running = lo(first);
  for (const i of order) {
    const shift = running - lo(boxes[i]);
    deltas[i] = horiz ? { dx: shift, dy: 0 } : { dx: 0, dy: shift };
    running += size(boxes[i]) + gap;
  }
  return deltas;
}
