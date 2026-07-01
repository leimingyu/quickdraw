# Save / Open / Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a QuickDraw drawing to a `.json` file and reopen it to keep editing (round-trip), and export the current tab as an SVG or PNG image.

**Architecture:** Isolate pure, testable logic (serialize, content bounds, SVG-string builder) from the thin browser-only I/O layer (file pickers, downloads, canvas). `files.ts` orchestrates; `App` gains a `replaceWorkspace` loader and an `onSave` hook so it never imports the I/O layer.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom). No new runtime dependencies. File System Access API with a download/upload fallback; SVG rasterized to PNG via `<canvas>`.

## Global Constraints

- Strict TypeScript. Source under `src/`; tests mirror under `tests/`. No new runtime dependencies.
- The model is the single source of truth and is plain JSON-serializable data; loading a document goes through `App.replaceWorkspace` (swap workspace, reset history, clear selection, render).
- On-disk format is the wrapper `{ format: 'quickdraw', version: SAVE_VERSION, workspace }`; `SAVE_VERSION = 1`. Open validates it and rejects non-JSON / wrong-format / newer-version / corrupt files with specific messages, leaving the current drawing untouched on failure.
- Save writes **in place** via the File System Access API where supported (Chrome/Edge) and falls back to a plain download (`drawing.quickdraw.json`) elsewhere. `Ctrl/Cmd+S` triggers save via the `App.onSave` hook (preventing the browser dialog). Open and Export are button-only.
- Export is the **active tab**, cropped to **content bounds + 20px** padding (independent of pan/zoom), filename derived from the (sanitized) tab name, PNG at **2× scale**.
- Open **replaces** the workspace and **resets history**; it `confirm(...)`s first only when the current workspace has any nodes. No dirty-tracking / `beforeunload` guard.
- Layering: `App` must NOT import `io/files.ts` (avoids a cycle). The Ctrl/Cmd+S shortcut fires `app.onSave`, which `main.ts` sets to `() => saveWorkspace(app)`.
- Full suite is green before this plan (172/172) and must stay green; `npm run build` clean.

---

### Task 1: `serialize.ts` — workspace ⇄ JSON

**Files:**
- Create: `src/io/serialize.ts`
- Test: `tests/io/serialize.test.ts`

**Interfaces:**
- Consumes: `Workspace` from `src/model/types`.
- Produces:
  - `SAVE_VERSION = 1` (number).
  - `interface QuickDrawFile { format: 'quickdraw'; version: number; workspace: Workspace }`.
  - `serializeWorkspace(ws: Workspace): string` — pretty JSON of the wrapper.
  - `deserializeWorkspace(text: string): Workspace` — parse + validate (throws `Error` with a user-facing message) + repair a dangling `activeTabId`.

- [ ] **Step 1: Write the failing test `tests/io/serialize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { serializeWorkspace, deserializeWorkspace, SAVE_VERSION } from '../../src/io/serialize';
import { createWorkspace, addTab, addNode, createShape, createConnector } from '../../src/model/document';

function sampleWorkspace() {
  const ws = createWorkspace();                        // Tab 1
  const a = createShape('rect', 0, 0, 100, 60);
  a.text = 'Hello';
  const b = createShape('ellipse', 200, 0, 80, 80);
  addNode(ws.tabs[0], a);
  addNode(ws.tabs[0], b);
  addNode(ws.tabs[0], createConnector({ nodeId: a.id }, { nodeId: b.id }));
  const t2 = addTab(ws, 'Second');
  t2.viewport = { panX: 10, panY: 20, zoom: 2 };
  addNode(t2, createShape('diamond', 50, 50, 40, 40));
  ws.activeTabId = ws.tabs[0].id;
  return ws;
}

describe('serializeWorkspace / deserializeWorkspace', () => {
  it('round-trips a multi-tab workspace', () => {
    const ws = sampleWorkspace();
    expect(deserializeWorkspace(serializeWorkspace(ws))).toEqual(ws);
  });

  it('writes a versioned quickdraw wrapper', () => {
    const obj = JSON.parse(serializeWorkspace(createWorkspace()));
    expect(obj.format).toBe('quickdraw');
    expect(obj.version).toBe(SAVE_VERSION);
    expect(obj.workspace.tabs).toHaveLength(1);
  });

  it('rejects non-JSON text', () => {
    expect(() => deserializeWorkspace('not json {')).toThrow(/valid JSON/i);
  });

  it('rejects a file without the quickdraw format tag', () => {
    expect(() => deserializeWorkspace(JSON.stringify({ hello: 1 }))).toThrow(/QuickDraw file/i);
  });

  it('rejects a newer save version', () => {
    const future = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION + 1, workspace: createWorkspace() });
    expect(() => deserializeWorkspace(future)).toThrow(/newer version/i);
  });

  it('rejects a corrupt workspace (missing tabs)', () => {
    const bad = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION, workspace: { version: 1, activeTabId: 'x' } });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('rejects an empty tabs array', () => {
    const bad = JSON.stringify({ format: 'quickdraw', version: SAVE_VERSION, workspace: { version: 1, tabs: [], activeTabId: 'x' } });
    expect(() => deserializeWorkspace(bad)).toThrow(/corrupt|incomplete/i);
  });

  it('repairs an activeTabId that matches no tab', () => {
    const ws = createWorkspace();
    ws.activeTabId = 'ghost';
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    expect(restored.activeTabId).toBe(restored.tabs[0].id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/io/serialize.test.ts`
Expected: FAIL — `src/io/serialize.ts` does not exist.

- [ ] **Step 3: Implement `src/io/serialize.ts`**

```ts
import type { Workspace } from '../model/types';

export const SAVE_VERSION = 1;

export interface QuickDrawFile {
  format: 'quickdraw';
  version: number;
  workspace: Workspace;
}

/** Serialize the workspace to a pretty-printed QuickDraw file string. */
export function serializeWorkspace(ws: Workspace): string {
  const file: QuickDrawFile = { format: 'quickdraw', version: SAVE_VERSION, workspace: ws };
  return JSON.stringify(file, null, 2);
}

/** Parse + validate a QuickDraw file string. Throws Error (user-facing message) on anything invalid. */
export function deserializeWorkspace(text: string): Workspace {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const file = obj as Partial<QuickDrawFile> | null;
  if (!file || file.format !== 'quickdraw') {
    throw new Error("This isn't a QuickDraw file.");
  }
  if (typeof file.version !== 'number' || file.version > SAVE_VERSION) {
    throw new Error('This file was made with a newer version of QuickDraw.');
  }
  const ws = file.workspace;
  if (!isValidWorkspace(ws)) {
    throw new Error('This QuickDraw file is corrupt or incomplete.');
  }
  if (!ws.tabs.some((t) => t.id === ws.activeTabId)) {
    ws.activeTabId = ws.tabs[0].id; // repair a dangling active id
  }
  return ws;
}

function isValidWorkspace(ws: unknown): ws is Workspace {
  if (!ws || typeof ws !== 'object') return false;
  const w = ws as Record<string, unknown>;
  if (typeof w.activeTabId !== 'string') return false;
  if (!Array.isArray(w.tabs) || w.tabs.length === 0) return false;
  return w.tabs.every((t) => {
    if (!t || typeof t !== 'object') return false;
    const tab = t as Record<string, unknown>;
    const vp = tab.viewport as Record<string, unknown> | undefined;
    return (
      typeof tab.id === 'string' &&
      typeof tab.name === 'string' &&
      Array.isArray(tab.nodes) &&
      !!vp &&
      typeof vp.panX === 'number' &&
      typeof vp.panY === 'number' &&
      typeof vp.zoom === 'number'
    );
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/io/serialize.test.ts`
Expected: PASS (8 tests). (`toEqual` ignores `undefined`-valued optional keys dropped by JSON, so the round-trip matches.)

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green (172 prior + 8 = 180), build clean.

- [ ] **Step 6: Commit**

```bash
git add src/io/serialize.ts tests/io/serialize.test.ts
git commit -m "feat: workspace JSON serialize/deserialize with validation"
```

---

### Task 2: `bounds.ts` — content bounding box

**Files:**
- Create: `src/model/bounds.ts`
- Test: `tests/model/bounds.test.ts`

**Interfaces:**
- Consumes: `Tab` from `src/model/types`; `isShape` from `src/model/document`; `Box` type from `src/model/geometry` (`{ x: number; y: number; w: number; h: number }`).
- Produces: `contentBounds(tab: Tab): Box | null` — union box of all shapes, or `null` when the tab has none.

- [ ] **Step 1: Write the failing test `tests/model/bounds.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { contentBounds } from '../../src/model/bounds';
import { createTab, addNode, createShape } from '../../src/model/document';

describe('contentBounds', () => {
  it('returns null for a tab with no shapes', () => {
    expect(contentBounds(createTab())).toBeNull();
  });

  it('returns the box of a single shape', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 10, 20, 100, 50));
    expect(contentBounds(tab)).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  it('unions multiple shapes', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 10, 20, 100, 50));    // x 10..110, y 20..70
    addNode(tab, createShape('ellipse', 200, 0, 40, 40));   // x 200..240, y 0..40
    expect(contentBounds(tab)).toEqual({ x: 10, y: 0, w: 230, h: 70 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/bounds.test.ts`
Expected: FAIL — `src/model/bounds.ts` does not exist.

- [ ] **Step 3: Implement `src/model/bounds.ts`**

```ts
import type { Tab } from './types';
import { isShape } from './document';
import type { Box } from './geometry';

/** Axis-aligned bounding box of all shapes in the tab, or null if there are none. */
export function contentBounds(tab: Tab): Box | null {
  const shapes = tab.nodes.filter(isShape);
  if (shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w);
    maxY = Math.max(maxY, s.y + s.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/bounds.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green (180 prior + 3 = 183), build clean.

- [ ] **Step 6: Commit**

```bash
git add src/model/bounds.ts tests/model/bounds.test.ts
git commit -m "feat: contentBounds — bounding box of a tab's shapes"
```

---

### Task 3: `exportSvg.ts` — standalone SVG string for a tab

**Files:**
- Create: `src/render/exportSvg.ts`
- Test: `tests/render/exportSvg.test.ts`

**Interfaces:**
- Consumes: `Tab` from `src/model/types`; `contentBounds` from `src/model/bounds` (Task 2); `Renderer` from `src/render/renderer` (`new Renderer(mount)`; `render(tab, selection: Set<string>, highlightId?)`; public `svg` element).
- Produces: `EXPORT_PADDING = 20`; `tabToSvgString(tab: Tab, padding?: number): string` — a self-contained `<svg>` cropped to content bounds + padding, in world coordinates, not mutating the tab's viewport.

- [ ] **Step 1: Write the failing test `tests/render/exportSvg.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tabToSvgString, EXPORT_PADDING } from '../../src/render/exportSvg';
import { createTab, addNode, createShape } from '../../src/model/document';

const P = EXPORT_PADDING;

describe('tabToSvgString', () => {
  it('produces a standalone svg cropped to padded content bounds', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 100, 100, 200, 100)); // bounds x100 y100 w200 h100
    const svg = tabToSvgString(tab);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="${100 - P} ${100 - P} ${200 + 2 * P} ${100 + 2 * P}"`);
    expect(svg).toContain(`width="${200 + 2 * P}"`);
    expect(svg).toContain('<rect');
  });

  it('does not mutate the source tab viewport', () => {
    const tab = createTab();
    tab.viewport = { panX: 5, panY: 6, zoom: 1.5 };
    addNode(tab, createShape('rect', 0, 0, 50, 50));
    tabToSvgString(tab);
    expect(tab.viewport).toEqual({ panX: 5, panY: 6, zoom: 1.5 });
  });

  it('falls back to a 400x300 canvas for an empty tab', () => {
    const svg = tabToSvgString(createTab());
    expect(svg).toContain(`width="${400 + 2 * P}"`);
    expect(svg).toContain(`height="${300 + 2 * P}"`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/exportSvg.test.ts`
Expected: FAIL — `src/render/exportSvg.ts` does not exist.

- [ ] **Step 3: Implement `src/render/exportSvg.ts`**

The renderer draws into an SVG whose children are `<defs>`, then a content `<g>` (transform `translate(panX panY) scale(zoom)`), then an overlay `<g>` (selection — empty when the selection is empty). Rendering at an identity viewport makes the content `<g>`'s children sit at world coordinates, so wrapping them in an `<svg>` with a content-bounds `viewBox` crops correctly. Presentation attributes (fill/stroke/font) are set directly on elements, so the output is self-contained.

```ts
import type { Tab } from '../model/types';
import { Renderer } from './renderer';
import { contentBounds } from '../model/bounds';

export const EXPORT_PADDING = 20;

/** A self-contained SVG document string for the tab, cropped to content bounds
 *  + padding. Independent of (and does not mutate) the tab's live viewport. */
export function tabToSvgString(tab: Tab, padding = EXPORT_PADDING): string {
  const raw = contentBounds(tab) ?? { x: 0, y: 0, w: 400, h: 300 };
  const x = raw.x - padding;
  const y = raw.y - padding;
  const w = raw.w + padding * 2;
  const h = raw.h + padding * 2;

  const holder = document.createElement('div');
  const renderer = new Renderer(holder);
  // Identity viewport → content <g> children are in world coords. Shallow copy so
  // the real tab's viewport is untouched; nodes are shared by reference (read-only).
  renderer.render({ ...tab, viewport: { panX: 0, panY: 0, zoom: 1 } }, new Set<string>());

  const svg = renderer.svg;
  const defs = svg.querySelector('defs')?.outerHTML ?? '';
  const content = svg.querySelector('g')?.innerHTML ?? ''; // first <g> = content layer

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${defs}<g>${content}</g></svg>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/render/exportSvg.test.ts`
Expected: PASS (3 tests). (The `Renderer` runs in jsdom, as the existing renderer tests do.)

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green (183 prior + 3 = 186), build clean.

- [ ] **Step 6: Commit**

```bash
git add src/render/exportSvg.ts tests/render/exportSvg.test.ts
git commit -m "feat: tabToSvgString — standalone cropped SVG for a tab"
```

---

### Task 4: `App` document loader + save hook

**Files:**
- Modify: `src/app.ts` (add `onSave?` field, `replaceWorkspace` method, `Ctrl/Cmd+S` in `bindKeyboard`)
- Test: `tests/app.io.test.ts`

**Interfaces:**
- Consumes: existing `App.workspace`, `App.activeTab`, `App.render()`, `App.commit()`, `App.undo()`, `App.selection`, the private `history: History`, `pruneDanglingConnectors` (already imported), and `History` (already imported).
- Produces:
  - `App.onSave?: () => void` — fired by `Ctrl/Cmd+S`.
  - `App.replaceWorkspace(ws: Workspace): void` — swap in `ws`, prune dangling connectors, reset history to it, clear selection, render.

- [ ] **Step 1: Write the failing test `tests/app.io.test.ts`**

```ts
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
    addNode(ws.tabs[0], createShape('rect', 0, 0, 40, 40));
    app.replaceWorkspace(ws);
    expect(app.workspace).toBe(ws);
    expect(app.workspace.tabs).toHaveLength(2);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.io.test.ts`
Expected: FAIL — `app.replaceWorkspace` is not a function; `onSave` not wired.

- [ ] **Step 3: Add the `onSave` field to `App`**

In `src/app.ts`, next to the other public fields (after `onRender?: () => void;`):

```ts
  onSave?: () => void;
```

- [ ] **Step 4: Add `replaceWorkspace` to `App`**

Insert this method right after the `switchTab(...)` method:

```ts
  /** Load a document: swap the workspace, reset history to it, clear selection, render. */
  replaceWorkspace(ws: Workspace): void {
    this.workspace = ws;
    this.workspace.tabs.forEach(pruneDanglingConnectors);
    this.history = new History(this.workspace); // the opened file is the new baseline
    this.selection.clear();
    this.render();
  }
```

- [ ] **Step 5: Add the `Ctrl/Cmd+S` shortcut in `bindKeyboard`**

In `src/app.ts`, inside `bindKeyboard`, add this block alongside the other `mod && …`
shortcuts (e.g. immediately after the `mod && ev.key.toLowerCase() === 'y'` redo block):

```ts
      if (mod && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        this.onSave?.();
        return;
      }
```

(The existing INPUT/TEXTAREA guard at the top of `bindKeyboard` still applies, so
Ctrl/Cmd+S is ignored while a text/rename input is focused.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/app.io.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green (186 prior + 4 = 190), build clean.

- [ ] **Step 8: Commit**

```bash
git add src/app.ts tests/app.io.test.ts
git commit -m "feat: App.replaceWorkspace loader + onSave hook (Ctrl/Cmd+S)"
```

---

### Task 5: `files.ts` browser I/O + toolbar/main wiring

**Files:**
- Create: `src/io/files.ts`
- Modify: `src/ui/toolbar.ts` (Save / Open / Export SVG / Export PNG buttons), `src/main.ts` (`app.onSave` wiring)
- Test: `tests/io/files.test.ts`

**Interfaces:**
- Consumes: `App` (`app.workspace`, `app.activeTab`, `app.replaceWorkspace`, `app.onSave`); `serializeWorkspace` / `deserializeWorkspace` from `src/io/serialize` (Task 1); `tabToSvgString` from `src/render/exportSvg` (Task 3).
- Produces: `saveWorkspace(app): Promise<void>`, `openWorkspace(app): Promise<void>`, `exportTabSvg(app): void`, `exportTabPng(app): void`, and the pure helper `safeFileName(name: string): string`.

- [ ] **Step 1: Write the failing test `tests/io/files.test.ts`** (covers the pure `safeFileName`; the picker/download/canvas paths are verified live)

```ts
import { describe, it, expect } from 'vitest';
import { safeFileName } from '../../src/io/files';

describe('safeFileName', () => {
  it('replaces filesystem-invalid characters with underscores', () => {
    expect(safeFileName('a/b:c*d')).toBe('a_b_c_d');
  });
  it('trims and falls back to "drawing" when empty/blank', () => {
    expect(safeFileName('   ')).toBe('drawing');
    expect(safeFileName('')).toBe('drawing');
  });
  it('keeps a normal tab name unchanged', () => {
    expect(safeFileName('Flow chart')).toBe('Flow chart');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/io/files.test.ts`
Expected: FAIL — `src/io/files.ts` does not exist.

- [ ] **Step 3: Implement `src/io/files.ts`**

```ts
import type { App } from '../app';
import { serializeWorkspace, deserializeWorkspace } from './serialize';
import { tabToSvgString } from '../render/exportSvg';

const SCALE = 2; // PNG raster scale for crispness
const JSON_TYPES = [{ description: 'QuickDraw drawing', accept: { 'application/json': ['.json'] } }];
let fileHandle: any = null; // File System Access handle remembered for save-in-place

/** Strip characters invalid in filenames; fall back to "drawing". */
export function safeFileName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return clean || 'drawing';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveWorkspace(app: App): Promise<void> {
  const text = serializeWorkspace(app.workspace);
  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle) {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: 'drawing.quickdraw.json',
          types: JSON_TYPES,
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user cancelled the picker
      throw err;
    }
  } else {
    downloadBlob(new Blob([text], { type: 'application/json' }), 'drawing.quickdraw.json');
  }
}

export async function openWorkspace(app: App): Promise<void> {
  if (app.workspace.tabs.some((t) => t.nodes.length > 0)) {
    if (!confirm('Discard the current drawing and open this file?')) return;
  }
  let text: string;
  let handle: any = null;
  if ('showOpenFilePicker' in window) {
    try {
      const [h] = await (window as any).showOpenFilePicker({ types: JSON_TYPES });
      handle = h;
      text = await (await h.getFile()).text();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // cancelled
      throw err;
    }
  } else {
    text = await pickFileText();
  }
  try {
    const ws = deserializeWorkspace(text);
    app.replaceWorkspace(ws);
    fileHandle = handle; // remember for save-in-place (null in the fallback path)
  } catch (err) {
    alert((err as Error).message); // current drawing left untouched
  }
}

/** Fallback open: a hidden file input. Resolves with the file's text; if the user
 *  cancels, the promise simply never resolves (no state change). */
function pickFileText(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) resolve(await file.text());
    });
    input.click();
  });
}

export function exportTabSvg(app: App): void {
  const svg = tabToSvgString(app.activeTab);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeFileName(app.activeTab.name)}.svg`);
}

export function exportTabPng(app: App): void {
  const svg = tabToSvgString(app.activeTab);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const name = safeFileName(app.activeTab.name);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * SCALE;
    canvas.height = img.height * SCALE;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${name}.png`); }, 'image/png');
  };
  img.src = url;
}
```

- [ ] **Step 4: Run the file test to verify it passes**

Run: `npx vitest run tests/io/files.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the toolbar buttons in `src/ui/toolbar.ts`**

Add the import at the top:

```ts
import { saveWorkspace, openWorkspace, exportTabSvg, exportTabPng } from '../io/files';
```

Then, in `mountToolbar`, after the `redo` button is appended (`bar.appendChild(redo);`) and before `container.appendChild(bar);`, add:

```ts
  const sep2 = document.createElement('span');
  sep2.style.width = '12px';
  bar.appendChild(sep2);

  const save = document.createElement('button');
  save.textContent = 'Save';
  save.title = 'Save drawing (⌘/Ctrl+S)';
  save.addEventListener('click', () => saveWorkspace(app));
  bar.appendChild(save);

  const open = document.createElement('button');
  open.textContent = 'Open';
  open.addEventListener('click', () => openWorkspace(app));
  bar.appendChild(open);

  const exportLabel = document.createElement('span');
  exportLabel.textContent = 'Export:';
  exportLabel.style.alignSelf = 'center';
  exportLabel.style.marginLeft = '8px';
  bar.appendChild(exportLabel);

  const svgBtn = document.createElement('button');
  svgBtn.textContent = 'SVG';
  svgBtn.title = 'Export current tab as SVG';
  svgBtn.addEventListener('click', () => exportTabSvg(app));
  bar.appendChild(svgBtn);

  const pngBtn = document.createElement('button');
  pngBtn.textContent = 'PNG';
  pngBtn.title = 'Export current tab as PNG';
  pngBtn.addEventListener('click', () => exportTabPng(app));
  bar.appendChild(pngBtn);
```

- [ ] **Step 6: Wire `app.onSave` in `src/main.ts`**

Add the import near the other imports:

```ts
import { saveWorkspace } from './io/files';
```

Then, next to the existing `app.onRender = …` line, add:

```ts
app.onSave = () => saveWorkspace(app);
```

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green (190 prior + 3 = 193), build clean. The `files.ts` picker/download/canvas paths and the toolbar buttons are exercised in the whole-feature live verification (jsdom has no File System Access API or real downloads), not by unit tests.

- [ ] **Step 8: Commit**

```bash
git add src/io/files.ts src/ui/toolbar.ts src/main.ts tests/io/files.test.ts
git commit -m "feat: Save/Open/Export SVG+PNG toolbar + files I/O (FS Access + download fallback)"
```

---

## Done — Definition of Done
- **Save** writes the whole drawing to `.json` (in place via File System Access where supported, download otherwise); **Ctrl/Cmd+S** works.
- **Open** loads a `.json` back (replacing the workspace, resetting history), confirming first if the canvas is non-empty, and rejecting non-QuickDraw / corrupt / newer-version files with a clear message.
- **Export SVG** and **Export PNG** download the active tab cropped to content bounds + 20px, named from the tab.
- `npm test` green; `npm run build` clean.

## Deferred (future sub-projects)
Copy/paste; alignment guides & snapping; elbow routing; recent files; selection-only or all-tabs export; PDF; drag-a-file-to-open.
