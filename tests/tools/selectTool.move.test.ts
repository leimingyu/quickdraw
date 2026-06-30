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

describe('SelectTool move', () => {
  it('drags selected shapes by the pointer delta', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.onPointerDown({ x: 50, y: 50 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 70, y: 90 }, {} as PointerEvent);
    tool.onPointerUp({ x: 70, y: 90 }, {} as PointerEvent);
    expect(s.x).toBe(20);
    expect(s.y).toBe(40);
  });

  it('moves all selected shapes together', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 100, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    tool.onPointerDown({ x: 25, y: 25 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 35, y: 25 }, {} as PointerEvent);
    tool.onPointerUp({ x: 35, y: 25 }, {} as PointerEvent);
    expect(a.x).toBe(10);
    expect(b.x).toBe(110);
  });
});
