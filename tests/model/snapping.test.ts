import { describe, it, expect } from 'vitest';
import { computeSnap } from '../../src/model/snapping';

const box = (x: number, y: number, w = 100, h = 100) => ({ x, y, w, h });

describe('computeSnap', () => {
  it('snaps a near-aligned left edge and reports a vertical guide', () => {
    const moving = box(3, 200); // left edge x=3, near static left edge x=0
    const snap = computeSnap(moving, [box(0, 0)], 6);
    expect(snap.dx).toBe(-3); // pulled to x=0
    expect(snap.dy).toBe(0);
    expect(snap.guides).toHaveLength(1);
    expect(snap.guides[0]).toMatchObject({ axis: 'x', at: 0 });
  });

  it('snaps centers together', () => {
    const moving = box(48, 300, 100, 100); // centerX = 98, near static centerX = 100
    const snap = computeSnap(moving, [box(50, 0, 100, 100)], 6); // static centerX = 100
    expect(snap.dx).toBe(2); // 98 -> 100
  });

  it('does not snap when everything is out of tolerance', () => {
    const snap = computeSnap(box(70, 300), [box(0, 0)], 6); // no line within 6 on either axis
    expect(snap).toMatchObject({ dx: 0, dy: 0 });
    expect(snap.guides).toHaveLength(0);
  });

  it('snaps both axes independently', () => {
    const moving = box(2, 4); // left x=2 near 0, top y=4 near 0
    const snap = computeSnap(moving, [box(0, 0)], 6);
    expect(snap.dx).toBe(-2);
    expect(snap.dy).toBe(-4);
    expect(snap.guides.map((g) => g.axis).sort()).toEqual(['x', 'y']);
  });

  it('picks the closest of several candidate lines', () => {
    const moving = box(9, 300); // left x=9
    // static A right edge at x=10 (delta 1), static B left edge at x=5 (delta -4)
    const snap = computeSnap(moving, [box(-90, 0, 100, 100), box(5, 0, 100, 100)], 6);
    expect(snap.dx).toBe(1); // snaps to the nearer line (x=10)
  });

  it('a guide spans from the moving box to the aligned static box', () => {
    const moving = box(0, 200, 100, 100); // top y=200..300
    const snap = computeSnap(moving, [box(0, 0, 100, 100)], 6); // aligned on left edge x=0
    const g = snap.guides.find((g) => g.axis === 'x')!;
    expect(g.start).toBe(0);   // static top
    expect(g.end).toBe(300);   // moving bottom
  });
});
