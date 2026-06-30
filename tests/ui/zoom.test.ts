import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { createShape, addNode } from '../../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

afterEach(() => app.destroy());

describe('pan and zoom', () => {
  it('zoomBy multiplies zoom and clamps', () => {
    app.zoomBy(2, 0, 0);
    expect(app.activeTab.viewport.zoom).toBe(2);
    app.zoomBy(100, 0, 0); // clamp to 8
    expect(app.activeTab.viewport.zoom).toBe(8);
  });

  it('panBy shifts the viewport', () => {
    app.panBy(30, -10);
    expect(app.activeTab.viewport.panX).toBe(30);
    expect(app.activeTab.viewport.panY).toBe(-10);
  });

  it('resetView restores defaults', () => {
    app.zoomBy(2, 0, 0);
    app.panBy(50, 50);
    app.resetView();
    expect(app.activeTab.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it('space keydown from an input is not hijacked by space-pan (labels can contain spaces)', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const ev = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    input.dispatchEvent(ev); // bubbles to window; target is the input
    expect(ev.defaultPrevented).toBe(false);
    input.remove();
  });

  it('undo does not move the camera (viewport preserved across history swap)', () => {
    addNode(app.activeTab, createShape('rect', 0, 0));
    app.commit();                 // commit 1
    app.zoomBy(2, 0, 0);          // viewport changes are NOT committed
    app.panBy(50, 30);
    const vp = { ...app.activeTab.viewport };
    addNode(app.activeTab, createShape('rect', 10, 10));
    app.commit();                 // commit 2
    app.undo();                   // removes shape 2; camera must stay put
    expect(app.activeTab.nodes).toHaveLength(1);
    expect(app.activeTab.viewport).toEqual(vp);
  });
});
