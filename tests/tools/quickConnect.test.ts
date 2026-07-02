import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape, isConnector, isShape } from '../../src/model/document';
import { portPoints, DUP_GAP } from '../../src/model/quickConnect';
import type { Point } from '../../src/model/geometry';
import type { Shape } from '../../src/model/types';

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

const ev = {} as PointerEvent;
const hover = (p: Point) => tool.onPointerMove(p, ev);
const down = (p: Point) => tool.onPointerDown(p, ev);
const move = (p: Point) => tool.onPointerMove(p, ev);
const up = (p: Point) => tool.onPointerUp(p, ev);
const conns = () => app.activeTab.nodes.filter(isConnector);
const shapes = () => app.activeTab.nodes.filter(isShape);
function rect(x: number, y: number, w: number, h: number): Shape {
  const s = createShape('rect', x, y, w, h);
  addNode(app.activeTab, s);
  return s;
}

describe('SelectTool quick-connect from hover ports', () => {
  it('hovering a shape body reveals its ports (sets hoverShapeId)', () => {
    const s = rect(0, 0, 100, 60);
    hover({ x: 50, y: 30 });
    expect(app.hoverShapeId).toBe(s.id);
    hover({ x: 500, y: 500 });
    expect(app.hoverShapeId).toBeUndefined();
  });

  it('hovering just outside an edge (on a port marker) keeps the shape hovered', () => {
    const s = rect(0, 0, 100, 60);
    hover(portPoints(s).e); // (118, 30) — outside the body
    expect(app.hoverShapeId).toBe(s.id);
  });

  it('dragging a port onto empty canvas creates a connected clone at the drop', () => {
    const s = rect(0, 0, 100, 60);
    const e = portPoints(s).e;
    hover(e);
    down(e);
    move({ x: 400, y: 400 });
    up({ x: 400, y: 400 });
    expect(shapes()).toHaveLength(2);
    const clone = shapes().find((x) => x.id !== s.id)!;
    expect(clone.w).toBe(100);
    expect(clone.h).toBe(60);
    expect(clone.x).toBe(350); // centered on the drop: 400 - 100/2
    expect(clone.y).toBe(370); // 400 - 60/2
    expect(conns()).toHaveLength(1);
    expect(conns()[0].from).toEqual({ nodeId: s.id, anchor: 'e' });
    expect(conns()[0].to).toEqual({ nodeId: clone.id });
    expect(app.selection.has(clone.id)).toBe(true);
  });

  it('dragging a port onto another shape connects the two, creating no new shape', () => {
    const a = rect(0, 0, 100, 60);
    const b = rect(300, 0, 100, 60);
    const e = portPoints(a).e;
    hover(e);
    down(e);
    move({ x: 350, y: 30 }); // inside B
    up({ x: 350, y: 30 });
    expect(shapes()).toHaveLength(2); // no clone
    expect(conns()).toHaveLength(1);
    expect(conns()[0].from).toEqual({ nodeId: a.id, anchor: 'e' });
    const to = conns()[0].to;
    expect('nodeId' in to && to.nodeId).toBe(b.id);
  });

  it('clicking a port (no drag) duplicates the shape in that direction and connects it', () => {
    const s = rect(0, 0, 100, 60);
    const e = portPoints(s).e;
    hover(e);
    down(e);
    up(e); // no movement → a click
    expect(shapes()).toHaveLength(2);
    const clone = shapes().find((x) => x.id !== s.id)!;
    expect(clone.x).toBe(0 + 100 + DUP_GAP); // duplicated to the east
    expect(clone.y).toBe(0);
    expect(conns()).toHaveLength(1);
    expect(conns()[0].from).toEqual({ nodeId: s.id, anchor: 'e' });
    expect(conns()[0].to).toEqual({ nodeId: clone.id, anchor: 'w' });
    expect(app.selection.has(clone.id)).toBe(true);
  });

  it('the n (top) port is suppressed while the shape is the sole selection', () => {
    const s = rect(0, 100, 100, 60);
    app.selection = new Set([s.id]); // rotation knob occupies the top
    hover(portPoints(s).n); // press-target for the top port
    down(portPoints(s).n);
    up(portPoints(s).n);
    // No quick-connect: n is suppressed, so this is not a port press.
    expect(shapes()).toHaveLength(1);
    expect(conns()).toHaveLength(0);
  });

  it('a press near a port with nothing hovered does not quick-connect (no marquee hijack)', () => {
    const s = rect(0, 0, 100, 60);
    const e = portPoints(s).e; // outside the body
    down(e); // no hover() first
    up(e);
    expect(shapes()).toHaveLength(1);
    expect(conns()).toHaveLength(0);
  });

  it('the whole gesture is a single undo', () => {
    const s = rect(0, 0, 100, 60);
    app.commit(); // baseline: just the source shape
    const e = portPoints(s).e;
    hover(e);
    down(e);
    up(e); // duplicate
    expect(app.activeTab.nodes).toHaveLength(3); // src + clone + connector
    app.undo();
    expect(app.activeTab.nodes).toHaveLength(1); // back to just the source
  });

  it('deactivating mid-drag removes the preview connector', () => {
    const s = rect(0, 0, 100, 60);
    const e = portPoints(s).e;
    hover(e);
    down(e);
    move({ x: 400, y: 400 });
    expect(conns()).toHaveLength(1);
    tool.onDeactivate!();
    expect(conns()).toHaveLength(0);
    expect(app.highlightId).toBeUndefined();
  });
});
