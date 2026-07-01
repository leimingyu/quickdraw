import { describe, it, expect } from 'vitest';
import { copyNodes, pasteNodes } from '../../src/model/copyPaste';
import { createTab, addNode, createShape, createConnector, groupNodes } from '../../src/model/document';
import { isShape, isConnector } from '../../src/model/document';

const attached = (e: any) => e as { nodeId: string };

describe('copyNodes / pasteNodes', () => {
  it('pastes clones with fresh ids, offset by (dx, dy)', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    addNode(tab, a);
    const copied = copyNodes(tab, new Set([a.id]));
    const pasted = pasteNodes(copied, 16, 16);
    expect(pasted).toHaveLength(1);
    expect(pasted[0].id).not.toBe(a.id);
    expect(pasted[0]).toMatchObject({ x: 16, y: 16, w: 100, h: 100 });
  });

  it('expands the copy to whole groups and gives the paste a fresh group id', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 100, 0, 50, 50);
    addNode(tab, a); addNode(tab, b);
    groupNodes(tab, new Set([a.id, b.id]));
    const copied = copyNodes(tab, new Set([a.id])); // select one → copies both
    expect(copied).toHaveLength(2);
    const pasted = pasteNodes(copied, 10, 10);
    const gids = new Set(pasted.map((n) => n.groupId));
    expect(gids.size).toBe(1);
    expect([...gids][0]).not.toBe(a.groupId);
  });

  it('re-links a connector between two copied shapes to the pasted shapes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(tab, n));
    const pasted = pasteNodes(copyNodes(tab, new Set([a.id, b.id, c.id])), 10, 10);
    const ids = new Set(pasted.filter(isShape).map((s) => s.id));
    const conn = pasted.find(isConnector)!;
    expect(ids.has(attached(conn.from).nodeId)).toBe(true);
    expect(ids.has(attached(conn.to).nodeId)).toBe(true);
    expect(attached(conn.from).nodeId).not.toBe(a.id);
  });

  it('drops a connector that references a non-copied shape', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(tab, n));
    const pasted = pasteNodes(copyNodes(tab, new Set([a.id, c.id])), 10, 10); // no B
    expect(pasted.filter(isConnector)).toHaveLength(0);
    expect(pasted.filter(isShape)).toHaveLength(1);
  });

  it('offsets a free connector endpoint but keeps attached ends anchored', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { x: 100, y: 100 });
    [a, c].forEach((n) => addNode(tab, n));
    const pasted = pasteNodes(copyNodes(tab, new Set([a.id, c.id])), 10, 20);
    const conn = pasted.find(isConnector)!;
    expect(conn.to).toEqual({ x: 110, y: 120 });
    expect('nodeId' in conn.from).toBe(true); // still attached (to the pasted A)
  });

  it('leaves the clipboard nodes untouched across repeated pastes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    const copied = copyNodes(tab, new Set([a.id]));
    const p1 = pasteNodes(copied, 16, 16);
    const p2 = pasteNodes(copied, 32, 32);
    expect(p1[0].id).not.toBe(p2[0].id);
    expect(copied[0]).toMatchObject({ x: 0, y: 0 });
  });
});
