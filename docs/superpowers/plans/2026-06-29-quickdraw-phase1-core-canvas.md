# QuickDraw Phase 1 — Core Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the working core of QuickDraw — a TypeScript + Vite + SVG diagramming canvas where you can place shapes, select/move/resize them, edit text inline, delete, undo/redo, pan/zoom, and have the whole workspace autosave to the browser.

**Architecture:** A plain data model (`Workspace` → `Tab` → `Node`) is the single source of truth. Interaction `Tool`s receive pointer events, mutate the model, and the `Renderer` rebuilds the SVG from the model. A snapshot-based `History` deep-clones the workspace on each committed change; `Autosave` debounces writes to `localStorage`. Logic-heavy code (model, geometry, history, storage) is DOM-free and unit-tested; DOM/event glue is thin.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), SVG. No UI framework, no runtime dependencies.

## Global Constraints

- **Language/tooling:** TypeScript (strict), Vite build, Vitest for tests — copied verbatim from spec §2.
- **Rendering:** SVG only; the data model is the single source of truth — **no application state stored in the DOM** (spec §3).
- **Top-level type is named `Workspace`** (spec calls it "Document"; renamed in code to avoid clashing with the DOM global `Document`). It maps to the spec's `Document`.
- **Phase 1 `Node` union = `Shape` only.** Phase 2 widens it to `Shape | Connector | Group`. Do not add Connector/Group/tabs-UI/export here — those are later phases (spec §13).
- **Undo is snapshot-based** (deep clone via `structuredClone`), bounded to 100 entries (spec §7, §12).
- **Starter shapes:** `rect | rounded | ellipse | diamond | triangle | text` (spec §7).
- **Autosave store:** `localStorage` under key `quickdraw:workspace`, debounced (spec §8).
- All new code lives under `src/`; tests mirror the path under `tests/`.

---

## File Structure (created across this plan)

| File | Responsibility | Task |
|------|----------------|------|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/style.css` | Project scaffold | 1 |
| `src/util/id.ts` | Unique id generator | 2 |
| `src/model/types.ts` | All TypeScript interfaces | 2 |
| `src/model/document.ts` | Workspace/Tab/Shape factories + mutation helpers (DOM-free) | 2 |
| `src/model/geometry.ts` | Pure geometry: hit-test, marquee, resize, selection bounds, zoom math | 3 |
| `src/render/shapes.ts` | One `Shape` → one SVG `<g>` | 4 |
| `src/render/renderer.ts` | Render a `Tab` + selection into SVG; screen↔world transform | 4 |
| `src/app.ts` | App state (workspace, selection, current tool) + wiring | 5 |
| `src/main.ts` | Bootstrap | 5 |
| `src/ui/toolbar.ts` | Tool/action buttons | 5 |
| `src/tools/types.ts` | `Tool` interface + shared types | 6 |
| `src/tools/shapeTool.ts` | Place a shape | 6 |
| `src/tools/selectTool.ts` | Select / move / resize / marquee / dblclick | 7, 8, 9, 10 |
| `src/history/history.ts` | Snapshot undo/redo | 12 |
| `src/ui/zoom.ts` | Pan/zoom controls | 13 |
| `src/storage/autosave.ts` | Debounced localStorage persistence | 14 |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/style.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Vite+TS app and a working `vitest` (jsdom) test runner that later tasks rely on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quickdraw",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QuickDraw</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/style.css`**

```css
* { box-sizing: border-box; }
html, body, #app { margin: 0; height: 100%; }
body { font: 14px system-ui, sans-serif; }
```

- [ ] **Step 6: Create `src/main.ts` (placeholder)**

```ts
const app = document.getElementById('app');
if (app) app.textContent = 'QuickDraw';
```

- [ ] **Step 7: Write the smoke test `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs arithmetic', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install and run the test**

Run: `npm install && npm test`
Expected: vitest reports `1 passed`.

- [ ] **Step 9: Verify the build**

Run: `npm run build`
Expected: build completes with no TypeScript errors; a `dist/` folder is produced.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

## Task 2: Data model & types

**Files:**
- Create: `src/util/id.ts`, `src/model/types.ts`, `src/model/document.ts`
- Test: `tests/model/document.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `ShapeKind`, `Anchor`, `ShapeStyle`, `Shape`, `Node`, `Viewport`, `Tab`, `Workspace`, `DEFAULT_STYLE`.
  - `uid(prefix?: string): string`
  - `createShape(kind: ShapeKind, x: number, y: number, w?: number, h?: number): Shape`
  - `createTab(name?: string): Tab`
  - `createWorkspace(): Workspace`
  - `getActiveTab(ws: Workspace): Tab`
  - `findNode(tab: Tab, id: string): Node | undefined`
  - `addNode(tab: Tab, node: Node): void`
  - `removeNodes(tab: Tab, ids: Set<string>): void`
  - `reorder(tab: Tab, id: string, dir: 'front' | 'back'): void`
  - `cloneWorkspace(ws: Workspace): Workspace`

- [ ] **Step 1: Create `src/util/id.ts`**

```ts
let n = 0;
/** Deterministic-per-process unique id. Reset via resetIds() in tests. */
export function uid(prefix = 'n'): string {
  return `${prefix}${(++n).toString(36)}`;
}
export function resetIds(): void {
  n = 0;
}
```

- [ ] **Step 2: Create `src/model/types.ts`**

```ts
export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';
export type Anchor = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontColor: string;
}

export interface Shape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  text?: string;
  style: ShapeStyle;
  groupId?: string;
}

/** Phase 2 widens this to `Shape | Connector | Group`. */
export type Node = Shape;

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Tab {
  id: string;
  name: string;
  nodes: Node[]; // z-ordered: later index = drawn on top
  viewport: Viewport;
}

export interface Workspace {
  version: number;
  tabs: Tab[];
  activeTabId: string;
}
```

- [ ] **Step 3: Write the failing test `tests/model/document.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIds } from '../../src/util/id';
import {
  createShape, createTab, createWorkspace, getActiveTab,
  findNode, addNode, removeNodes, reorder, cloneWorkspace,
} from '../../src/model/document';

beforeEach(() => resetIds());

describe('document model', () => {
  it('creates a workspace with one active empty tab', () => {
    const ws = createWorkspace();
    expect(ws.tabs).toHaveLength(1);
    expect(ws.activeTabId).toBe(ws.tabs[0].id);
    expect(getActiveTab(ws).nodes).toHaveLength(0);
    expect(getActiveTab(ws).viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it('creates a shape with defaults and given geometry', () => {
    const s = createShape('rect', 10, 20);
    expect(s.kind).toBe('rect');
    expect(s).toMatchObject({ x: 10, y: 20, w: 120, h: 70 });
    expect(s.style.strokeWidth).toBe(2);
    expect(s.id).toBeTruthy();
  });

  it('adds, finds, and removes nodes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0);
    const b = createShape('ellipse', 50, 50);
    addNode(tab, a);
    addNode(tab, b);
    expect(tab.nodes).toHaveLength(2);
    expect(findNode(tab, a.id)).toBe(a);
    removeNodes(tab, new Set([a.id]));
    expect(tab.nodes).toHaveLength(1);
    expect(findNode(tab, a.id)).toBeUndefined();
  });

  it('reorders a node to front and back', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 0, 0);
    addNode(tab, a);
    addNode(tab, b);
    reorder(tab, a.id, 'front');
    expect(tab.nodes[tab.nodes.length - 1].id).toBe(a.id);
    reorder(tab, a.id, 'back');
    expect(tab.nodes[0].id).toBe(a.id);
  });

  it('deep-clones a workspace independently', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    const copy = cloneWorkspace(ws);
    copy.tabs[0].nodes[0].x = 999;
    expect(getActiveTab(ws).nodes[0].x).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/model/document.test.ts`
Expected: FAIL — cannot import from `../../src/model/document`.

- [ ] **Step 5: Create `src/model/document.ts`**

```ts
import type { Node, Shape, ShapeKind, ShapeStyle, Tab, Workspace } from './types';
import { uid } from '../util/id';

export const DEFAULT_STYLE: ShapeStyle = {
  fill: '#ffffff',
  stroke: '#1e1e1e',
  strokeWidth: 2,
  fontSize: 16,
  fontColor: '#1e1e1e',
};

export function createShape(kind: ShapeKind, x: number, y: number, w = 120, h = 70): Shape {
  const style = { ...DEFAULT_STYLE };
  if (kind === 'text') {
    style.fill = 'none';
    style.stroke = 'none';
  }
  return { id: uid('s'), kind, x, y, w, h, style, text: kind === 'text' ? 'Text' : undefined };
}

export function createTab(name = 'Untitled'): Tab {
  return { id: uid('t'), name, nodes: [], viewport: { panX: 0, panY: 0, zoom: 1 } };
}

export function createWorkspace(): Workspace {
  const tab = createTab();
  return { version: 1, tabs: [tab], activeTabId: tab.id };
}

export function getActiveTab(ws: Workspace): Tab {
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
  if (!tab) throw new Error(`active tab ${ws.activeTabId} not found`);
  return tab;
}

export function findNode(tab: Tab, id: string): Node | undefined {
  return tab.nodes.find((n) => n.id === id);
}

export function addNode(tab: Tab, node: Node): void {
  tab.nodes.push(node);
}

export function removeNodes(tab: Tab, ids: Set<string>): void {
  tab.nodes = tab.nodes.filter((n) => !ids.has(n.id));
}

export function reorder(tab: Tab, id: string, dir: 'front' | 'back'): void {
  const i = tab.nodes.findIndex((n) => n.id === id);
  if (i < 0) return;
  const [node] = tab.nodes.splice(i, 1);
  if (dir === 'front') tab.nodes.push(node);
  else tab.nodes.unshift(node);
}

export function cloneWorkspace(ws: Workspace): Workspace {
  return structuredClone(ws);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/model/document.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: workspace/tab/shape data model with mutation helpers"
```

---

## Task 3: Geometry helpers (pure)

**Files:**
- Create: `src/model/geometry.ts`
- Test: `tests/model/geometry.test.ts`

**Interfaces:**
- Consumes: `Shape`, `Viewport` from `model/types`.
- Produces:
  - `Point = { x: number; y: number }`
  - `Box = { x: number; y: number; w: number; h: number }`
  - `Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'`
  - `pointInShape(s: Shape, p: Point): boolean`
  - `hitTest(nodes: Shape[], p: Point): Shape | undefined` (topmost)
  - `shapeInRect(s: Shape, box: Box): boolean` (bbox intersects)
  - `selectionBounds(shapes: Shape[]): Box | null`
  - `resizeBox(box: Box, handle: Handle, dx: number, dy: number): Box`
  - `handlePositions(box: Box): Record<Handle, Point>`
  - `zoomAt(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport`

- [ ] **Step 1: Write the failing test `tests/model/geometry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { Shape } from '../../src/model/types';
import {
  pointInShape, hitTest, shapeInRect, selectionBounds, resizeBox, zoomAt,
} from '../../src/model/geometry';

function shape(over: Partial<Shape>): Shape {
  return {
    id: 'x', kind: 'rect', x: 0, y: 0, w: 100, h: 100,
    style: { fill: '#fff', stroke: '#000', strokeWidth: 2, fontSize: 16, fontColor: '#000' },
    ...over,
  };
}

describe('geometry', () => {
  it('rect hit test uses the bounding box', () => {
    const s = shape({ kind: 'rect' });
    expect(pointInShape(s, { x: 50, y: 50 })).toBe(true);
    expect(pointInShape(s, { x: 150, y: 50 })).toBe(false);
  });

  it('ellipse hit test excludes corners', () => {
    const s = shape({ kind: 'ellipse' });
    expect(pointInShape(s, { x: 50, y: 50 })).toBe(true); // center
    expect(pointInShape(s, { x: 2, y: 2 })).toBe(false); // corner
  });

  it('hitTest returns the topmost (last) matching node', () => {
    const a = shape({ id: 'a' });
    const b = shape({ id: 'b' });
    expect(hitTest([a, b], { x: 50, y: 50 })?.id).toBe('b');
    expect(hitTest([a, b], { x: 999, y: 999 })).toBeUndefined();
  });

  it('shapeInRect detects bbox intersection', () => {
    const s = shape({ x: 0, y: 0, w: 100, h: 100 });
    expect(shapeInRect(s, { x: 50, y: 50, w: 200, h: 200 })).toBe(true);
    expect(shapeInRect(s, { x: 200, y: 200, w: 50, h: 50 })).toBe(false);
  });

  it('selectionBounds unions all shapes', () => {
    const box = selectionBounds([shape({ x: 0, y: 0, w: 50, h: 50 }), shape({ x: 100, y: 100, w: 50, h: 50 })]);
    expect(box).toEqual({ x: 0, y: 0, w: 150, h: 150 });
    expect(selectionBounds([])).toBeNull();
  });

  it('resizeBox grows from the SE handle', () => {
    const out = resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'se', 20, 30);
    expect(out).toEqual({ x: 0, y: 0, w: 120, h: 130 });
  });

  it('resizeBox moves the origin from the NW handle', () => {
    const out = resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'nw', 10, 10);
    expect(out).toEqual({ x: 10, y: 10, w: 90, h: 90 });
  });

  it('zoomAt keeps the cursor point stationary in world space', () => {
    const vp = zoomAt({ panX: 0, panY: 0, zoom: 1 }, 2, 100, 100);
    expect(vp.zoom).toBe(2);
    // world point under cursor before == after: (100-pan)/zoom
    expect((100 - vp.panX) / vp.zoom).toBeCloseTo(100);
    expect((100 - vp.panY) / vp.zoom).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/geometry.test.ts`
Expected: FAIL — cannot import from `../../src/model/geometry`.

- [ ] **Step 3: Create `src/model/geometry.ts`**

```ts
import type { Shape, Viewport } from './types';

export interface Point { x: number; y: number; }
export interface Box { x: number; y: number; w: number; h: number; }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_SIZE = 8;

export function pointInShape(s: Shape, p: Point): boolean {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const rx = s.w / 2;
  const ry = s.h / 2;
  if (rx <= 0 || ry <= 0) return false;
  switch (s.kind) {
    case 'ellipse': {
      const nx = (p.x - cx) / rx;
      const ny = (p.y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }
    case 'diamond': {
      return Math.abs((p.x - cx) / rx) + Math.abs((p.y - cy) / ry) <= 1;
    }
    default: // rect, rounded, triangle, text: bounding box
      return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
  }
}

export function hitTest(nodes: Shape[], p: Point): Shape | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (pointInShape(nodes[i], p)) return nodes[i];
  }
  return undefined;
}

export function shapeInRect(s: Shape, box: Box): boolean {
  return !(s.x > box.x + box.w || s.x + s.w < box.x || s.y > box.y + box.h || s.y + s.h < box.y);
}

export function selectionBounds(shapes: Shape[]): Box | null {
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

export function resizeBox(box: Box, handle: Handle, dx: number, dy: number): Box {
  let { x, y, w, h } = box;
  if (handle.includes('e')) w += dx;
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) { x += dx; w -= dx; }
  if (handle.includes('n')) { y += dy; h -= dy; }
  if (w < MIN_SIZE) { if (handle.includes('w')) x -= (MIN_SIZE - w); w = MIN_SIZE; }
  if (h < MIN_SIZE) { if (handle.includes('n')) y -= (MIN_SIZE - h); h = MIN_SIZE; }
  return { x, y, w, h };
}

export function handlePositions(b: Box): Record<Handle, Point> {
  const { x, y, w, h } = b;
  return {
    nw: { x, y }, n: { x: x + w / 2, y }, ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 }, se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h }, sw: { x, y: y + h }, w: { x, y: y + h / 2 },
  };
}

export function zoomAt(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const worldX = (screenX - vp.panX) / vp.zoom;
  const worldY = (screenY - vp.panY) / vp.zoom;
  const zoom = Math.min(8, Math.max(0.1, vp.zoom * factor));
  return { zoom, panX: screenX - worldX * zoom, panY: screenY - worldY * zoom };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/geometry.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pure geometry helpers (hit-test, marquee, resize, zoom)"
```

---

## Task 4: SVG renderer

**Files:**
- Create: `src/render/shapes.ts`, `src/render/renderer.ts`
- Test: `tests/render/renderer.test.ts`

**Interfaces:**
- Consumes: `Shape`, `Tab` from `model/types`; `Box`, `Handle`, `Point`, `handlePositions`, `selectionBounds` from `model/geometry`.
- Produces:
  - `shapeToSvg(s: Shape): SVGGElement` (a `<g data-id>` containing the primitive + optional text)
  - `class Renderer`:
    - `constructor(mount: HTMLElement)`
    - `readonly svg: SVGSVGElement`
    - `render(tab: Tab, selection: Set<string>): void`
    - `toWorld(clientX: number, clientY: number, vp: Viewport): Point`

- [ ] **Step 1: Write the failing test `tests/render/renderer.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape } from '../../src/model/document';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

describe('Renderer', () => {
  it('mounts a single <svg> element', () => {
    const r = new Renderer(mount);
    expect(r.svg.tagName.toLowerCase()).toBe('svg');
    expect(mount.querySelectorAll('svg')).toHaveLength(1);
  });

  it('renders one <g data-id> per node', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    addNode(tab, createShape('rect', 0, 0));
    addNode(tab, createShape('ellipse', 10, 10));
    r.render(tab, new Set());
    expect(r.svg.querySelectorAll('g[data-id]')).toHaveLength(2);
  });

  it('rebuilds (does not accumulate) on repeated render', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    addNode(tab, createShape('rect', 0, 0));
    r.render(tab, new Set());
    r.render(tab, new Set());
    expect(r.svg.querySelectorAll('g[data-id]')).toHaveLength(1);
  });

  it('draws selection handles for a single selected shape', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    const s = createShape('rect', 0, 0);
    addNode(tab, s);
    r.render(tab, new Set([s.id]));
    expect(r.svg.querySelectorAll('[data-handle]').length).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/renderer.test.ts`
Expected: FAIL — cannot import `Renderer`.

- [ ] **Step 3: Create `src/render/shapes.ts`**

```ts
import type { Shape } from '../model/types';

const NS = 'http://www.w3.org/2000/svg';

function applyStyle(el: SVGElement, s: Shape): void {
  el.setAttribute('fill', s.style.fill);
  el.setAttribute('stroke', s.style.stroke);
  el.setAttribute('stroke-width', String(s.style.strokeWidth));
}

function primitive(s: Shape): SVGElement {
  switch (s.kind) {
    case 'ellipse': {
      const e = document.createElementNS(NS, 'ellipse');
      e.setAttribute('cx', String(s.x + s.w / 2));
      e.setAttribute('cy', String(s.y + s.h / 2));
      e.setAttribute('rx', String(s.w / 2));
      e.setAttribute('ry', String(s.h / 2));
      applyStyle(e, s);
      return e;
    }
    case 'diamond': {
      const p = document.createElementNS(NS, 'polygon');
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      p.setAttribute('points', `${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}`);
      applyStyle(p, s);
      return p;
    }
    case 'triangle': {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', `${s.x + s.w / 2},${s.y} ${s.x + s.w},${s.y + s.h} ${s.x},${s.y + s.h}`);
      applyStyle(p, s);
      return p;
    }
    default: { // rect, rounded, text
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(s.x));
      r.setAttribute('y', String(s.y));
      r.setAttribute('width', String(s.w));
      r.setAttribute('height', String(s.h));
      if (s.kind === 'rounded') {
        r.setAttribute('rx', '12');
        r.setAttribute('ry', '12');
      }
      applyStyle(r, s);
      return r;
    }
  }
}

function textEl(s: Shape): SVGTextElement {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', String(s.x + s.w / 2));
  t.setAttribute('y', String(s.y + s.h / 2));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'central');
  t.setAttribute('font-size', String(s.style.fontSize));
  t.setAttribute('fill', s.style.fontColor);
  t.setAttribute('pointer-events', 'none');
  t.textContent = s.text ?? '';
  return t;
}

export function shapeToSvg(s: Shape): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', s.id);
  g.appendChild(primitive(s));
  if (s.text) g.appendChild(textEl(s));
  return g;
}
```

- [ ] **Step 4: Create `src/render/renderer.ts`**

```ts
import type { Tab, Viewport } from '../model/types';
import { handlePositions, selectionBounds, type Point } from '../model/geometry';
import { shapeToSvg } from './shapes';

const NS = 'http://www.w3.org/2000/svg';

export class Renderer {
  readonly svg: SVGSVGElement;
  private content: SVGGElement;
  private overlay: SVGGElement;

  constructor(mount: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.display = 'block';
    this.svg.style.background = '#fafafa';
    this.content = document.createElementNS(NS, 'g');
    this.overlay = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.content);
    this.svg.appendChild(this.overlay);
    mount.appendChild(this.svg);
  }

  render(tab: Tab, selection: Set<string>): void {
    const vp = tab.viewport;
    const transform = `translate(${vp.panX} ${vp.panY}) scale(${vp.zoom})`;
    this.content.setAttribute('transform', transform);
    this.overlay.setAttribute('transform', transform);
    this.content.replaceChildren(...tab.nodes.map(shapeToSvg));
    this.overlay.replaceChildren();
    this.drawSelection(tab, selection);
  }

  private drawSelection(tab: Tab, selection: Set<string>): void {
    const shapes = tab.nodes.filter((n) => selection.has(n.id));
    const box = selectionBounds(shapes);
    if (!box) return;
    const outline = document.createElementNS(NS, 'rect');
    outline.setAttribute('x', String(box.x));
    outline.setAttribute('y', String(box.y));
    outline.setAttribute('width', String(box.w));
    outline.setAttribute('height', String(box.h));
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#3b82f6');
    outline.setAttribute('stroke-width', '1');
    outline.setAttribute('stroke-dasharray', '4 3');
    outline.setAttribute('pointer-events', 'none');
    this.overlay.appendChild(outline);
    if (shapes.length === 1) {
      const pos = handlePositions(box);
      for (const [handle, p] of Object.entries(pos)) {
        const h = document.createElementNS(NS, 'rect');
        h.setAttribute('x', String(p.x - 4));
        h.setAttribute('y', String(p.y - 4));
        h.setAttribute('width', '8');
        h.setAttribute('height', '8');
        h.setAttribute('fill', '#fff');
        h.setAttribute('stroke', '#3b82f6');
        h.setAttribute('data-handle', handle);
        this.overlay.appendChild(h);
      }
    }
  }

  toWorld(clientX: number, clientY: number, vp: Viewport): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/render/renderer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: SVG renderer with shape factory and selection overlay"
```

---

## Task 5: App shell, toolbar, bootstrap

**Files:**
- Create: `src/tools/types.ts`, `src/ui/toolbar.ts`, `src/app.ts`
- Modify: `src/main.ts`, `src/style.css`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `Renderer`; `createWorkspace`, `getActiveTab`, `cloneWorkspace`; `Workspace`, `Tab`.
- Produces:
  - `src/tools/types.ts`: `interface Tool { onPointerDown(world,ev); onPointerMove(world,ev); onPointerUp(world,ev); onDoubleClick?(world,ev); onActivate?(); onDeactivate?(); }` and `type ToolName = 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text'`.
  - `class App`:
    - `constructor(mount: HTMLElement)`
    - `workspace: Workspace`, `selection: Set<string>`
    - `get activeTab(): Tab`
    - `renderer: Renderer`
    - `registerTool(name: ToolName, tool: Tool): void`
    - `setTool(name: ToolName): void`
    - `currentToolName: ToolName`
    - `render(): void`
    - `commit(): void` (Task 12 wires history/autosave here; for now just re-render)
  - `mountToolbar(app: App, container: HTMLElement): void`

- [ ] **Step 1: Create `src/tools/types.ts`**

```ts
import type { Point } from '../model/geometry';

export type ToolName = 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';

export interface Tool {
  onPointerDown(world: Point, ev: PointerEvent): void;
  onPointerMove(world: Point, ev: PointerEvent): void;
  onPointerUp(world: Point, ev: PointerEvent): void;
  onDoubleClick?(world: Point, ev: MouseEvent): void;
  onActivate?(): void;
  onDeactivate?(): void;
}
```

- [ ] **Step 2: Write the failing test `tests/app.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/app';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

describe('App', () => {
  it('starts with one empty tab and select tool', () => {
    const app = new App(mount);
    expect(app.workspace.tabs).toHaveLength(1);
    expect(app.currentToolName).toBe('select');
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('switches the current tool', () => {
    const app = new App(mount);
    app.setTool('rect');
    expect(app.currentToolName).toBe('rect');
  });

  it('renders an svg into the mount', () => {
    const app = new App(mount);
    app.render();
    expect(mount.querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/app.test.ts`
Expected: FAIL — cannot import `App`.

- [ ] **Step 4: Create `src/app.ts`**

```ts
import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab } from './model/document';
import type { Tab, Workspace } from './model/types';
import type { Tool, ToolName } from './tools/types';

class NoopTool implements Tool {
  onPointerDown(): void {}
  onPointerMove(): void {}
  onPointerUp(): void {}
}

export class App {
  workspace: Workspace = createWorkspace();
  selection = new Set<string>();
  readonly renderer: Renderer;
  currentToolName: ToolName = 'select';

  private tools = new Map<ToolName, Tool>();
  private current: Tool = new NoopTool();

  constructor(mount: HTMLElement) {
    this.renderer = new Renderer(mount);
    this.bindPointerEvents();
  }

  get activeTab(): Tab {
    return getActiveTab(this.workspace);
  }

  registerTool(name: ToolName, tool: Tool): void {
    this.tools.set(name, tool);
    if (name === this.currentToolName) this.current = tool;
  }

  setTool(name: ToolName): void {
    this.current.onDeactivate?.();
    this.currentToolName = name;
    this.current = this.tools.get(name) ?? new NoopTool();
    this.current.onActivate?.();
    // Selection persists across tool switches; it is cleared only by explicit
    // user actions (clicking empty canvas, Esc, or delete).
    this.render();
  }

  render(): void {
    this.renderer.render(this.activeTab, this.selection);
  }

  /** Commit a finished mutation. Task 12 adds history; Task 14 adds autosave. */
  commit(): void {
    this.render();
  }

  private bindPointerEvents(): void {
    const svg = this.renderer.svg;
    svg.addEventListener('pointerdown', (ev) => {
      svg.setPointerCapture(ev.pointerId);
      this.current.onPointerDown(this.world(ev), ev);
    });
    svg.addEventListener('pointermove', (ev) => this.current.onPointerMove(this.world(ev), ev));
    svg.addEventListener('pointerup', (ev) => {
      this.current.onPointerUp(this.world(ev), ev);
      svg.releasePointerCapture(ev.pointerId);
    });
    svg.addEventListener('dblclick', (ev) => this.current.onDoubleClick?.(this.world(ev), ev));
  }

  private world(ev: { clientX: number; clientY: number }) {
    return this.renderer.toWorld(ev.clientX, ev.clientY, this.activeTab.viewport);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/app.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Create `src/ui/toolbar.ts`**

```ts
import type { App } from '../app';
import type { ToolName } from '../tools/types';

const TOOLS: { name: ToolName; label: string }[] = [
  { name: 'select', label: 'Select' },
  { name: 'rect', label: 'Rect' },
  { name: 'rounded', label: 'Rounded' },
  { name: 'ellipse', label: 'Ellipse' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'triangle', label: 'Triangle' },
  { name: 'text', label: 'Text' },
];

export function mountToolbar(app: App, container: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'toolbar';
  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.dataset.tool = t.name;
    btn.addEventListener('click', () => {
      app.setTool(t.name);
      for (const b of bar.querySelectorAll('button[data-tool]')) {
        b.classList.toggle('active', (b as HTMLElement).dataset.tool === app.currentToolName);
      }
    });
    bar.appendChild(btn);
  }
  container.appendChild(bar);
}
```

- [ ] **Step 7: Replace `src/main.ts`**

```ts
import { App } from './app';
import { mountToolbar } from './ui/toolbar';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
root.appendChild(toolbarHost);
root.appendChild(canvasHost);

const app = new App(canvasHost);
mountToolbar(app, toolbarHost);
app.render();
```

- [ ] **Step 8: Append layout styles to `src/style.css`**

```css
#app { display: flex; flex-direction: column; }
.toolbar { display: flex; gap: 4px; padding: 6px; border-bottom: 1px solid #ddd; }
.toolbar button { padding: 4px 10px; cursor: pointer; }
.toolbar button.active { background: #3b82f6; color: #fff; }
.canvas-host { flex: 1; min-height: 0; }
```

- [ ] **Step 9: Manually verify the dev server**

Run: `npm run dev`
Expected: opening the served URL shows a toolbar with 7 buttons over an empty grey canvas; clicking a button highlights it. Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: app shell, tool dispatch, toolbar, bootstrap"
```

---

## Task 6: Shape placement tool

**Files:**
- Create: `src/tools/shapeTool.ts`
- Modify: `src/main.ts` (register shape tools)
- Test: `tests/tools/shapeTool.test.ts`

**Interfaces:**
- Consumes: `App`; `createShape`, `addNode`; `Tool`, `ToolName`; `Point`.
- Produces: `class ShapeTool implements Tool` with `constructor(app: App, kind: ShapeKind)`. A single click on the canvas adds a default-sized shape centered at the click; the new shape becomes the selection and the tool reverts to `select`.

- [ ] **Step 1: Write the failing test `tests/tools/shapeTool.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import type { Point } from '../../src/model/geometry';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

function down(tool: ShapeTool, p: Point) {
  tool.onPointerDown(p, {} as PointerEvent);
  tool.onPointerUp(p, {} as PointerEvent);
}

describe('ShapeTool', () => {
  it('adds a centered shape on click', () => {
    const tool = new ShapeTool(app, 'rect');
    app.registerTool('rect', tool);
    app.setTool('rect');
    down(tool, { x: 200, y: 150 });
    expect(app.activeTab.nodes).toHaveLength(1);
    const s = app.activeTab.nodes[0];
    expect(s.kind).toBe('rect');
    expect(s.x + s.w / 2).toBeCloseTo(200);
    expect(s.y + s.h / 2).toBeCloseTo(150);
  });

  it('selects the new shape and reverts to select tool', () => {
    const tool = new ShapeTool(app, 'ellipse');
    app.registerTool('ellipse', tool);
    app.setTool('ellipse');
    down(tool, { x: 50, y: 50 });
    expect(app.currentToolName).toBe('select');
    expect(app.selection.has(app.activeTab.nodes[0].id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/shapeTool.test.ts`
Expected: FAIL — cannot import `ShapeTool`.

- [ ] **Step 3: Create `src/tools/shapeTool.ts`**

```ts
import type { App } from '../app';
import type { ShapeKind } from '../model/types';
import { addNode, createShape } from '../model/document';
import type { Point } from '../model/geometry';
import type { Tool } from './types';

const DEFAULT_W = 120;
const DEFAULT_H = 70;

export class ShapeTool implements Tool {
  constructor(private app: App, private kind: ShapeKind) {}

  onPointerDown(world: Point): void {
    const shape = createShape(this.kind, world.x - DEFAULT_W / 2, world.y - DEFAULT_H / 2, DEFAULT_W, DEFAULT_H);
    addNode(this.app.activeTab, shape);
    this.app.selection = new Set([shape.id]);
    this.app.commit();
  }

  onPointerMove(): void {}

  onPointerUp(): void {
    this.app.setTool('select');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/shapeTool.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Register shape tools in `src/main.ts`**

Add after `const app = new App(canvasHost);`:

```ts
import { ShapeTool } from './tools/shapeTool';

for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
```

- [ ] **Step 6: Manually verify**

Run: `npm run dev`
Expected: pick "Rect", click the canvas → a rectangle appears where you clicked and the tool returns to Select. Repeat for each shape. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: shape placement tool"
```

---

## Task 7: Select tool — selection & marquee

**Files:**
- Create: `src/tools/selectTool.ts`
- Modify: `src/main.ts` (register select tool)
- Test: `tests/tools/selectTool.select.test.ts`

**Interfaces:**
- Consumes: `App`; `hitTest`, `shapeInRect`, `handlePositions`, `selectionBounds`, `Point`, `Box`, `Handle`; `Tool`.
- Produces: `class SelectTool implements Tool`. This task implements **selection only**: click a shape to select it; shift-click toggles membership; click empty space clears; drag on empty space draws a marquee and selects intersecting shapes on release. (Move/resize/dblclick are added in Tasks 8–10 to the same class.)
- Internal state the later tasks extend: `private mode: 'idle' | 'marquee' | 'move' | 'resize'`, `private start: Point`, `private activeHandle: Handle | null`.

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.select.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';
import type { Point } from '../../src/model/geometry';

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});

function click(p: Point, shift = false) {
  tool.onPointerDown(p, { shiftKey: shift } as PointerEvent);
  tool.onPointerUp(p, { shiftKey: shift } as PointerEvent);
}

describe('SelectTool selection', () => {
  it('selects a shape on click and clears on empty click', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    click({ x: 50, y: 50 });
    expect(app.selection.has(s.id)).toBe(true);
    click({ x: 500, y: 500 });
    expect(app.selection.size).toBe(0);
  });

  it('shift-click toggles multi-selection', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 100, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    click({ x: 25, y: 25 });
    click({ x: 125, y: 25 }, true);
    expect(app.selection.size).toBe(2);
    click({ x: 125, y: 25 }, true);
    expect(app.selection.has(b.id)).toBe(false);
  });

  it('marquee selects intersecting shapes', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 300, 300, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 100, y: 100 }, {} as PointerEvent);
    tool.onPointerUp({ x: 100, y: 100 }, {} as PointerEvent);
    expect(app.selection.has(a.id)).toBe(true);
    expect(app.selection.has(b.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.select.test.ts`
Expected: FAIL — cannot import `SelectTool`.

- [ ] **Step 3: Create `src/tools/selectTool.ts`**

```ts
import type { App } from '../app';
import type { Shape } from '../model/types';
import { hitTest, shapeInRect, type Box, type Handle, type Point } from '../model/geometry';
import type { Tool } from './types';

type Mode = 'idle' | 'marquee' | 'move' | 'resize';

export class SelectTool implements Tool {
  private mode: Mode = 'idle';
  private start: Point = { x: 0, y: 0 };
  protected activeHandle: Handle | null = null;

  constructor(protected app: App) {}

  onPointerDown(world: Point, ev: PointerEvent): void {
    this.start = world;
    const hit = hitTest(this.app.activeTab.nodes as Shape[], world);
    if (hit) {
      if (ev.shiftKey) this.toggle(hit.id);
      else if (!this.app.selection.has(hit.id)) this.app.selection = new Set([hit.id]);
      this.mode = 'idle';
      this.app.render();
    } else {
      if (!ev.shiftKey) this.app.selection.clear();
      this.mode = 'marquee';
      this.app.render();
    }
  }

  onPointerMove(world: Point): void {
    if (this.mode === 'marquee') {
      this.app.selection = new Set(
        (this.app.activeTab.nodes as Shape[])
          .filter((s) => shapeInRect(s, this.marqueeBox(world)))
          .map((s) => s.id),
      );
      this.app.render();
    }
  }

  onPointerUp(): void {
    this.mode = 'idle';
    this.app.render();
  }

  private toggle(id: string): void {
    if (this.app.selection.has(id)) this.app.selection.delete(id);
    else this.app.selection.add(id);
  }

  private marqueeBox(world: Point): Box {
    return {
      x: Math.min(this.start.x, world.x),
      y: Math.min(this.start.y, world.y),
      w: Math.abs(world.x - this.start.x),
      h: Math.abs(world.y - this.start.y),
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.select.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Register the select tool in `src/main.ts`**

Add after the App is created (before the ShapeTool loop is fine):

```ts
import { SelectTool } from './tools/selectTool';

app.registerTool('select', new SelectTool(app));
app.setTool('select');
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: select tool with click, shift-click, and marquee selection"
```

---

## Task 8: Select tool — move

**Files:**
- Modify: `src/tools/selectTool.ts`
- Test: `tests/tools/selectTool.move.test.ts`

**Interfaces:**
- Consumes: existing `SelectTool` state (`mode`, `start`).
- Produces: dragging a selected shape moves every selected shape by the pointer delta; the move commits once on pointer-up (single history entry — relied on by Task 12).

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.move.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});

describe('SelectTool move', () => {
  it('drags selected shapes by the pointer delta', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.onPointerDown({ x: 50, y: 50 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 70, y: 90 }, {} as PointerEvent);
    tool.onPointerUp({ x: 70, y: 90 }, {} as PointerEvent);
    expect(s.x).toBe(20);
    expect(s.y).toBe(40);
  });

  it('moves all selected shapes together', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 100, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    tool.onPointerDown({ x: 25, y: 25 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 35, y: 25 }, {} as PointerEvent);
    tool.onPointerUp({ x: 35, y: 25 }, {} as PointerEvent);
    expect(a.x).toBe(10);
    expect(b.x).toBe(110);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.move.test.ts`
Expected: FAIL — shapes are not moved (no move logic yet).

- [ ] **Step 3: Add move logic to `src/tools/selectTool.ts`**

In `onPointerDown`, replace the `if (hit) { ... this.mode = 'idle'; this.app.render(); }` branch body with logic that enters move mode and tracks the last pointer position:

```ts
    if (hit) {
      if (ev.shiftKey) this.toggle(hit.id);
      else if (!this.app.selection.has(hit.id)) this.app.selection = new Set([hit.id]);
      this.mode = 'move';
      this.last = world;
      this.moved = false;
      this.app.render();
    } else {
```

Add two fields next to `start`:

```ts
  private last: Point = { x: 0, y: 0 };
  private moved = false;
```

Add a `move` branch to `onPointerMove` (before/after the existing marquee branch):

```ts
    if (this.mode === 'move') {
      const dx = world.x - this.last.x;
      const dy = world.y - this.last.y;
      this.last = world;
      for (const s of this.app.activeTab.nodes as Shape[]) {
        if (this.app.selection.has(s.id)) {
          s.x += dx;
          s.y += dy;
          this.moved = true;
        }
      }
      this.app.render();
      return;
    }
```

Replace `onPointerUp` so a real move commits once:

```ts
  onPointerUp(): void {
    if (this.mode === 'move' && this.moved) this.app.commit();
    this.mode = 'idle';
    this.moved = false;
    this.app.render();
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.move.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: drag to move selected shapes (single commit per drag)"
```

---

## Task 9: Select tool — resize

**Files:**
- Modify: `src/tools/selectTool.ts`
- Test: `tests/tools/selectTool.resize.test.ts`

**Interfaces:**
- Consumes: `resizeBox`, `handlePositions`, `Handle`; existing `SelectTool`.
- Produces: when exactly one shape is selected, pressing on a handle resizes that shape via `resizeBox`; commits once on pointer-up. Handle hit-testing is done against `handlePositions` of the selected shape's box within a small screen-independent tolerance in world units.

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.resize.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});

describe('SelectTool resize', () => {
  it('resizes from the SE handle when one shape is selected', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    // press exactly on the SE handle (100,100)
    tool.onPointerDown({ x: 100, y: 100 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 140, y: 130 }, {} as PointerEvent);
    tool.onPointerUp({ x: 140, y: 130 }, {} as PointerEvent);
    expect(s.w).toBe(140);
    expect(s.h).toBe(130);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.resize.test.ts`
Expected: FAIL — shape is moved or unchanged, not resized.

- [ ] **Step 3: Add resize logic to `src/tools/selectTool.ts`**

Add imports:

```ts
import { hitTest, shapeInRect, handlePositions, resizeBox, type Box, type Handle, type Point } from '../model/geometry';
```

Add a field to remember the shape being resized and its starting box:

```ts
  private resizeShape: Shape | null = null;
  private startBox: Box = { x: 0, y: 0, w: 0, h: 0 };
```

At the very top of `onPointerDown`, before the `hitTest`, check for a handle press when a single shape is selected:

```ts
    this.start = world;
    const handle = this.handleAt(world);
    if (handle) {
      const s = this.singleSelected();
      if (s) {
        this.mode = 'resize';
        this.activeHandle = handle;
        this.resizeShape = s;
        this.startBox = { x: s.x, y: s.y, w: s.w, h: s.h };
        return;
      }
    }
```

Add the resize branch to `onPointerMove` (before the marquee/move branches):

```ts
    if (this.mode === 'resize' && this.resizeShape && this.activeHandle) {
      const dx = world.x - this.start.x;
      const dy = world.y - this.start.y;
      const box = resizeBox(this.startBox, this.activeHandle, dx, dy);
      Object.assign(this.resizeShape, box);
      this.app.render();
      return;
    }
```

Extend `onPointerUp` to commit a resize:

```ts
  onPointerUp(): void {
    if (this.mode === 'resize') this.app.commit();
    else if (this.mode === 'move' && this.moved) this.app.commit();
    this.mode = 'idle';
    this.moved = false;
    this.resizeShape = null;
    this.activeHandle = null;
    this.app.render();
  }
```

Add the helper methods to the class:

```ts
  private singleSelected(): Shape | null {
    if (this.app.selection.size !== 1) return null;
    const id = [...this.app.selection][0];
    return (this.app.activeTab.nodes as Shape[]).find((s) => s.id === id) ?? null;
  }

  private handleAt(world: Point): Handle | null {
    const s = this.singleSelected();
    if (!s) return null;
    const tol = 8 / this.app.activeTab.viewport.zoom; // world-space tolerance
    const pos = handlePositions({ x: s.x, y: s.y, w: s.w, h: s.h });
    for (const [handle, p] of Object.entries(pos)) {
      if (Math.abs(world.x - p.x) <= tol && Math.abs(world.y - p.y) <= tol) return handle as Handle;
    }
    return null;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.resize.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: resize a single selected shape via handles"
```

---

## Task 10: Inline text editing

**Files:**
- Modify: `src/tools/selectTool.ts` (add `onDoubleClick`)
- Test: `tests/tools/selectTool.text.test.ts`

**Interfaces:**
- Consumes: `hitTest`; the `App`.
- Produces: `SelectTool.onDoubleClick(world)` — double-clicking a shape opens an HTML `<input>` overlay positioned over the shape (absolutely positioned in the canvas host); committing on Enter/blur writes `shape.text` and commits; Escape cancels. Implemented with a small DOM overlay; the **text value logic** is exercised by a unit test that drives a helper `applyText(shapeId, value)`.

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.text.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});

describe('SelectTool text editing', () => {
  it('applyText writes text to the shape and commits', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.applyText(s.id, 'Hello');
    expect(s.text).toBe('Hello');
  });

  it('double-click on a shape selects it and opens an editor input', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    tool.onDoubleClick({ x: 50, y: 50 }, {} as MouseEvent);
    expect(app.selection.has(s.id)).toBe(true);
    expect(document.querySelector('input.text-editor')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.text.test.ts`
Expected: FAIL — `applyText`/`onDoubleClick` not defined.

- [ ] **Step 3: Add text editing to `src/tools/selectTool.ts`**

Add methods to the class:

```ts
  applyText(id: string, value: string): void {
    const s = (this.app.activeTab.nodes as Shape[]).find((n) => n.id === id);
    if (!s) return;
    s.text = value;
    this.app.commit();
  }

  onDoubleClick(world: Point): void {
    const hit = hitTest(this.app.activeTab.nodes as Shape[], world);
    if (!hit) return;
    this.app.selection = new Set([hit.id]);
    this.app.render();
    this.openEditor(hit);
  }

  private openEditor(s: Shape): void {
    const host = this.app.renderer.svg.parentElement;
    if (!host) return;
    const input = document.createElement('input');
    input.className = 'text-editor';
    input.value = s.text ?? '';
    const vp = this.app.activeTab.viewport;
    input.style.position = 'absolute';
    input.style.left = `${vp.panX + s.x * vp.zoom}px`;
    input.style.top = `${vp.panY + (s.y + s.h / 2 - 12) * vp.zoom}px`;
    input.style.width = `${s.w * vp.zoom}px`;
    host.style.position = 'relative';
    host.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (write: boolean) => {
      if (done) return;
      done = true;
      if (write) this.applyText(s.id, input.value);
      input.remove();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      else if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.text.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Manually verify**

Run: `npm run dev`
Expected: place a rect, double-click it, type text, press Enter → text appears centered in the shape. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: double-click inline text editing for shapes"
```

---

## Task 11: Delete & reset

**Files:**
- Modify: `src/app.ts` (add `deleteSelection`, `resetTab`, keyboard binding), `src/ui/toolbar.ts` (Delete + Reset buttons)
- Test: `tests/app.delete.test.ts`

**Interfaces:**
- Consumes: `removeNodes`; `App`.
- Produces:
  - `App.deleteSelection(): void` — removes selected nodes, clears selection, commits.
  - `App.resetTab(): void` — clears the active tab's nodes, commits.
  - Delete/Backspace key removes the selection (when not typing in an input).

- [ ] **Step 1: Write the failing test `tests/app.delete.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

describe('delete and reset', () => {
  it('deleteSelection removes selected nodes', () => {
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 10, 10);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id]);
    app.deleteSelection();
    expect(app.activeTab.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(app.selection.size).toBe(0);
  });

  it('resetTab clears all nodes', () => {
    addNode(app.activeTab, createShape('rect', 0, 0));
    app.resetTab();
    expect(app.activeTab.nodes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.delete.test.ts`
Expected: FAIL — `deleteSelection`/`resetTab` not defined.

- [ ] **Step 3: Add methods + key handler to `src/app.ts`**

Add import:

```ts
import { createWorkspace, getActiveTab, removeNodes } from './model/document';
```

Add methods to `App`:

```ts
  deleteSelection(): void {
    if (this.selection.size === 0) return;
    removeNodes(this.activeTab, this.selection);
    this.selection.clear();
    this.commit();
  }

  resetTab(): void {
    this.activeTab.nodes = [];
    this.selection.clear();
    this.commit();
  }
```

In the constructor, after `this.bindPointerEvents();`, add:

```ts
    this.bindKeyboard();
```

Add the method:

```ts
  private listeners = new AbortController();

  /** Detach all global (window) listeners this App registered. */
  destroy(): void {
    this.listeners.abort();
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        this.deleteSelection();
      }
    }, { signal: this.listeners.signal });
  }

// NOTE: Tasks 12 (undo/redo) and 13 (space-pan) must register their window listeners
// through `{ signal: this.listeners.signal }` so they are cleaned up by destroy().
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/app.delete.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add Delete + Reset buttons to `src/ui/toolbar.ts`**

At the end of `mountToolbar`, before `container.appendChild(bar)` is fine to keep; append action buttons after the tool loop:

```ts
  const sep = document.createElement('span');
  sep.style.width = '12px';
  bar.appendChild(sep);

  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.addEventListener('click', () => app.deleteSelection());
  bar.appendChild(del);

  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    if (app.activeTab.nodes.length === 0 || confirm('Clear the whole canvas?')) app.resetTab();
  });
  bar.appendChild(reset);
```

- [ ] **Step 6: Manually verify**

Run: `npm run dev`
Expected: select a shape and press Delete (or the button) → it disappears. Reset clears everything (with a confirm when non-empty). Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: delete selection and reset canvas"
```

---

## Task 12: Undo / redo (snapshot)

**Files:**
- Create: `src/history/history.ts`
- Modify: `src/app.ts` (wire history into `commit`, add `undo`/`redo`, keyboard), `src/ui/toolbar.ts` (Undo/Redo buttons)
- Test: `tests/history/history.test.ts`

**Interfaces:**
- Consumes: `Workspace`; `cloneWorkspace`.
- Produces:
  - `class History`:
    - `constructor(initial: Workspace)`
    - `commit(next: Workspace): void` (push prior state, cap at 100, clear redo)
    - `undo(): Workspace | null`
    - `redo(): Workspace | null`
    - `canUndo(): boolean`, `canRedo(): boolean`
  - `App.undo()` / `App.redo()` replace `this.workspace` with the returned snapshot, clear selection, and render. `App.commit()` now also calls `history.commit`.

- [ ] **Step 1: Write the failing test `tests/history/history.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { History } from '../../src/history/history';
import { createWorkspace, getActiveTab, addNode, createShape } from '../../src/model/document';

describe('History', () => {
  it('undo restores the previous workspace state', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    expect(getActiveTab(ws).nodes).toHaveLength(1);

    const prev = h.undo()!;
    expect(getActiveTab(prev).nodes).toHaveLength(0);
  });

  it('redo re-applies an undone change', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    const undone = h.undo()!;
    const redone = h.redo()!;
    expect(getActiveTab(undone).nodes).toHaveLength(0);
    expect(getActiveTab(redone).nodes).toHaveLength(1);
  });

  it('a new commit clears the redo stack', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    h.undo();
    addNode(getActiveTab(ws), createShape('ellipse', 0, 0));
    h.commit(ws);
    expect(h.canRedo()).toBe(false);
  });

  it('returns null when there is nothing to undo/redo', () => {
    const h = new History(createWorkspace());
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/history/history.test.ts`
Expected: FAIL — cannot import `History`.

- [ ] **Step 3: Create `src/history/history.ts`**

```ts
import type { Workspace } from '../model/types';
import { cloneWorkspace } from '../model/document';

const LIMIT = 100;

export class History {
  private undoStack: Workspace[] = [];
  private redoStack: Workspace[] = [];
  private present: Workspace;

  constructor(initial: Workspace) {
    this.present = cloneWorkspace(initial);
  }

  commit(next: Workspace): void {
    this.undoStack.push(this.present);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.present = cloneWorkspace(next);
    this.redoStack = [];
  }

  undo(): Workspace | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(this.present);
    this.present = cloneWorkspace(prev);
    return cloneWorkspace(this.present);
  }

  redo(): Workspace | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(this.present);
    this.present = cloneWorkspace(next);
    return cloneWorkspace(this.present);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/history/history.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire history into `src/app.ts`**

Add import and a field:

```ts
import { History } from './history/history';
```

Add field and initialize after `this.renderer = ...` in the constructor:

```ts
  private history = new History(this.workspace);
```

Replace `commit()`:

```ts
  commit(): void {
    this.history.commit(this.workspace);
    this.render();
  }
```

Add undo/redo:

```ts
  undo(): void {
    const ws = this.history.undo();
    if (!ws) return;
    this.workspace = ws;
    this.selection.clear();
    this.render();
  }

  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    this.workspace = ws;
    this.selection.clear();
    this.render();
  }
```

Extend `bindKeyboard` with undo/redo shortcuts (inside the existing handler, after the input guard):

```ts
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        this.redo();
        return;
      }
```

- [ ] **Step 6: Add Undo/Redo buttons to `src/ui/toolbar.ts`**

After the Reset button:

```ts
  const undo = document.createElement('button');
  undo.textContent = 'Undo';
  undo.addEventListener('click', () => app.undo());
  bar.appendChild(undo);

  const redo = document.createElement('button');
  redo.textContent = 'Redo';
  redo.addEventListener('click', () => app.redo());
  bar.appendChild(redo);
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Manually verify**

Run: `npm run dev`
Expected: add a shape, move it, Ctrl+Z reverts the move, then the add; Ctrl+Shift+Z redoes. Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: snapshot-based undo/redo with keyboard shortcuts"
```

---

## Task 13: Pan & zoom

**Files:**
- Create: `src/ui/zoom.ts`
- Modify: `src/app.ts` (wheel + space-drag pan, `zoomBy`/`resetView`), `src/ui/toolbar.ts` (zoom buttons)
- Test: `tests/ui/zoom.test.ts`

**Interfaces:**
- Consumes: `zoomAt`, `Viewport`; `App`.
- Produces:
  - `App.zoomBy(factor: number, screenX?: number, screenY?: number): void` — uses `zoomAt`; defaults to canvas center. Viewport changes render + autosave but **do not** push history.
  - `App.resetView(): void` — sets viewport to `{panX:0,panY:0,zoom:1}`.
  - `App.panBy(dx: number, dy: number): void`.
  - Ctrl/⌘ + wheel zooms at cursor; space-held pointer drag pans.

- [ ] **Step 1: Write the failing test `tests/ui/zoom.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});

describe('pan and zoom', () => {
  it('zoomBy multiplies zoom and clamps', () => {
    app.zoomBy(2, 0, 0);
    expect(app.activeTab.viewport.zoom).toBe(2);
    app.zoomBy(100, 0, 0); // clamp to 8
    expect(app.activeTab.viewport.zoom).toBe(8);
  });

  it('panBy shifts the viewport', () => {
    app.panBy(30, -10);
    expect(app.activeTab.viewport.panX).toBe(30);
    expect(app.activeTab.viewport.panY).toBe(-10);
  });

  it('resetView restores defaults', () => {
    app.zoomBy(2, 0, 0);
    app.panBy(50, 50);
    app.resetView();
    expect(app.activeTab.viewport).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/zoom.test.ts`
Expected: FAIL — `zoomBy`/`panBy`/`resetView` not defined.

- [ ] **Step 3: Add viewport methods to `src/app.ts`**

Add import:

```ts
import { zoomAt } from './model/geometry';
```

Add methods to `App`:

```ts
  zoomBy(factor: number, screenX?: number, screenY?: number): void {
    const rect = this.renderer.svg.getBoundingClientRect();
    const sx = screenX ?? rect.width / 2;
    const sy = screenY ?? rect.height / 2;
    this.activeTab.viewport = zoomAt(this.activeTab.viewport, factor, sx, sy);
    this.render();
  }

  panBy(dx: number, dy: number): void {
    const vp = this.activeTab.viewport;
    this.activeTab.viewport = { ...vp, panX: vp.panX + dx, panY: vp.panY + dy };
    this.render();
  }

  resetView(): void {
    this.activeTab.viewport = { panX: 0, panY: 0, zoom: 1 };
    this.render();
  }
```

(Note: these intentionally call `render()`, not `commit()`, so view changes are not undoable. Autosave wiring in Task 14 will also persist viewport via a separate hook.)

- [ ] **Step 4: Add wheel + space-drag handling to `src/app.ts`**

In the constructor after `this.bindKeyboard();` add `this.bindViewport();` and implement:

```ts
  private spaceDown = false;
  private panning = false;
  private panLast = { x: 0, y: 0 };

  private bindViewport(): void {
    const svg = this.renderer.svg;
    const sig = { signal: this.listeners.signal };
    svg.addEventListener('wheel', (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        const rect = svg.getBoundingClientRect();
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.zoomBy(factor, ev.clientX - rect.left, ev.clientY - rect.top);
      }
    }, { ...sig, passive: false });

    window.addEventListener('keydown', (ev) => { if (ev.code === 'Space') { ev.preventDefault(); this.spaceDown = true; } }, sig);
    window.addEventListener('keyup', (ev) => { if (ev.code === 'Space') this.spaceDown = false; }, sig);

    svg.addEventListener('pointerdown', (ev) => {
      if (this.spaceDown || ev.button === 1) {
        this.panning = true;
        this.panLast = { x: ev.clientX, y: ev.clientY };
        svg.setPointerCapture(ev.pointerId);
        ev.stopImmediatePropagation();
      }
    }, { ...sig, capture: true });
    svg.addEventListener('pointermove', (ev) => {
      if (!this.panning) return;
      this.panBy(ev.clientX - this.panLast.x, ev.clientY - this.panLast.y);
      this.panLast = { x: ev.clientX, y: ev.clientY };
      ev.stopImmediatePropagation();
    }, { ...sig, capture: true });
    svg.addEventListener('pointerup', (ev) => {
      if (this.panning) {
        this.panning = false;
        svg.releasePointerCapture(ev.pointerId);
        ev.stopImmediatePropagation();
      }
    }, { ...sig, capture: true });
  }
```

- [ ] **Step 5: Create `src/ui/zoom.ts`**

```ts
import type { App } from '../app';

export function mountZoomControls(app: App, bar: HTMLElement): void {
  const zoomOut = document.createElement('button');
  zoomOut.textContent = '−';
  zoomOut.title = 'Zoom out';
  zoomOut.addEventListener('click', () => app.zoomBy(1 / 1.2));

  const zoomIn = document.createElement('button');
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  zoomIn.addEventListener('click', () => app.zoomBy(1.2));

  const fit = document.createElement('button');
  fit.textContent = '100%';
  fit.title = 'Reset view';
  fit.addEventListener('click', () => app.resetView());

  bar.append(zoomOut, zoomIn, fit);
}
```

- [ ] **Step 6: Mount zoom controls in `src/main.ts`**

```ts
import { mountZoomControls } from './ui/zoom';

mountZoomControls(app, toolbarHost.querySelector('.toolbar')!);
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Manually verify**

Run: `npm run dev`
Expected: +/−/100% buttons change zoom; Ctrl/⌘+wheel zooms toward the cursor; holding Space and dragging pans the canvas. Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: pan and zoom (buttons, ctrl-wheel, space-drag)"
```

---

## Task 14: Autosave to localStorage

**Files:**
- Create: `src/storage/autosave.ts`
- Modify: `src/app.ts` (schedule autosave on every render-affecting change; load on startup), `src/main.ts` (load saved workspace)
- Test: `tests/storage/autosave.test.ts`

**Interfaces:**
- Consumes: `Workspace`.
- Produces:
  - `class Autosave`:
    - `constructor(key?: string)` (default `'quickdraw:workspace'`)
    - `save(ws: Workspace): void` (synchronous write, swallows quota errors)
    - `load(): Workspace | null`
    - `schedule(ws: Workspace): void` (debounced 400ms write)
  - `App` loads a saved workspace if present at construction, and schedules autosave inside `commit()` and after viewport changes.

- [ ] **Step 1: Write the failing test `tests/storage/autosave.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Autosave } from '../../src/storage/autosave';
import { createWorkspace, getActiveTab, addNode, createShape } from '../../src/model/document';

beforeEach(() => localStorage.clear());

describe('Autosave', () => {
  it('save then load round-trips the workspace', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createShape('rect', 5, 6));
    const store = new Autosave('test:ws');
    store.save(ws);
    const loaded = store.load();
    expect(loaded).not.toBeNull();
    expect(getActiveTab(loaded!).nodes[0]).toMatchObject({ x: 5, y: 6, kind: 'rect' });
  });

  it('load returns null when nothing is stored', () => {
    const store = new Autosave('test:empty');
    expect(store.load()).toBeNull();
  });

  it('load returns null on corrupt data', () => {
    localStorage.setItem('test:corrupt', '{not json');
    const store = new Autosave('test:corrupt');
    expect(store.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/storage/autosave.test.ts`
Expected: FAIL — cannot import `Autosave`.

- [ ] **Step 3: Create `src/storage/autosave.ts`**

```ts
import type { Workspace } from '../model/types';

const DEBOUNCE_MS = 400;

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private key = 'quickdraw:workspace') {}

  save(ws: Workspace): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(ws));
    } catch {
      // quota or serialization failure: keep the app usable, drop the write
    }
  }

  load(): Workspace | null {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Workspace;
      if (!parsed || !Array.isArray(parsed.tabs) || !parsed.activeTabId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  schedule(ws: Workspace): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(ws), DEBOUNCE_MS);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/storage/autosave.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire autosave into `src/app.ts`**

Add import and field:

```ts
import { Autosave } from './storage/autosave';
```

```ts
  private autosave = new Autosave();
```

Add an optional constructor parameter to load a saved workspace. Change the field initializer `workspace: Workspace = createWorkspace();` to be assigned in the constructor instead, and update the constructor signature:

```ts
  workspace: Workspace;

  constructor(mount: HTMLElement, initial?: Workspace) {
    this.workspace = initial ?? createWorkspace();
    this.renderer = new Renderer(mount);
    this.history = new History(this.workspace);
    this.bindPointerEvents();
    this.bindKeyboard();
    this.bindViewport();
  }
```

(Move the `private history` initialization into the constructor as shown — declare it as `private history: History;` at the field level.)

Schedule autosave in `commit()` and after viewport changes. Update `commit()`:

```ts
  commit(): void {
    this.history.commit(this.workspace);
    this.autosave.schedule(this.workspace);
    this.render();
  }
```

Add `this.autosave.schedule(this.workspace);` at the end of `zoomBy`, `panBy`, and `resetView` (after their `this.render()`).

- [ ] **Step 6: Load saved workspace in `src/main.ts`**

Change the App construction to load any saved workspace first:

```ts
import { Autosave } from './storage/autosave';

const saved = new Autosave().load();
const app = new App(canvasHost, saved ?? undefined);
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Manually verify persistence**

Run: `npm run dev`
Expected: add a few shapes, wait ~1s, refresh the page → the shapes are still there. Stop with Ctrl+C.

- [ ] **Step 9: Final build check**

Run: `npm run build`
Expected: type-checks and builds with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: debounced autosave to localStorage with load on startup"
```

---

## Phase 1 Done — Definition of Done
- Place all six shape kinds on the canvas.
- Select (click / shift-click / marquee), move, and resize shapes; resize handles on single selection.
- Double-click to edit a shape's text.
- Delete selection; reset the canvas.
- Undo/redo via buttons and keyboard, snapshot-based.
- Pan and zoom (buttons, ctrl-wheel-at-cursor, space-drag).
- Workspace autosaves and survives a refresh.
- `npm test` green; `npm run build` clean.

## What Phase 1 deliberately omits (later plans)
- **Phase 2:** smart anchored connectors, grouping, properties/style panel, multi-tab UI + naming.
- **Phase 3:** JSON/PNG/SVG export + project open, copy/paste, alignment guides, elbow routing, shortcut polish.

---

## Self-Review Notes (against the spec)
- **Spec coverage (Phase 1 scope):** shapes §7 → Tasks 4,6; select/move/resize §6 → Tasks 7–9; inline text §6 → Task 10; delete/reset §7 → Task 11; undo §7,§12 → Task 12; pan/zoom §7 → Task 13; autosave §8 → Task 14; model/render/source-of-truth §3,§4,§5 → Tasks 2–5. Connectors/grouping/tabs/export are intentionally deferred to Phase 2–3 plans (spec §13).
- **Placeholders:** none — every code/test step contains complete content.
- **Type consistency:** `Workspace`/`Tab`/`Shape`/`Node`, `Viewport{panX,panY,zoom}`, `Box{x,y,w,h}`, `Handle`, `Point`, `Tool`/`ToolName`, and the `commit()`/`render()`/`zoomBy()/panBy()/resetView()` signatures are used identically across tasks. `cloneWorkspace` (Task 2) is reused by `History` (Task 12). `commit()` is the single history+autosave choke point introduced in Task 5 and extended in Tasks 12 and 14.
