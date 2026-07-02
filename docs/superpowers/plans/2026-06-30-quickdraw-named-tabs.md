# Named Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-style tab strip at the top of QuickDraw so a drawing can hold multiple named canvases you can switch, add, rename, and close.

**Architecture:** The model already supports multi-tab (`Workspace.tabs[]` + `activeTabId`, each `Tab {id,name,nodes,viewport}`) and the renderer already draws only the active tab. Add three pure model mutators, thin `App` wrappers that commit (add/rename/close) or just re-render (switch), a top HTML strip (`src/ui/tabs.ts`), and make `undo`/`redo` keep you on the current tab so switching stays out of history.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom). No runtime dependencies. SVG canvas; tab strip is plain DOM.

## Global Constraints

- Strict TypeScript. Source under `src/`; tests mirror under `tests/`.
- The model is the single source of truth; every undoable mutation goes through `App.commit()` (snapshot history + re-render).
- Tab strip sits at the **very top**, above the toolbar (browser-style): vertical order is **tab strip → toolbar → body (canvas + properties)**.
- **Add / rename / close a tab are undoable; switching is NOT** (switch mutates `activeTabId` + re-renders only; `undo`/`redo` stay on the current tab when it still exists).
- A workspace always has **≥1 tab**: `removeTab`/`closeTab` no-op on the last tab, and the `×` button is not rendered when only one tab remains.
- New tabs are named **"Tab N"** (N = tab count at creation); the initial workspace tab is **"Tab 1"**.
- Blank/whitespace rename is ignored (keeps the old name). Rename uses the same idempotent `done`-guard idiom as the shape text editor (Enter/blur commit, Escape cancels).
- No close-confirmation dialog (closing is undoable). No per-tab keyboard shortcuts (Ctrl/Cmd+T is browser-reserved).
- Full suite is green before this plan (137/137) and must stay green; `npm run build` clean.

---

### Task 1: Tab model mutators

**Files:**
- Modify: `src/model/document.ts` (add `addTab`, `removeTab`, `renameTab`; change `createWorkspace` to name its tab "Tab 1")
- Test: `tests/model/tabs.test.ts` (new)

**Interfaces:**
- Consumes: existing `createTab(name?)`, `createWorkspace()`, `getActiveTab(ws)`, and the `Tab`/`Workspace` types from `./types`.
- Produces:
  - `addTab(ws: Workspace, name?: string): Tab` — append an empty tab (default name `"Tab ${ws.tabs.length + 1}"`), set it active, return it.
  - `removeTab(ws: Workspace, id: string): void` — remove a tab; no-op if only one tab or unknown id; if the removed tab was active, activate the left neighbor (`tabs[i-1]`) or the new first tab.
  - `renameTab(ws: Workspace, id: string, name: string): void` — set a trimmed name; ignore blank; no-op for unknown id.
  - `createWorkspace()` now yields a single tab named `"Tab 1"`.

- [ ] **Step 1: Write the failing test `tests/model/tabs.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/tabs.test.ts`
Expected: FAIL — `addTab`/`removeTab`/`renameTab` are not exported; and `createWorkspace` names its tab "Untitled".

- [ ] **Step 3: Add the mutators and rename the initial tab in `src/model/document.ts`**

Add these three functions right after the existing `createWorkspace`/`getActiveTab` block (near line 43):

```ts
/** Append a new empty tab named "Tab N" and make it active. Returns the new tab. */
export function addTab(ws: Workspace, name?: string): Tab {
  const tab = createTab(name ?? `Tab ${ws.tabs.length + 1}`);
  ws.tabs.push(tab);
  ws.activeTabId = tab.id;
  return tab;
}

/** Remove a tab. No-op if it's the only tab (a workspace always has ≥1 tab).
 *  If the removed tab was active, activate its left neighbor (or the new first). */
export function removeTab(ws: Workspace, id: string): void {
  if (ws.tabs.length <= 1) return;
  const i = ws.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  ws.tabs.splice(i, 1);
  if (ws.activeTabId === id) {
    const neighbor = ws.tabs[i - 1] ?? ws.tabs[0];
    ws.activeTabId = neighbor.id;
  }
}

/** Rename a tab. A blank/whitespace-only name is ignored (keeps the old name). */
export function renameTab(ws: Workspace, id: string, name: string): void {
  const tab = ws.tabs.find((t) => t.id === id);
  if (!tab) return;
  const trimmed = name.trim();
  if (trimmed) tab.name = trimmed;
}
```

Then change `createWorkspace` so the initial tab is named "Tab 1" (leave `createTab`'s own default parameter untouched — many tests call `createTab()` and rely on it):

```ts
export function createWorkspace(): Workspace {
  const tab = createTab('Tab 1');
  return { version: 1, tabs: [tab], activeTabId: tab.id };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/tabs.test.ts`
Expected: PASS (all 11 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all green (137 prior + 11 new = 148), build clean. No existing test asserts the workspace tab name, so the "Tab 1" change is safe.

- [ ] **Step 6: Commit**

```bash
git add src/model/document.ts tests/model/tabs.test.ts
git commit -m "feat: tab model mutators (addTab/removeTab/renameTab); name first tab Tab 1"
```

---

### Task 2: App tab methods + switch-invisible-to-undo

**Files:**
- Modify: `src/app.ts` (add `addTab`/`closeTab`/`renameTab`/`switchTab`; preserve the current active tab in `undo`/`redo`; import the three model mutators under aliases)
- Test: `tests/app.tabs.test.ts` (new)

**Interfaces:**
- Consumes (from Task 1): `addTab(ws, name?)`, `removeTab(ws, id)`, `renameTab(ws, id, name)` from `./model/document`. Existing `App.commit()`, `App.render()`, `App.undo()`, `App.redo()`, the `App.activeTab` getter, and `App.workspace`/`App.selection`.
- Produces:
  - `App.addTab(): void` — add a tab, clear selection, commit.
  - `App.closeTab(id: string): void` — no-op on the last tab; remove, clear selection if it was active, commit.
  - `App.renameTab(id: string, name: string): void` — rename, commit.
  - `App.switchTab(id: string): void` — set active tab, clear selection, render (no commit).
  - `undo`/`redo` keep the currently active tab active when it still exists in the restored snapshot.

**Note on naming:** the model functions and three of the new `App` methods share the names `addTab`/`renameTab`. Import the model functions under `*Model` aliases so the method bodies call them unambiguously (this mirrors the codebase's habit of keeping model-fn names distinct from method names, e.g. `groupNodes` vs `App.group`).

- [ ] **Step 1: Write the failing test `tests/app.tabs.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.tabs.test.ts`
Expected: FAIL — `app.addTab`/`closeTab`/`renameTab`/`switchTab` are not functions.

- [ ] **Step 3: Import the model mutators (aliased) in `src/app.ts`**

Change the existing `./model/document` import (currently ending `…reorderSelection, isShape, type StylePatch`) to also bring in the three mutators under `*Model` aliases:

```ts
import { createWorkspace, getActiveTab, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors, restyleNodes, reorderSelection, isShape, addTab as addTabModel, removeTab as removeTabModel, renameTab as renameTabModel, type StylePatch } from './model/document';
```

- [ ] **Step 4: Add the four tab methods in `src/app.ts`**

Insert these methods immediately after the existing `ungroup()` method (right before `/** Apply a style patch … */ restyle(...)`):

```ts
  /** Create a new tab, switch to it, and record it (undoable). */
  addTab(): void {
    addTabModel(this.workspace);
    this.selection.clear();
    this.commit();
  }

  /** Close a tab (undoable). No-op on the last remaining tab. */
  closeTab(id: string): void {
    if (this.workspace.tabs.length <= 1) return;
    const wasActive = this.workspace.activeTabId === id;
    removeTabModel(this.workspace, id);
    if (wasActive) this.selection.clear();
    this.commit();
  }

  /** Rename a tab (undoable). Blank names are ignored by the model. */
  renameTab(id: string, name: string): void {
    renameTabModel(this.workspace, id, name);
    this.commit();
  }

  /** Switch the active tab. Not undoable — mutates activeTabId and re-renders only. */
  switchTab(id: string): void {
    if (this.workspace.activeTabId === id) return;
    this.workspace.activeTabId = id;
    this.selection.clear(); // selection ids belong to the previous tab's nodes
    this.render();
  }
```

- [ ] **Step 5: Preserve the active tab across `undo`/`redo` in `src/app.ts`**

Replace the existing `undo()` method:

```ts
  undo(): void {
    const ws = this.history.undo();
    if (!ws) return;
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }
```

with (adds active-tab preservation before the viewport line):

```ts
  undo(): void {
    const ws = this.history.undo();
    if (!ws) return;
    const keepId = this.activeTab.id;            // stay on the current tab if it survives
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    if (ws.tabs.some((t) => t.id === keepId)) ws.activeTabId = keepId;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }
```

Replace the existing `redo()` method the same way:

```ts
  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }
```

with:

```ts
  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    const keepId = this.activeTab.id;            // stay on the current tab if it survives
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    if (ws.tabs.some((t) => t.id === keepId)) ws.activeTabId = keepId;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/app.tabs.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all green (148 prior + 7 new = 155), build clean. In particular, existing history/undo tests still pass (the active-tab-preservation is a no-op for single-tab workspaces).

- [ ] **Step 8: Commit**

```bash
git add src/app.ts tests/app.tabs.test.ts
git commit -m "feat: App tab methods (add/close/rename/switch); keep active tab across undo/redo"
```

---

### Task 3: Tab strip UI, wiring, and styles

**Files:**
- Create: `src/ui/tabs.ts`
- Modify: `src/main.ts` (add `tabStripHost` as the first child of `#app`; mount the strip; compose `onRender`)
- Modify: `src/style.css` (tab-strip styles)
- Test: `tests/ui/tabs.test.ts` (new)

**Interfaces:**
- Consumes (from Task 2): `app.workspace.tabs`, `app.workspace.activeTabId`, `app.addTab()`, `app.closeTab(id)`, `app.renameTab(id, name)`, `app.switchTab(id)`, and the `app.onRender` hook.
- Produces: `mountTabs(app: App, container: HTMLElement): { update: () => void }` — appends a `.tab-strip` to `container` and returns `{ update }` that re-renders the strip from the model (same shape as `mountProperties`).

- [ ] **Step 1: Write the failing test `tests/ui/tabs.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountTabs } from '../../src/ui/tabs';

let app: App;
let host: HTMLElement;
let strip: { update: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  strip = mountTabs(app, host);
  app.onRender = () => strip.update();
  app.render();
});
afterEach(() => app.destroy());

const tabs = () => [...host.querySelectorAll('.tab')] as HTMLElement[];
const names = () => tabs().map((t) => t.querySelector('.tab-name')!.textContent);
const activeName = () => host.querySelector('.tab.active .tab-name')?.textContent ?? null;
const addBtn = () => host.querySelector('.tab-add') as HTMLButtonElement;

describe('tab strip UI', () => {
  it('renders one tab per workspace tab plus an add button', () => {
    expect(tabs()).toHaveLength(1);
    expect(names()).toEqual(['Tab 1']);
    expect(addBtn()).toBeTruthy();
  });

  it('marks the active tab', () => {
    expect(activeName()).toBe('Tab 1');
  });

  it('the add button adds a tab and activates it', () => {
    addBtn().click();
    expect(tabs()).toHaveLength(2);
    expect(activeName()).toBe('Tab 2');
  });

  it('clicking a tab switches to it', () => {
    addBtn().click();                 // Tab 2 active
    tabs()[0].click();                // click Tab 1
    expect(activeName()).toBe('Tab 1');
    expect(app.activeTab.name).toBe('Tab 1');
  });

  it('shows no close button when only one tab exists', () => {
    expect(host.querySelector('.tab-close')).toBeNull();
  });

  it('shows a close button per tab when >1, and closing removes that tab', () => {
    addBtn().click();                 // now 2 tabs
    expect(host.querySelectorAll('.tab-close')).toHaveLength(2);
    (tabs()[1].querySelector('.tab-close') as HTMLButtonElement).click();
    expect(tabs()).toHaveLength(1);
    expect(names()).toEqual(['Tab 1']);
  });

  it('clicking close does not also switch to that tab', () => {
    addBtn().click();                 // Tab 2 active
    (tabs()[0].querySelector('.tab-close') as HTMLButtonElement).click(); // close Tab 1
    expect(app.activeTab.name).toBe('Tab 2');
    expect(tabs()).toHaveLength(1);
  });

  it('double-clicking a tab name opens a rename input; Enter commits', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'Flow';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.activeTab.name).toBe('Flow');
    expect(names()).toEqual(['Flow']);
    expect(host.querySelector('input.tab-rename')).toBeNull();
  });

  it('rename via Escape cancels (keeps the old name)', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.activeTab.name).toBe('Tab 1');
    expect(host.querySelector('input.tab-rename')).toBeNull();
  });

  it('a blank rename keeps the previous name', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.activeTab.name).toBe('Tab 1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/tabs.test.ts`
Expected: FAIL — `../../src/ui/tabs` does not exist / `mountTabs` is not a function.

- [ ] **Step 3: Create `src/ui/tabs.ts`**

```ts
import type { App } from '../app';

export function mountTabs(app: App, container: HTMLElement): { update: () => void } {
  const strip = document.createElement('div');
  strip.className = 'tab-strip';
  container.appendChild(strip);

  function update(): void {
    // Don't rebuild while a rename input is open (it would drop focus mid-edit).
    if (strip.querySelector('input.tab-rename')) return;
    strip.replaceChildren();
    const tabs = app.workspace.tabs;
    const closable = tabs.length > 1;
    for (const tab of tabs) {
      strip.appendChild(tabEl(tab.id, tab.name, tab.id === app.workspace.activeTabId, closable));
    }
    const add = document.createElement('button');
    add.className = 'tab-add';
    add.textContent = '+';
    add.title = 'New tab';
    add.addEventListener('click', () => app.addTab());
    strip.appendChild(add);
  }

  function tabEl(id: string, name: string, active: boolean, closable: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = active ? 'tab active' : 'tab';
    el.dataset.tabId = id;

    const label = document.createElement('span');
    label.className = 'tab-name';
    label.textContent = name;
    el.appendChild(label);

    el.addEventListener('click', () => app.switchTab(id));
    label.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      beginRename(el, id, name);
    });

    if (closable) {
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = '×';
      close.title = 'Close tab';
      close.addEventListener('click', (ev) => {
        ev.stopPropagation(); // don't also switch to the tab
        app.closeTab(id);
      });
      el.appendChild(close);
    }
    return el;
  }

  function beginRename(el: HTMLElement, id: string, current: string): void {
    const input = document.createElement('input');
    input.className = 'tab-rename';
    input.value = current;
    el.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (write: boolean): void => {
      if (done) return;
      done = true;
      const value = input.value;
      input.remove();                 // take the input out before any re-render
      if (write) app.renameTab(id, value); // commit -> render -> update() rebuilds the strip
      else update();                   // cancel: rebuild from the model
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  return { update };
}
```

- [ ] **Step 4: Run the UI test to verify it passes**

Run: `npx vitest run tests/ui/tabs.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Wire the strip into `src/main.ts`**

Add the import near the other UI imports (after `import { mountProperties } from './ui/properties';`):

```ts
import { mountTabs } from './ui/tabs';
```

Add a `tabStripHost` and make it the first child of `#app`. Replace:

```ts
const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(toolbarHost, bodyHost);
```

with (adds `tabStripHost`, prepends it in the append):

```ts
const tabStripHost = document.createElement('div');
const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(tabStripHost, toolbarHost, bodyHost);
```

Then replace the mount/onRender tail:

```ts
const panel = mountProperties(app, propsHost);
app.onRender = () => panel.update();

app.render();
```

with (mount the strip and refresh both on render):

```ts
const tabs = mountTabs(app, tabStripHost);
const panel = mountProperties(app, propsHost);
app.onRender = () => { panel.update(); tabs.update(); };

app.render();
```

- [ ] **Step 6: Add styles to `src/style.css`**

Append at the end of `src/style.css`:

```css
.tab-strip { display: flex; align-items: stretch; gap: 2px; padding: 4px 6px 0; border-bottom: 1px solid #ddd; }
.tab { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid #ddd;
  border-bottom: none; border-radius: 6px 6px 0 0; background: #f5f5f5; cursor: pointer; max-width: 160px; }
.tab .tab-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab.active { background: #fff; font-weight: 600; }
.tab-close { border: none; background: none; cursor: pointer; line-height: 1; color: #888; padding: 0 2px; }
.tab-close:hover { color: #e11d48; }
.tab-add { border: 1px solid #ddd; background: #fff; cursor: pointer; border-radius: 6px; padding: 2px 8px; }
.tab-rename { width: 110px; font: inherit; box-sizing: border-box; }
```

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all green (155 prior + 10 new = 165), build clean. The `main.ts` change is not unit-tested directly (it wires DOM at startup); it is covered by the UI test's use of `mountTabs` and verified live in the whole-feature review.

- [ ] **Step 8: Commit**

```bash
git add src/ui/tabs.ts src/main.ts src/style.css tests/ui/tabs.test.ts
git commit -m "feat: top tab strip UI (switch/add/rename/close) wired above the toolbar"
```

---

## Done — Definition of Done
- A tab strip sits at the top of the app; the active tab is highlighted.
- **Click** switches tabs (each restores its own nodes + camera); selection clears on switch.
- **`+`** adds a "Tab N" tab and switches to it; **double-click** a name renames it inline (Enter/blur commit, Escape cancels, blank ignored); **`×`** closes a tab (hidden when only one remains).
- Add / rename / close are undoable; plain switching is not (undo/redo stay on the current tab).
- `npm test` green; `npm run build` clean.

## Deferred (future)
Drag-to-reorder; duplicate tab; move/copy nodes across tabs; per-tab keyboard navigation; tab persistence to disk (Phase 3 save/open).
