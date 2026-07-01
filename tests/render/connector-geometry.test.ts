import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';
import { connectorSegment, connectorHit, endpointCenter } from '../../src/render/connector';

function tabWithTwoBoxes() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);   // center (50,50)
  const b = createShape('rect', 300, 0, 100, 100);  // center (350,50)
  addNode(tab, a);
  addNode(tab, b);
  return { tab, a, b };
}

describe('connector geometry', () => {
  it('snaps each end to the connection point facing the other shape', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    const seg = connectorSegment(tab, c)!;
    // aligned boxes → A's right-middle handle (100,50) and B's left-middle (300,50)
    expect(seg).toEqual({ x1: 100, y1: 50, x2: 300, y2: 50 });
  });

  it('re-snaps to a corner connection point after a shape moves diagonally', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    b.y = 400; // B now far below-right of A
    const seg = connectorSegment(tab, c)!;
    // A snaps to its bottom-right corner, B to its top-left corner (both facing each other)
    expect({ x: seg.x1, y: seg.y1 }).toEqual({ x: 100, y: 100 });
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 300, y: 400 });
  });

  it('uses a floating endpoint as-is (for the live preview)', () => {
    const { tab, a } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { x: 500, y: 50 });
    addNode(tab, c);
    const seg = connectorSegment(tab, c)!;
    expect(seg.x1).toBe(100); // clipped to A's right edge
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 500, y: 50 });
  });

  it('returns null when an attached shape is missing (dangling)', () => {
    const { tab, a } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: 'gone' });
    addNode(tab, c);
    expect(connectorSegment(tab, c)).toBeNull();
  });

  it('connectorHit is true near the line and false far from it', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    expect(connectorHit(tab, c, { x: 200, y: 52 }, 5)).toBe(true);
    expect(connectorHit(tab, c, { x: 200, y: 80 }, 5)).toBe(false);
  });

  it('endpointCenter returns the shape center or the floating point', () => {
    const { tab, a } = tabWithTwoBoxes();
    expect(endpointCenter(tab, { nodeId: a.id })).toEqual({ x: 50, y: 50 });
    expect(endpointCenter(tab, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
    expect(endpointCenter(tab, { nodeId: 'gone' })).toBeNull();
  });
});
