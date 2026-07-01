import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

const editor = () => document.querySelector('input.text-editor') as HTMLInputElement | null;

describe('App.editText', () => {
  it('opens an editor seeded with the initial character and selects the shape', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.editText(s, 'H');
    expect(editor()?.value).toBe('H');
    expect(app.selection.has(s.id)).toBe(true);
  });

  it('opens seeded with existing text when no initial is given', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    addNode(app.activeTab, s);
    app.editText(s);
    expect(editor()?.value).toBe('Hi');
  });

  it('Enter writes the text and commits exactly once, even if a blur follows', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    const spy = vi.spyOn(app, 'commit');
    app.editText(s);
    const input = editor()!;
    input.value = 'Label';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(s.text).toBe('Label');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(editor()).toBeNull();
  });

  it('Escape cancels without writing, even if a blur follows', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'orig';
    addNode(app.activeTab, s);
    app.editText(s);
    const input = editor()!;
    input.value = 'changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(s.text).toBe('orig');
    expect(editor()).toBeNull();
  });

  it('places the cursor at the end when seeded with an initial character', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.editText(s, 'H');
    const input = editor()!;
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it('selects all existing text when opened without an initial', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hello';
    addNode(app.activeTab, s);
    app.editText(s);
    const input = editor()!;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it('centers the editor vertically in screen space (offset not scaled by zoom)', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.activeTab.viewport = { panX: 0, panY: 0, zoom: 2 };
    app.editText(s);
    // center of shape y = 50; screen = 50*2 = 100; minus 12px half-height = 88
    expect(editor()!.style.top).toBe('88px');
  });
});
