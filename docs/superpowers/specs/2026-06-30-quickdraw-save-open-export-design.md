# QuickDraw — Save / Open / Export Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pre-implementation
**Topic:** Persist a drawing to disk and reopen it to keep editing (round-trip
`.json`), plus export the current tab as an image (SVG / PNG). This is Phase 3a.
**Builds on:** the `feat/phase1-core-canvas` branch (Phase 1 + Phase 2: connectors,
properties, text-in-any-tool, named tabs). Browser autosave was deliberately
removed earlier; this replaces it with explicit, user-driven save/open.

---

## 1. Overview

The whole `Workspace` is already plain, JSON-serializable data (`structuredClone`
is used for history), so persistence is mostly serialization + a thin browser
I/O layer. This change lets the user:

- **Save** the entire drawing (all tabs) to a `.json` file and **Open** it later
  to keep editing — a true round-trip.
- **Export** the current tab as an **SVG** (vector) or **PNG** (raster) image.

The design isolates the *pure, testable* logic (serialize, bounds, SVG string)
from the *browser-only* I/O (file pickers, downloads, canvas), so the hard-to-test
surface stays as thin as possible.

### Goals
- Round-trip: `Open(Save(ws))` reproduces the workspace (all tabs, nodes, styles,
  groups, names, viewports).
- Save writes **in place** where the browser supports it (File System Access API,
  Chrome/Edge), and falls back to a plain download everywhere else.
- Export the active tab cropped to its **content bounds** (independent of pan/zoom).
- No new runtime dependencies (stays vanilla).

### Non-goals (deferred — separate Phase 3 sub-projects)
- Copy / paste (within and across tabs).
- Alignment guides / snapping.
- Elbow (orthogonal) connector routing.
- Multi-file "recent files", cloud sync, autosave, or a dirty-state `beforeunload`
  guard (refresh still discards unsaved work — the previously accepted behavior).

---

## 2. Architecture (four units)

| Unit | Kind | Responsibility |
|------|------|----------------|
| `src/io/serialize.ts` | pure | `serializeWorkspace` / `deserializeWorkspace` (JSON + validate + version) |
| `src/model/bounds.ts` | pure | `contentBounds(tab)` — bounding box of a tab's shapes |
| `src/render/exportSvg.ts` | pure-ish (jsdom-testable) | `tabToSvgString(tab)` — standalone SVG cropped to content |
| `src/io/files.ts` | browser I/O (verified live) | `saveWorkspace` / `openWorkspace` / `exportTabSvg` / `exportTabPng` |

Plus small touchpoints:
- `src/app.ts` — add `replaceWorkspace(ws)` (load a document: swap workspace, reset
  history, clear selection, render) and an `onSave?: () => void` hook (for Ctrl/Cmd+S).
- `src/ui/toolbar.ts` — Save / Open / Export SVG / Export PNG buttons.
- `src/main.ts` — wire `app.onSave` and the toolbar handlers to `files.ts`.

**Layering:** `files.ts` imports `App`, `serialize`, `exportSvg`, `bounds`. `App`
does **not** import `files.ts` (avoids a cycle); the Ctrl/Cmd+S shortcut fires the
`app.onSave` hook, which `main.ts` sets to `() => saveWorkspace(app)`.

---

## 3. `src/io/serialize.ts` (pure)

```ts
import type { Workspace } from '../model/types';

export const SAVE_VERSION = 1;

export interface QuickDrawFile {
  format: 'quickdraw';
  version: number;      // the on-disk save-format version (SAVE_VERSION at write time)
  workspace: Workspace; // the app's Workspace object verbatim
}

/** Serialize the workspace to a pretty-printed QuickDraw file string. */
export function serializeWorkspace(ws: Workspace): string;

/** Parse + validate a QuickDraw file string into a Workspace.
 *  Throws Error with a user-facing message on anything invalid. */
export function deserializeWorkspace(text: string): Workspace;
```

**`serializeWorkspace`:** `JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION, workspace: ws }, null, 2)`.

**`deserializeWorkspace` validation (each failure throws a clear `Error`):**
1. `JSON.parse` — on failure throw `"This file isn't valid JSON."`.
2. `obj.format === 'quickdraw'` — else throw `"This isn't a QuickDraw file."`.
3. `typeof obj.version === 'number' && obj.version <= SAVE_VERSION` — else throw
   `"This file was made with a newer version of QuickDraw."`.
4. `obj.workspace` shape: `workspace.tabs` is a non-empty array; every tab has a
   string `id`, string `name`, array `nodes`, and a `viewport` with numeric
   `panX/panY/zoom`; `workspace.activeTabId` is a string. Else throw
   `"This QuickDraw file is corrupt or incomplete."`.
5. **Repair** `activeTabId` if it doesn't match any tab → set it to `tabs[0].id`
   (defensive; keeps the app from throwing in `getActiveTab`).
6. Return `obj.workspace`.

(Older-version migration is a passthrough for now — only v1 exists. The
`version <= SAVE_VERSION` gate reserves the seam.)

---

## 4. `src/model/bounds.ts` (pure)

```ts
import type { Tab } from '../model/types';
import type { Box } from '../model/geometry';

/** Axis-aligned bounding box of all shapes in the tab, or null if there are none. */
export function contentBounds(tab: Tab): Box | null;
```

- Union the `{x, y, w, h}` of every shape (`nodes.filter(isShape)`).
- Return `null` when the tab has no shapes.
- Connectors need no explicit handling: in v1 every connector has both endpoints
  attached to shapes (`pruneDanglingConnectors` enforces this), so a connector's
  extent lies between shapes already included in the union. (Arrowheads may poke a
  pixel or two past a shape edge; the export padding absorbs that.)

---

## 5. `src/render/exportSvg.ts` (pure-ish, jsdom-testable)

```ts
import type { Tab } from '../model/types';

export const EXPORT_PADDING = 20;

/** A self-contained SVG document string for the tab, cropped to content
 *  bounds + EXPORT_PADDING. Independent of the live viewport. */
export function tabToSvgString(tab: Tab, padding?: number): string;
```

**Approach (reuses the `Renderer` — no drawing logic is duplicated):**
1. `bounds = contentBounds(tab) ?? { x: 0, y: 0, w: 400, h: 300 }` (empty-tab
   fallback), then expand by `padding` (default `EXPORT_PADDING`) on all sides.
2. Render the tab at an **identity viewport** so world coords equal SVG user
   coords: build a detached `<div>`, `new Renderer(div)`, and
   `renderer.render({ ...tab, viewport: { panX: 0, panY: 0, zoom: 1 } }, new Set())`
   (empty selection → no selection overlay, no handles). A shallow tab copy is used
   so the real tab's viewport is never mutated; nodes are shared by reference and
   only read.
3. Read the rendered `<defs>` (arrowhead marker) and the content `<g>`'s inner
   markup, and assemble:
   `<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="{minX} {minY} {W} {H}">{defs}{content}</svg>`
   (`W = bounds.w`, `H = bounds.h` after padding).

The renderer sets `fill`/`stroke`/`stroke-width`/font as **presentation attributes**
directly on elements (not via CSS classes), so the serialized SVG is fully
self-contained — no external stylesheet is needed for it to render correctly in
another app or when rasterized. The content `<g>` from an identity viewport carries
a `translate(0 0) scale(1)` transform, which is a harmless no-op inside the
`viewBox`-cropped `<svg>`.

---

## 6. `src/io/files.ts` (browser I/O — verified live)

```ts
import type { App } from '../app';

export function saveWorkspace(app: App): Promise<void>;
export function openWorkspace(app: App): Promise<void>;
export function exportTabSvg(app: App): void;
export function exportTabPng(app: App): void;

/** Strip characters invalid in filenames; fall back to "drawing". Exported for tests. */
export function safeFileName(name: string): string;
```

**Feature detection:** `const hasFS = 'showSaveFilePicker' in window;`

**`saveWorkspace`** — `const text = serializeWorkspace(app.workspace);`
- **FS Access:** reuse a module-level `let fileHandle` from a prior open/save to
  write **in place**; if none, `showSaveFilePicker({ suggestedName: 'drawing.quickdraw.json', types: [{ description: 'QuickDraw', accept: { 'application/json': ['.json'] } }] })`,
  then `createWritable()` → `write(text)` → `close()`, and remember the handle.
- **Fallback:** create a `Blob([text], { type: 'application/json' })`, an object URL,
  and click a temporary `<a download="drawing.quickdraw.json">`; revoke the URL.
- User cancels the picker (`AbortError`) → silent no-op.

**`openWorkspace`** —
- Guard: if any tab has nodes (`app.workspace.tabs.some(t => t.nodes.length > 0)`),
  `confirm('Discard the current drawing and open this file?')`; abort if declined.
- **FS Access:** `showOpenFilePicker({ types: … })` → `getFile()` → `text()`.
  Remember the handle (so a later Save writes back to it).
- **Fallback:** a hidden `<input type="file" accept=".json,application/json">`;
  on `change`, read `file.text()`.
- Then `const ws = deserializeWorkspace(text); app.replaceWorkspace(ws);`.
- Any error from `deserializeWorkspace` → `alert(err.message)`; the current drawing
  is left untouched (validation happens before `replaceWorkspace`).

**`exportTabSvg`** — `const svg = tabToSvgString(app.activeTab);` → download a
`Blob([svg], { type: 'image/svg+xml' })` as `` `${safeFileName(app.activeTab.name)}.svg` ``
(plain download in every browser).

**`exportTabPng`** —
1. `const svg = tabToSvgString(app.activeTab);`
2. Load it into an `Image` via a **Blob URL** (`URL.createObjectURL(new Blob([svg],
   { type: 'image/svg+xml' }))`) — a Blob URL avoids `btoa`/base64 breaking on
   non-Latin1 text in labels. Revoke the URL after load.
3. On load: draw onto a `<canvas>` sized `img.width * SCALE × img.height * SCALE`
   (`SCALE = 2` for crispness), `ctx.drawImage(...)`.
4. `canvas.toBlob(blob => download(blob, safeName + '.png'), 'image/png')`.

`safeFileName(name)`: replace `` /[\\/:*?"<>|]/g `` and control chars with `_`, trim,
and fall back to `'drawing'` if the result is empty.

---

## 7. `src/app.ts` touchpoints

```ts
onSave?: () => void; // set by main.ts to () => saveWorkspace(app)

/** Load a document: swap the workspace, reset history to it, clear selection, render. */
replaceWorkspace(ws: Workspace): void {
  this.workspace = ws;
  this.workspace.tabs.forEach(pruneDanglingConnectors);
  this.history = new History(this.workspace); // fresh history — the opened file is the new baseline
  this.selection.clear();
  this.render(); // onRender refreshes the tab strip + properties panel
}
```

In `bindKeyboard`, add (near the other `mod` shortcuts, respecting the existing
INPUT/TEXTAREA guard): `Ctrl/Cmd+S` → `ev.preventDefault(); this.onSave?.();` (stops
the browser's "Save page" dialog). Open and Export are button-only (no shortcuts, to
avoid hijacking Cmd+O / browser chrome).

---

## 8. UI (`src/ui/toolbar.ts`, `src/main.ts`)

Append to the toolbar, after the existing Undo/Redo buttons, a small separator then:
- **Save** → `saveWorkspace(app)` (tooltip notes ⌘/Ctrl+S).
- **Open** → `openWorkspace(app)`.
- An `Export:` label, then **SVG** → `exportTabSvg(app)` and **PNG** →
  `exportTabPng(app)`. (Two explicit buttons rather than a `▾` dropdown — same
  compact "export as image" control, but no open/close menu state to manage or test.)

`main.ts` sets `app.onSave = () => saveWorkspace(app)` alongside the existing
`app.onRender` wiring. The toolbar's new buttons call the `files.ts` functions
directly (the toolbar already receives `app`).

---

## 9. Error handling & edge cases
- **Invalid/foreign file on open:** `deserializeWorkspace` throws a specific message;
  `openWorkspace` shows it via `alert` and leaves the current drawing intact.
- **Newer file version:** rejected with a clear message (forward-compat seam).
- **Confirm on open** only when the current workspace has content; opening into an
  empty canvas doesn't prompt.
- **Picker cancelled** (FS Access `AbortError`, or fallback file input dismissed) →
  no-op, no error shown.
- **Empty tab export:** `tabToSvgString` falls back to a 400×300 canvas so SVG/PNG
  still produce a (blank) valid image rather than a zero-size one.
- **Save-in-place unsupported** (Firefox/Safari): Save downloads a fresh file each
  time; there is no in-place overwrite there (accepted).
- **Ctrl/Cmd+S while editing a text label:** the existing INPUT/TEXTAREA guard means
  the shortcut is ignored mid-edit (finish the label first, then save) — acceptable.

---

## 10. Testing (Vitest, jsdom)

**`tests/io/serialize.test.ts`:**
- Round-trip: `deserializeWorkspace(serializeWorkspace(ws))` deep-equals `ws`
  (multi-tab workspace with shapes, a connector, a group, styles, viewports).
- Rejects: non-JSON text; JSON missing `format`; wrong `format`; `version` >
  `SAVE_VERSION`; workspace missing `tabs` / empty `tabs` / a tab missing fields —
  each throws with its specific message.
- Repairs an `activeTabId` that matches no tab → `tabs[0].id`.

**`tests/model/bounds.test.ts`:**
- One shape → its box; multiple shapes → the union; a tab with no shapes → `null`.

**`tests/render/exportSvg.test.ts` (jsdom):**
- `tabToSvgString(tab)` returns a string starting with `<svg`, containing
  `xmlns="http://www.w3.org/2000/svg"`, a `viewBox` and `width`/`height` equal to the
  padded content bounds, and a `<rect>` for a rect shape; the source tab's
  `viewport` is unchanged afterward; an empty tab yields the 400×300 fallback size.

**`tests/io/files.test.ts`:**
- `safeFileName` sanitizes `/ \ : * ? " < > |` and control chars, trims, and falls
  back to `'drawing'` for an empty/blank name.
- (The file-picker/download/canvas paths in `files.ts` are covered by live
  verification, not unit tests — jsdom has no File System Access API or real downloads.)

**Live (Playwright):** Save (FS Access in Chromium) → make a change → Open the file →
the drawing (tabs + shapes) is restored; Export SVG downloads a valid `.svg`; Export
PNG downloads a `.png`. Downloads are captured via Playwright's download events.

---

## 11. Decisions (resolved)
- Scope: round-trip `.json` save/open **and** SVG + PNG export (one "file" feature).
- Mechanism: **hybrid** — File System Access API (save-in-place, Ctrl/Cmd+S) where
  supported, download/upload fallback elsewhere.
- On-disk format: `{ format: 'quickdraw', version, workspace }` wrapper; validated on
  open; `SAVE_VERSION = 1`.
- Export crops to **content bounds + 20px**, active tab only, filename from the tab
  name (sanitized). PNG at **2× scale**.
- Open **replaces** the workspace and **resets history**; confirm first only when the
  current canvas is non-empty. No dirty-tracking / `beforeunload` guard.
- Export UI is **two buttons (SVG / PNG)**, not a dropdown (simpler, testable).

## 12. Future (not now)
Copy/paste; alignment guides & snapping; elbow routing; "recent files"; per-tab or
selection-only export; PDF export; drag-a-file-onto-canvas to open.
