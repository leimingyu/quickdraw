import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector, restyleNodes } from '../../src/model/document';
import { elbowRoute, connectorRoute, connectorHit, connectorToSvg } from '../../src/render/connector';

function elbowConn() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 200, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  c.style.routing = 'elbow';
  return { tab, c };
}

describe('elbow routing', () => {
  it('splits vertically for a wide gap (Z, 4 points)', () => {
    expect(elbowRoute({ x1: 0, y1: 0, x2: 100, y2: 40 })).toEqual([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 40 },
    ]);
  });

  it('splits horizontally for a tall gap', () => {
    expect(elbowRoute({ x1: 0, y1: 0, x2: 40, y2: 100 })).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 50 }, { x: 40, y: 50 }, { x: 40, y: 100 },
    ]);
  });

  it('with exit directions, stubs out along the normals then Z-connects', () => {
    // both ends leave horizontally (A exits right, B is entered from its left)
    expect(elbowRoute({ x1: 100, y1: 0, x2: 300, y2: 100 }, { x: 1, y: 0 }, { x: -1, y: 0 })).toEqual([
      { x: 100, y: 0 }, { x: 116, y: 0 }, { x: 200, y: 0 },
      { x: 200, y: 100 }, { x: 284, y: 100 }, { x: 300, y: 100 },
    ]);
  });

  it('with mixed exit directions, makes a clean L (no backtrack)', () => {
    // A exits right (+x), B exits up (its top edge faces A) → single corner
    expect(elbowRoute({ x1: 100, y1: 50, x2: 200, y2: 200 }, { x: 1, y: 0 }, { x: 0, y: -1 })).toEqual([
      { x: 100, y: 50 }, { x: 116, y: 50 }, { x: 200, y: 50 },
      { x: 200, y: 184 }, { x: 200, y: 200 },
    ]);
  });

  it('routes an elbow with clipped, perpendicular ends between two boxes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);     // center (50,50)
    const b = createShape('rect', 300, 200, 100, 100); // center (350,250)
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(tab, n));
    c.style.routing = 'elbow';
    const route = connectorRoute(tab, c)!;
    expect(route[0].x).toBe(100);          // clipped to A's right edge
    expect(route[0].y).toBeCloseTo(83.333, 3);
    expect(route[route.length - 1].x).toBe(300); // clipped to B's left edge
    expect(route[route.length - 1].y).toBeCloseTo(216.667, 3);
    // ends leave perpendicular to the edge they clip to (first/last legs horizontal)
    expect(route[1].y).toBe(route[0].y);
    expect(route[1].x).toBeGreaterThan(route[0].x); // exits rightward out of A
    expect(route[route.length - 1].y).toBe(route[route.length - 2].y);
  });

  it('connectorRoute is a 2-point line when straight, an orthogonal path when elbow', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 300, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(tab, n));
    expect(connectorRoute(tab, c)).toHaveLength(2);
    c.style.routing = 'elbow';
    const route = connectorRoute(tab, c)!;
    expect(route.length).toBeGreaterThan(2);
    for (let i = 0; i + 1 < route.length; i++) { // every leg is axis-aligned
      expect(route[i].x === route[i + 1].x || route[i].y === route[i + 1].y).toBe(true);
    }
  });

  it('renders a fill:none polyline for elbow, a line for straight', () => {
    const { tab, c } = elbowConn();
    const poly = connectorToSvg(tab, c, false)!.querySelector('polyline')!;
    expect(poly).not.toBeNull();
    expect(poly.getAttribute('fill')).toBe('none');
    expect(poly.getAttribute('marker-end')).toBe('url(#arrowhead)');
    c.style.routing = 'straight';
    expect(connectorToSvg(tab, c, false)!.querySelector('line')).not.toBeNull();
  });

  it('connectorHit follows the elbow legs', () => {
    const { tab, c } = elbowConn();
    const route = connectorRoute(tab, c)!;
    const mid = { x: (route[0].x + route[1].x) / 2, y: (route[0].y + route[1].y) / 2 };
    expect(connectorHit(tab, c, mid, 4)).toBe(true);
    expect(connectorHit(tab, c, { x: route[0].x + 9999, y: route[0].y }, 4)).toBe(false);
  });

  it('routing restyles connectors only, not shapes', () => {
    const tab = createTab();
    const s = createShape('rect', 0, 0, 50, 50);
    const a = createShape('rect', 100, 0, 50, 50);
    const c = createConnector({ nodeId: s.id }, { nodeId: a.id });
    [s, a, c].forEach((n) => addNode(tab, n));
    restyleNodes(tab, new Set([s.id, c.id]), { routing: 'elbow' });
    expect((c.style as { routing?: string }).routing).toBe('elbow');
    expect((s.style as { routing?: string }).routing).toBeUndefined();
  });
});
