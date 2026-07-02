import { describe, it, expect } from 'vitest';
import { shapeToSvg } from '../../src/render/shapes';
import { connectorToSvg } from '../../src/render/connector';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

describe('style rendering', () => {
  it('a dashed shape gets stroke-dasharray', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.style.dashed = true;
    const g = shapeToSvg(s);
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('a non-dashed shape has no stroke-dasharray', () => {
    const g = shapeToSvg(createShape('rect', 0, 0, 100, 100));
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('a connector with arrowStart gets marker-start, and dashed gets stroke-dasharray', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 300, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    c.style.arrowStart = true;
    c.style.dashed = true;
    [a, b, c].forEach((n) => addNode(tab, n));
    const line = connectorToSvg(tab, c, false)!.querySelector('line')!;
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead)');
    expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
