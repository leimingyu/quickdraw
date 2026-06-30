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

describe('SelectTool resize', () => {
  it('resizes from the SE handle when one shape is selected', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    // press exactly on the SE handle (100,100)
    tool.onPointerDown({ x: 100, y: 100 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 140, y: 130 }, {} as PointerEvent);
    tool.onPointerUp({ x: 140, y: 130 }, {} as PointerEvent);
    expect(s.w).toBe(140);
    expect(s.h).toBe(130);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });
});
