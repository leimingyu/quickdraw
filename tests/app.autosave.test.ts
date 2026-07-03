import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';
import { saveDraft, loadDraft, type StorageLike } from '../src/io/autosave';

// The App exposes an onCommit hook; main.ts drives autosave from it. These tests pin
// the wiring contract (issue #28) without depending on timers or the DOM bootstrap.

function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

describe('App.onCommit (autosave trigger)', () => {
  it('fires on commit, undo, and redo', () => {
    let fired = 0;
    app.onCommit = () => { fired++; };
    addNode(app.activeTab, createShape('rect', 0, 0, 10, 10));
    app.commit();
    expect(fired).toBe(1);
    app.undo();
    expect(fired).toBe(2);
    app.redo();
    expect(fired).toBe(3);
  });

  it('does NOT fire from a plain render (so booting can\'t overwrite a draft)', () => {
    let fired = 0;
    app.onCommit = () => { fired++; };
    app.render();
    expect(fired).toBe(0);
  });

  it('end-to-end: an edit autosaves a recoverable draft', () => {
    const store = memStorage();
    app.onCommit = () => saveDraft(app.workspace, store);
    const s = createShape('ellipse', 12, 34, 40, 40);
    addNode(app.activeTab, s);
    app.commit();
    const draft = loadDraft(store);
    expect(draft).not.toBeNull();
    expect(draft!.workspace.tabs[0].nodes.map((n) => n.id)).toContain(s.id);
  });
});
