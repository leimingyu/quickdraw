import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import { SelectTool } from '../../src/tools/selectTool';
import type { Point } from '../../src/model/geometry';
import type { Shape } from '../../src/model/types';

// Regression: github.com/leimingyu/quickdraw/issues/2 — "after adding the textbox,
// I couldn't drag the dashed boundary to enlarge." The text tool used to stay
// active after placing a box, so pressing its resize handle moved it (or drew a
// new box) instead of resizing. Placing a text box now hands off to Select, whose
// resize handles work immediately.

let app: App;
let select: SelectTool;
let text: ShapeTool;

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  select = new SelectTool(app);
  app.registerTool('select', select);
  text = new ShapeTool(app, 'text');
  app.registerTool('text', text);
  app.setTool('text');
});
afterEach(() => app.destroy());

function click(tool: ShapeTool, p: Point) {
  tool.onPointerDown(p);
  tool.onPointerUp(p);
}

describe('text box placement → resize', () => {
  it('placing a text box selects it and hands off to the select tool', () => {
    click(text, { x: 200, y: 150 });
    const box = app.activeTab.nodes[0] as Shape;
    expect(box.kind).toBe('text');
    expect(app.selection.has(box.id)).toBe(true);
    expect(app.currentToolName).toBe('select'); // the fix: no longer stuck on 'text'
  });

  it('the placed text box can be enlarged from its SE handle', () => {
    click(text, { x: 200, y: 150 }); // default box: x140 y115 w120 h70
    const box = app.activeTab.nodes[0] as Shape;
    const se = { x: box.x + box.w, y: box.y + box.h }; // (260,185)
    // Drive the now-active select tool, as the app's dispatcher would.
    select.onPointerDown(se, { shiftKey: false } as PointerEvent);
    select.onPointerMove({ x: se.x + 40, y: se.y + 30 }, {} as PointerEvent);
    select.onPointerUp({ x: se.x + 40, y: se.y + 30 }, {} as PointerEvent);
    expect(box.w).toBe(160);
    expect(box.h).toBe(100);
    expect(app.activeTab.nodes).toHaveLength(1); // resized, not a second box drawn
  });

  it('drawing a text box by dragging also hands off to select', () => {
    text.onPointerDown({ x: 100, y: 100 });
    text.onPointerMove({ x: 260, y: 210 });
    text.onPointerUp({ x: 260, y: 210 });
    const box = app.activeTab.nodes[0] as Shape;
    expect(box).toMatchObject({ x: 100, y: 100, w: 160, h: 110 });
    expect(app.currentToolName).toBe('select');
  });
});
