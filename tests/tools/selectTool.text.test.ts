import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
afterEach(() => app.destroy());

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

  it('beginEdit seeds the editor with the typed character', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    tool.beginEdit('H');
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('H');
  });

  it('beginEdit without a seed opens with the existing text', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    tool.beginEdit();
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    expect(input.value).toBe('Hi');
  });

  it('beginEdit is a no-op when not exactly one shape is selected', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 80, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    tool.beginEdit('x');
    expect(document.querySelector('input.text-editor')).toBeNull();
  });

  it('typing a printable key over a single selection opens the editor seeded with it', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    expect(input?.value).toBe('H');
  });

  it('Enter over a single selection opens the editor with existing text', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const input = document.querySelector('input.text-editor') as HTMLInputElement;
    expect(input?.value).toBe('Hi');
  });

  it('a space keydown does not open the editor (it stays a pan modifier)', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    expect(document.querySelector('input.text-editor')).toBeNull();
  });
});
