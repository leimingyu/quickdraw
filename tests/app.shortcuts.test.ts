import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape, createConnector } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

const press = (key: string, opts: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));

describe('keyboard polish', () => {
  it('⌘A selects every node in the tab', () => {
    const a = createShape('rect', 0, 0);
    const b = createShape('ellipse', 200, 0);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    press('a', { metaKey: true });
    expect(app.selection).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('arrow keys nudge the selection 1px, Shift 10px (undoable)', () => {
    const s = createShape('rect', 100, 100, 50, 50);
    addNode(app.activeTab, s);
    app.commit();
    app.selection = new Set([s.id]);
    press('ArrowRight');
    expect(s.x).toBe(101);
    press('ArrowDown', { shiftKey: true });
    expect(s.y).toBe(110);
    app.undo(); // undoes the last nudge only
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 101, y: 100 });
  });

  it('arrow keys do nothing with an empty selection', () => {
    const s = createShape('rect', 10, 10, 50, 50);
    addNode(app.activeTab, s);
    press('ArrowRight');
    expect(s.x).toBe(10);
  });

  it('nudge shifts a free connector endpoint too', () => {
    const s = createShape('rect', 0, 0, 50, 50);
    const c = createConnector({ nodeId: s.id }, { x: 200, y: 100 });
    [s, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([c.id]);
    press('ArrowRight', { shiftKey: true });
    expect(c.to).toEqual({ x: 210, y: 100 });
  });
});
