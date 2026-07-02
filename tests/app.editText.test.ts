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

const editor = () => document.querySelector('textarea.text-editor') as HTMLTextAreaElement | null;

describe('App.editText', () => {
  it('opens a textarea editor seeded with the initial character and selects the shape', () => {
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

  it('Shift+Enter inserts a newline instead of committing (editor stays open)', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    const spy = vi.spyOn(app, 'commit');
    app.editText(s);
    const input = editor()!;
    input.value = 'first';
    const ev = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
    input.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false); // the textarea keeps its native newline behavior
    expect(spy).not.toHaveBeenCalled();
    expect(editor()).not.toBeNull(); // still editing
  });

  it('commits a multi-line value on Enter', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.editText(s);
    const input = editor()!;
    input.value = 'line one\nline two';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(s.text).toBe('line one\nline two');
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

  it('overlays the shape box in screen space (origin + size scaled by zoom)', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.activeTab.viewport = { panX: 0, panY: 0, zoom: 2 };
    app.editText(s);
    const input = editor()!;
    expect(input.style.left).toBe('0px');
    expect(input.style.top).toBe('0px');
    expect(input.style.width).toBe('200px'); // 100 * 2
    expect(input.style.height).toBe('200px'); // 100 * 2
  });
});
