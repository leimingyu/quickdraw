import { describe, it, expect } from 'vitest';
import { createShape } from '../../src/model/document';
import {
  portPoints,
  cloneShapeAt,
  duplicateInDirection,
  PORT_OFFSET,
  DUP_GAP,
} from '../../src/model/quickConnect';

describe('quickConnect model', () => {
  describe('portPoints', () => {
    it('places the four ports PORT_OFFSET outside an axis-aligned rect edge midpoints', () => {
      const s = createShape('rect', 0, 0, 100, 60); // center (50,30)
      const p = portPoints(s);
      expect(p.n).toEqual({ x: 50, y: 0 - PORT_OFFSET });
      expect(p.s).toEqual({ x: 50, y: 60 + PORT_OFFSET });
      expect(p.w).toEqual({ x: 0 - PORT_OFFSET, y: 30 });
      expect(p.e).toEqual({ x: 100 + PORT_OFFSET, y: 30 });
    });
  });

  describe('cloneShapeAt', () => {
    it('copies kind/size/style, centers on the point, gets a fresh id and no text', () => {
      const src = createShape('ellipse', 10, 20, 80, 40);
      src.style.fill = '#ff0000';
      src.text = 'hello';
      const c = cloneShapeAt(src, 200, 100);
      expect(c.id).not.toBe(src.id);
      expect(c.kind).toBe('ellipse');
      expect(c.w).toBe(80);
      expect(c.h).toBe(40);
      expect(c.x).toBe(200 - 40); // centered: cx - w/2
      expect(c.y).toBe(100 - 20); // centered: cy - h/2
      expect(c.style.fill).toBe('#ff0000');
      expect(c.style).not.toBe(src.style); // deep-copied, not shared
      expect(c.text).toBeUndefined();
      expect(c.rotation ?? 0).toBe(0);
    });
  });

  describe('duplicateInDirection', () => {
    it('east: clone sits a DUP_GAP to the right, same row, connected e→w', () => {
      const src = createShape('rect', 0, 0, 100, 60);
      const { shape, connector } = duplicateInDirection(src, 'e');
      expect(shape.x).toBe(0 + 100 + DUP_GAP);
      expect(shape.y).toBe(0);
      expect(shape.w).toBe(100);
      expect(shape.h).toBe(60);
      expect(connector.from).toEqual({ nodeId: src.id, anchor: 'e' });
      expect(connector.to).toEqual({ nodeId: shape.id, anchor: 'w' });
    });

    it('west: clone sits a DUP_GAP to the left, connected w→e', () => {
      const src = createShape('rect', 200, 0, 100, 60);
      const { shape, connector } = duplicateInDirection(src, 'w');
      expect(shape.x).toBe(200 - 100 - DUP_GAP);
      expect(shape.y).toBe(0);
      expect(connector.from).toEqual({ nodeId: src.id, anchor: 'w' });
      expect(connector.to).toEqual({ nodeId: shape.id, anchor: 'e' });
    });

    it('south: clone sits a DUP_GAP below, connected s→n', () => {
      const src = createShape('rect', 0, 0, 100, 60);
      const { shape, connector } = duplicateInDirection(src, 's');
      expect(shape.x).toBe(0);
      expect(shape.y).toBe(0 + 60 + DUP_GAP);
      expect(connector.from).toEqual({ nodeId: src.id, anchor: 's' });
      expect(connector.to).toEqual({ nodeId: shape.id, anchor: 'n' });
    });

    it('north: clone sits a DUP_GAP above, connected n→s', () => {
      const src = createShape('rect', 0, 200, 100, 60);
      const { shape, connector } = duplicateInDirection(src, 'n');
      expect(shape.x).toBe(0);
      expect(shape.y).toBe(200 - 60 - DUP_GAP);
      expect(connector.from).toEqual({ nodeId: src.id, anchor: 'n' });
      expect(connector.to).toEqual({ nodeId: shape.id, anchor: 's' });
    });
  });
});
