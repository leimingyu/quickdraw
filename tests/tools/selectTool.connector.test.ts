import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape, createConnector } from '../../src/model/document';
import type { Point } from '../../src/model/geometry';

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});
afterEach(() => app.destroy());

function connected() {
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}
function click(p: Point, shift = false) {
  tool.onPointerDown(p, { shiftKey: shift } as PointerEvent);
  tool.onPointerUp(p, { shiftKey: shift } as PointerEvent);
}

describe('SelectTool with connectors', () => {
  it('clicking a connector line selects the connector', () => {
    const { c } = connected();
    click({ x: 200, y: 50 }); // on the line between the two boxes
    expect(app.selection).toEqual(new Set([c.id]));
  });

  it('a shape wins over a connector when they overlap', () => {
    const { a } = connected();
    click({ x: 50, y: 50 }); // inside shape A (line also passes near here)
    expect(app.selection.has(a.id)).toBe(true);
  });

  it('marquee includes a connector only when both endpoint shapes are selected', () => {
    const { a, b, c } = connected();
    // marquee around BOTH boxes
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 410, y: 110 }, {} as PointerEvent);
    tool.onPointerUp({ x: 410, y: 110 }, {} as PointerEvent);
    expect(app.selection).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('marquee around only one endpoint does NOT include the connector', () => {
    const { a, c } = connected();
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 110, y: 110 }, {} as PointerEvent); // covers only A
    tool.onPointerUp({ x: 110, y: 110 }, {} as PointerEvent);
    expect(app.selection.has(a.id)).toBe(true);
    expect(app.selection.has(c.id)).toBe(false);
  });

  it('marquee enclosing a FREE (unattached) connector selects it', () => {
    const c = createConnector({ x: 150, y: 40 }, { x: 250, y: 40 }); // both ends free
    addNode(app.activeTab, c);
    tool.onPointerDown({ x: 100, y: 0 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 300, y: 100 }, {} as PointerEvent); // box covers both free ends
    tool.onPointerUp({ x: 300, y: 100 }, {} as PointerEvent);
    expect(app.selection.has(c.id)).toBe(true);
  });

  it('marquee covering only one end of a free connector does NOT select it', () => {
    const c = createConnector({ x: 150, y: 40 }, { x: 250, y: 40 });
    addNode(app.activeTab, c);
    tool.onPointerDown({ x: 100, y: 0 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 200, y: 100 }, {} as PointerEvent); // covers (150,40) but not (250,40)
    tool.onPointerUp({ x: 200, y: 100 }, {} as PointerEvent);
    expect(app.selection.has(c.id)).toBe(false);
  });
});

/** Dragging a connector's body moves its free ends (attached ends stay pinned to
 *  their shape) — the pointer counterpart of App.nudgeSelection. */
describe('SelectTool dragging connectors', () => {
  const pe = { shiftKey: false } as PointerEvent;

  function drag(from: Point, to: Point) {
    tool.onPointerDown(from, pe);
    tool.onPointerMove(to, pe);
    tool.onPointerUp(to, pe);
  }

  it('dragging the body of a free connector moves both ends', () => {
    const c = createConnector({ x: 100, y: 100 }, { x: 300, y: 100 });
    addNode(app.activeTab, c);
    drag({ x: 200, y: 100 }, { x: 250, y: 140 }); // press on the line, drag by (50,40)
    expect(c.from).toEqual({ x: 150, y: 140 });
    expect(c.to).toEqual({ x: 350, y: 140 });
  });

  it('a single click on a connector selects it and moves nothing', () => {
    const c = createConnector({ x: 100, y: 100 }, { x: 300, y: 100 });
    addNode(app.activeTab, c);
    click({ x: 200, y: 100 });
    expect(app.selection).toEqual(new Set([c.id]));
    expect(c.from).toEqual({ x: 100, y: 100 });
  });

  it('dragging a connector is undoable', () => {
    const c = createConnector({ x: 100, y: 100 }, { x: 300, y: 100 });
    addNode(app.activeTab, c);
    app.commit();
    drag({ x: 200, y: 100 }, { x: 250, y: 140 });
    app.undo();
    const moved = app.activeTab.nodes.find((n) => n.id === c.id)!;
    expect((moved as typeof c).from).toEqual({ x: 100, y: 100 });
  });

  it('an attached end stays pinned while the free end follows the drag', () => {
    const a = createShape('rect', 0, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { x: 300, y: 50 });
    [a, c].forEach((n) => addNode(app.activeTab, n));
    drag({ x: 200, y: 50 }, { x: 230, y: 70 }); // on the line, right of the shape
    expect(c.from).toEqual({ nodeId: a.id });
    expect(c.to).toEqual({ x: 330, y: 70 });
  });

  it('dragging a shape carries a selected connector\'s free end with it', () => {
    const a = createShape('rect', 0, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { x: 300, y: 50 });
    [a, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, c.id]);
    tool.onPointerDown({ x: 50, y: 50 }, pe); // press inside the shape
    tool.onPointerMove({ x: 90, y: 50 }, pe); // drag right by 40
    tool.onPointerUp({ x: 90, y: 50 }, pe);
    expect(a.x).toBe(40);
    expect(c.to).toEqual({ x: 340, y: 50 });
  });

  it('a connector-only drag snaps its ends to the grid when snap-to-grid is on', () => {
    app.snapToGrid = true;
    const c = createConnector({ x: 100, y: 100 }, { x: 300, y: 100 });
    addNode(app.activeTab, c);
    drag({ x: 200, y: 100 }, { x: 223, y: 121 }); // total (23,21) → top-left (123,121) snaps to (120,120)
    expect(c.from).toEqual({ x: 120, y: 120 });
    expect(c.to).toEqual({ x: 320, y: 120 });
  });
});
