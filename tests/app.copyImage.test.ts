import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

const press = (key: string, opts: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  window.dispatchEvent(ev);
  return ev;
};

describe('Copy as image (⌘⇧C)', () => {
  it('⌘⇧C fires onCopyImage and prevents the default', () => {
    let copied = 0;
    app.onCopyImage = () => { copied++; };
    const ev = press('c', { metaKey: true, shiftKey: true });
    expect(copied).toBe(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Ctrl+Shift+C (Windows/Linux) fires onCopyImage too', () => {
    let copied = 0;
    app.onCopyImage = () => { copied++; };
    press('c', { ctrlKey: true, shiftKey: true });
    expect(copied).toBe(1);
  });

  it('fires even with an empty selection (copies the whole diagram)', () => {
    let copied = 0;
    app.onCopyImage = () => { copied++; };
    expect(app.selection.size).toBe(0);
    press('c', { metaKey: true, shiftKey: true });
    expect(copied).toBe(1);
  });

  it('plain ⌘C does NOT fire onCopyImage — it stays the in-app copy', () => {
    let copied = 0;
    app.onCopyImage = () => { copied++; };
    const s = createShape('rect', 0, 0, 40, 40);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    press('c', { metaKey: true }); // no shift
    expect(copied).toBe(0);
    // and the in-app clipboard still works: paste adds a copy
    press('v', { metaKey: true });
    expect(app.activeTab.nodes).toHaveLength(2);
  });
});
