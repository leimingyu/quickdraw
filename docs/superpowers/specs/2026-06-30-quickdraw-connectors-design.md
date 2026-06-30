# QuickDraw — Connectors (Phase 2a) Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pre-implementation
**Topic:** Arrows that connect one shape to another, attaching to shape edges and
re-routing automatically when shapes move.
**Builds on:** the Phase 1 core canvas (shapes, select/move/resize, text, undo/redo,
pan/zoom, autosave) plus the grouping/drag-to-draw/type-to-edit additions already on
the `feat/phase1-core-canvas` branch.

---

## 1. Overview

Add **connectors** (arrows) so a user can link two shapes. Pick the **Arrow** tool,
press on a source shape, drag (a live preview follows the cursor), and release on a
target shape to create an arrow. The arrow attaches to the *shapes*, not fixed points —
its endpoints are computed from each shape's boundary, so the arrow **re-routes
automatically** whenever either shape moves. Arrows can be selected and deleted, and are
removed automatically when a shape they touch is deleted. Everything persists via the
existing autosave and is undoable via the existing history.

### Goals
- Create a connector by dragging from one shape to another with a dedicated Arrow tool.
- **Auto-edge attachment:** the connector references the two shapes; each endpoint is the
  point where the center-to-center line crosses that shape's boundary.
- **Straight** line, edge-clipped, with an **arrowhead at the target** end.
- Automatic re-routing when a connected shape moves.
- Select a connector (click the line) and delete it.
- Deleting a shape prunes connectors that reference it (no dangling arrows).
- Connectors serialize, autosave, and undo/redo for free.

### Non-goals (explicitly deferred — YAGNI)
- **Restyling connectors** (color/width/arrowhead-toggle) — waits for a properties panel.
  v1 uses a fixed sensible default style.
- **Per-kind precise edge clipping** — v1 clips to the bounding box for all shape kinds
  (exact for rect/rounded/text; ellipse/diamond endpoints land on the box).
- **Floating / dangling endpoints** — releasing on empty canvas cancels; an endpoint must
  land on a shape. (Endpoint type still allows `{x,y}` for the live preview and future use.)
- **Dragging an endpoint to re-attach** to a different shape.
- **Elbow / orthogonal routing** and obstacle avoidance.
- **Marquee-selecting connectors directly** (v1 includes a connector in a marquee only
  when both of its endpoints' shapes are selected).

---

## 2. Data model

The `Node` union widens from `Shape` to `Shape | Connector`. A discriminated union plus
type guards replace the Phase-1 `as Shape[]` casts.

```ts
// model/types.ts
export type Node = Shape | Connector;

export interface Connector {
  id: string;
  kind: 'connector';                 // discriminant (Shape.kind is never 'connector')
  from: Endpoint;
  to: Endpoint;
  style: ConnectorStyle;
  groupId?: string;
}

export type Endpoint =
  | { nodeId: string }               // attached to a shape (boundary point is derived)
  | { x: number; y: number };        // floating point (live preview only in v1)

export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  arrowEnd: boolean;                 // arrowhead at the `to` end (default true)
}
```

Type guards (in `model/types.ts` or `model/document.ts`):
```ts
export const isConnector = (n: Node): n is Connector => n.kind === 'connector';
export const isShape = (n: Node): n is Shape => n.kind !== 'connector';
export const isAttached = (e: Endpoint): e is { nodeId: string } => 'nodeId' in e;
```

Default connector style (in `document.ts`, alongside `DEFAULT_STYLE`):
```ts
export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = {
  stroke: '#1e1e1e', strokeWidth: 2, arrowEnd: true,
};
```

Factory:
```ts
export function createConnector(from: Endpoint, to: Endpoint): Connector {
  return { id: uid('c'), kind: 'connector', from, to, style: { ...DEFAULT_CONNECTOR_STYLE } };
}
```

Connectors live in `tab.nodes` like shapes, so autosave (JSON serialization) and undo
(snapshot clone) include them with no extra work.

---

## 3. Connector geometry (`render/connector.ts`, pure / DOM-free)

```ts
export interface Segment { x1: number; y1: number; x2: number; y2: number; }

/** Absolute point for an endpoint: the referenced shape's center, or the floating point.
 *  Returns null if an attached endpoint references a missing shape. */
export function endpointCenter(tab: Tab, e: Endpoint): Point | null;

/** The clipped, drawable segment for a connector. From each endpoint's center, draw toward
 *  the other end and clip to the endpoint shape's bounding-box edge (line–rectangle
 *  intersection). Floating endpoints are used as-is. Returns null if either attached shape
 *  is missing (dangling). */
export function connectorSegment(tab: Tab, c: Connector): Segment | null;

/** True if `point` is within `tol` (world units) of the connector's drawn segment. */
export function connectorHit(tab: Tab, c: Connector, point: Point, tol: number): boolean;
```

- **Edge clipping:** `clipToBox(box, from, toward)` returns the intersection of the segment
  `from → toward` with the box boundary; `from` is the box center. Use the existing `Box`
  type. v1 uses each shape's bounding box (`{x,y,w,h}`) for all kinds.
- **Degenerate case:** if the two shapes overlap or share a center, fall back to the shape
  centers (no clipping) so a segment is always produced when both shapes exist.
- `connectorHit` uses point-to-segment distance with a tolerance scaled by zoom
  (`8 / zoom`, matching the resize-handle tolerance convention).

---

## 4. Rendering

`render/connector.ts` also provides the SVG factory:
```ts
export function connectorToSvg(tab: Tab, c: Connector, selected: boolean): SVGGElement | null;
```
- Produces a `<g data-id="<id>">` containing a `<line>` from the clipped segment, styled
  from `c.style`. An **arrowhead** at the `to` end is drawn via a shared SVG `<marker>`
  (defined once in `<defs>`) referenced by `marker-end`, or an inline polygon if simpler.
- `selected === true` → draw the line with a highlighted stroke (e.g. the selection blue,
  thicker) instead of a box+handles. Connectors have no resize handles.
- Returns `null` for a dangling connector (renderer skips it).

`render/renderer.ts` changes:
- Split `tab.nodes` into connectors and shapes. **Render connectors first (back layer),
  then shapes (front)**, each preserving relative order, so shapes overlay their arrows.
- Dispatch by `kind`: `connectorToSvg(tab, n, selected)` vs the existing `shapeToSvg(n)`.
- Selection overlay: the dashed bounding box + handles are computed from **selected shapes
  only** (`selectionBounds(selectedShapes)`); selected connectors are shown via their
  highlighted stroke (handled in `connectorToSvg`).
- A `<defs>` with the arrowhead marker is added once to the root SVG.

**Re-routing is automatic:** every `render()` recomputes connector segments from current
shape positions, so moving a shape moves its arrows with no extra code.

---

## 5. The Arrow tool (`tools/connectorTool.ts`)

`ConnectorTool implements Tool`. Internal state: `sourceId: string | null`,
`preview: Connector | null`.

- **onPointerDown(world):** hit-test the topmost **shape** at `world` (shapes only). If
  none, do nothing. If a shape `s` is hit: set `sourceId = s.id`; create a preview
  connector `from {nodeId: s.id}` → `to {x,y} = world`; `addNode`; clear selection; render.
- **onPointerMove(world):** if drawing, update `preview.to = {x: world.x, y: world.y}`;
  set a transient **target highlight** on the shape currently under the cursor (if any and
  not the source); render. (Highlight = the candidate target rendered with a highlighted
  outline; passed to the renderer like `selection`.)
- **onPointerUp(world):** hit-test the topmost shape at `world`.
  - If a shape `t` is hit and `t.id !== sourceId`: set `preview.to = {nodeId: t.id}`, keep
    it, select it (`selection = {preview.id}`), `commit()`.
  - Otherwise (empty, or same shape): **remove** the preview node (cancel), render.
  - Reset `sourceId`/`preview`; clear the target highlight. **Stay active** (continuous).
- Exiting: **Esc** returns to the Select tool (already wired in `app.ts`); leaving mid-drag
  cancels and removes the preview.

New **Arrow** button in the toolbar (in the shape-tools row). `ToolName` gains `'arrow'`.
The tool follows the same "stay active, Esc exits" model as the shape tools.

**Target highlight plumbing:** `App` holds an optional `highlightId?: string`;
`App.render()` passes it to the renderer, which outlines that node. The Arrow tool sets/
clears it during a drag. (Small, contained addition.)

---

## 6. Selecting & deleting connectors

- **Selection hit-test** becomes node-aware. A new `hitNode(tab, point, tol)` checks nodes
  topmost-first: connectors via `connectorHit`, shapes via `pointInShape`. The Select
  tool's `onPointerDown` uses `hitNode` instead of the shape-only `hitTest`.
- Clicking a connector selects it (replace, or shift-toggle like shapes). A selected
  connector renders highlighted (no handles).
- **Delete** removes the selected connector(s) — `deleteSelection` already removes nodes by
  id, so it works for connectors unchanged.
- Connectors are **not draggable** (no `x/y`); a press on a connector selects it but the
  move path is a no-op for connectors (move translates shapes only — see §7).

---

## 7. Refactor: narrow shape-only code (`isShape`)

Widening `Node` requires updating every place that assumed all nodes are shapes:

- **`model/geometry.ts`** — `hitTest`, `shapeInRect`, `selectionBounds`, etc. remain
  shape-typed helpers; callers pass `tab.nodes.filter(isShape)` where they need shapes.
- **`tools/selectTool.ts`:**
  - `onPointerDown` uses `hitNode` (shapes + connectors).
  - **Move** iterates `tab.nodes.filter(isShape)` and translates only shapes; connectors
    re-derive. Selected connectors are skipped by the move loop.
  - **Resize** stays single-shape only (`singleSelected` returns a `Shape`; ignores
    connectors). Handles never appear for connectors.
  - **Marquee** selects shapes whose bbox intersects, then **auto-includes a connector when
    both its endpoints' shapes are in the selection** (`expandSelectionWithConnectors`).
  - `groupMembers`/`expandToGroups` already operate on any node via `groupId` — unchanged.
- **`model/document.ts`** — add **delete-cascade**: `removeNodes` (or a new
  `removeWithConnectors`) also drops any connector whose attached endpoint references a
  removed node. `deleteSelection` and `resetTab` route through it. Add an on-load
  validation that drops connectors with a missing attached endpoint.
- **`render/renderer.ts`** — dispatch by kind (see §4).

This removes the `as Shape[]` casts the Phase-1 whole-branch review flagged as a Phase-2
landmine.

---

## 8. Module layout

| File | Change |
|------|--------|
| `model/types.ts` | `Node = Shape \| Connector`; `Connector`, `Endpoint`, `ConnectorStyle`; type guards. |
| `model/document.ts` | `DEFAULT_CONNECTOR_STYLE`, `createConnector`, delete-cascade, on-load prune. |
| `render/connector.ts` | **New.** `endpointCenter`, `connectorSegment`, `connectorHit`, `connectorToSvg`. |
| `render/renderer.ts` | Kind dispatch; back/front layering; arrowhead `<defs>`; highlight + connector-selected rendering. |
| `tools/connectorTool.ts` | **New.** The Arrow tool. |
| `tools/selectTool.ts` | `hitNode`; move/marquee narrowing; connector selection. |
| `tools/types.ts` | `ToolName` gains `'arrow'`. |
| `ui/toolbar.ts` | Arrow tool button. |
| `app.ts` | `highlightId` state + pass to render; register Arrow tool; delete-cascade via document. |
| `main.ts` | Register `ConnectorTool`. |

---

## 9. Error handling
- **Dangling connector** (referenced shape missing) → `connectorSegment` returns `null`;
  renderer skips it; delete-cascade prevents most cases; on-load prune removes any that
  slipped through a hand-edited file.
- **Self-connection / release-on-empty** → cancel (remove the preview node), no connector.
- **Zero-length / overlapping shapes** → fall back to center-to-center so a segment always
  draws when both shapes exist.

---

## 10. Testing (Vitest)
DOM-free first:
- `render/connector.ts` — `connectorSegment` clips to box edges; re-derives when a shape
  moves; `connectorHit` true near the line / false far; `endpointCenter` for attached vs
  floating; dangling returns `null`.
- `model/document.ts` — `createConnector`; delete-cascade drops connectors of a removed
  shape; on-load prune; serialization round-trip preserves connectors.
- `tools/connectorTool.ts` — drag shape→shape creates a connector with the right endpoints,
  selects it, stays active; release-on-empty / same-shape cancels (no node added).
- `tools/selectTool.ts` — `hitNode` selects a connector by clicking its line; moving a
  shape leaves connector endpoints re-derived (segment changes); marquee includes a
  connector only when both endpoints' shapes are selected.
- Renderer (jsdom) — a connector renders one `<g data-id>` with a `<line>`; connectors
  render behind shapes; selected connector renders highlighted.

---

## 11. Decisions (resolved)
- **Attachment:** auto-edge (reference shapes, derive boundary endpoints), not fixed anchors.
- **Creation:** dedicated Arrow tool, drag source→target, live preview, target highlight,
  stays active, Esc exits.
- **Routing:** straight, edge-clipped; arrowhead at the target end.
- **Restyle:** deferred (fixed default style for v1; awaits a properties panel).
- **Edge clipping:** bounding box for all kinds in v1 (per-kind precise clipping later).
- **Release on empty:** cancels (no floating/dangling endpoints in v1).
- **Node union:** discriminated union + `isShape`/`isConnector` guards (pays down the
  Phase-1 cast debt).

## 12. Future (not now)
Properties panel → connector restyle + arrowhead toggle (none/both); drag an endpoint to
re-attach; floating endpoints; elbow/orthogonal routing; per-kind precise edge clipping;
direct marquee-selection of connectors.
