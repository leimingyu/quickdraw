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

describe('App tab operations', () => {
  it('addTab creates and activates a new tab, and is undoable', () => {
    const firstId = app.activeTab.id;
    app.addTab();
    expect(app.workspace.tabs).toHaveLength(2);
    expect(app.activeTab.id).not.toBe(firstId);
    app.undo();
    expect(app.workspace.tabs).toHaveLength(1);
    expect(app.activeTab.id).toBe(firstId); // fell back to the snapshot's active tab
  });

  it('addTab clears the selection', () => {
    const s = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.addTab();
    expect(app.selection.size).toBe(0);
  });

  it('closeTab removes a tab, activates the neighbor, and is undoable', () => {
    const firstId = app.activeTab.id;
    app.addTab();                    // second tab, now active
    const secondId = app.activeTab.id;
    app.closeTab(secondId);
    expect(app.workspace.tabs).toHaveLength(1);
    expect(app.activeTab.id).toBe(firstId);
    app.undo();                      // restore the closed tab
    expect(app.workspace.tabs).toHaveLength(2);
  });

  it('closeTab is a no-op on the last tab', () => {
    const onlyId = app.activeTab.id;
    app.closeTab(onlyId);
    expect(app.workspace.tabs).toHaveLength(1);
  });

  it('renameTab commits a new name (undoable)', () => {
    const id = app.activeTab.id;
    app.renameTab(id, 'Renamed');
    expect(app.activeTab.name).toBe('Renamed');
    app.undo();
    expect(app.activeTab.name).toBe('Tab 1');
  });

  it('switchTab changes the active tab, clears selection, and adds no history entry', () => {
    const firstId = app.activeTab.id;
    app.addTab();                    // commits; second tab active
    const s = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.switchTab(firstId);          // no commit
    expect(app.activeTab.id).toBe(firstId);
    expect(app.selection.size).toBe(0);
    app.undo();                      // undoes addTab (the last commit), not the switch
    expect(app.workspace.tabs).toHaveLength(1);
  });

  it('undo of a content change does not switch tabs', () => {
    app.addTab();                    // tab 2 active (committed)
    const secondId = app.activeTab.id;
    const s = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, s);
    app.commit();                    // commit the shape on tab 2
    app.undo();                      // undo the shape add
    expect(app.activeTab.id).toBe(secondId); // stayed on tab 2
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('undo keeps the live camera on the tab you stay on', () => {
    const s = createShape('rect', 0, 0, 50, 50);
    addNode(app.activeTab, s);
    app.commit();                                              // snapshot has default camera
    app.activeTab.viewport = { panX: 20, panY: 20, zoom: 1.5 }; // pan after the commit (live only)
    app.undo();                                                // undo the shape; stay on Tab 1
    expect(app.activeTab.viewport).toEqual({ panX: 20, panY: 20, zoom: 1.5 });
  });

  it('undo of an add does not bleed the added tab camera onto the tab you land on', () => {
    const firstId = app.activeTab.id;
    app.addTab();                                              // Tab 2 active
    app.activeTab.viewport = { panX: 300, panY: 300, zoom: 3 }; // pan Tab 2
    app.undo();                                                // fall back to Tab 1
    expect(app.activeTab.id).toBe(firstId);
    expect(app.activeTab.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 }); // Tab 1's own camera
  });

  it('a no-op rename (blank or unchanged) does not consume an undo step', () => {
    const id = app.activeTab.id;
    app.renameTab(id, 'Renamed'); // real change -> one history entry
    app.renameTab(id, '   ');       // blank -> ignored, no history entry
    app.renameTab(id, 'Renamed');   // unchanged -> no history entry
    app.undo();                     // must undo 'Renamed', not a phantom no-op
    expect(app.activeTab.name).toBe('Tab 1');
  });
});
