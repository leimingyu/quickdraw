import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import type { Point } from '../../src/model/geometry';
import type { Shape, ShapeKind } from '../../src/model/types';

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
    const s = app.activeTab.nodes[0] as Shape;
    expect(s.kind).toBe('rect');
    expect(s).toMatchObject({ w: 120, h: 70 });
    expect(s.x + s.w / 2).toBeCloseTo(200);
    expect(s.y + s.h / 2).toBeCloseTo(150);
  });

  it('selects the new shape and stays on the shape tool for continuous drawing', () => {
    const tool = makeTool('ellipse');
    click(tool, { x: 50, y: 50 });
    expect(app.currentToolName).toBe('ellipse');
    expect(app.selection.has(app.activeTab.nodes[0].id)).toBe(true);
  });

  it('keeps drawing the same shape without re-selecting the tool', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 80 });
    drag(tool, { x: 200, y: 0 }, { x: 320, y: 90 });
    expect(app.activeTab.nodes).toHaveLength(2);
    expect(app.currentToolName).toBe('rect');
  });

  it('Escape leaves draw mode and returns to the select tool', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 80 });
    expect(app.currentToolName).toBe('rect');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.currentToolName).toBe('select');
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
    const s = app.activeTab.nodes[0] as Shape;
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

  it('does not create a shape when pressing on an existing shape', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 }); // shape A covers (0,0)-(100,100)
    expect(app.activeTab.nodes).toHaveLength(1);
    tool.onPointerDown({ x: 50, y: 50 }); // press inside A
    tool.onPointerUp({ x: 50, y: 50 });
    expect(app.activeTab.nodes).toHaveLength(1); // no second shape created
  });

  it('press-drags an existing shape to move it instead of drawing', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 }); // shape A at (0,0)-(100,100)
    const a = app.activeTab.nodes[0] as Shape;
    tool.onPointerDown({ x: 50, y: 50 }); // press inside A
    tool.onPointerMove({ x: 80, y: 70 });
    tool.onPointerMove({ x: 100, y: 80 }); // total delta (50, 30)
    tool.onPointerUp({ x: 100, y: 80 });
    expect(app.activeTab.nodes).toHaveLength(1); // still no new shape
    expect({ x: a.x, y: a.y }).toEqual({ x: 50, y: 30 }); // moved by the drag delta
  });

  it('a move is one undo entry that restores the original position', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 });
    tool.onPointerDown({ x: 50, y: 50 });
    tool.onPointerMove({ x: 90, y: 90 }); // delta (40, 40)
    tool.onPointerUp({ x: 90, y: 90 });
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 40, y: 40 });
    app.undo();
    expect(app.activeTab.nodes[0]).toMatchObject({ x: 0, y: 0 }); // back to original
    expect(app.activeTab.nodes).toHaveLength(1);
  });

  it('pressing a shape without moving records no undo entry', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 }); // the only undo entry (the draw)
    tool.onPointerDown({ x: 50, y: 50 }); // press, no move
    tool.onPointerUp({ x: 50, y: 50 });
    app.undo(); // undoes the draw, not a phantom move
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('still draws a new shape from an empty-canvas press', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 });     // shape A
    drag(tool, { x: 200, y: 200 }, { x: 300, y: 300 }); // empty spot → shape B
    expect(app.activeTab.nodes).toHaveLength(2);
  });

  it('moves the whole group when dragging a grouped shape', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 });   // A
    drag(tool, { x: 200, y: 0 }, { x: 300, y: 100 }); // B
    const [a, b] = app.activeTab.nodes as Shape[];
    app.selection = new Set([a.id, b.id]);
    app.group();
    tool.onPointerDown({ x: 50, y: 50 }); // press inside A
    tool.onPointerMove({ x: 60, y: 70 }); // delta (10, 20)
    tool.onPointerUp({ x: 60, y: 70 });
    expect({ x: a.x, y: a.y }).toEqual({ x: 10, y: 20 });
    expect({ x: b.x, y: b.y }).toEqual({ x: 210, y: 20 }); // group-mate moved too
  });
});
