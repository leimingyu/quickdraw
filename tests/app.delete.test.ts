import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

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

  it('resetTab clears all nodes', () => {
    addNode(app.activeTab, createShape('rect', 0, 0));
    app.resetTab();
    expect(app.activeTab.nodes).toHaveLength(0);
  });
});
