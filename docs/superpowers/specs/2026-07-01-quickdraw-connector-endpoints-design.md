# QuickDraw — Editable Connector Endpoints Design Spec

**Date:** 2026-07-01
**Status:** Approved design, pre-implementation
**Topic:** PowerPoint-style arrows — draw an arrow anywhere, then select it and drag
either end onto a shape to attach it (or off, to float). Free endpoints become
first-class.
**Builds on:** the `feat/phase1-core-canvas` branch (connectors currently must be
drawn shape-to-shape and can't be edited afterward).

---

## 1. Overview

Today an arrow is created by dragging from one shape to another, both ends must be
attached, and it can't be changed afterward (`pruneDanglingConnectors` even deletes
any connector with a free end). This change makes arrows behave like PowerPoint:

- **Draw an arrow anywhere** (Arrow tool): drag from a point to a point; each end
  attaches to a shape if it lands on one, otherwise it floats as a free point.
- **Edit endpoints** (Select tool): select an arrow and drag either end — onto a
  shape to attach it, onto empty canvas to detach it. The arrow re-routes live and
  keeps following an attached shape when the shape moves.

### Goals
- A `Connector` endpoint may be attached (`{ nodeId }`) or free (`{ x, y }`); both
  persist and round-trip through save/load.
- Create arrows with the Arrow tool by dragging (no requirement to start on a shape).
- Re-attach / detach either end from the Select tool via endpoint handles.

### Non-goals (deferred — YAGNI)
- Named connection points on a shape (top / bottom / left / right dots) — an
  attached end still uses the dynamic boundary point (`connectorSegment`).
- Elbow / orthogonal routing (arrows are straight lines).
- Editing endpoints of a multi-node selection (only when exactly one connector is
  selected).
- Reticulating: moving the arrow's *middle* (arrows are repositioned via their ends).

### Reverts
This removes the previous "grab the body to move / edge to connect" behavior in the
Arrow tool (the `DragMove` wiring in `ConnectorTool`). Shapes are moved in the Select
tool or the drawing tools (both already support drag-to-move). `DragMove` itself
stays — the drawing tools still use it.

---

## 2. Model: free endpoints are first-class (`src/model/document.ts`)

`Endpoint = { nodeId: string } | { x: number; y: number }` and `isAttached` already
exist. Two behaviors change/confirm:

**`pruneDanglingConnectors` — relax it.** Today it drops any connector with a
non-attached endpoint. New rule: an endpoint is valid if it is free **or** attached
to an existing shape; a connector is kept iff both endpoints are valid. Only a
connector whose *attached* end references a missing (deleted) shape is dropped.

```ts
export function pruneDanglingConnectors(tab: Tab): void {
  const shapeIds = new Set(tab.nodes.filter(isShape).map((s) => s.id));
  const endpointOk = (e: Endpoint) => !isAttached(e) || shapeIds.has(e.nodeId);
  tab.nodes = tab.nodes.filter(
    (n) => !isConnector(n) || (endpointOk(n.from) && endpointOk(n.to)),
  );
}
```

**`removeNodes` — unchanged.** It already frees nothing and removes a connector when
an *attached* endpoint's `nodeId` is deleted (free endpoints are ignored by the
`isAttached` guard). Deleting a shape still removes the connectors attached to it.

Save/open already serialize whatever `from`/`to` hold, so free-ended arrows
round-trip; deserialize's node validation only requires `from`/`to` to be objects.

---

## 3. Arrow tool: draw an arrow anywhere (`src/tools/connectorTool.ts`)

Rewrite so a press-drag creates one arrow between the two points, attaching each end
to a shape when it lands on one. This replaces the current shape-to-shape-only
creation and removes the `DragMove`/edge-band code.

```ts
const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click, no arrow

private endpointAt(world: Point): Endpoint {
  const s = hitTest(this.app.activeTab.nodes.filter(isShape), world);
  return s ? { nodeId: s.id } : { x: world.x, y: world.y };
}
```

- **onPointerDown(world):** record `start = world`; `from = endpointAt(world)`; create
  a preview `createConnector(from, { x: world.x, y: world.y })`; `addNode`; clear
  selection; render.
- **onPointerMove(world):** `preview.to = { x: world.x, y: world.y }`; highlight the
  shape under the cursor (`app.highlightId = shapeAt(world)?.id`); render.
- **onPointerUp(world):** if the move was below `DRAG_THRESHOLD` in both axes (a
  click) → remove the preview (no arrow). Otherwise `preview.to = endpointAt(world)`,
  select the new arrow, clear the highlight, and `commit()`. Reset state.
- **onDeactivate / pointercancel:** if a preview exists, remove it; clear highlight;
  render (unchanged from today).

Result: drag empty→empty = a floating arrow; empty→shape / shape→empty = one end
attached; shape→shape = both attached (the old behavior, now a special case).

---

## 4. Endpoint editing in the Select tool (`src/tools/selectTool.ts`)

Add an `'endpoint'` mode alongside the existing `idle | marquee | move | resize`.
When exactly one **connector** is selected, pressing near one of its endpoint handles
drags that end.

New helpers/state:
```ts
private endpointConn: Connector | null = null;
private endpointEnd: 'from' | 'to' | null = null;

private singleSelectedConnector(): Connector | null {
  if (this.app.selection.size !== 1) return null;
  const id = [...this.app.selection][0];
  const n = this.app.activeTab.nodes.find((x) => x.id === id);
  return n && isConnector(n) ? n : null;
}
```

**onPointerDown** — check endpoints FIRST (before resize handles / hitNode):
```ts
const conn = this.singleSelectedConnector();
if (conn) {
  const seg = connectorSegment(this.app.activeTab, conn);
  if (seg) {
    const tol = 10 / this.app.activeTab.viewport.zoom; // screen-constant grab radius
    const near = (x: number, y: number) =>
      Math.abs(world.x - x) <= tol && Math.abs(world.y - y) <= tol;
    if (near(seg.x1, seg.y1)) { this.beginEndpoint(conn, 'from'); return; }
    if (near(seg.x2, seg.y2)) { this.beginEndpoint(conn, 'to'); return; }
  }
}
// …then the existing resize-handle check, hitNode, marquee…
```
`beginEndpoint(conn, end)` sets `this.mode = 'endpoint'`, `this.endpointConn = conn`,
`this.endpointEnd = end`.

**onPointerMove** (endpoint mode): set the dragged end to a free point following the
cursor and preview the attach target:
```ts
if (this.mode === 'endpoint' && this.endpointConn && this.endpointEnd) {
  this.endpointConn[this.endpointEnd] = { x: world.x, y: world.y };
  const t = hitTest(this.app.activeTab.nodes.filter(isShape), world);
  this.app.highlightId = t ? t.id : undefined;
  this.app.render();
  return;
}
```

**onPointerUp** (endpoint mode): attach if released on a shape, else leave it free;
commit once:
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

Notes:
- Dragging the connector's **line** (not an endpoint) does nothing new — `move` mode
  only translates selected shapes, so a lone selected connector isn't dragged by its
  body. Arrows move only via their endpoints (or by moving the shapes they attach to).
- Imports to add: `connectorSegment` from `../render/connector`; `Connector` type;
  (`isConnector`, `hitTest` are already imported).

---

## 5. Rendering the endpoint handles (`src/render/renderer.ts`)

Today `drawSelection` draws a dashed box + square resize handles for selected
**shapes** and nothing for a connector. Add: when exactly one connector is selected,
draw a small **circle** handle at each resolved endpoint.

In `render()`, after `drawSelection(tab, selection)`:
```ts
if (selection.size === 1) {
  const n = tab.nodes.find((x) => x.id === [...selection][0]);
  if (n && isConnector(n)) this.drawConnectorHandles(tab, n);
}
```
```ts
private drawConnectorHandles(tab: Tab, c: Connector): void {
  const seg = connectorSegment(tab, c);
  if (!seg) return;
  for (const [end, x, y] of [['from', seg.x1, seg.y1], ['to', seg.x2, seg.y2]] as const) {
    const h = document.createElementNS(NS, 'circle');
    h.setAttribute('cx', String(x));
    h.setAttribute('cy', String(y));
    h.setAttribute('r', '5');
    h.setAttribute('fill', '#fff');
    h.setAttribute('stroke', '#3b82f6');
    h.setAttribute('stroke-width', '1.5');
    h.setAttribute('data-endpoint', end); // 'from' | 'to'
    this.overlay.appendChild(h);
  }
}
```
Imports to add: `connectorSegment` from `./connector`; `Connector` type. Circles are
distinct from the square resize handles so the two selection modes read differently.
Handles live in the (zoom-scaled) overlay, matching the existing resize-handle sizing.

---

## 6. Module layout

| File | Change |
|------|--------|
| `src/model/document.ts` | relax `pruneDanglingConnectors` to keep free endpoints. |
| `src/tools/connectorTool.ts` | rewrite: draw an arrow anywhere, attach ends that land on shapes; remove the `DragMove`/edge-band code. |
| `src/tools/selectTool.ts` | add `'endpoint'` mode: press an endpoint handle of a selected connector to drag/attach/detach it. |
| `src/render/renderer.ts` | draw circle endpoint handles when a single connector is selected. |
| `src/render/connector.ts` | no change — reuse `connectorSegment` (already exported). |

---

## 7. Error handling & edge cases
- **Click (no drag) in the Arrow tool:** no arrow is created (the preview is removed).
- **Free-ended arrow:** a connector with both ends free is valid and selectable; its
  endpoints are editable.
- **Detach:** dragging an attached end onto empty canvas leaves it as a free point.
- **Deleting a shape** removes the connectors attached to it (unchanged); a connector
  with only a *free* end pointing near that shape is untouched.
- **Load robustness:** `pruneDanglingConnectors` (run on construct and on open) keeps
  free-ended arrows and drops only connectors whose attached end references a missing
  shape.
- **Endpoint grab vs. select:** the endpoint-handle check runs only when the connector
  is already the sole selection, so it never steals a plain click that's trying to
  select something else.

---

## 8. Testing (Vitest, jsdom)

**Model (`tests/model/connector-cascade.test.ts` / a prune test):**
- `pruneDanglingConnectors` keeps a connector with a free `{x,y}` endpoint; keeps one
  attached to an existing shape; drops one whose attached end references a missing id.

**Arrow tool (`tests/tools/connectorTool.test.ts` — rewrite):**
- Drag empty→empty makes a connector with two free endpoints at the drag corners.
- Drag empty→shape attaches the `to` end (`{nodeId}`), leaves `from` free.
- Drag shape→shape attaches both ends (the old case).
- A click (no drag) creates nothing.
- Tool stays on `arrow`; switching mid-drag / pointercancel removes the preview.
- (The previous edge-band "move a shape in the arrow tool" tests are removed.)

**Select tool (`tests/tools/selectTool.endpoint.test.ts`, new):**
- With a connector selected, pressing near an endpoint and dragging onto a shape sets
  that end to `{nodeId}` (attach) and records one history entry.
- Dragging an attached end onto empty canvas sets it to `{x,y}` (detach).
- Dragging highlights the shape under the cursor and clears the highlight on release.
- A press away from both endpoints does not enter endpoint mode (normal select/move).

**Renderer (`tests/render/renderer.test.ts`):**
- Selecting a single connector renders two `circle[data-endpoint]` handles at the
  segment ends; selecting a shape still renders square resize handles (no endpoint
  circles).

**Live (Playwright):** draw an arrow between two boxes; select it; drag one end onto a
third box (re-attaches); drag the other end to empty (detaches/floats); move a box and
the attached end follows.

---

## 9. Decisions (resolved)
- Arrow tool **draws an arrow anywhere**; ends attach to shapes they land on, else float.
- Free endpoints are **first-class** (persisted; `pruneDanglingConnectors` relaxed).
- Endpoint editing lives in the **Select tool** (select a connector → drag its handles).
- Releasing an end on empty canvas leaves it **free** (no snap-back).
- The Arrow tool's move-a-shape behavior is **removed** (use Select / drawing tools).
- Attached ends use the existing **dynamic boundary** point — no named connection points.

## 10. Future (not now)
Named connection points (edge/corner dots); elbow routing; drag the arrow's midpoint;
multi-select endpoint edits; arrowless line style toggle already exists via the
properties panel.
