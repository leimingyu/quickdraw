import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape, createConnector } from '../src/model/document';
import type { Shape } from '../src/model/types';

// Issue #4: after rotating a text box (or any shape) the user needs a way to
// reset it back to the default (landscape, 0°) rotation.

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

describe('App.resetRotation', () => {
  it('resets a rotated text box back to 0°', () => {
    const s = createShape('text', 0, 0, 120, 70);
    s.rotation = 45;
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.resetRotation();
    expect(s.rotation).toBe(0);
  });

  it('resets every selected shape', () => {
    const a = createShape('rect', 0, 0, 50, 50); a.rotation = 30;
    const b = createShape('ellipse', 100, 0, 50, 50); b.rotation = 200;
    [a, b].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, b.id]);
    app.resetRotation();
    expect(a.rotation).toBe(0);
    expect(b.rotation).toBe(0);
  });

  it('is undoable — restores the previous rotation', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.rotation = 90;
    addNode(app.activeTab, s);
    app.commit(); // baseline: shape rotated 90°
    app.selection = new Set([s.id]);
    app.resetRotation();
    expect(s.rotation).toBe(0);
    app.undo();
    expect((app.activeTab.nodes[0] as Shape).rotation).toBe(90);
  });

  it('records no history entry when nothing in the selection is rotated', () => {
    const s = createShape('rect', 0, 0, 100, 100); // rotation undefined
    addNode(app.activeTab, s);
    app.commit(); // the only entry: the shape exists
    app.selection = new Set([s.id]);
    app.resetRotation(); // no-op — nothing rotated
    app.undo(); // undoes the add, not a phantom reset
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('ignores connectors in the selection without error', () => {
    const a = createShape('rect', 0, 0, 50, 50); a.rotation = 45;
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, c.id]);
    expect(() => app.resetRotation()).not.toThrow();
    expect(a.rotation).toBe(0);
  });

  it('no-op when nothing is selected', () => {
    const s = createShape('rect', 0, 0, 50, 50); s.rotation = 45;
    addNode(app.activeTab, s);
    app.resetRotation(); // empty selection
    expect(s.rotation).toBe(45);
  });
});
