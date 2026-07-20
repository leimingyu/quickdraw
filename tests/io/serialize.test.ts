import { describe, it, expect } from 'vitest';
import { serializeWorkspace, deserializeWorkspace, SAVE_VERSION } from '../../src/io/serialize';
import { createWorkspace, addTab, addNode, createShape, createConnector, groupNodes } from '../../src/model/document';

function sampleWorkspace() {
  const ws = createWorkspace();                        // Tab 1
  const a = createShape('rect', 0, 0, 100, 60);
  a.text = 'Hello';
  const b = createShape('ellipse', 200, 0, 80, 80);
  addNode(ws.tabs[0], a);
  addNode(ws.tabs[0], b);
  groupNodes(ws.tabs[0], new Set([a.id, b.id]));       // exercise groupId round-trip
  addNode(ws.tabs[0], createConnector({ nodeId: a.id }, { nodeId: b.id }));
  const t2 = addTab(ws, 'Second');
  t2.viewport = { panX: 10, panY: 20, zoom: 2 };
  addNode(t2, createShape('diamond', 50, 50, 40, 40));
  ws.activeTabId = ws.tabs[0].id;
  return ws;
}

describe('serializeWorkspace / deserializeWorkspace', () => {
  it('round-trips a multi-tab workspace', () => {
    const ws = sampleWorkspace();
    expect(deserializeWorkspace(serializeWorkspace(ws))).toEqual(ws);
  });

  it('round-trips multi-line shape text (embedded newlines)', () => {
    const ws = createWorkspace();
    const s = createShape('rect', 0, 0, 100, 60);
    s.text = 'line one\nline two\n\nline four';
    addNode(ws.tabs[0], s);
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    expect((restored.tabs[0].nodes[0] as typeof s).text).toBe('line one\nline two\n\nline four');
  });

  it('round-trips a pinned connector anchor', () => {
    const ws = createWorkspace();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    addNode(ws.tabs[0], a);
    addNode(ws.tabs[0], b);
    addNode(ws.tabs[0], createConnector({ nodeId: a.id, anchor: 'ne' }, { nodeId: b.id, anchor: 'sw' }));
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    const conn = restored.tabs[0].nodes.find((n) => n.kind === 'connector')!;
    expect(conn.from).toEqual({ nodeId: a.id, anchor: 'ne' });
    expect(conn.to).toEqual({ nodeId: b.id, anchor: 'sw' });
  });

  it('writes a versioned quickdraw wrapper', () => {
    const obj = JSON.parse(serializeWorkspace(createWorkspace()));
    expect(obj.format).toBe('quickdraw');
    expect(obj.version).toBe(SAVE_VERSION);
    expect(obj.workspace.tabs).toHaveLength(1);
  });

  it('rejects non-JSON text', () => {
    expect(() => deserializeWorkspace('not json {')).toThrow(/valid JSON/i);
  });

  it('rejects a file without the quickdraw format tag', () => {
    expect(() => deserializeWorkspace(JSON.stringify({ hello: 1 }))).toThrow(/QuickDraw file/i);
  });

  it('rejects a newer save version', () => {
    const future = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION + 1, workspace: createWorkspace() });
    expect(() => deserializeWorkspace(future)).toThrow(/newer version/i);
  });

  it('reports a malformed/missing version as corrupt, not "newer version"', () => {
    const bad = JSON.stringify({ format: 'quickdraw', version: 'oops', workspace: createWorkspace() });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('rejects a corrupt workspace (missing tabs)', () => {
    const bad = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION, workspace: { version: 1, activeTabId: 'x' } });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('rejects an empty tabs array', () => {
    const bad = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION, workspace: { version: 1, tabs: [], activeTabId: 'x' } });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('rejects a tab containing a null node (would throw later in prune/render)', () => {
    const ws = createWorkspace();
    const bad = JSON.stringify({
      format: 'quickdraw', version: SAVE_VERSION,
      workspace: { ...ws, tabs: [{ ...ws.tabs[0], nodes: [null] }] },
    });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('rejects a node missing kind/style', () => {
    const ws = createWorkspace();
    const bad = JSON.stringify({
      format: 'quickdraw', version: SAVE_VERSION,
      workspace: { ...ws, tabs: [{ ...ws.tabs[0], nodes: [{ x: 0, y: 0 }] }] },
    });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('repairs an activeTabId that matches no tab', () => {
    const ws = createWorkspace();
    ws.activeTabId = 'ghost';
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    expect(restored.activeTabId).toBe(restored.tabs[0].id);
  });

  it('round-trips brace and bracket shape kinds', () => {
    const ws = createWorkspace();
    addNode(ws.tabs[0], createShape('brace-left', 0, 0, 40, 80));
    addNode(ws.tabs[0], createShape('bracket-right', 60, 0, 40, 80));
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    expect(restored.tabs[0].nodes.map((n) => n.kind)).toEqual(['brace-left', 'bracket-right']);
  });
});
