import { describe, it, expect } from 'vitest';
import type { Shape } from '../../src/model/types';
import {
  pointInShape, hitTest, shapeInRect, selectionBounds, resizeBox, zoomAt, handlePositions,
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
