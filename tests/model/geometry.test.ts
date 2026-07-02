import { describe, it, expect } from 'vitest';
import type { Shape } from '../../src/model/types';
import {
  pointInShape, hitTest, shapeInRect, selectionBounds, resizeBox, zoomAt, handlePositions,
  clipToOutline,
} from '../../src/model/geometry';

function shape(over: Partial<Shape>): Shape {
  return {
    id: 'x', kind: 'rect', x: 0, y: 0, w: 100, h: 100,
    style: { fill: '#fff', stroke: '#000', strokeWidth: 2, fontSize: 16, fontColor: '#000' },
    ...over,
  };
}

describe('geometry', () => {
  it('rect hit test uses the bounding box', () => {
    const s = shape({ kind: 'rect' });
    expect(pointInShape(s, { x: 50, y: 50 })).toBe(true);
    expect(pointInShape(s, { x: 150, y: 50 })).toBe(false);
  });

  it('ellipse hit test excludes corners', () => {
    const s = shape({ kind: 'ellipse' });
    expect(pointInShape(s, { x: 50, y: 50 })).toBe(true); // center
    expect(pointInShape(s, { x: 2, y: 2 })).toBe(false); // corner
  });

  it('hitTest returns the topmost (last) matching node', () => {
    const a = shape({ id: 'a' });
    const b = shape({ id: 'b' });
    expect(hitTest([a, b], { x: 50, y: 50 })?.id).toBe('b');
    expect(hitTest([a, b], { x: 999, y: 999 })).toBeUndefined();
  });

  it('shapeInRect detects bbox intersection', () => {
    const s = shape({ x: 0, y: 0, w: 100, h: 100 });
    expect(shapeInRect(s, { x: 50, y: 50, w: 200, h: 200 })).toBe(true);
    expect(shapeInRect(s, { x: 200, y: 200, w: 50, h: 50 })).toBe(false);
  });

  it('selectionBounds unions all shapes', () => {
    const box = selectionBounds([shape({ x: 0, y: 0, w: 50, h: 50 }), shape({ x: 100, y: 100, w: 50, h: 50 })]);
    expect(box).toEqual({ x: 0, y: 0, w: 150, h: 150 });
    expect(selectionBounds([])).toBeNull();
  });

  it('resizeBox grows from the SE handle', () => {
    const out = resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'se', 20, 30);
    expect(out).toEqual({ x: 0, y: 0, w: 120, h: 130 });
  });

  it('resizeBox moves the origin from the NW handle', () => {
    const out = resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'nw', 10, 10);
    expect(out).toEqual({ x: 10, y: 10, w: 90, h: 90 });
  });

  it('zoomAt keeps the cursor point stationary in world space', () => {
    const vp = zoomAt({ panX: 0, panY: 0, zoom: 1 }, 2, 100, 100);
    expect(vp.zoom).toBe(2);
    // world point under cursor before == after: (100-pan)/zoom
    expect((100 - vp.panX) / vp.zoom).toBeCloseTo(100);
    expect((100 - vp.panY) / vp.zoom).toBeCloseTo(100);
  });

  it('resizeBox keeps the opposite edge fixed when a NW drag hits MIN_SIZE', () => {
    expect(resizeBox({ x: 0, y: 0, w: 10, h: 100 }, 'nw', 5, 0)).toEqual({ x: 2, y: 0, w: 8, h: 100 });
  });

  it('diamond hit test excludes corners', () => {
    const s = shape({ kind: 'diamond' });
    expect(pointInShape(s, { x: 50, y: 50 })).toBe(true); // center
    expect(pointInShape(s, { x: 2, y: 2 })).toBe(false);  // corner
  });

  it('handlePositions places corner and edge handles correctly', () => {
    const pos = handlePositions({ x: 0, y: 0, w: 100, h: 100 });
    expect(pos.se).toEqual({ x: 100, y: 100 });
    expect(pos.n).toEqual({ x: 50, y: 0 });
  });
});

describe('clipToOutline', () => {
  it('clips to a rect edge along the center→target ray', () => {
    const s = shape({ kind: 'rect', x: 0, y: 0, w: 100, h: 100 }); // center (50,50)
    expect(clipToOutline(s, { x: 200, y: 50 })).toEqual({ x: 100, y: 50 });  // right edge
    expect(clipToOutline(s, { x: 150, y: 250 })).toEqual({ x: 75, y: 100 }); // bottom, diagonal
  });

  it('clips a diagonal to the true rect edge, not the nearest corner', () => {
    const s = shape({ kind: 'rect', x: 0, y: 0, w: 100, h: 100 });
    // steeper in y → exits the bottom edge partway, not the SE corner (100,100)
    expect(clipToOutline(s, { x: 350, y: 450 })).toEqual({ x: 87.5, y: 100 });
  });

  it('clips to the ellipse outline, on the ellipse and not its bounding box', () => {
    const s = shape({ kind: 'ellipse', x: 0, y: 0, w: 100, h: 100 }); // circle r=50
    const p = clipToOutline(s, { x: 200, y: 200 }); // 45° diagonal
    expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(50, 6); // lands on the circle
    expect(p.x).toBeCloseTo(50 + 50 / Math.SQRT2, 6);
    expect(p.x).toBeLessThan(100); // not the bbox corner
  });

  it('clips to a diamond edge', () => {
    const s = shape({ kind: 'diamond', x: 0, y: 0, w: 100, h: 100 });
    expect(clipToOutline(s, { x: 150, y: 150 })).toEqual({ x: 75, y: 75 }); // |dx|/50+|dy|/50=1
  });

  it('clips to a triangle edge', () => {
    const s = shape({ kind: 'triangle', x: 0, y: 0, w: 100, h: 100 });
    // apex (50,0), base-right (100,100), base-left (0,100); center (50,50)
    expect(clipToOutline(s, { x: 50, y: 300 })).toEqual({ x: 50, y: 100 }); // down → base edge
    const r = clipToOutline(s, { x: 300, y: 50 }); // right → right leg
    expect(r.x).toBeCloseTo(75, 6);
    expect(r.y).toBeCloseTo(50, 6);
  });

  it('clips on the rotated outline', () => {
    const s = shape({ kind: 'rect', x: 0, y: 0, w: 200, h: 100, rotation: 90 }); // center (100,50)
    const p = clipToOutline(s, { x: 100, y: -100 }); // straight up in world
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(-50, 6); // rotated: the half-width (100) becomes the top extent
  });

  it('returns the center when the target coincides with it', () => {
    const s = shape({ kind: 'rect', x: 0, y: 0, w: 100, h: 100 });
    expect(clipToOutline(s, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });
});
