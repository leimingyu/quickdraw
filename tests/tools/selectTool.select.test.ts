import { describe, it, expect, beforeEach } from 'vitest';
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

function click(p: Point, shift = false) {
  tool.onPointerDown(p, { shiftKey: shift } as PointerEvent);
  tool.onPointerUp(p, { shiftKey: shift } as PointerEvent);
}

describe('SelectTool selection', () => {
  it('selects a shape on click and clears on empty click', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    click({ x: 50, y: 50 });
    expect(app.selection.has(s.id)).toBe(true);
    click({ x: 500, y: 500 });
    expect(app.selection.size).toBe(0);
  });

  it('shift-click toggles multi-selection', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 100, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    click({ x: 25, y: 25 });
    click({ x: 125, y: 25 }, true);
    expect(app.selection.size).toBe(2);
    click({ x: 125, y: 25 }, true);
    expect(app.selection.has(b.id)).toBe(false);
  });

  it('marquee selects intersecting shapes', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 300, 300, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 100, y: 100 }, {} as PointerEvent);
    tool.onPointerUp({ x: 100, y: 100 }, {} as PointerEvent);
    expect(app.selection.has(a.id)).toBe(true);
    expect(app.selection.has(b.id)).toBe(false);
  });
});
