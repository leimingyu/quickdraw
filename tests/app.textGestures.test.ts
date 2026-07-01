import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { SelectTool } from '../src/tools/selectTool';
import { ShapeTool } from '../src/tools/shapeTool';
import { addNode, createShape, createConnector } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  app.registerTool('select', new SelectTool(app));
  app.registerTool('rect', new ShapeTool(app, 'rect'));
});
afterEach(() => app.destroy());

const editor = () => document.querySelector('input.text-editor') as HTMLInputElement | null;

describe('editing text in any tool', () => {
  it('type-to-edit opens the editor while a shape tool is active', () => {
    app.setTool('rect');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    expect(editor()?.value).toBe('H');
  });

  it('double-click opens the editor in a shape tool and selects the shape', () => {
    app.setTool('rect');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 50, clientY: 50, bubbles: true }));
    expect(editor()).toBeTruthy();
    expect(app.selection.has(s.id)).toBe(true);
  });

  it('double-click still works in the select tool', () => {
    app.setTool('select');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 50, clientY: 50, bubbles: true }));
    expect(editor()).toBeTruthy();
  });

  it('double-click on empty canvas opens nothing', () => {
    app.setTool('select');
    addNode(app.activeTab, createShape('rect', 0, 0, 100, 100));
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 400, clientY: 400, bubbles: true }));
    expect(editor()).toBeNull();
  });

  it('type-to-edit does not fire when a connector is selected', () => {
    app.setTool('select');
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([c.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    expect(editor()).toBeNull();
  });

  it('Enter over a single selection opens the editor with its existing text', () => {
    app.setTool('rect');
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(editor()?.value).toBe('Hi');
  });

  it('Space does not open the editor (reserved for pan)', () => {
    app.setTool('select');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    expect(editor()).toBeNull();
  });

  it('type-to-edit is a no-op when more than one node is selected', () => {
    app.setTool('select');
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 200, 0, 100, 100);
    [a, b].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, b.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    expect(editor()).toBeNull();
  });
});
