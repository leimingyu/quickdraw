import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape, createConnector, groupNodes, isConnector } from '../../src/model/document';

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

describe('align / distribute controls', () => {
  const alignBtns = () => [...container.querySelectorAll<HTMLButtonElement>('.seg button[data-arrange]')];
  const distBtns = () => [...container.querySelectorAll<HTMLButtonElement>('.seg button[data-distribute]')];

  function select(n: number): ReturnType<typeof createShape>[] {
    const panel = mountProperties(app, container);
    app.onRender = () => panel.update();
    const shapes = Array.from({ length: n }, (_, i) => createShape('rect', i * 100, 20 + i * 5, 40, 20));
    shapes.forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set(shapes.map((s) => s.id));
    app.render();
    return shapes;
  }

  it('shows six align + two distribute buttons when three shapes are selected', () => {
    select(3);
    expect(alignBtns().map((b) => b.dataset.arrange))
      .toEqual(['left', 'hcenter', 'right', 'top', 'vmiddle', 'bottom']);
    expect(distBtns().map((b) => b.dataset.distribute)).toEqual(['hspace', 'vspace']);
  });

  it('shows align but not distribute when only two shapes are selected', () => {
    select(2);
    expect(alignBtns()).toHaveLength(6);
    expect(distBtns()).toHaveLength(0);
  });

  it('shows neither for a single selected shape', () => {
    select(1);
    expect(alignBtns()).toHaveLength(0);
    expect(distBtns()).toHaveLength(0);
  });

  it('clicking an align button aligns the selection', () => {
    const shapes = select(3);
    alignBtns().find((b) => b.dataset.arrange === 'left')!.click();
    expect(shapes.map((s) => s.x)).toEqual([0, 0, 0]);
  });

  it('clicking distribute equalizes gaps', () => {
    const shapes = select(3); // x 0,100,200 all w40
    distBtns().find((b) => b.dataset.distribute === 'hspace')!.click();
    const [a, b, c] = shapes;
    expect(b.x - (a.x + a.w)).toBe(c.x - (b.x + b.w));
  });

  it('counts a group as one unit — a group of two shows no controls', () => {
    const panel = mountProperties(app, container);
    app.onRender = () => panel.update();
    const a = createShape('rect', 0, 0, 40, 20);
    const b = createShape('rect', 100, 0, 40, 20);
    [a, b].forEach((s) => addNode(app.activeTab, s));
    groupNodes(app.activeTab, new Set([a.id, b.id]));
    app.selection = new Set([a.id, b.id]);
    app.render();
    expect(alignBtns()).toHaveLength(0); // one unit → nothing to align
  });
});
