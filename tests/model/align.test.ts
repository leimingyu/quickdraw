import { describe, it, expect } from 'vitest';
import { alignDeltas, distributeDeltas } from '../../src/model/align';
import type { Box } from '../../src/model/geometry';

// Three boxes with distinct positions/sizes for alignment fixtures.
//   A: x 0..40   (w40)  y 0..20
//   B: x 100..160 (w60) y 50..90  (h40)
//   C: x 200..220 (w20) y 10..40  (h30)
const boxes = (): Box[] => [
  { x: 0, y: 0, w: 40, h: 20 },
  { x: 100, y: 50, w: 60, h: 40 },
  { x: 200, y: 10, w: 20, h: 30 },
];

// bbox: minX 0, maxX 220, minY 0, maxY 90; center (110, 45)
const applyX = (bs: Box[], d: { dx: number }[], i: number) => bs[i].x + d[i].dx;
const applyRight = (bs: Box[], d: { dx: number }[], i: number) => bs[i].x + d[i].dx + bs[i].w;
const applyY = (bs: Box[], d: { dy: number }[], i: number) => bs[i].y + d[i].dy;

describe('alignDeltas', () => {
  it('left: every left edge lands on the min left (0), no vertical move', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'left');
    expect([0, 1, 2].map((i) => applyX(bs, d, i))).toEqual([0, 0, 0]);
    expect(d.every((x) => x.dy === 0)).toBe(true);
  });

  it('right: every right edge lands on the max right (220)', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'right');
    expect([0, 1, 2].map((i) => applyRight(bs, d, i))).toEqual([220, 220, 220]);
    expect(d.every((x) => x.dy === 0)).toBe(true);
  });

  it('hcenter: every center-x lands on the bbox center (110)', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'hcenter');
    const centerX = (i: number) => applyX(bs, d, i) + bs[i].w / 2;
    expect([0, 1, 2].map(centerX)).toEqual([110, 110, 110]);
  });

  it('top: every top edge lands on the min top (0), no horizontal move', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'top');
    expect([0, 1, 2].map((i) => applyY(bs, d, i))).toEqual([0, 0, 0]);
    expect(d.every((x) => x.dx === 0)).toBe(true);
  });

  it('bottom: every bottom edge lands on the max bottom (90)', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'bottom');
    const bottom = (i: number) => applyY(bs, d, i) + bs[i].h;
    expect([0, 1, 2].map(bottom)).toEqual([90, 90, 90]);
  });

  it('vmiddle: every center-y lands on the bbox middle (45)', () => {
    const bs = boxes();
    const d = alignDeltas(bs, 'vmiddle');
    const centerY = (i: number) => applyY(bs, d, i) + bs[i].h / 2;
    expect([0, 1, 2].map(centerY)).toEqual([45, 45, 45]);
  });

  it('is a no-op for fewer than two boxes', () => {
    expect(alignDeltas([{ x: 5, y: 5, w: 10, h: 10 }], 'left')).toEqual([{ dx: 0, dy: 0 }]);
    expect(alignDeltas([], 'left')).toEqual([]);
  });
});

describe('distributeDeltas', () => {
  it('hspace: equalizes horizontal gaps and pins the extreme boxes', () => {
    // widths 40+60+20 = 120; span 0..220 = 220; free 100; two gaps → 50 each.
    const bs = boxes();
    const d = distributeDeltas(bs, 'hspace');
    const left = (i: number) => bs[i].x + d[i].dx;
    const right = (i: number) => left(i) + bs[i].w;
    expect(left(0)).toBe(0); // first pinned
    expect(right(2)).toBe(220); // last pinned (its right edge)
    // gaps: B.left - A.right, C.left - B.right
    expect(left(1) - right(0)).toBe(left(2) - right(1));
    expect(d.every((x) => x.dy === 0)).toBe(true);
  });

  it('vspace: equalizes vertical gaps and pins the extreme boxes', () => {
    const bs = boxes();
    const d = distributeDeltas(bs, 'vspace');
    const top = (i: number) => bs[i].y + d[i].dy;
    const bottom = (i: number) => top(i) + bs[i].h;
    // order by y: A(0) , C(10), B(50). extremes A.top=0 and B.bottom=90 pinned.
    expect(top(0)).toBe(0);
    expect(bottom(1)).toBe(90); // B is bottom-most
    // interior box C sits so the two gaps are equal
    expect(top(2) - bottom(0)).toBe(top(1) - bottom(2));
    expect(d.every((x) => x.dx === 0)).toBe(true);
  });

  it('returns deltas in input order even when input is unsorted', () => {
    const bs: Box[] = [
      { x: 200, y: 0, w: 20, h: 20 }, // rightmost, first in array
      { x: 0, y: 0, w: 20, h: 20 }, // leftmost
      { x: 100, y: 0, w: 20, h: 20 }, // middle
    ];
    const d = distributeDeltas(bs, 'hspace');
    const left = (i: number) => bs[i].x + d[i].dx;
    // leftmost (idx1) pinned at 0, rightmost (idx0) pinned; middle (idx2) unchanged (already centered)
    expect(left(1)).toBe(0);
    expect(left(0) + bs[0].w).toBe(220);
    // sorted lefts should be evenly spaced: 0, 100, 200
    expect([left(1), left(2), left(0)]).toEqual([0, 100, 200]);
  });

  it('is a no-op for fewer than three boxes', () => {
    const two: Box[] = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 0, w: 10, h: 10 }];
    expect(distributeDeltas(two, 'hspace')).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
    expect(distributeDeltas([], 'vspace')).toEqual([]);
  });
});
