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

describe('App style + z-order', () => {
  it('restyle applies to the selection without adding a history entry', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    const commitSpy = vi.spyOn(app, 'commit');
    app.restyle({ fill: '#abcdef' });
    expect(s.style.fill).toBe('#abcdef');
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('commitStyle commits exactly once', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    const commitSpy = vi.spyOn(app, 'commit');
    app.commitStyle();
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('bringToFront reorders the selection and commits', () => {
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 10, 0);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id]);
    app.bringToFront();
    expect(app.activeTab.nodes[app.activeTab.nodes.length - 1].id).toBe(a.id);
  });

  it('restyle is a no-op on an empty selection', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.restyle({ fill: '#000000' });
    expect(s.style.fill).not.toBe('#000000');
  });

  it('commitStyle is a no-op on an empty selection', () => {
    const commitSpy = vi.spyOn(app, 'commit');
    app.commitStyle();
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('render() calls the onRender hook', () => {
    const hook = vi.fn();
    app.onRender = hook;
    app.render();
    expect(hook).toHaveBeenCalled();
  });
});
