# QuickDraw — Named Tabs Design Spec

**Date:** 2026-06-30
**Status:** Approved design (top browser-style strip), pre-implementation
**Topic:** A browser-style tab strip so a drawing can hold multiple named
canvases — switch, add, rename, close.
**Builds on:** the `feat/phase1-core-canvas` branch (Phase 1 core + drag-to-draw,
grouping, connectors, properties panel, text-in-any-tool). This is the last
Phase 2 piece.

---

## 1. Overview

The data model already supports multiple named canvases — `Workspace` holds
`tabs: Tab[]` and an `activeTabId`, each `Tab` has `{ id, name, nodes, viewport }`,
and the renderer already draws only the active tab. What's missing is the **UI**
to expose it. This change adds a **tab strip at the very top of the app**
(above the toolbar) that lets you:

- **Switch** to a tab by clicking it.
- **Add** a tab with a trailing **`+`** button (creates it and switches to it).
- **Rename** a tab by double-clicking its label (inline edit).
- **Close** a tab with its **`×`** button.

### Goals
- Surface the existing multi-tab model with a minimal, familiar top strip.
- Add / rename / close are **undoable**; plain **switching is not** (see §4).
- Each tab keeps its own camera (`viewport`) and selection is per-canvas.

### Non-goals (deferred — YAGNI)
- Drag-to-reorder tabs.
- Duplicate a tab; move/copy nodes across tabs.
- Per-tab keyboard shortcuts (Ctrl/Cmd+T is reserved by the browser).
- A close-confirmation dialog (closing is undoable — see §7).
- Persisting tabs to disk (that's Phase 3 save/open).

---

## 2. Model mutators (`src/model/document.ts`)

The model is the single source of truth; add three pure functions beside the
existing tab helpers (`createTab`, `createWorkspace`, `getActiveTab`). They
mutate the workspace in place (consistent with `addNode`/`removeNodes`/etc.);
`App` wraps each and decides whether to `commit()`.

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

Also change `createWorkspace` so the initial tab reads **"Tab 1"** (today it's
`createTab()` → "Untitled"), so the first tab matches the "Tab N" naming of the
rest. `createTab`'s own default parameter is unchanged (many tests call
`createTab()` and don't assert its name).

```ts
export function createWorkspace(): Workspace {
  const tab = createTab('Tab 1');
  return { version: 1, tabs: [tab], activeTabId: tab.id };
}
```

---

## 3. `App` methods (`src/app.ts`)

Thin wrappers, mirroring the existing `group`/`ungroup`/`restyle` pattern. Add
imports for `addTab`, `removeTab`, `renameTab` from `./model/document`.

```ts
/** Create a new tab, switch to it, and record it (undoable). */
addTab(): void {
  addTab(this.workspace);
  this.selection.clear();
  this.commit();
}

/** Close a tab (undoable). No-op on the last remaining tab. */
closeTab(id: string): void {
  if (this.workspace.tabs.length <= 1) return;
  const wasActive = this.workspace.activeTabId === id;
  removeTab(this.workspace, id);
  if (wasActive) this.selection.clear();
  this.commit();
}

/** Rename a tab (undoable). Blank names are ignored by the model. */
renameTab(id: string, name: string): void {
  renameTab(this.workspace, id, name);
  this.commit();
}

/** Switch the active tab. NOT undoable — mutates activeTabId and re-renders only. */
switchTab(id: string): void {
  if (this.workspace.activeTabId === id) return;
  this.workspace.activeTabId = id;
  this.selection.clear(); // selection ids belong to the previous tab's nodes
  this.render();
}
```

Switching clears the selection and re-renders (the renderer picks up the new
`activeTab` and its stored viewport, so each tab restores its own camera).

---

## 4. Keeping "switch" out of history

History snapshots the whole `Workspace`, including `activeTabId`. `switchTab`
deliberately does **not** `commit()`, so a switch creates no history entry. But
snapshots taken by *other* commits still carry an `activeTabId`, so a naive
undo could yank you to a different tab as a side effect. To make switching
invisible to undo/redo, `undo()`/`redo()` **stay on the currently active tab
when it still exists** in the restored snapshot — the same idea already used to
preserve the live `viewport`.

Capture the current active id *before* reassigning `this.workspace` (alongside
the existing viewport capture), then restore it if it survives. `App.undo()`
becomes (and `App.redo()` mirrors it):

```ts
undo(): void {
  const ws = this.history.undo();
  if (!ws) return;
  const keepId = this.activeTab.id;              // current tab, before reassignment
  const vp = { ...this.activeTab.viewport };     // and its live camera
  this.workspace = ws;
  if (ws.tabs.some((t) => t.id === keepId)) ws.activeTabId = keepId;
  // else keep the snapshot's own activeTabId (e.g. after undoing an "add")
  this.activeTab.viewport = vp;
  this.selection.clear();
  this.render();
}
```

Behavior this produces:

- **Undo a content change** (add/move/delete/style) → you stay on the current
  tab. ✓ ("switching is not undoable")
- **Undo an "add tab"** → the added tab is the current one and is gone from the
  restored snapshot, so `keepId` isn't found → fall back to the snapshot's
  active tab (the one you were on before adding). ✓
- **Undo a "close tab"** → the closed tab reappears; you remain on the neighbor
  you were moved to (it still exists), and can click the restored tab. Accepted.

The viewport-preservation currently in `undo()`/`redo()` reads
`this.activeTab.viewport`; keep it, but note it now applies to whichever tab
ends up active after the rule above.

---

## 5. The tab strip UI (`src/ui/tabs.ts`)

A new `mountTabs(app, host)` renders the strip from `app.workspace.tabs` and
returns `{ update() }` so it can re-render after any change (same shape as
`mountProperties`). All DOM, no SVG.

```ts
export function mountTabs(app: App, host: HTMLElement): { update: () => void }
```

Structure per render:
- A container `<div class="tab-strip">`.
- One `<div class="tab" data-tab-id="…">` per tab, carrying:
  - a `<span class="tab-name">` with the tab's name,
  - a `<button class="tab-close">×</button>` — **omitted when only one tab
    exists** (you can't close the last tab).
  - `class="tab active"` on the active tab.
- A trailing `<button class="tab-add">+</button>`.

Interactions:
- **Click a tab** (not on its `×`, and not while renaming) → `app.switchTab(id)`.
- **Click `×`** → `app.closeTab(id)` (stop propagation so it doesn't also switch).
- **Double-click a tab name** → inline rename: replace the label with an
  `<input class="tab-rename">` seeded with the current name, selected-all,
  focused. **Enter** or **blur** → `app.renameTab(id, input.value)`; **Escape**
  → cancel (no change). Idempotent exit (a `done` guard), matching the shape
  text editor.
- **Click `+`** → `app.addTab()`.

`update()` re-renders the strip in place (rebuild its children from the current
model). The rename `<input>` is created directly by the strip's double-click
handler, not by `update()`. Renaming only mutates the model on commit/cancel, so
no `render()` (and thus no `update()`) fires mid-edit; the rename input is torn
down by its own `done` guard before the post-commit re-render rebuilds the strip
with the new name. So `update()` never needs to preserve a live rename input.

### Wiring (`src/main.ts`)
Add a `tabStripHost` as the **first** child of `#app` (above `toolbarHost`), so
the vertical order is **tab strip → toolbar → body (canvas + properties)**:

```ts
const tabStripHost = document.createElement('div');
// …existing toolbarHost / bodyHost …
root.append(tabStripHost, toolbarHost, bodyHost);
```

Mount after the app and tools exist, and compose the existing `onRender` hook so
both the properties panel and the tab strip refresh on every render:

```ts
const tabs = mountTabs(app, tabStripHost);
const panel = mountProperties(app, propsHost);
app.onRender = () => { panel.update(); tabs.update(); };
app.render();
```

### Styles (`src/style.css`)
A thin horizontal strip consistent with the toolbar:
- `.tab-strip { display: flex; align-items: stretch; gap: 2px; padding: 4px 6px 0; border-bottom: 1px solid #ddd; }`
- `.tab { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid #ddd; border-bottom: none; border-radius: 6px 6px 0 0; background: #f5f5f5; cursor: pointer; max-width: 160px; }`
- `.tab .tab-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
- `.tab.active { background: #fff; font-weight: 600; }`
- `.tab-close { border: none; background: none; cursor: pointer; line-height: 1; color: #888; }`
- `.tab-add { border: 1px solid #ddd; background: #fff; cursor: pointer; border-radius: 6px; padding: 2px 8px; }`
- `.tab-rename { width: 100px; font: inherit; }`

(Exact pixel values are guidance; match the toolbar's look.)

---

## 6. Module layout

| File | Change |
|------|--------|
| `src/model/document.ts` | add `addTab`, `removeTab`, `renameTab`; `createWorkspace` names its tab "Tab 1". |
| `src/app.ts` | add `addTab`/`closeTab`/`renameTab`/`switchTab`; preserve current active tab across `undo`/`redo`; import the three model mutators. |
| `src/ui/tabs.ts` | **new** — `mountTabs(app, host)`: render strip, switch/add/close/rename wiring, `update()`. |
| `src/main.ts` | add `tabStripHost` as first child of `#app`; `mountTabs`; compose `onRender` to update panel + tabs. |
| `src/style.css` | `.tab-strip`, `.tab`, `.tab-name`, `.tab.active`, `.tab-close`, `.tab-add`, `.tab-rename`. |

---

## 7. Error handling & edge cases
- **Last tab:** `removeTab`/`closeTab` no-op on the only tab; the `×` is not
  rendered when a single tab remains.
- **Close active tab:** the left neighbor becomes active (or the new first tab
  if the first was closed); selection clears.
- **Blank rename:** ignored — the tab keeps its previous name.
- **Rename idempotency:** Enter-then-blur commits once; Escape never writes
  (a `done` guard, like the shape text editor).
- **Switch to the active tab:** no-op (no needless render/commit).
- **No close-confirmation:** closing is undoable (Ctrl/Cmd+Z restores the tab
  and its nodes), so no dialog — consistent with the app's undo-first model.

---

## 8. Testing (Vitest, jsdom)

**Model (`tests/model/tabs.test.ts`):**
- `addTab` appends a tab, names it "Tab N", makes it active, returns it.
- `removeTab` removes a tab and, when it was active, activates the left
  neighbor; is a no-op when only one tab remains; no-op for an unknown id.
- `removeTab` of a non-active tab keeps the current active tab.
- `renameTab` sets a trimmed name; ignores blank/whitespace; no-op for unknown id.
- `createWorkspace` names its initial tab "Tab 1".

**App (`tests/app.tabs.test.ts`):**
- `addTab` adds + activates a new tab and records history (undo removes it and
  returns to the prior active tab); selection cleared.
- `closeTab` removes a tab, activates the neighbor, records history (undo
  restores it); no-op on the last tab.
- `renameTab` commits a new name (undoable).
- `switchTab` changes `activeTabId`, clears selection, and creates **no**
  history entry (undo after a switch-then-edit does not switch tabs).
- Undo of a plain content change (add a shape) does **not** change the active
  tab (switch-invisible-to-undo rule).

**UI (`tests/ui/tabs.test.ts`):**
- Renders one `.tab` per tab with the active one marked; a trailing `.tab-add`.
- Clicking a tab calls `switchTab` (active class moves).
- Clicking `.tab-close` closes that tab (and does not also switch).
- `.tab-close` is absent when only one tab exists.
- Clicking `.tab-add` adds a tab (strip grows, new tab active).
- Double-click a name opens `.tab-rename`; Enter commits the new name; Escape
  cancels; blank keeps the old name.
- `update()` re-renders after a model change.

**Integration:** add two tabs → draw distinct shapes in each → switching shows
each tab's own nodes and camera; closing the active tab lands on the neighbor.

---

## 9. Decisions (resolved)
- **Placement:** top strip, above the toolbar (browser-style).
- **Undoability:** add / rename / close are undoable; switching is not
  (kept out of history via the preserve-active-tab rule in undo/redo).
- **Last tab:** always keep ≥1 tab; `×` hidden when one remains.
- **Naming:** new tabs are "Tab N" (N = tab count at creation); the first tab
  is "Tab 1".
- **No close-confirmation** (undo covers it); no per-tab keyboard shortcuts.
- **Rename** uses the same inline-edit + `done`-guard idiom as shape text.

## 10. Future (not now)
Drag-to-reorder; duplicate tab; move/copy nodes across tabs; per-tab
keyboard navigation; tab persistence to disk (Phase 3 save/open).
