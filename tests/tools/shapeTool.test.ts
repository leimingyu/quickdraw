import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import type { Point } from '../../src/model/geometry';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

function down(tool: ShapeTool, p: Point) {
  tool.onPointerDown(p, {} as PointerEvent);
  tool.onPointerUp(p, {} as PointerEvent);
}

describe('ShapeTool', () => {
  it('adds a centered shape on click', () => {
    const tool = new ShapeTool(app, 'rect');
    app.registerTool('rect', tool);
    app.setTool('rect');
    down(tool, { x: 200, y: 150 });
    expect(app.activeTab.nodes).toHaveLength(1);
    const s = app.activeTab.nodes[0];
    expect(s.kind).toBe('rect');
    expect(s.x + s.w / 2).toBeCloseTo(200);
    expect(s.y + s.h / 2).toBeCloseTo(150);
  });

  it('selects the new shape and reverts to select tool', () => {
    const tool = new ShapeTool(app, 'ellipse');
    app.registerTool('ellipse', tool);
    app.setTool('ellipse');
    down(tool, { x: 50, y: 50 });
    expect(app.currentToolName).toBe('select');
    expect(app.selection.has(app.activeTab.nodes[0].id)).toBe(true);
  });
});
