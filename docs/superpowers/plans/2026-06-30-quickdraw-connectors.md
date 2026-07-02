# QuickDraw Connectors (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add arrows that connect two shapes — created with an Arrow tool by dragging source→target, attached to shape edges, auto-re-routing when shapes move, selectable and deletable, with delete-cascade and persistence.

**Architecture:** Widen the `Node` union from `Shape` to `Shape | Connector` with `isShape`/`isConnector` type guards (replacing the Phase-1 `as Shape[]` casts). A `Connector` references two shapes; its drawn segment is computed each render by clipping the center-to-center line to each shape's bounding box, so re-routing is automatic. A new `ConnectorTool` creates connectors by drag; the `SelectTool` becomes node-aware for click-selection.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom), SVG. No new dependencies.

## Global Constraints

- Strict TypeScript; all source under `src/`, tests mirror under `tests/`.
- The data model is the single source of truth; the renderer renders from the model (no app state in the DOM). Every committed mutation routes through `App.commit()` (history + autosave).
- `Node = Shape | Connector`. Narrow with `isShape`/`isConnector` — do NOT add new `as Shape[]` casts.
- Connectors use **auto-edge attachment**: endpoints reference shapes; the boundary point is derived. v1 clips to the **bounding box** for all shape kinds.
- **Straight** routing, arrowhead at the `to` end, fixed `DEFAULT_CONNECTOR_STYLE` (no restyle UI this phase).
- Release-on-empty (or same shape) **cancels** — no floating/dangling endpoints created by the user.
- Connectors render in a **back layer**, shapes in front. Shapes win hit-testing over connectors.
- Keep the build green and all existing tests passing at every task boundary.

---

## File Structure

| File | Change | Task |
|------|--------|------|
| `src/model/types.ts` | `Node = Shape \| Connector`; `Connector`, `Endpoint`, `ConnectorStyle` | 1 |
| `src/model/document.ts` | guards, `DEFAULT_CONNECTOR_STYLE`, `createConnector`, widen `groupMembers`; (Task 6) cascade + prune | 1, 6 |
| `src/render/renderer.ts` | narrow shape-only spots (T1); kind dispatch + back/front + arrowhead defs + highlight (T3, T4) | 1, 3, 4 |
| `src/tools/selectTool.ts` | narrow casts (T1); `hitNode` + marquee connector rule (T5) | 1, 5 |
| `src/render/connector.ts` | **New** — geometry + svg factory | 2, 3 |
| `src/tools/connectorTool.ts` | **New** — the Arrow tool | 4 |
| `src/tools/types.ts` | `ToolName` gains `'arrow'` | 4 |
| `src/ui/toolbar.ts` | Arrow tool button | 4 |
| `src/app.ts` | `highlightId` + pass to render; register no-op; (T6) prune on load | 4, 6 |
| `src/main.ts` | register `ConnectorTool` | 4 |

---

## Task 1: Widen the Node union (behavior-preserving migration)

**Files:**
- Modify: `src/model/types.ts`, `src/model/document.ts`, `src/render/renderer.ts`, `src/tools/selectTool.ts`
- Test: `tests/model/connector-model.test.ts`

**Interfaces:**
- Consumes: existing `Shape`, `Tab`, geometry helpers.
- Produces:
  - Types: `Node = Shape | Connector`, `Connector`, `Endpoint`, `ConnectorStyle`.
  - `isShape(n: Node): n is Shape`, `isConnector(n: Node): n is Connector`, `isAttached(e: Endpoint): e is { nodeId: string }`
  - `DEFAULT_CONNECTOR_STYLE: ConnectorStyle`
  - `createConnector(from: Endpoint, to: Endpoint): Connector`
  - `groupMembers(tab: Tab, node: Node): string[]` (param widened from `Shape` to `Node`)

- [ ] **Step 1: Add the connector types to `src/model/types.ts`**

Replace `export type Node = Shape;` with:

```ts
export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  arrowEnd: boolean;
}

export type Endpoint = { nodeId: string } | { x: number; y: number };

export interface Connector {
  id: string;
  kind: 'connector';
  from: Endpoint;
  to: Endpoint;
  style: ConnectorStyle;
  groupId?: string;
}

export type Node = Shape | Connector;
```

- [ ] **Step 2: Write the failing test `tests/model/connector-model.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createShape, createConnector, isShape, isConnector, isAttached,
  createWorkspace, getActiveTab, addNode, cloneWorkspace, DEFAULT_CONNECTOR_STYLE,
} from '../../src/model/document';

describe('connector model', () => {
  it('createConnector builds a connector with the default style', () => {
    const c = createConnector({ nodeId: 'a' }, { nodeId: 'b' });
    expect(c.kind).toBe('connector');
    expect(c.from).toEqual({ nodeId: 'a' });
    expect(c.to).toEqual({ nodeId: 'b' });
    expect(c.style).toEqual(DEFAULT_CONNECTOR_STYLE);
    expect(c.style).not.toBe(DEFAULT_CONNECTOR_STYLE); // copied, not shared
    expect(c.id).toBeTruthy();
  });

  it('type guards discriminate shapes and connectors', () => {
    const s = createShape('rect', 0, 0);
    const c = createConnector({ nodeId: 'a' }, { nodeId: 'b' });
    expect(isShape(s)).toBe(true);
    expect(isConnector(s)).toBe(false);
    expect(isConnector(c)).toBe(true);
    expect(isShape(c)).toBe(false);
  });

  it('isAttached distinguishes attached and floating endpoints', () => {
    expect(isAttached({ nodeId: 'a' })).toBe(true);
    expect(isAttached({ x: 1, y: 2 })).toBe(false);
  });

  it('connectors serialize and clone with the workspace', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createConnector({ nodeId: 'a' }, { nodeId: 'b' }));
    const copy = cloneWorkspace(ws);
    const roundTrip = JSON.parse(JSON.stringify(ws));
    expect(getActiveTab(copy).nodes[0].kind).toBe('connector');
    expect(roundTrip.tabs[0].nodes[0].from).toEqual({ nodeId: 'a' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/model/connector-model.test.ts`
Expected: FAIL — `createConnector`, `isShape`, etc. not exported.

- [ ] **Step 4: Add guards, default style, and factory to `src/model/document.ts`**

Update the import on line 1 to include the new types:

```ts
import type { Connector, ConnectorStyle, Endpoint, Node, Shape, ShapeKind, ShapeStyle, Tab, Workspace } from './types';
```

Add after `DEFAULT_STYLE`:

```ts
export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = {
  stroke: '#1e1e1e',
  strokeWidth: 2,
  arrowEnd: true,
};

export const isConnector = (n: Node): n is Connector => n.kind === 'connector';
export const isShape = (n: Node): n is Shape => n.kind !== 'connector';
export const isAttached = (e: Endpoint): e is { nodeId: string } => 'nodeId' in e;

export function createConnector(from: Endpoint, to: Endpoint): Connector {
  return { id: uid('c'), kind: 'connector', from, to, style: { ...DEFAULT_CONNECTOR_STYLE } };
}
```

Widen `groupMembers`'s parameter from `Shape` to `Node`:

```ts
export function groupMembers(tab: Tab, node: Node): string[] {
  if (!node.groupId) return [node.id];
  const gid = node.groupId;
  return tab.nodes.filter((n) => n.groupId === gid).map((n) => n.id);
}
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx vitest run tests/model/connector-model.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Fix the compile breaks in `src/render/renderer.ts`**

The renderer maps nodes to shape SVG; with `Node` widened it must narrow. Add `isShape` to the document import:

```ts
import { handlePositions, selectionBounds, type Point } from '../model/geometry';
import { isShape } from '../model/document';
```

In `render`, change the content rebuild to shapes only (connectors render in Task 3):

```ts
    this.content.replaceChildren(...tab.nodes.filter(isShape).map(shapeToSvg));
```

In `drawSelection`, narrow the selected nodes to shapes:

```ts
    const shapes = tab.nodes.filter((n) => selection.has(n.id) && isShape(n));
```

- [ ] **Step 7: Fix the compile breaks in `src/tools/selectTool.ts`**

Replace every `this.app.activeTab.nodes as Shape[]` with `this.app.activeTab.nodes.filter(isShape)`. Add the import:

```ts
import { groupMembers, expandToGroups, isShape } from '../model/document';
```

The affected spots: the `hitTest(...)` argument in `onPointerDown`, the move loop in `onPointerMove`, `applyMarquee`, and `singleSelected`. Each becomes `.filter(isShape)` instead of `as Shape[]`. Behavior is unchanged because every node is currently a shape.

- [ ] **Step 8: Run the full suite and build (no behavior change)**

Run: `npm test && npm run build`
Expected: all existing tests pass (84 total: 80 prior + 4 new) and `tsc` + vite build are clean. No `as Shape[]` casts remain in `selectTool.ts` or `renderer.ts`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: widen Node to Shape|Connector with type guards (behavior-preserving)"
```

---

## Task 2: Connector geometry (pure)

**Files:**
- Create: `src/render/connector.ts`
- Test: `tests/render/connector-geometry.test.ts`

**Interfaces:**
- Consumes: `Tab`, `Connector`, `Endpoint` from `model/types`; `isShape`, `isAttached` from `model/document`; `Point`, `Box` from `model/geometry`.
- Produces:
  - `interface Segment { x1: number; y1: number; x2: number; y2: number }`
  - `endpointCenter(tab: Tab, e: Endpoint): Point | null`
  - `connectorSegment(tab: Tab, c: Connector): Segment | null`
  - `connectorHit(tab: Tab, c: Connector, point: Point, tol: number): boolean`

- [ ] **Step 1: Write the failing test `tests/render/connector-geometry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';
import { connectorSegment, connectorHit, endpointCenter } from '../../src/render/connector';

function tabWithTwoBoxes() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);   // center (50,50)
  const b = createShape('rect', 300, 0, 100, 100);  // center (350,50)
  addNode(tab, a);
  addNode(tab, b);
  return { tab, a, b };
}

describe('connector geometry', () => {
  it('clips the segment to each shape edge along the center-to-center line', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    const seg = connectorSegment(tab, c)!;
    // horizontal line at y=50; leaves A's right edge (x=100) and enters B's left edge (x=300)
    expect(seg).toEqual({ x1: 100, y1: 50, x2: 300, y2: 50 });
  });

  it('re-derives the segment after a shape moves', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    b.y = 400; // move B down (avoid a perfect 45° diagonal, which would exit on the corner)
    const seg = connectorSegment(tab, c)!;
    expect(seg.x1).not.toBe(100); // no longer a clean horizontal exit
    expect(seg.y2).toBeGreaterThan(50);
  });

  it('uses a floating endpoint as-is (for the live preview)', () => {
    const { tab, a } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { x: 500, y: 50 });
    addNode(tab, c);
    const seg = connectorSegment(tab, c)!;
    expect(seg.x1).toBe(100); // clipped to A's right edge
    expect({ x: seg.x2, y: seg.y2 }).toEqual({ x: 500, y: 50 });
  });

  it('returns null when an attached shape is missing (dangling)', () => {
    const { tab, a } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: 'gone' });
    addNode(tab, c);
    expect(connectorSegment(tab, c)).toBeNull();
  });

  it('connectorHit is true near the line and false far from it', () => {
    const { tab, a, b } = tabWithTwoBoxes();
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    addNode(tab, c);
    expect(connectorHit(tab, c, { x: 200, y: 52 }, 5)).toBe(true);
    expect(connectorHit(tab, c, { x: 200, y: 80 }, 5)).toBe(false);
  });

  it('endpointCenter returns the shape center or the floating point', () => {
    const { tab, a } = tabWithTwoBoxes();
    expect(endpointCenter(tab, { nodeId: a.id })).toEqual({ x: 50, y: 50 });
    expect(endpointCenter(tab, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
    expect(endpointCenter(tab, { nodeId: 'gone' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/connector-geometry.test.ts`
Expected: FAIL — cannot import from `../../src/render/connector`.

- [ ] **Step 3: Create `src/render/connector.ts`**

```ts
import type { Connector, Endpoint, Shape, Tab } from '../model/types';
import { isAttached, isShape } from '../model/document';
import type { Box, Point } from '../model/geometry';

export interface Segment { x1: number; y1: number; x2: number; y2: number; }

function attachedShape(tab: Tab, e: Endpoint): Shape | null {
  if (!isAttached(e)) return null;
  const n = tab.nodes.find((node) => node.id === e.nodeId);
  return n && isShape(n) ? n : null;
}

export function endpointCenter(tab: Tab, e: Endpoint): Point | null {
  if (isAttached(e)) {
    const s = attachedShape(tab, e);
    if (!s) return null;
    return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  }
  return { x: e.x, y: e.y };
}

/** Point where the ray from the box center toward `toward` crosses the box boundary. */
function clipBoxEdge(box: Box, toward: Point): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx !== 0 ? box.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? box.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

function boxOf(s: Shape): Box {
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

export function connectorSegment(tab: Tab, c: Connector): Segment | null {
  const a = endpointCenter(tab, c.from);
  const b = endpointCenter(tab, c.to);
  if (!a || !b) return null;
  const sa = attachedShape(tab, c.from);
  const sb = attachedShape(tab, c.to);
  const p1 = sa ? clipBoxEdge(boxOf(sa), b) : a;
  const p2 = sb ? clipBoxEdge(boxOf(sb), a) : b;
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function distToSegment(p: Point, s: Segment): number {
  const vx = s.x2 - s.x1;
  const vy = s.y2 - s.y1;
  const wx = p.x - s.x1;
  const wy = p.y - s.y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const px = s.x1 + t * vx;
  const py = s.y1 + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}

export function connectorHit(tab: Tab, c: Connector, point: Point, tol: number): boolean {
  const seg = connectorSegment(tab, c);
  return seg ? distToSegment(point, seg) <= tol : false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/render/connector-geometry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: connector geometry (edge clipping, segment, hit-test)"
```

---

## Task 3: Connector rendering

**Files:**
- Modify: `src/render/connector.ts` (add svg factory), `src/render/renderer.ts`
- Test: `tests/render/connector-render.test.ts`

**Interfaces:**
- Consumes: `connectorSegment`; `Connector`, `Tab`; `isShape`, `isConnector`.
- Produces:
  - `connectorToSvg(tab: Tab, c: Connector, selected: boolean): SVGGElement | null`
  - Renderer renders connectors (back) then shapes (front); a shared `<marker id="arrowhead">` lives in the SVG `<defs>`.

- [ ] **Step 1: Write the failing test `tests/render/connector-render.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

function connectedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  addNode(tab, a);
  addNode(tab, b);
  addNode(tab, c);
  return { tab, a, b, c };
}

describe('connector rendering', () => {
  it('renders a connector as a <g data-id> containing a <line>', () => {
    const r = new Renderer(mount);
    const { tab, c } = connectedTab();
    r.render(tab, new Set());
    const g = r.svg.querySelector(`g[data-id="${c.id}"]`);
    expect(g).toBeTruthy();
    expect(g!.querySelector('line')).toBeTruthy();
  });

  it('defines a reusable arrowhead marker once', () => {
    const r = new Renderer(mount);
    expect(r.svg.querySelectorAll('marker#arrowhead')).toHaveLength(1);
  });

  it('draws connectors behind shapes (connector g precedes shape g in the content)', () => {
    const r = new Renderer(mount);
    const { tab, a, c } = connectedTab();
    r.render(tab, new Set());
    const ids = [...r.svg.querySelectorAll('g[data-id]')].map((g) => g.getAttribute('data-id'));
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it('highlights a selected connector', () => {
    const r = new Renderer(mount);
    const { tab, c } = connectedTab();
    r.render(tab, new Set([c.id]));
    const line = r.svg.querySelector(`g[data-id="${c.id}"] line`)!;
    expect(line.getAttribute('stroke')).toBe('#3b82f6');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/connector-render.test.ts`
Expected: FAIL — connectors are not rendered / no marker.

- [ ] **Step 3: Add `connectorToSvg` to `src/render/connector.ts`**

```ts
const NS = 'http://www.w3.org/2000/svg';

export function connectorToSvg(tab: Tab, c: Connector, selected: boolean): SVGGElement | null {
  const seg = connectorSegment(tab, c);
  if (!seg) return null;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', c.id);
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', String(seg.x1));
  line.setAttribute('y1', String(seg.y1));
  line.setAttribute('x2', String(seg.x2));
  line.setAttribute('y2', String(seg.y2));
  line.setAttribute('stroke', selected ? '#3b82f6' : c.style.stroke);
  line.setAttribute('stroke-width', String(c.style.strokeWidth));
  if (c.style.arrowEnd) line.setAttribute('marker-end', 'url(#arrowhead)');
  g.appendChild(line);
  return g;
}
```

Add the `import` for the SVG factory at the top of `connector.ts` is not needed (uses `document`). Ensure `Connector`/`Tab` are already imported (they are).

- [ ] **Step 4: Update `src/render/renderer.ts` to render connectors + the marker**

Add imports:

```ts
import { isShape, isConnector } from '../model/document';
import { connectorToSvg } from './connector';
```

In the constructor, after creating `this.svg` and before appending groups, add the arrowhead marker:

```ts
    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(NS, 'path');
    arrow.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    arrow.setAttribute('fill', '#1e1e1e');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    this.svg.appendChild(defs);
```

Replace the content rebuild line (from Task 1, `...tab.nodes.filter(isShape).map(shapeToSvg)`) with a connectors-back / shapes-front rebuild:

```ts
    const connectors = tab.nodes
      .filter(isConnector)
      .map((c) => connectorToSvg(tab, c, selection.has(c.id)))
      .filter((g): g is SVGGElement => g !== null);
    const shapes = tab.nodes.filter(isShape).map(shapeToSvg);
    this.content.replaceChildren(...connectors, ...shapes);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/render/connector-render.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: render connectors (back layer, arrowhead, selected highlight)"
```

---

## Task 4: The Arrow tool

**Files:**
- Create: `src/tools/connectorTool.ts`
- Modify: `src/tools/types.ts`, `src/ui/toolbar.ts`, `src/app.ts`, `src/render/renderer.ts`, `src/main.ts`
- Test: `tests/tools/connectorTool.test.ts`

**Interfaces:**
- Consumes: `App`; `hitTest`, `Point`; `createConnector`, `addNode`, `removeNodes`, `isShape`; `Tool`.
- Produces:
  - `class ConnectorTool implements Tool` with `constructor(app: App)`.
  - `ToolName` includes `'arrow'`.
  - `App.highlightId?: string`; `App.render()` passes it to `renderer.render(tab, selection, highlightId)`.
  - `Renderer.render(tab, selection, highlightId?)` outlines the highlighted node.

- [ ] **Step 1: Add `'arrow'` to `ToolName` in `src/tools/types.ts`**

```ts
export type ToolName = 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'arrow';
```

- [ ] **Step 2: Write the failing test `tests/tools/connectorTool.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ConnectorTool } from '../../src/tools/connectorTool';
import { addNode, createShape, isConnector } from '../../src/model/document';
import type { Point } from '../../src/model/geometry';

let app: App;
let tool: ConnectorTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new ConnectorTool(app);
  app.registerTool('arrow', tool);
  app.setTool('arrow');
});
afterEach(() => app.destroy());

function twoShapes() {
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  addNode(app.activeTab, a);
  addNode(app.activeTab, b);
  return { a, b };
}
const at = (p: Point) => p;

describe('ConnectorTool', () => {
  it('drag from shape A to shape B creates a connector between them', () => {
    const { a, b } = twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));   // inside A
    tool.onPointerMove(at({ x: 200, y: 50 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));    // inside B
    const conns = app.activeTab.nodes.filter(isConnector);
    expect(conns).toHaveLength(1);
    expect(conns[0].from).toEqual({ nodeId: a.id });
    expect(conns[0].to).toEqual({ nodeId: b.id });
    expect(app.selection.has(conns[0].id)).toBe(true);
  });

  it('stays on the arrow tool for continuous drawing', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));
    expect(app.currentToolName).toBe('arrow');
  });

  it('release on empty space cancels (no connector, no leftover node)', () => {
    const before = app.activeTab.nodes.length;
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerMove(at({ x: 600, y: 400 }));
    tool.onPointerUp(at({ x: 600, y: 400 }));    // empty
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
    expect(app.activeTab.nodes.length).toBe(before + 2); // just the two shapes
  });

  it('release on the same shape cancels', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerUp(at({ x: 60, y: 60 }));      // still inside A
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
  });

  it('pressing on empty space starts nothing', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 600, y: 400 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/tools/connectorTool.test.ts`
Expected: FAIL — cannot import `ConnectorTool`.

- [ ] **Step 4: Create `src/tools/connectorTool.ts`**

```ts
import type { App } from '../app';
import type { Connector } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import type { Tool } from './types';

/** Draw arrows by dragging from a source shape to a target shape. Stays active for
 *  continuous drawing; Esc returns to the select tool. */
export class ConnectorTool implements Tool {
  private sourceId: string | null = null;
  private preview: Connector | null = null;

  constructor(private app: App) {}

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  onPointerDown(world: Point): void {
    const s = this.shapeAt(world);
    if (!s) return;
    this.sourceId = s.id;
    const c = createConnector({ nodeId: s.id }, { x: world.x, y: world.y });
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t && t.id !== this.sourceId ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (this.preview && this.sourceId) {
      const t = this.shapeAt(world);
      if (t && t.id !== this.sourceId) {
        this.preview.to = { nodeId: t.id };
        this.app.selection = new Set([this.preview.id]);
        this.app.highlightId = undefined;
        this.app.commit();
      } else {
        removeNodes(this.app.activeTab, new Set([this.preview.id]));
        this.app.highlightId = undefined;
        this.app.render();
      }
    }
    this.sourceId = null;
    this.preview = null;
  }
}
```

- [ ] **Step 5: Add `highlightId` to `src/app.ts` and pass it through render**

Add a public field near `selection`:

```ts
  highlightId?: string;
```

Update `render()`:

```ts
  render(): void {
    this.renderer.render(this.activeTab, this.selection, this.highlightId);
  }
```

- [ ] **Step 6: Add the highlight param to `Renderer.render` in `src/render/renderer.ts`**

Change the signature and draw a highlight outline in the overlay:

```ts
  render(tab: Tab, selection: Set<string>, highlightId?: string): void {
```

After `this.drawSelection(tab, selection);` add:

```ts
    if (highlightId) this.drawHighlight(tab, highlightId);
```

Add the method (uses the existing `isShape` import and `NS`):

```ts
  private drawHighlight(tab: Tab, id: string): void {
    const node = tab.nodes.find((n) => n.id === id);
    if (!node || !isShape(node)) return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(node.x));
    r.setAttribute('y', String(node.y));
    r.setAttribute('width', String(node.w));
    r.setAttribute('height', String(node.h));
    r.setAttribute('fill', 'none');
    r.setAttribute('stroke', '#22c55e');
    r.setAttribute('stroke-width', '2');
    r.setAttribute('pointer-events', 'none');
    this.overlay.appendChild(r);
  }
```

- [ ] **Step 7: Add the Arrow button to `src/ui/toolbar.ts`**

Add to the `TOOLS` array (after `text`):

```ts
  { name: 'arrow', label: 'Arrow' },
```

- [ ] **Step 8: Register the ConnectorTool in `src/main.ts`**

```ts
import { ConnectorTool } from './tools/connectorTool';

app.registerTool('arrow', new ConnectorTool(app));
```

- [ ] **Step 9: Run the focused test, full suite, and build**

Run: `npx vitest run tests/tools/connectorTool.test.ts && npm test && npm run build`
Expected: connector tool tests pass (5), full suite green, build clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Arrow tool — drag source to target to create a connector"
```

---

## Task 5: Node-aware selection (click + marquee)

**Files:**
- Modify: `src/tools/selectTool.ts`
- Test: `tests/tools/selectTool.connector.test.ts`

**Interfaces:**
- Consumes: `connectorHit`; `isShape`, `isConnector`; existing `SelectTool`.
- Produces: clicking a connector's line selects it; shapes win over connectors when overlapping; a marquee includes a connector only when **both** its endpoints' shapes are within the marquee.

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.connector.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape, createConnector } from '../../src/model/document';
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
afterEach(() => app.destroy());

function connected() {
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}
function click(p: Point, shift = false) {
  tool.onPointerDown(p, { shiftKey: shift } as PointerEvent);
  tool.onPointerUp(p, { shiftKey: shift } as PointerEvent);
}

describe('SelectTool with connectors', () => {
  it('clicking a connector line selects the connector', () => {
    const { c } = connected();
    click({ x: 200, y: 50 }); // on the line between the two boxes
    expect(app.selection).toEqual(new Set([c.id]));
  });

  it('a shape wins over a connector when they overlap', () => {
    const { a } = connected();
    click({ x: 50, y: 50 }); // inside shape A (line also passes near here)
    expect(app.selection.has(a.id)).toBe(true);
  });

  it('marquee includes a connector only when both endpoint shapes are selected', () => {
    const { a, b, c } = connected();
    // marquee around BOTH boxes
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 410, y: 110 }, {} as PointerEvent);
    tool.onPointerUp({ x: 410, y: 110 }, {} as PointerEvent);
    expect(app.selection).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('marquee around only one endpoint does NOT include the connector', () => {
    const { a, c } = connected();
    tool.onPointerDown({ x: -10, y: -10 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 110, y: 110 }, {} as PointerEvent); // covers only A
    tool.onPointerUp({ x: 110, y: 110 }, {} as PointerEvent);
    expect(app.selection.has(a.id)).toBe(true);
    expect(app.selection.has(c.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.connector.test.ts`
Expected: FAIL — clicking a line selects nothing; marquee ignores connectors.

- [ ] **Step 3: Add node-aware hit-testing and marquee rule to `src/tools/selectTool.ts`**

Add imports (and `Node` to the existing `model/types` import, since a hit can now be a connector):

```ts
import type { Node, Shape } from '../model/types';
import { groupMembers, expandToGroups, isShape, isConnector } from '../model/document';
import { connectorHit } from '../render/connector';
```

Replace the `hitTest(this.app.activeTab.nodes.filter(isShape), world)` call in `onPointerDown` with `this.hitNode(world)`:

```ts
    const hit = this.hitNode(world);
```

Widen `toggleGroup` to accept any node (a connector can now be the hit) — its body is unchanged because `groupMembers` already takes a `Node`:

```ts
  private toggleGroup(hit: Node): void {
```

Add the `hitNode` helper (shapes first to match front-layer rendering, then connectors):

```ts
  private hitNode(world: Point) {
    const shape = hitTest(this.app.activeTab.nodes.filter(isShape), world);
    if (shape) return shape;
    const tol = 8 / this.app.activeTab.viewport.zoom;
    const connectors = this.app.activeTab.nodes.filter(isConnector);
    for (let i = connectors.length - 1; i >= 0; i--) {
      if (connectorHit(this.app.activeTab, connectors[i], world, tol)) return connectors[i];
    }
    return undefined;
  }
```

In `applyMarquee`, after selecting shapes by bbox, fold in connectors whose **both** attached endpoints are selected:

```ts
  private applyMarquee(world: Point): void {
    const box = this.marqueeBox(world);
    const shapeIds = new Set(
      this.app.activeTab.nodes.filter(isShape).filter((s) => shapeInRect(s, box)).map((s) => s.id),
    );
    const sel = expandToGroups(this.app.activeTab, shapeIds);
    for (const n of this.app.activeTab.nodes) {
      if (isConnector(n)) {
        const fromIn = 'nodeId' in n.from ? sel.has(n.from.nodeId) : false;
        const toIn = 'nodeId' in n.to ? sel.has(n.to.nodeId) : false;
        if (fromIn && toIn) sel.add(n.id);
      }
    }
    this.app.selection = sel;
  }
```

(The move loop already filters `isShape`, so a selected connector is correctly skipped while its shapes move and it re-derives.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.connector.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass (including the prior selectTool/group tests), build clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: select connectors by clicking; marquee includes fully-enclosed connectors"
```

---

## Task 6: Delete-cascade and on-load prune

**Files:**
- Modify: `src/model/document.ts`, `src/app.ts`
- Test: `tests/model/connector-cascade.test.ts`

**Interfaces:**
- Consumes: `isConnector`, `isAttached`, `isShape`.
- Produces:
  - `removeNodes(tab, ids)` also drops connectors whose attached endpoint references a removed node.
  - `pruneDanglingConnectors(tab: Tab): void`
  - `App` prunes every loaded tab in its constructor.

- [ ] **Step 1: Write the failing test `tests/model/connector-cascade.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createTab, addNode, createShape, createConnector, removeNodes,
  pruneDanglingConnectors, isConnector,
} from '../../src/model/document';

function connectedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  return { tab, a, b, c };
}

describe('connector delete-cascade and prune', () => {
  it('removeNodes drops connectors attached to a removed shape', () => {
    const { tab, a, c } = connectedTab();
    removeNodes(tab, new Set([a.id]));
    expect(tab.nodes.find((n) => n.id === c.id)).toBeUndefined();
    expect(tab.nodes.filter(isConnector)).toHaveLength(0);
  });

  it('removeNodes keeps connectors whose shapes both survive', () => {
    const { tab, c } = connectedTab();
    const lone = createShape('rect', 600, 0, 50, 50);
    addNode(tab, lone);
    removeNodes(tab, new Set([lone.id]));
    expect(tab.nodes.find((n) => n.id === c.id)).toBeDefined();
  });

  it('pruneDanglingConnectors removes connectors with a missing endpoint', () => {
    const { tab, a, c } = connectedTab();
    // simulate a hand-edited/corrupt file: shape A removed directly (no cascade),
    // leaving the connector pointing at a node that no longer exists.
    tab.nodes = tab.nodes.filter((n) => n.id !== a.id);
    pruneDanglingConnectors(tab);
    expect(tab.nodes.find((n) => n.id === c.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/connector-cascade.test.ts`
Expected: FAIL — `removeNodes` doesn't cascade; `pruneDanglingConnectors` not exported.

- [ ] **Step 3: Update `removeNodes` and add `pruneDanglingConnectors` in `src/model/document.ts`**

Replace `removeNodes`:

```ts
export function removeNodes(tab: Tab, ids: Set<string>): void {
  const kept = tab.nodes.filter((n) => !ids.has(n.id));
  tab.nodes = kept.filter((n) => {
    if (!isConnector(n)) return true;
    const fromGone = isAttached(n.from) && ids.has(n.from.nodeId);
    const toGone = isAttached(n.to) && ids.has(n.to.nodeId);
    return !fromGone && !toGone;
  });
}
```

Add:

```ts
export function pruneDanglingConnectors(tab: Tab): void {
  const shapeIds = new Set(tab.nodes.filter(isShape).map((s) => s.id));
  tab.nodes = tab.nodes.filter((n) => {
    if (!isConnector(n)) return true;
    // v1 never persists a user-created floating endpoint; a connector with a
    // non-attached or missing endpoint is a leaked live preview — drop it.
    const fromOk = isAttached(n.from) && shapeIds.has(n.from.nodeId);
    const toOk = isAttached(n.to) && shapeIds.has(n.to.nodeId);
    return fromOk && toOk;
  });
}
```

- [ ] **Step 4: Prune loaded tabs in `src/app.ts`**

Add the import:

```ts
import { createWorkspace, getActiveTab, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors } from './model/document';
```

In the constructor, after `this.workspace = initial ?? createWorkspace();` add:

```ts
    this.workspace.tabs.forEach(pruneDanglingConnectors);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/model/connector-cascade.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: delete-cascade and on-load prune for connectors"
```

---

## Phase 2a Done — Definition of Done
- Pick the **Arrow** tool, drag from one shape to another → a connector is created, attached to both shapes' edges, with an arrowhead at the target.
- Moving either shape re-routes the connector automatically.
- Click a connector's line to select it; **Delete** removes it.
- Deleting a shape removes its connectors; a workspace loaded with a dangling connector is cleaned up.
- The Arrow tool stays active for continuous drawing; **Esc** returns to Select.
- Connectors autosave and undo/redo with the rest of the workspace.
- `Node = Shape | Connector` with type guards; no `as Shape[]` casts remain.
- `npm test` green; `npm run build` clean.

## What this phase deliberately omits (future)
Connector restyle + arrowhead toggle (needs a properties panel); drag an endpoint to re-attach; floating/dangling endpoints created by the user; elbow/orthogonal routing; per-kind precise edge clipping (ellipse/diamond); direct marquee-selection of a connector by crossing its line.

---

## Self-Review Notes (against the spec)
- **Spec coverage:** data model + guards §2 → Task 1; geometry §3 → Task 2; rendering §4 → Task 3; Arrow tool §5 → Task 4; select/delete §6 + refactor §7 → Tasks 1, 5; delete-cascade + prune §6/§9 → Task 6; testing §10 → each task's tests. Persistence/undo are inherited (connectors are nodes) and checked by the round-trip test in Task 1.
- **Placeholders:** none — every code/test step is complete.
- **Type consistency:** `Node`/`Connector`/`Endpoint`/`ConnectorStyle`, `isShape`/`isConnector`/`isAttached`, `createConnector`, `connectorSegment`/`connectorHit`/`connectorToSvg`/`endpointCenter`, `Segment`, `hitNode`, `pruneDanglingConnectors`, and `App.highlightId` / `Renderer.render(tab, selection, highlightId?)` are used identically across tasks. `groupMembers` is widened to `Node` in Task 1 before Task 5 relies on it.
