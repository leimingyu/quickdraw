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

describe('SelectTool text editing', () => {
  it('applyText writes text to the shape and commits', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.applyText(s.id, 'Hello');
    expect(s.text).toBe('Hello');
  });

  it('double-click on a shape selects it and opens an editor input', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.onDoubleClick({ x: 50, y: 50 }, {} as MouseEvent);
    expect(app.selection.has(s.id)).toBe(true);
    expect(document.querySelector('input.text-editor')).toBeTruthy();
  });
});
