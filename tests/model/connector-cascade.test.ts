import { describe, it, expect } from 'vitest';
import {
  createTab, addNode, createShape, createConnector, removeNodes,
  pruneDanglingConnectors, isConnector,
} from '../../src/model/document';

function connectedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  return { tab, a, b, c };
}

describe('connector delete-cascade and prune', () => {
  it('removeNodes drops connectors attached to a removed shape', () => {
    const { tab, a, c } = connectedTab();
    removeNodes(tab, new Set([a.id]));
    expect(tab.nodes.find((n) => n.id === c.id)).toBeUndefined();
    expect(tab.nodes.filter(isConnector)).toHaveLength(0);
  });

  it('removeNodes keeps connectors whose shapes both survive', () => {
    const { tab, c } = connectedTab();
    const lone = createShape('rect', 600, 0, 50, 50);
    addNode(tab, lone);
    removeNodes(tab, new Set([lone.id]));
    expect(tab.nodes.find((n) => n.id === c.id)).toBeDefined();
  });

  it('pruneDanglingConnectors removes connectors with a missing endpoint', () => {
    const { tab, a, c } = connectedTab();
    // simulate a hand-edited/corrupt file: shape A removed directly (no cascade),
    // leaving the connector pointing at a node that no longer exists.
    tab.nodes = tab.nodes.filter((n) => n.id !== a.id);
    pruneDanglingConnectors(tab);
    expect(tab.nodes.find((n) => n.id === c.id)).toBeUndefined();
  });

  it('pruneDanglingConnectors drops a leaked floating-endpoint connector', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { x: 200, y: 50 })); // leaked preview
    pruneDanglingConnectors(tab);
    expect(tab.nodes.filter(isConnector)).toHaveLength(0);
  });
});
