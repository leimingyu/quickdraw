import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import type { Point } from '../../src/model/geometry';
import type { ShapeKind } from '../../src/model/types';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

function makeTool(kind: ShapeKind): ShapeTool {
  const tool = new ShapeTool(app, kind);
  app.registerTool(kind, tool);
  app.setTool(kind);
  return tool;
}

/** A click: press and release at the same point (no drag). */
function click(tool: ShapeTool, p: Point) {
  tool.onPointerDown(p);
  tool.onPointerUp(p);
}

/** A drag: press at a, move to b, release at b. */
function drag(tool: ShapeTool, a: Point, b: Point) {
  tool.onPointerDown(a);
  tool.onPointerMove(b);
  tool.onPointerUp(b);
}

describe('ShapeTool', () => {
  it('a click drops a default-sized shape centered on the point', () => {
    const tool = makeTool('rect');
    click(tool, { x: 200, y: 150 });
    expect(app.activeTab.nodes).toHaveLength(1);
    const s = app.activeTab.nodes[0];
    expect(s.kind).toBe('rect');
    expect(s).toMatchObject({ w: 120, h: 70 });
    expect(s.x + s.w / 2).toBeCloseTo(200);
    expect(s.y + s.h / 2).toBeCloseTo(150);
  });

  it('selects the new shape and reverts to the select tool', () => {
    const tool = makeTool('ellipse');
    click(tool, { x: 50, y: 50 });
    expect(app.currentToolName).toBe('select');
    expect(app.selection.has(app.activeTab.nodes[0].id)).toBe(true);
  });

  it('drag draws a shape sized from the start corner to the end corner', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 100, y: 100 }, { x: 260, y: 210 });
    expect(app.activeTab.nodes).toHaveLength(1);
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 100, y: 100, w: 160, h: 110 });
  });

  it('drag is direction-agnostic (normalized box)', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 260, y: 210 }, { x: 100, y: 100 });
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 100, y: 100, w: 160, h: 110 });
  });

  it('shows a single live-preview node that grows during the drag', () => {
    const tool = makeTool('rect');
    tool.onPointerDown({ x: 0, y: 0 });
    expect(app.activeTab.nodes).toHaveLength(1);
    tool.onPointerMove({ x: 40, y: 30 });
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 0, y: 0, w: 40, h: 30 });
    tool.onPointerUp({ x: 40, y: 30 });
    expect(app.activeTab.nodes).toHaveLength(1);
  });

  it('floors a thin drag to a minimum visible size', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 200, y: 2 });
    const s = app.activeTab.nodes[0];
    expect(s.w).toBe(200);
    expect(s.h).toBe(8); // MIN_SIZE floor
  });

  it('commits exactly once per shape (one undo entry)', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 80 });
    expect(app.activeTab.nodes).toHaveLength(1);
    app.undo();
    expect(app.activeTab.nodes).toHaveLength(0);
  });
});
