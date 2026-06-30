import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('Enter commits exactly once even when a blur follows the removal', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    const commitSpy = vi.spyOn(app, 'commit');
    tool.onDoubleClick({ x: 50, y: 50 });
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    input.value = 'Hello';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    input.dispatchEvent(new FocusEvent('blur')); // browsers fire blur when a focused element is removed
    expect(s.text).toBe('Hello');
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('input.text-editor')).toBeNull();
  });

  it('Escape cancels without writing, even when a blur follows', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'original';
    addNode(app.activeTab, s);
    tool.onDoubleClick({ x: 50, y: 50 });
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    input.value = 'changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(s.text).toBe('original');
    expect(document.querySelector('input.text-editor')).toBeNull();
  });
});
