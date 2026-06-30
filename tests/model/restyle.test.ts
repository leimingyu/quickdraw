import { describe, it, expect } from 'vitest';
import {
  createTab, addNode, createShape, createConnector,
  restyleNodes, reorderSelection,
} from '../../src/model/document';

function mixedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 50, 50);
  const b = createShape('rect', 100, 0, 50, 50);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  return { tab, a, b, c };
}

describe('restyleNodes', () => {
  it('applies a common key (stroke) to both shapes and connectors in the selection', () => {
    const { tab, a, c } = mixedTab();
    restyleNodes(tab, new Set([a.id, c.id]), { stroke: '#ff0000' });
    expect(a.style.stroke).toBe('#ff0000');
    expect(c.style.stroke).toBe('#ff0000');
  });

  it('routes shape-only keys to shapes and connector-only keys to connectors', () => {
    const { tab, a, c } = mixedTab();
    restyleNodes(tab, new Set([a.id, c.id]), { fill: '#00ff00', arrowEnd: false });
    expect(a.style.fill).toBe('#00ff00');     // shape got fill
    expect('fill' in c.style).toBe(false);    // connector did NOT get fill
    expect(c.style.arrowEnd).toBe(false);     // connector got arrowEnd
  });

  it('sets a new optional field (dashed) even on a node that lacked it', () => {
    const { tab, a } = mixedTab();
    delete a.style.dashed; // simulate an old node
    restyleNodes(tab, new Set([a.id]), { dashed: true });
    expect(a.style.dashed).toBe(true);
  });

  it('ignores nodes not in the id set', () => {
    const { tab, a, b } = mixedTab();
    restyleNodes(tab, new Set([a.id]), { stroke: '#0000ff' });
    expect(b.style.stroke).not.toBe('#0000ff');
  });
});

describe('reorderSelection', () => {
  it('moves the selection to the front, preserving relative order', () => {
    const { tab, a, b, c } = mixedTab(); // order [a, b, c]
    reorderSelection(tab, new Set([a.id]), 'front');
    expect(tab.nodes.map((n) => n.id)).toEqual([b.id, c.id, a.id]);
  });

  it('moves the selection to the back, preserving relative order', () => {
    const { tab, a, b, c } = mixedTab();
    reorderSelection(tab, new Set([b.id, c.id]), 'back');
    expect(tab.nodes.map((n) => n.id)).toEqual([b.id, c.id, a.id]);
  });
});
