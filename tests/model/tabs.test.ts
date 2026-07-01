import { describe, it, expect } from 'vitest';
import { createWorkspace, addTab, removeTab, renameTab } from '../../src/model/document';

describe('tab model mutators', () => {
  it('createWorkspace names the initial tab "Tab 1"', () => {
    const ws = createWorkspace();
    expect(ws.tabs).toHaveLength(1);
    expect(ws.tabs[0].name).toBe('Tab 1');
    expect(ws.activeTabId).toBe(ws.tabs[0].id);
  });

  it('addTab appends a "Tab N" tab, activates it, and returns it', () => {
    const ws = createWorkspace();     // Tab 1
    const t = addTab(ws);             // Tab 2
    expect(ws.tabs).toHaveLength(2);
    expect(t.name).toBe('Tab 2');
    expect(ws.tabs[1]).toBe(t);
    expect(ws.activeTabId).toBe(t.id);
    expect(t.nodes).toEqual([]);
  });

  it('addTab honors an explicit name', () => {
    const ws = createWorkspace();
    expect(addTab(ws, 'Diagram').name).toBe('Diagram');
  });

  it('removeTab activates the left neighbor when the active tab is closed', () => {
    const ws = createWorkspace();     // Tab 1 (active)
    const t2 = addTab(ws);            // Tab 2 (active)
    const t3 = addTab(ws);            // Tab 3 (active)
    removeTab(ws, t3.id);
    expect(ws.tabs.map((t) => t.id)).not.toContain(t3.id);
    expect(ws.activeTabId).toBe(t2.id);
  });

  it('removeTab activates the new first tab when the first (active) tab is closed', () => {
    const ws = createWorkspace();     // Tab 1
    const first = ws.tabs[0];
    const t2 = addTab(ws);           // Tab 2 (active)
    ws.activeTabId = first.id;        // make the first tab active
    removeTab(ws, first.id);          // i-1 = -1 -> fall back to tabs[0]
    expect(ws.activeTabId).toBe(t2.id);
    expect(ws.tabs).toHaveLength(1);
  });

  it('removeTab keeps the current active tab when a non-active tab is closed', () => {
    const ws = createWorkspace();
    const t2 = addTab(ws);           // active
    const t3 = addTab(ws);           // active
    removeTab(ws, t2.id);            // close non-active
    expect(ws.activeTabId).toBe(t3.id);
  });

  it('removeTab is a no-op on the only tab', () => {
    const ws = createWorkspace();
    const only = ws.tabs[0];
    removeTab(ws, only.id);
    expect(ws.tabs).toHaveLength(1);
    expect(ws.activeTabId).toBe(only.id);
  });

  it('removeTab is a no-op for an unknown id', () => {
    const ws = createWorkspace();
    addTab(ws);
    removeTab(ws, 'nope');
    expect(ws.tabs).toHaveLength(2);
  });

  it('renameTab sets a trimmed name', () => {
    const ws = createWorkspace();
    renameTab(ws, ws.tabs[0].id, '  Flow  ');
    expect(ws.tabs[0].name).toBe('Flow');
  });

  it('renameTab ignores a blank name', () => {
    const ws = createWorkspace();
    renameTab(ws, ws.tabs[0].id, '   ');
    expect(ws.tabs[0].name).toBe('Tab 1');
  });

  it('renameTab is a no-op for an unknown id', () => {
    const ws = createWorkspace();
    renameTab(ws, 'nope', 'X'); // must not throw
    expect(ws.tabs[0].name).toBe('Tab 1');
  });
});
