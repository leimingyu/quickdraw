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

  it('connectorRoute is 2 points when straight, 4 when elbow', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 300, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(tab, n));
    expect(connectorRoute(tab, c)).toHaveLength(2);
    c.style.routing = 'elbow';
    expect(connectorRoute(tab, c)).toHaveLength(4);
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
