# Editable Connector Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make arrows PowerPoint-style — draw one anywhere by dragging, then select it and drag either end onto a shape to attach (or onto empty canvas to detach).

**Architecture:** Endpoints are already `{ nodeId } | { x, y }`. Relax the pruning that deleted free ends; rewrite the Arrow tool to draw an arrow between any two points (attaching ends that land on shapes); add an endpoint-drag mode to the Select tool; and draw endpoint circle handles for a selected connector, placed from the existing `connectorSegment` geometry.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom); SVG rendering. No new runtime dependencies.

## Global Constraints

- Strict TypeScript. Source under `src/`; tests mirror under `tests/`. No new runtime dependencies.
- A `Connector` endpoint may be attached (`{ nodeId }`) or **free** (`{ x, y }`); both are valid and persist. `pruneDanglingConnectors` keeps a connector iff each endpoint is free OR attached to an existing shape; it drops only a connector whose *attached* end references a missing shape.
- **Arrow tool** draws an arrow by dragging between two points; each end attaches to a shape it lands on, else stays free. A click (drag below `DRAG_THRESHOLD = 4` world units in both axes) creates nothing. It stays active for continuous drawing; Esc returns to Select. (This removes the previous "grab body = move / edge = connect" behavior.)
- **Endpoint editing** is in the **Select tool**: with exactly one connector selected, pressing within `10 / zoom` world units of an endpoint handle drags that end — release on a shape attaches (`{ nodeId }`), release on empty leaves it free (`{ x, y }`); commit once.
- The selection overlay draws a **circle** handle (`data-endpoint="from" | "to"`) at each endpoint when exactly one connector is selected (distinct from the square shape resize handles).
- Attached ends use the existing dynamic boundary point (`connectorSegment`) — no named connection points.
- Full suite is green before this plan and must stay green; `npm run build` clean.

---

### Task 1: Model — allow free connector endpoints

**Files:**
- Modify: `src/model/document.ts` (`pruneDanglingConnectors`)
- Test: `tests/model/prune.test.ts` (new)

**Interfaces:**
- Consumes: `Tab`, `Endpoint` types; `isShape`, `isConnector`, `isAttached` (all already in `document.ts`).
- Produces: `pruneDanglingConnectors(tab: Tab): void` keeps free endpoints; drops a connector only when an attached endpoint references a missing shape.

- [ ] **Step 1: Write the failing test `tests/model/prune.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createTab, addNode, createShape, createConnector, pruneDanglingConnectors, isConnector } from '../../src/model/document';

const conns = (tab: ReturnType<typeof createTab>) => tab.nodes.filter(isConnector);

describe('pruneDanglingConnectors (free endpoints allowed)', () => {
  it('keeps a connector with one free endpoint', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { x: 200, y: 200 }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('keeps a fully free-floating connector', () => {
    const tab = createTab();
    addNode(tab, createConnector({ x: 10, y: 10 }, { x: 90, y: 90 }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('keeps a connector attached to two existing shapes', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, b);
    addNode(tab, createConnector({ nodeId: a.id }, { nodeId: b.id }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(1);
  });

  it('drops a connector whose attached end references a missing shape', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { nodeId: 'ghost' }));
    pruneDanglingConnectors(tab);
    expect(conns(tab)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/prune.test.ts`
Expected: FAIL — the current `pruneDanglingConnectors` deletes the free-endpoint connectors (first two tests fail).

- [ ] **Step 3: Relax `pruneDanglingConnectors` in `src/model/document.ts`**

Replace the current function:

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

with (free endpoints are now first-class; only an attached end pointing at a missing shape is invalid):

```ts
export function pruneDanglingConnectors(tab: Tab): void {
  const shapeIds = new Set(tab.nodes.filter(isShape).map((s) => s.id));
  const endpointOk = (e: Endpoint) => !isAttached(e) || shapeIds.has(e.nodeId);
  tab.nodes = tab.nodes.filter(
    (n) => !isConnector(n) || (endpointOk(n.from) && endpointOk(n.to)),
  );
}
```

(`Endpoint` is already imported at the top of `document.ts`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/prune.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green, build clean. (Existing connector-cascade / save-open tests still pass — `removeNodes` is unchanged, and no existing test relied on free endpoints being pruned.)

- [ ] **Step 6: Commit**

```bash
git add src/model/document.ts tests/model/prune.test.ts
git commit -m "feat: allow free connector endpoints (prune only missing-shape refs)"
```

---

### Task 2: Arrow tool — draw an arrow anywhere

**Files:**
- Modify (rewrite): `src/tools/connectorTool.ts`
- Test (rewrite): `tests/tools/connectorTool.test.ts`

**Interfaces:**
- Consumes: `hitTest` from `model/geometry`; `addNode`, `createConnector`, `removeNodes`, `isShape` from `model/document`; `Endpoint`, `Connector` types; `App` (`app.activeTab`, `app.selection`, `app.render()`, `app.commit()`, `app.highlightId`).
- Produces: a `ConnectorTool` whose press-drag creates one connector between the two points, attaching each end that lands on a shape (`{ nodeId }`) else free (`{ x, y }`); a click makes nothing.

- [ ] **Step 1: Rewrite the test `tests/tools/connectorTool.test.ts`** (replace the whole file)

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
  const a = createShape('rect', 0, 0, 100, 100);    // (0,0)-(100,100)
  const b = createShape('rect', 300, 0, 100, 100);  // (300,0)-(400,100)
  addNode(app.activeTab, a);
  addNode(app.activeTab, b);
  return { a, b };
}
const conns = () => app.activeTab.nodes.filter(isConnector);
const drag = (from: Point, to: Point) => {
  tool.onPointerDown(from);
  tool.onPointerMove(to);
  tool.onPointerUp(to);
};

describe('ConnectorTool (draw an arrow anywhere)', () => {
  it('drag on empty canvas makes a free-floating arrow', () => {
    twoShapes();
    drag({ x: 150, y: 200 }, { x: 260, y: 260 });
    expect(conns()).toHaveLength(1);
    expect(conns()[0].from).toEqual({ x: 150, y: 200 });
    expect(conns()[0].to).toEqual({ x: 260, y: 260 });
    expect(app.selection.has(conns()[0].id)).toBe(true);
  });

  it('an end that lands on a shape attaches to it', () => {
    const { b } = twoShapes();
    drag({ x: 150, y: 200 }, { x: 350, y: 50 }); // empty → inside B
    expect(conns()[0].from).toEqual({ x: 150, y: 200 });
    expect(conns()[0].to).toEqual({ nodeId: b.id });
  });

  it('drag from shape to shape attaches both ends', () => {
    const { a, b } = twoShapes();
    drag({ x: 50, y: 50 }, { x: 350, y: 50 }); // inside A → inside B
    expect(conns()[0].from).toEqual({ nodeId: a.id });
    expect(conns()[0].to).toEqual({ nodeId: b.id });
  });

  it('a click (no drag) creates no arrow', () => {
    twoShapes();
    tool.onPointerDown({ x: 200, y: 200 });
    tool.onPointerUp({ x: 201, y: 201 }); // moved < DRAG_THRESHOLD
    expect(conns()).toHaveLength(0);
  });

  it('stays on the arrow tool for continuous drawing', () => {
    drag({ x: 10, y: 10 }, { x: 120, y: 120 });
    expect(app.currentToolName).toBe('arrow');
  });

  it('switching tools mid-drag removes the preview', () => {
    tool.onPointerDown({ x: 10, y: 10 });
    tool.onPointerMove({ x: 120, y: 120 });
    expect(conns()).toHaveLength(1);
    app.setTool('select');
    expect(conns()).toHaveLength(0);
    expect(app.highlightId).toBeUndefined();
  });

  it('a pointercancel during a drag cleans up the preview', () => {
    tool.onPointerDown({ x: 10, y: 10 });
    tool.onPointerMove({ x: 120, y: 120 });
    expect(conns()).toHaveLength(1);
    app.renderer.svg.dispatchEvent(new Event('pointercancel'));
    expect(conns()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/connectorTool.test.ts`
Expected: FAIL — the current tool requires starting on a shape and cancels on empty, so the free-arrow / attach-on-drop cases fail.

- [ ] **Step 3: Rewrite `src/tools/connectorTool.ts`** (replace the whole file)

```ts
import type { App } from '../app';
import type { Connector, Endpoint } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import type { Tool } from './types';

const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click, no arrow

/** Draw arrows by dragging between any two points. An end that lands on a shape
 *  attaches to it (`{ nodeId }`), otherwise it floats (`{ x, y }`). Stays active for
 *  continuous drawing; Esc returns to the select tool. */
export class ConnectorTool implements Tool {
  private start: Point | null = null;
  private preview: Connector | null = null;

  constructor(private app: App) {}

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  /** A shape under `world` → attached endpoint; otherwise a free point. */
  private endpointAt(world: Point): Endpoint {
    const s = this.shapeAt(world);
    return s ? { nodeId: s.id } : { x: world.x, y: world.y };
  }

  onPointerDown(world: Point): void {
    this.start = world;
    const c = createConnector(this.endpointAt(world), { x: world.x, y: world.y });
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (!this.preview || !this.start) return;
    const dx = Math.abs(world.x - this.start.x);
    const dy = Math.abs(world.y - this.start.y);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      removeNodes(this.app.activeTab, new Set([this.preview.id])); // a click → no arrow
      this.app.highlightId = undefined;
      this.app.render();
    } else {
      this.preview.to = this.endpointAt(world);
      this.app.selection = new Set([this.preview.id]);
      this.app.highlightId = undefined;
      this.app.commit();
    }
    this.preview = null;
    this.start = null;
  }

  onDeactivate(): void {
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.start = null;
    this.app.highlightId = undefined;
    this.app.render();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/connectorTool.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green, build clean. (`src/tools/dragMove.ts` is now unused by the connector tool but is still used by the drawing tools — leave it. `tsc` will confirm no unused imports remain in `connectorTool.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/tools/connectorTool.ts tests/tools/connectorTool.test.ts
git commit -m "feat: Arrow tool draws an arrow anywhere; ends attach to shapes they land on"
```

---

### Task 3: Render endpoint handles for a selected connector

**Files:**
- Modify: `src/render/renderer.ts`
- Test: `tests/render/connector-handles.test.ts` (new)

**Interfaces:**
- Consumes: `connectorSegment(tab, c): Segment | null` (`{ x1,y1,x2,y2 }`) from `render/connector` (already exported); `isConnector`; `Connector` type.
- Produces: when `selection.size === 1` and the selected node is a connector, the overlay contains two `circle[data-endpoint]` handles (`"from"`, `"to"`) at the resolved segment endpoints.

- [ ] **Step 1: Write the failing test `tests/render/connector-handles.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

function setup() {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const renderer = new Renderer(mount);
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  addNode(tab, a);
  addNode(tab, b);
  addNode(tab, c);
  return { renderer, tab, a, c };
}

describe('Renderer connector endpoint handles', () => {
  it('draws two circle handles when a single connector is selected', () => {
    const { renderer, tab, c } = setup();
    renderer.render(tab, new Set([c.id]));
    const circles = renderer.svg.querySelectorAll('circle[data-endpoint]');
    expect(circles).toHaveLength(2);
    expect([...circles].map((h) => h.getAttribute('data-endpoint')).sort()).toEqual(['from', 'to']);
  });

  it('draws no endpoint circles for a selected shape (square handles instead)', () => {
    const { renderer, tab, a } = setup();
    renderer.render(tab, new Set([a.id]));
    expect(renderer.svg.querySelectorAll('circle[data-endpoint]')).toHaveLength(0);
    expect(renderer.svg.querySelectorAll('[data-handle]').length).toBeGreaterThan(0);
  });

  it('draws no endpoint circles when nothing is selected', () => {
    const { renderer, tab } = setup();
    renderer.render(tab, new Set());
    expect(renderer.svg.querySelectorAll('circle[data-endpoint]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/connector-handles.test.ts`
Expected: FAIL — no `circle[data-endpoint]` handles are rendered today.

- [ ] **Step 3: Add endpoint handles in `src/render/renderer.ts`**

Update the imports at the top:

```ts
import type { Shape, Tab, Viewport, Connector } from '../model/types';
import { connectorToSvg, connectorSegment } from './connector';
```

In `render(...)`, after `this.drawSelection(tab, selection);` and before the
`if (highlightId) …` line, add:

```ts
    if (selection.size === 1) {
      const n = tab.nodes.find((x) => x.id === [...selection][0]);
      if (n && isConnector(n)) this.drawConnectorHandles(tab, n);
    }
```

Add the method (next to `drawSelection`):

```ts
  private drawConnectorHandles(tab: Tab, c: Connector): void {
    const seg = connectorSegment(tab, c);
    if (!seg) return;
    const ends = [
      ['from', seg.x1, seg.y1],
      ['to', seg.x2, seg.y2],
    ] as const;
    for (const [end, x, y] of ends) {
      const h = document.createElementNS(NS, 'circle');
      h.setAttribute('cx', String(x));
      h.setAttribute('cy', String(y));
      h.setAttribute('r', '5');
      h.setAttribute('fill', '#fff');
      h.setAttribute('stroke', '#3b82f6');
      h.setAttribute('stroke-width', '1.5');
      h.setAttribute('data-endpoint', end);
      this.overlay.appendChild(h);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/render/connector-handles.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green, build clean.

- [ ] **Step 6: Commit**

```bash
git add src/render/renderer.ts tests/render/connector-handles.test.ts
git commit -m "feat: draw endpoint circle handles for a selected connector"
```

---

### Task 4: Select tool — drag endpoints to attach / detach

**Files:**
- Modify: `src/tools/selectTool.ts`
- Test: `tests/tools/selectTool.endpoint.test.ts` (new)

**Interfaces:**
- Consumes: `connectorSegment(tab, c)` from `render/connector`; `Connector` type; `hitTest`, `isConnector`, `isShape` (already available in `selectTool.ts`); `App` (`app.activeTab`, `app.selection`, `app.render()`, `app.commit()`, `app.highlightId`).
- Produces: with one connector selected, a press within `10 / zoom` of an endpoint handle drags that end; release on a shape sets it to `{ nodeId }`, release on empty sets it to `{ x, y }`; one `commit()` per edit.

- [ ] **Step 1: Write the failing test `tests/tools/selectTool.endpoint.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape, createConnector, isConnector } from '../../src/model/document';

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

const pe = () => ({ shiftKey: false } as unknown as PointerEvent);

function scene() {
  const a = createShape('rect', 0, 0, 100, 100);     // (0,0)-(100,100)
  const b = createShape('rect', 300, 0, 100, 100);   // (300,0)-(400,100)
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}
const conn = () => app.activeTab.nodes.filter(isConnector)[0];
// For A→B the resolved handles sit at A's right edge (100,50) and B's left edge (300,50).

describe('SelectTool connector endpoint editing', () => {
  it('dragging the "to" endpoint onto another shape re-attaches it', () => {
    const { a } = scene();
    const d = createShape('rect', 200, 200, 100, 100); // (200,200)-(300,300)
    addNode(app.activeTab, d);
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());   // grab the 'to' handle
    tool.onPointerMove({ x: 250, y: 250 }, pe());  // over D
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(conn().to).toEqual({ nodeId: d.id });
    expect(conn().from).toEqual({ nodeId: a.id });
  });

  it('dragging an endpoint onto empty canvas detaches it (free point)', () => {
    scene();
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());   // 'to' handle
    tool.onPointerMove({ x: 500, y: 400 }, pe());  // empty
    tool.onPointerUp({ x: 500, y: 400 }, pe());
    expect(conn().to).toEqual({ x: 500, y: 400 });
  });

  it('highlights the shape under the cursor while dragging, clears on release', () => {
    scene();
    const d = createShape('rect', 200, 200, 100, 100);
    addNode(app.activeTab, d);
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());
    tool.onPointerMove({ x: 250, y: 250 }, pe());  // over D
    expect(app.highlightId).toBe(d.id);
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(app.highlightId).toBeUndefined();
  });

  it('a press away from the endpoints does not enter endpoint mode', () => {
    const { a, b } = scene();
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 200, y: 50 }, pe());   // mid-line, not near a handle
    tool.onPointerMove({ x: 200, y: 120 }, pe());
    tool.onPointerUp({ x: 200, y: 120 }, pe());
    expect(conn().from).toEqual({ nodeId: a.id });
    expect(conn().to).toEqual({ nodeId: b.id });
  });

  it('re-attaching an endpoint is a single undo entry', () => {
    const { b } = scene();
    const d = createShape('rect', 200, 200, 100, 100);
    addNode(app.activeTab, d);
    app.commit();                                  // baseline: the drawing before the edit
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());
    tool.onPointerMove({ x: 250, y: 250 }, pe());
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(conn().to).toEqual({ nodeId: d.id });
    app.undo();
    expect(conn().to).toEqual({ nodeId: b.id });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/selectTool.endpoint.test.ts`
Expected: FAIL — endpoint editing doesn't exist; pressing the handle currently starts a `move`/`marquee`, so `to` is unchanged.

- [ ] **Step 3: Add endpoint editing to `src/tools/selectTool.ts`**

Add imports (top of file):

```ts
import { connectorSegment } from '../render/connector';
import type { Connector } from '../model/types';
```

Extend the `Mode` type:

```ts
type Mode = 'idle' | 'marquee' | 'move' | 'resize' | 'endpoint';
```

Add two fields next to the other private fields (e.g. after `private resizeShape: Shape | null = null;`):

```ts
  private endpointConn: Connector | null = null;
  private endpointEnd: 'from' | 'to' | null = null;
```

Add a helper method (e.g. next to `singleSelected`):

```ts
  private singleSelectedConnector(): Connector | null {
    if (this.app.selection.size !== 1) return null;
    const id = [...this.app.selection][0];
    const n = this.app.activeTab.nodes.find((x) => x.id === id);
    return n && isConnector(n) ? n : null;
  }
```

In `onPointerDown`, insert this block at the very top of the method, right after
`this.start = world;` (before the `const handle = this.handleAt(world);` line):

```ts
    const conn = this.singleSelectedConnector();
    if (conn) {
      const seg = connectorSegment(this.app.activeTab, conn);
      if (seg) {
        const tol = 10 / this.app.activeTab.viewport.zoom;
        const near = (x: number, y: number) =>
          Math.abs(world.x - x) <= tol && Math.abs(world.y - y) <= tol;
        if (near(seg.x1, seg.y1)) { this.mode = 'endpoint'; this.endpointConn = conn; this.endpointEnd = 'from'; return; }
        if (near(seg.x2, seg.y2)) { this.mode = 'endpoint'; this.endpointConn = conn; this.endpointEnd = 'to'; return; }
      }
    }
```

In `onPointerMove`, add this branch as the FIRST statement of the method:

```ts
    if (this.mode === 'endpoint' && this.endpointConn && this.endpointEnd) {
      this.endpointConn[this.endpointEnd] = { x: world.x, y: world.y };
      const t = hitTest(this.app.activeTab.nodes.filter(isShape), world);
      this.app.highlightId = t ? t.id : undefined;
      this.app.render();
      return;
    }
```

In `onPointerUp`, add this branch as the FIRST statement of the method:

```ts
    if (this.mode === 'endpoint' && this.endpointConn && this.endpointEnd) {
      const t = hitTest(this.app.activeTab.nodes.filter(isShape), world);
      this.endpointConn[this.endpointEnd] = t ? { nodeId: t.id } : { x: world.x, y: world.y };
      this.app.highlightId = undefined;
      this.app.commit();
      this.mode = 'idle';
      this.endpointConn = null;
      this.endpointEnd = null;
      return;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/selectTool.endpoint.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: green, build clean. Existing select-tool behavior (move / resize / marquee) is unchanged — the endpoint branch only triggers when exactly one connector is selected and the press is within tolerance of a handle.

- [ ] **Step 6: Commit**

```bash
git add src/tools/selectTool.ts tests/tools/selectTool.endpoint.test.ts
git commit -m "feat: drag connector endpoints in the Select tool to attach/detach"
```

---

## Done — Definition of Done
- **Draw an arrow anywhere** (Arrow tool): drag between two points; ends attach to shapes they land on, else float. A click makes nothing.
- **Edit endpoints** (Select tool): select an arrow → drag a round end-handle onto a shape to attach, onto empty to detach; the arrow re-routes and an attached end follows its shape.
- Free-ended arrows persist through save/open (prune keeps them; only missing-shape refs are dropped).
- `npm test` green; `npm run build` clean.

## Deferred (future)
Named connection points (edge/corner dots); elbow routing; drag the arrow's midpoint; multi-select endpoint edits.
