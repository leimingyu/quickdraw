import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';
import { connectorSegment, connectorHit, endpointCenter, attachEndpoint } from '../../src/render/connector';

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

  it('clips each end to the true edge (not the corner) after a diagonal move', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    b.y = 400; // B now far below-right of A
    const seg = connectorSegment(tab, c)!;
    // center→center ray leaves A through its bottom edge and enters B through its top —
    // partway across, where the line actually crosses, not snapped to a corner handle.
    expect({ x: seg.x1, y: seg.y1 }).toEqual({ x: 87.5, y: 100 });
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 312.5, y: 400 });
  });

  it('clips an attached end to the ellipse outline, not its bounding box', () => {
    const tab = createTab();
    const e = createShape('ellipse', 0, 0, 100, 100); // circle r=50, center (50,50)
    const b = createShape('rect', 200, 200, 100, 100); // center (250,250), down-right
    addNode(tab, e);
    addNode(tab, b);
    const c = createConnector({ nodeId: e.id }, { nodeId: b.id });
    addNode(tab, c);
    const seg = connectorSegment(tab, c)!;
    expect(Math.hypot(seg.x1 - 50, seg.y1 - 50)).toBeCloseTo(50, 6); // on the circle
    expect(seg.x1).toBeLessThan(100); // not the bbox SE corner
    expect(seg.y1).toBeLessThan(100);
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

  it('attachEndpoint pins to the connection point the drop lands on', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    expect(attachEndpoint(s, { x: 3, y: 4 }, 1)).toEqual({ nodeId: s.id, anchor: 'nw' });   // top-left
    expect(attachEndpoint(s, { x: 98, y: 52 }, 1)).toEqual({ nodeId: s.id, anchor: 'e' });   // right-middle
  });

  it('attachEndpoint stays dynamic (no anchor) when dropped on the body', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    expect(attachEndpoint(s, { x: 50, y: 50 }, 1)).toEqual({ nodeId: s.id }); // center → auto-snap
  });

  it('a pinned endpoint holds its connection point instead of re-snapping', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    // Pin B's end to its SE corner (away from A) — a dynamic end would pick B's NW (facing A).
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id, anchor: 'se' });
    addNode(tab, c);
    let seg = connectorSegment(tab, c)!;
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 400, y: 100 }); // B's SE corner, not the NW facing A
    b.x = 600; // move B; the pin follows the SE corner to its new position
    seg = connectorSegment(tab, c)!;
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 700, y: 100 }); // still B's SE corner (600+100, 100)
  });
});
