import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector, pruneDanglingConnectors, isConnector } from '../../src/model/document';

const conns = (tab: ReturnType<typeof createTab>) => tab.nodes.filter(isConnector);

describe('pruneDanglingConnectors (free endpoints allowed)', () => {
  it('keeps a connector with one free endpoint', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { x: 200, y: 200 }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('keeps a fully free-floating connector', () => {
    const tab = createTab();
    addNode(tab, createConnector({ x: 10, y: 10 }, { x: 90, y: 90 }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('keeps a connector attached to two existing shapes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, b);
    addNode(tab, createConnector({ nodeId: a.id }, { nodeId: b.id }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('drops a connector whose attached end references a missing shape', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { nodeId: 'ghost' }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(0);
  });
});
