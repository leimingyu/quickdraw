import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape, isShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

const key = (k: string) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: true, bubbles: true }));

describe('copy / cut / paste / duplicate', () => {
  it('paste adds an offset clone and selects it (undoable)', () => {
    const a = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, a);
    app.commit(); // baseline snapshot includes `a`
    app.selection = new Set([a.id]);
    app.copySelection();
    app.paste();
    expect(app.activeTab.nodes).toHaveLength(2);
    const pasted = app.activeTab.nodes.find((n) => n.id !== a.id)!;
    expect(pasted.id).not.toBe(a.id);
    expect(app.selection).toEqual(new Set([pasted.id]));
    expect(pasted).toMatchObject({ x: 16, y: 16 });
    app.undo();
    expect(app.activeTab.nodes).toHaveLength(1); // paste is one history entry
  });

  it('each successive paste steps further from the original', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    app.copySelection();
    app.paste();
    app.paste();
    const xs = app.activeTab.nodes.filter(isShape).map((s) => s.x).sort((p, q) => p - q);
    expect(xs).toEqual([0, 16, 32]);
  });

  it('cut copies then removes the selection', () => {
    const a = createShape('rect', 0, 0, 40, 40);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    app.cut();
    expect(app.activeTab.nodes).toHaveLength(0);
    app.paste();
    expect(app.activeTab.nodes).toHaveLength(1); // clipboard survived the cut
  });

  it('duplicate copies the selection in place without using the clipboard', () => {
    const a = createShape('rect', 5, 5, 40, 40);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    app.copySelection(); // put something else on the clipboard first
    const other = createShape('ellipse', 200, 200, 40, 40);
    addNode(app.activeTab, other);
    app.selection = new Set([other.id]);
    app.duplicate();
    expect(app.activeTab.nodes).toHaveLength(3); // a, other, other-copy
    const dup = app.activeTab.nodes.find((n) => n.id !== a.id && n.id !== other.id)!;
    expect(dup).toMatchObject({ kind: 'ellipse', x: 216, y: 216 }); // duplicated `other`, not the clipboard
  });

  it('⌘C then ⌘V pastes via keyboard', () => {
    const a = createShape('rect', 0, 0, 30, 30);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    key('c');
    key('v');
    expect(app.activeTab.nodes).toHaveLength(2);
  });

  it('pastes into a different tab', () => {
    const a = createShape('rect', 0, 0, 30, 30);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    app.copySelection();
    app.addTab(); // switch to a fresh empty tab
    expect(app.activeTab.nodes).toHaveLength(0);
    app.paste();
    expect(app.activeTab.nodes).toHaveLength(1);
  });
});
