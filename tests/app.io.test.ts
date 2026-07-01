import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { createWorkspace, addTab, addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

describe('App document I/O touchpoints', () => {
  it('replaceWorkspace swaps in the new workspace and renders it', () => {
    const ws = createWorkspace();
    addTab(ws, 'Loaded');
    addNode(app.activeTab, createShape('rect', 0, 0, 10, 10)); // node on the CURRENT doc
    app.replaceWorkspace(ws);
    expect(app.workspace).toBe(ws);
    expect(app.workspace.tabs).toHaveLength(2);
  });

  it('replaceWorkspace lands on the loaded workspace\'s active tab (round-trip fidelity)', () => {
    const ws = createWorkspace();                          // Tab 1
    const second = addTab(ws, 'Second');                   // addTab makes Second active
    addNode(second, createShape('rect', 0, 0, 40, 40));    // content on the active tab
    app.replaceWorkspace(ws);
    expect(app.activeTab.id).toBe(second.id);              // honored the saved active tab, not tabs[0]
    expect(app.activeTab.nodes).toHaveLength(1);
  });

  it('replaceWorkspace clears the selection', () => {
    const s = createShape('rect', 0, 0, 40, 40);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.replaceWorkspace(createWorkspace());
    expect(app.selection.size).toBe(0);
  });

  it('replaceWorkspace resets history (cannot undo past the loaded doc)', () => {
    addNode(app.activeTab, createShape('rect', 0, 0, 40, 40));
    app.commit();                             // undo history now exists
    app.replaceWorkspace(createWorkspace());  // load a fresh doc
    app.undo();                               // must not resurrect the old drawing
    expect(app.workspace.tabs).toHaveLength(1);
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('Ctrl/Cmd+S fires onSave and prevents the default', () => {
    let saved = 0;
    app.onSave = () => { saved++; };
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(saved).toBe(1);
    expect(ev.defaultPrevented).toBe(true);
  });
});
