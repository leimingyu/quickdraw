import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape, createConnector, isConnector } from '../../src/model/document';

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

  it('the routing selector changes a connector between straight / elbow / curved', () => {
    const panel = mountProperties(app, container);
    app.onRender = () => panel.update();
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 300, 0);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([c.id]);
    app.render();
    // three routing buttons, Straight active by default
    const seg = () => [...container.querySelectorAll<HTMLButtonElement>('.seg button[data-routing]')];
    expect(seg().map((btn) => btn.dataset.routing)).toEqual(['straight', 'elbow', 'curved']);
    seg().find((btn) => btn.dataset.routing === 'curved')!.click();
    const conn = app.activeTab.nodes.find(isConnector)!;
    expect(conn.style.routing).toBe('curved');
    expect(app.connectorRouting).toBe('curved'); // also becomes the default for new connectors
  });
});
