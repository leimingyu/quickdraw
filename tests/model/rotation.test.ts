import { describe, it, expect } from 'vitest';
import {
  rotatePoint, pointInShape, resizeRotatedBox, shapeHandlePositions, angleFromCenter,
} from '../../src/model/geometry';
import { createShape } from '../../src/model/document';
import { shapeToSvg } from '../../src/render/shapes';
import type { ShapeKind } from '../../src/model/types';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const KINDS: ShapeKind[] = ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'];

describe('rotation geometry', () => {
  it('rotatePoint turns +90° clockwise (right → down)', () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(near(p.x, 0)).toBe(true);
    expect(near(p.y, 10)).toBe(true);
  });

  it('pointInShape tests in the shape\'s unrotated frame', () => {
    const s = createShape('rect', 0, 0, 100, 20); // wide, center (50,10)
    s.rotation = 90; // visually 20 wide × 100 tall
    expect(pointInShape(s, { x: 50, y: 10 - 40 })).toBe(true);  // 40 up: within rotated half-height 50
    expect(pointInShape(s, { x: 50 + 40, y: 10 })).toBe(false); // 40 right: beyond rotated half-width 10
  });

  it('resizeRotatedBox keeps the opposite corner fixed (deg 0)', () => {
    const box = resizeRotatedBox({ x: 0, y: 0, w: 100, h: 100 }, 'se', 0, { x: 160, y: 140 });
    expect(box).toEqual({ x: 0, y: 0, w: 160, h: 140 });
  });

  it('resizeRotatedBox at 90° keeps the opposite corner pinned in world', () => {
    const box0 = { x: 0, y: 0, w: 100, h: 100 };
    const nwWorld = rotatePoint({ x: 0, y: 0 }, { x: 50, y: 50 }, 90); // (100,0)
    const box = resizeRotatedBox(box0, 'se', 90, { x: 100, y: 200 });
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const nwAfter = rotatePoint({ x: box.x, y: box.y }, c, 90);
    expect(near(nwAfter.x, nwWorld.x)).toBe(true);
    expect(near(nwAfter.y, nwWorld.y)).toBe(true);
  });

  it('shapeHandlePositions rotates the handles with the shape', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.rotation = 90;
    const h = shapeHandlePositions(s);
    expect(near(h.nw.x, 100)).toBe(true); // nw (0,0) → (100,0) around center (50,50)
    expect(near(h.nw.y, 0)).toBe(true);
  });

  it('angleFromCenter: up = 0°, right = 90°', () => {
    expect(near(angleFromCenter({ x: 0, y: 0 }, { x: 0, y: -10 }), 0)).toBe(true);
    expect(near(angleFromCenter({ x: 0, y: 0 }, { x: 10, y: 0 }), 90)).toBe(true);
  });

  it('rotation applies to — and is hit-tested for — every shape kind', () => {
    for (const kind of KINDS) {
      const s = createShape(kind, 0, 0, 100, 40); // wide; center (50,20)
      // (50,-10) is 30 above center: outside the wide unrotated shape...
      expect(pointInShape(s, { x: 50, y: -10 })).toBe(false);
      s.rotation = 90; // ...but inside once rotated tall
      expect(pointInShape(s, { x: 50, y: -10 })).toBe(true);
    }
  });

  it('shapeToSvg emits a rotate transform around the center for every kind', () => {
    for (const kind of KINDS) {
      const s = createShape(kind, 0, 0, 100, 40);
      s.rotation = 45;
      expect(shapeToSvg(s).getAttribute('transform')).toBe('rotate(45 50 20)');
    }
  });
});
