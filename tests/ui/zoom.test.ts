import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';

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
});
