import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';

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

const pe = { shiftKey: false } as PointerEvent;

describe('SelectTool alignment snapping', () => {
  it('snaps a dragged shape to another shape edge and shows guides, clearing on release', () => {
    const target = createShape('rect', 0, 0, 100, 100); // left edge x=0
    const moving = createShape('rect', 300, 0, 100, 100);
    addNode(app.activeTab, target);
    addNode(app.activeTab, moving);
    app.selection = new Set([moving.id]);
    tool.onPointerDown({ x: 350, y: 50 }, pe);
    tool.onPointerMove({ x: 53, y: 50 }, pe); // left edge lands at x=3 → within 6 of target's x=0
    expect(moving.x).toBe(0); // snapped
    expect(app.snapGuides.length).toBeGreaterThan(0);
    tool.onPointerUp({ x: 53, y: 50 }, pe);
    expect(app.snapGuides).toHaveLength(0); // guides cleared on release
  });

  it('does not snap when no edge is within tolerance', () => {
    const target = createShape('rect', 0, 0, 100, 100);
    const moving = createShape('rect', 300, 0, 100, 100);
    addNode(app.activeTab, target);
    addNode(app.activeTab, moving);
    app.selection = new Set([moving.id]);
    tool.onPointerDown({ x: 350, y: 50 }, pe);
    tool.onPointerMove({ x: 360, y: 200 }, pe); // small move, far from target
    expect(moving.x).toBe(310); // 300 + 10, unsnapped
    expect(app.snapGuides).toHaveLength(0);
  });
});

describe('SelectTool snap-to-grid', () => {
  it('snaps the dragged shape top-left to the grid, drawing no alignment guides', () => {
    app.snapToGrid = true;
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    tool.onPointerDown({ x: 50, y: 50 }, pe);
    tool.onPointerMove({ x: 73, y: 71 }, pe); // total (23,21) → top-left (23,21) snaps to (20,20)
    expect(s.x).toBe(20);
    expect(s.y).toBe(20);
    expect(app.snapGuides).toHaveLength(0);
    tool.onPointerUp({ x: 73, y: 71 }, pe);
  });

  it('shifts the whole selection by one grid offset, preserving relative layout', () => {
    app.snapToGrid = true;
    const a = createShape('rect', 0, 0, 40, 40); // top-left of the selection
    const b = createShape('rect', 63, 17, 40, 40); // 63,17 relative to a
    [a, b].forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set([a.id, b.id]);
    tool.onPointerDown({ x: 10, y: 10 }, pe);
    tool.onPointerMove({ x: 33, y: 31 }, pe); // total (23,21): a's corner (23,21) snaps to (20,20)
    expect([a.x, a.y]).toEqual([20, 20]);
    expect([b.x, b.y]).toEqual([83, 37]); // b keeps its +63,+17 offset from a
  });
});
