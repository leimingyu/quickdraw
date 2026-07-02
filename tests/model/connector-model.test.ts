import { describe, it, expect } from 'vitest';
import {
  createShape, createConnector, isShape, isConnector, isAttached,
  createWorkspace, getActiveTab, addNode, cloneWorkspace, DEFAULT_CONNECTOR_STYLE,
} from '../../src/model/document';

describe('connector model', () => {
  it('createConnector builds a connector with the default style', () => {
    const c = createConnector({ nodeId: 'a' }, { nodeId: 'b' });
    expect(c.kind).toBe('connector');
    expect(c.from).toEqual({ nodeId: 'a' });
    expect(c.to).toEqual({ nodeId: 'b' });
    expect(c.style).toEqual(DEFAULT_CONNECTOR_STYLE);
    expect(c.style).not.toBe(DEFAULT_CONNECTOR_STYLE); // copied, not shared
    expect(c.id).toBeTruthy();
  });

  it('type guards discriminate shapes and connectors', () => {
    const s = createShape('rect', 0, 0);
    const c = createConnector({ nodeId: 'a' }, { nodeId: 'b' });
    expect(isShape(s)).toBe(true);
    expect(isConnector(s)).toBe(false);
    expect(isConnector(c)).toBe(true);
    expect(isShape(c)).toBe(false);
  });

  it('isAttached distinguishes attached and floating endpoints', () => {
    expect(isAttached({ nodeId: 'a' })).toBe(true);
    expect(isAttached({ x: 1, y: 2 })).toBe(false);
  });

  it('connectors serialize and clone with the workspace', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createConnector({ nodeId: 'a' }, { nodeId: 'b' }));
    const copy = cloneWorkspace(ws);
    const roundTrip = JSON.parse(JSON.stringify(ws));
    expect(getActiveTab(copy).nodes[0].kind).toBe('connector');
    expect(roundTrip.tabs[0].nodes[0].from).toEqual({ nodeId: 'a' });
  });
});
