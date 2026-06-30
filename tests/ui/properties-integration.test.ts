import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let container: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => app.destroy());

describe('properties panel wired via onRender', () => {
  it('shows the dock after a render once a shape is selected', () => {
    const panel = mountProperties(app, container);
    app.onRender = () => panel.update();
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.render(); // onRender → panel.update()
    expect((container.querySelector('.props') as HTMLElement).style.display).toBe('block');
  });
});
