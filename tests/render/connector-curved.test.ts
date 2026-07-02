import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';
import { curveControl, connectorRoute, connectorToSvg, connectorHit } from '../../src/render/connector';

function curvedConn() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);   // right edge (100,50)
  const b = createShape('rect', 300, 0, 100, 100); // left edge (300,50)
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  c.style.routing = 'curved';
  return { tab, c };
}

describe('curved routing', () => {
  it('curveControl offsets the chord midpoint perpendicular', () => {
    const cc = curveControl({ x1: 0, y1: 0, x2: 100, y2: 0 });
    expect(cc.x).toBeCloseTo(50, 6);
    expect(cc.y).toBeGreaterThan(0); // horizontal chord bulges downward
  });

  it('connectorRoute samples the curve, anchored at the connection points', () => {
    const { tab, c } = curvedConn();
    const pts = connectorRoute(tab, c)!;
    expect(pts).toHaveLength(17); // 16 segments
    expect(pts[0]).toEqual({ x: 100, y: 50 });
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 50 });
    expect(pts[8].y).toBeGreaterThan(50); // apex bulges away from the chord
  });

  it('renders a fill:none path (bezier) with the arrowhead', () => {
    const { tab, c } = curvedConn();
    const path = connectorToSvg(tab, c, false)!.querySelector('path')!;
    expect(path).not.toBeNull();
    expect(path.getAttribute('fill')).toBe('none');
    expect(path.getAttribute('d')).toMatch(/^M100 50 Q/);
    expect(path.getAttribute('marker-end')).toBe('url(#arrowhead)');
  });

  it('connectorHit follows the curve, not the straight chord', () => {
    const { tab, c } = curvedConn();
    const apex = connectorRoute(tab, c)![8];
    expect(connectorHit(tab, c, apex, 4)).toBe(true);
    expect(connectorHit(tab, c, { x: apex.x, y: 50 }, 4)).toBe(false); // on the chord, off the curve
  });
});
