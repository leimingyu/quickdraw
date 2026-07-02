# Quick-connect from hover ports — design

Issue: [#16](https://github.com/leimingyu/quickdraw/issues/16) — "Quick-connect from hover ports".

## Goal

Speed up flowchart building (draw.io / Lucidchart style):

1. **Hover** a shape → 4 edge **ports** appear (top / right / bottom / left).
2. **Drag** a port → rubber-band a connector; release on empty canvas to
   auto-create a connected clone of the source, or release on another shape to
   connect the two.
3. **Click** a port (press + release, no meaningful drag) → **duplicate the
   shape in that direction and connect it** ("duplicate & connect").

Both gestures share the same port machinery, so they cost little on top of each
other.

## Non-goals (YAGNI)

- No new toolbar button — this lives entirely inside the existing Select tool.
- No keyboard shortcut variant.
- Rotated-shape duplicate placement is best-effort (axis-aligned offset); ports
  still render/hit-test correctly on rotated shapes.

## Architecture

The feature slots into the existing tool/model/render split. No new tool is
registered; the Select tool grows a hover state and delegates the drag to a
small helper, mirroring how it already delegates endpoint editing to
`EndpointDrag`.

### `src/model/quickConnect.ts` (pure, unit-tested)

- `type Port = 'n' | 'e' | 's' | 'w'` (also the `ConnectionPoint` anchor names).
- `PORT_OFFSET = 18` — world units a port marker sits outside its edge midpoint.
- `DUP_GAP = 60` — gap between source and duplicated shape.
- `portPoints(s: Shape): Record<Port, Point>` — each edge midpoint (rotated with
  the shape via `shapeHandlePositions`) pushed outward along the
  center→midpoint normal by `PORT_OFFSET`.
- `cloneShapeAt(src, cx, cy): Shape` — a fresh shape with the source's
  kind/size/style, centered at `(cx, cy)`, rotation 0, no text.
- `duplicateInDirection(src, port): { shape, connector }` — a clone offset by
  `DUP_GAP` in `port`'s direction (aligned on the cross axis), plus a connector
  from `{ nodeId: src, anchor: port }` to `{ nodeId: clone, anchor: OPPOSITE[port] }`.

### `src/tools/quickConnect.ts` — `QuickConnect` helper

Mirrors `EndpointDrag`. Owns a preview `Connector` while a port is being dragged.

- `begin(src, port, world)` — create a preview connector pinned at the source
  port (`{ nodeId, anchor: port }`) with a free `to`; inherit
  `app.connectorRouting` / `connectorArrow` like `ConnectorTool`; add + render.
- `move(world)` — update `to`; highlight the shape under the cursor (never the
  source); render.
- `finish(world)` — below drag threshold → **click**: drop the preview, run
  `duplicateInDirection`, select the new shape. Real drag onto a shape → connect
  to it (`attachEndpoint`). Real drag onto empty → `cloneShapeAt` centered on the
  drop, connect to it, select the new shape. Commit once, hand back to Select.
- `cancel()` — remove the preview (tool switch / pointercancel).

### `src/tools/selectTool.ts` integration

- New `QuickConnect` field.
- `onPointerDown`: after the endpoint / rotation / resize checks and before the
  hit-node check, if a port of the **hovered** shape is under the cursor, begin
  quick-connect. Gating on the hovered shape (not a blind geometric search)
  means a port only fires when its marker is actually visible, so it never
  hijacks an empty-canvas marquee.
- `onPointerMove`: if quick-connect is active, delegate; else when idle, update
  the hovered shape (body hit **or** a port within reach) and re-render on change.
- `onPointerUp` / `onDeactivate`: delegate to / cancel quick-connect.
- The top (`n`) port is suppressed for the single-selected shape, whose rotation
  knob occupies that space; `e`/`s`/`w` remain, so the core "make a box, drag a
  port off it" flow works on the just-created (selected) shape.

### `src/app.ts` + `src/render/renderer.ts`

- `App` gains `hoverShapeId?: string`, passed into `render()` and cleared by
  `setTool` (ports are a Select-only affordance).
- `Renderer.render` takes an optional `hoverShapeId`; a new `drawPorts` paints
  the port markers (filled blue dots, `pointer-events: none` — hit-testing is
  geometric, like the resize handles) at `portPoints`, skipping the suppressed
  `n` port when the shape is the sole selection.

## Data flow

hover move → `SelectTool.updateHover` → `app.hoverShapeId` → `render` →
`drawPorts`. Press on a port → `SelectTool` → `QuickConnect.begin` → preview
connector node. Release → `QuickConnect.finish` → model mutation
(`duplicateInDirection` / `cloneShapeAt` + connector) → `app.commit()` (one undo
entry) → `setTool('select')`.

## Testing

- **model/quickConnect**: `portPoints` positions for an axis-aligned rect;
  `duplicateInDirection` offset + connector anchors for all four ports;
  `cloneShapeAt` copies kind/size/style, centers, drops text, gets a fresh id.
- **tools/quickConnect (via App + SelectTool, jsdom)**: hover then drag a port
  to empty → new connected clone; drag a port onto another shape → connects the
  two; click a port → duplicate-in-direction; a press with no hover does nothing
  (no marquee hijack); tool switch mid-drag removes the preview; the whole
  gesture is a single undo.

## Risks / mitigations

- **Marquee hijack** near a shape edge → gating the port press on `hoverShapeId`.
- **Rotation-knob collision** at the top → suppress the `n` port when selected.
- **Existing render callers** → the new `render` param is optional; default
  behavior (no hover) is byte-identical.
