import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

describe('delete and reset', () => {
  it('deleteSelection removes selected nodes', () => {
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 10, 10);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id]);
    app.deleteSelection();
    expect(app.activeTab.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(app.selection.size).toBe(0);
  });

  it('resetTab clears all nodes and clears selection', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.resetTab();
    expect(app.activeTab.nodes).toHaveLength(0);
    expect(app.selection.size).toBe(0);
  });

  it('deleteSelection is a no-op (no commit) when selection is empty', () => {
    addNode(app.activeTab, createShape('rect', 0, 0));
    const commitSpy = vi.spyOn(app, 'commit');
    app.deleteSelection();
    expect(app.activeTab.nodes).toHaveLength(1);
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('does not handle Delete after destroy()', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(app.activeTab.nodes).toHaveLength(1); // listener was removed; shape survives
  });
});
