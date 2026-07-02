import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';
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

function click(p: Point, shift = false) {
  tool.onPointerDown(p, { shiftKey: shift } as PointerEvent);
  tool.onPointerUp(p, { shiftKey: shift } as PointerEvent);
}

function twoGroupedShapes() {
  const a = createShape('rect', 0, 0, 50, 50);
  const b = createShape('rect', 100, 0, 50, 50);
  addNode(app.activeTab, a);
  addNode(app.activeTab, b);
  app.selection = new Set([a.id, b.id]);
  app.group();
  return { a, b };
}

describe('grouping in the select tool', () => {
  it('clicking one member selects the whole group', () => {
    const { a, b } = twoGroupedShapes();
    app.selection.clear();
    click({ x: 25, y: 25 }); // inside shape a
    expect(app.selection).toEqual(new Set([a.id, b.id]));
  });

  it('dragging a group moves every member together', () => {
    const { a, b } = twoGroupedShapes();
    tool.onPointerDown({ x: 25, y: 25 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 45, y: 35 }, {} as PointerEvent);
    tool.onPointerUp({ x: 45, y: 35 }, {} as PointerEvent);
    expect(a).toMatchObject({ x: 20, y: 10 });
    expect(b).toMatchObject({ x: 120, y: 10 });
  });

  it('a marquee touching one member selects the whole group', () => {
    const { a, b } = twoGroupedShapes();
    app.selection.clear();
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 60, y: 60 }, {} as PointerEvent); // covers only a
    tool.onPointerUp({ x: 60, y: 60 }, {} as PointerEvent);
    expect(app.selection).toEqual(new Set([a.id, b.id]));
  });

  it('ungroup lets members be selected independently again', () => {
    const { a, b } = twoGroupedShapes();
    app.ungroup();
    expect(a.groupId).toBeUndefined();
    app.selection.clear();
    click({ x: 25, y: 25 }); // click a only
    expect(app.selection).toEqual(new Set([a.id]));
    expect(app.selection.has(b.id)).toBe(false);
  });

  it('group is a no-op for a single shape', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    app.group();
    expect(a.groupId).toBeUndefined();
  });
});
