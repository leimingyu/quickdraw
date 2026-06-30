import { describe, it, expect, beforeEach } from 'vitest';
import { resetIds } from '../../src/util/id';
import {
  createShape, createTab, createWorkspace, getActiveTab,
  findNode, addNode, removeNodes, reorder, cloneWorkspace,
} from '../../src/model/document';

beforeEach(() => resetIds());

describe('document model', () => {
  it('creates a workspace with one active empty tab', () => {
    const ws = createWorkspace();
    expect(ws.tabs).toHaveLength(1);
    expect(ws.activeTabId).toBe(ws.tabs[0].id);
    expect(getActiveTab(ws).nodes).toHaveLength(0);
    expect(getActiveTab(ws).viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it('creates a shape with defaults and given geometry', () => {
    const s = createShape('rect', 10, 20);
    expect(s.kind).toBe('rect');
    expect(s).toMatchObject({ x: 10, y: 20, w: 120, h: 70 });
    expect(s.style.strokeWidth).toBe(2);
    expect(s.id).toBeTruthy();
  });

  it('adds, finds, and removes nodes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0);
    const b = createShape('ellipse', 50, 50);
    addNode(tab, a);
    addNode(tab, b);
    expect(tab.nodes).toHaveLength(2);
    expect(findNode(tab, a.id)).toBe(a);
    removeNodes(tab, new Set([a.id]));
    expect(tab.nodes).toHaveLength(1);
    expect(findNode(tab, a.id)).toBeUndefined();
  });

  it('reorders a node to front and back', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 0, 0);
    addNode(tab, a);
    addNode(tab, b);
    reorder(tab, a.id, 'front');
    expect(tab.nodes[tab.nodes.length - 1].id).toBe(a.id);
    reorder(tab, a.id, 'back');
    expect(tab.nodes[0].id).toBe(a.id);
  });

  it('deep-clones a workspace independently', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    const copy = cloneWorkspace(ws);
    copy.tabs[0].nodes[0].x = 999;
    expect(getActiveTab(ws).nodes[0].x).toBe(0);
  });
});
