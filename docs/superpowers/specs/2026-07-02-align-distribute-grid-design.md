# QuickDraw — Align & Distribute + Optional Grid / Snap-to-Grid Design Spec

**Date:** 2026-07-02
**Status:** Implemented
**Issue:** [#21](https://github.com/leimingyu/quickdraw/issues/21) — *Align & distribute +
optional grid/snap-to-grid. No align/distribute today, no grid. Alignment buttons
(left/center/right/top/middle/bottom, distribute h/v) + a toggleable grid are what make
diagrams look tidy without fiddling.*
**Builds on:** the selection model (`App.selection`, group-aware via `groupMembers` /
`expandToGroups`), the properties panel (contextual controls incl. z-order Front/Back), the
canvas `Renderer` (pan/zoom-transformed `content`/`overlay` groups), the View menu, and the
existing edge/center **shape-to-shape** snapping (`model/snapping.ts`) used during drag.

---

## 1. Overview

Two independent capabilities that both make diagrams "tidy without fiddling":

1. **Align & distribute** — reposition the current multi-selection. Six align ops
   (**left / h-center / right** on X, **top / v-middle / bottom** on Y) snap every selected
   unit's edge/center to the selection's bounding box. Two distribute ops
   (**horizontal / vertical**) equalize the gaps between three-or-more units, keeping the two
   extreme units pinned. Exposed as icon-button rows in the properties panel (next to z-order).

2. **Optional grid + snap-to-grid** — a **Show grid** toggle paints light grid lines across
   the canvas (in world space, so they pan/zoom with content), and an independent **Snap to
   grid** toggle quantizes shape positions to the grid while dragging or drawing. Both live in
   the **View** menu as checkable items.

**Units, not shapes.** Align/distribute and grid-snap operate on **units**: a group counts as
one rigid unit (its combined bounding box moves; members keep their relative layout), and each
ungrouped shape is its own unit. This is the non-surprising behavior — aligning a selection
that contains a group must not scatter the group's members.

**No model/schema change, no version bump.** Align/distribute only mutate existing shape
`x`/`y`. Grid `showGrid`/`snapToGrid` are **session settings on `App`** (exactly like
`exportBackground`/`exportDpi`) — not serialized into the `.quickdraw` file.

### Goals
- Align 2+ selected units to a common left/center/right/top/middle/bottom line, one click.
- Distribute 3+ units with equal horizontal or vertical gaps, extremes pinned.
- Toggle a visible grid on/off; toggle snap-to-grid on/off, independently.
- With snap on, dragging or drawing a shape lands it on grid coordinates.
- Groups behave as single rigid units for all of the above.
- Undoable align/distribute (one history entry); no history entry when nothing moves.

### Non-goals (YAGNI)
- Align/distribute relative to the canvas/page (only "align to selection" — PowerPoint's
  default with multiple objects selected).
- "Distribute by centers" mode (we ship equal-**gap** distribution only).
- Snap-to-grid on **resize**, on **rotation**, on **connector endpoints**, or on **arrow-key
  nudge** (nudge stays 1px / 10px — deliberate fine control; re-snapping it would fight the
  user). v1 snaps **move** and **create** only.
- Configurable grid spacing / grid units in the UI (fixed `GRID_SIZE = 20` world units).
- Persisting grid preferences to the saved file or to `localStorage`.
- Aligning/distributing free connector endpoints (operate on shapes; attached connectors
  follow their shapes for free).

---

## 2. Align & distribute — model (`src/model/align.ts`, pure)

Mirrors `snapping.ts`: pure functions on `Box`es, returning per-input **deltas**. No DOM, no
`Shape` dependency — trivially unit-testable.

```ts
export type AlignOp = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';
export type DistributeOp = 'hspace' | 'vspace';
export interface Delta { dx: number; dy: number; }

export function alignDeltas(boxes: Box[], op: AlignOp): Delta[];
export function distributeDeltas(boxes: Box[], op: DistributeOp): Delta[];
```

**`alignDeltas`** — reference is the selection's bounding box `bb` (min/max over all boxes).
Per box, one axis moves, the other is 0:
- `left`   → `dx = bb.minX − b.x`
- `right`  → `dx = bb.maxX − (b.x + b.w)`
- `hcenter`→ `dx = (bb.minX + bb.maxX)/2 − (b.x + b.w/2)`
- `top` / `bottom` / `vmiddle` → the same on Y (`dy`).

Fewer than 2 boxes ⇒ all-zero deltas (nothing to align against).

**`distributeDeltas`** — equal-gap distribution along one axis. Fewer than 3 boxes ⇒ all-zero
(with 2 there's no interior gap to equalize). For `hspace`:
1. Order indices by left edge `x` (stable).
2. `span = (last.x + last.w) − first.x`; `sumW = Σ w`; `gap = (span − sumW) / (n − 1)`.
3. Sweep in sorted order: `running = first.x`; each box's new `x = running`; then
   `running += w + gap`. This pins the first (its `x` unchanged) and the last (it lands back
   at `last.x + last.w`), equalizing the edge-to-edge gaps between. `dx = newX − b.x`.

`vspace` is the same on `y`/`h`. Deltas are returned in the **input order** (we map back from
the sorted order). Overlaps from oversized shapes are allowed (matches PowerPoint).

---

## 3. Align & distribute — units helper (`src/model/document.ts`)

```ts
/** Group selected shapes into rigid units: one array per group (in first-appearance
 *  order), plus one singleton array per ungrouped selected shape. Preserves node order. */
export function groupedShapeUnits(tab: Tab, ids: Set<string>): Shape[][];
```

Walk `tab.nodes` once (z-order): each selected shape either extends its group's bucket
(keyed by `groupId`) or starts a new singleton bucket. Buckets are emitted in the order their
first member appears. This is the ordering align/distribute and the unit **count** both use.

---

## 4. Align & distribute — App methods (`src/app.ts`)

```ts
align(op: AlignOp): void
distribute(op: DistributeOp): void
```

Both: `units = groupedShapeUnits(activeTab, selection)`; need `≥2` (align) / `≥3` (distribute)
units, else no-op. Compute each unit's bounding box (`selectionBounds(unit)`), get
`deltas = alignDeltas/distributeDeltas(boxes, op)`, and apply each unit's `(dx,dy)` to **every
member shape** of that unit. Track whether any delta was non-zero; `commit()` once if so
(single undo step), else return without a history entry (mirrors `resetRotation`). Connectors
attached to moved shapes follow automatically; free connector ends are untouched.

---

## 5. Align & distribute — properties panel (`src/ui/properties.ts` + `style.css`)

In `rebuild(nodes)`, after the shape/connector style rows and before `zorderRow()`, compute
`units = groupedShapeUnits(app.activeTab, app.selection).length`:
- `units ≥ 2` → append an **Align** row: a `.seg` of six icon buttons
  (`data-align` = `left|hcenter|right|top|vmiddle|bottom`), each with a `title`/`aria-label`,
  calling `app.align(op)` on click.
- `units ≥ 3` → append a **Distribute** row: a `.seg` of two icon buttons
  (`data-distribute` = `hspace|vspace`), calling `app.distribute(op)`.

Buttons use small inline SVG glyphs (viewBox `0 0 24 24`, `stroke=currentColor`) in the
existing tool-icon idiom. The panel already rebuilds on selection-signature change, so the
rows appear/disappear as the selection grows/shrinks. CSS: allow `.props .seg` to
`flex-wrap` so six buttons wrap within the 200px dock; give the icon buttons a fixed compact
size. These are discrete one-shot actions (like Front/Back) — no live-restyle/commit dance.

---

## 6. Grid — model (`src/model/grid.ts`, pure)

```ts
export const GRID_SIZE = 20;   // world units between grid lines
const MAX_LINES = 400;         // density cap: skip drawing when zoomed too far out

/** World-space X positions (vertical lines) and Y positions (horizontal lines) that fall
 *  within the viewport-visible region, at `spacing`. Empty when the viewport isn't sized
 *  yet (jsdom) or the grid would be too dense to be useful. */
export function gridLinePositions(
  vp: Viewport, width: number, height: number, spacing?: number,
): { xs: number[]; ys: number[] };

/** Round a world coordinate to the nearest grid line. */
export function snapValueToGrid(v: number, spacing?: number): number; // Math.round(v/s)*s
```

`gridLinePositions` converts the screen rect `[0,width]×[0,height]` to world bounds via the
viewport (`worldX = (screen − pan)/zoom`), then enumerates multiples of `spacing` inside those
bounds. Returns `{xs:[],ys:[]}` when `width|height ≤ 0` (unmeasured, e.g. jsdom) or when either
axis would exceed `MAX_LINES`. Pure ⇒ unit-tested directly, independent of the DOM.

---

## 7. Grid — renderer (`src/render/renderer.ts`)

Add a `grid` `<g>` inserted **before** `content` (so it paints behind shapes/overlay), sharing
the same `translate(pan) scale(zoom)` transform. Extend `render(...)` with a trailing
`showGrid = false` param. Each render: clear the grid group; if `showGrid`, measure
`this.svg.getBoundingClientRect()`, call `gridLinePositions(vp, w, h)`, and append one thin
`<line>` per `x`/`y` (light `#e5e7eb`, `stroke-width = 1/zoom` for ~1 screen-px,
`pointer-events:none`). No measured size (jsdom) ⇒ no lines, no throw. Export
(`exportSvg`/PNG) calls the renderer without `showGrid`, so **exports never include the grid**
— it's a working aid, not diagram content.

`App` gains `showGrid = false` and passes it in `render()`:
`renderer.render(activeTab, selection, highlightId, snapGuides, hoverShapeId, this.showGrid)`.

---

## 8. Snap-to-grid — integration

`App` gains `snapToGrid = false`. When **on**:

- **Move** (`tools/selectTool.ts`, `mode==='move'`): after computing the dragged selection's
  raw bounding box, snap its top-left corner to the grid
  (`dx = snapValueToGrid(minX) − minX`, likewise `dy`) and apply that single `(dx,dy)` to all
  selected shapes — preserving relative layout. This **replaces** edge/center snapping for the
  drag (guides cleared: `app.snapGuides = []`). When off, the existing `computeSnap` path is
  unchanged.
- **Create** (`tools/shapeTool.ts`, `onPointerUp`): after fixing the final box (click-default
  or dragged), if snapping is on, quantize it — snap `x`,`y` to the grid and snap `w`,`h` to
  the nearest multiple of `GRID_SIZE` (floored at one cell) — before `commit()`.

`DragMove` (used by shape tools to move an existing shape) is left unsnapped in v1 for
simplicity; the primary Select-tool move path is snapped. (Noted; can extend later.)

---

## 9. Menu (`src/ui/menubar.ts`) — View

Append to the **View** menu, after the zoom items:
- `'separator'`
- checkable **Show grid** — reuse the existing `radio` item shape as a checkbox:
  `active: () => app.showGrid`, `select: () => { app.showGrid = !app.showGrid; app.render(); }`.
- checkable **Snap to grid** — `active: () => app.snapToGrid`,
  `select: () => { app.snapToGrid = !app.snapToGrid; }`.

`radio` items already toggle their `.active` class via `refreshRadios()` and keep the menu open
on click — exactly right for independent checkboxes. `Show grid` re-renders the canvas; `Snap
to grid` only flips a flag (it affects the next drag/draw).

---

## 10. Testing (Vitest / jsdom)

- **`align.test.ts` (pure)** — `alignDeltas` for all six ops on a 3-box fixture (left→min,
  right→max-right, hcenter→bbox center; same on Y); `< 2` boxes ⇒ zero deltas.
  `distributeDeltas` hspace/vspace: equal gaps, first & last pinned (dx=0), `< 3` ⇒ zero;
  deltas returned in input order for shuffled input.
- **`document.test.ts`** — `groupedShapeUnits`: two grouped + one loose selected ⇒ 2 units
  (the group as one bucket); order follows node order; ignores unselected.
- **`grid.test.ts` (pure)** — `gridLinePositions` at zoom 1 / panned / zoomed lists the right
  world coords inside bounds; `width|height=0` ⇒ empty (jsdom safety); over-`MAX_LINES` ⇒
  empty. `snapValueToGrid` rounds to nearest cell (incl. negatives / exact-half).
- **`app.align.test.ts`** — `align('left')` on three loose shapes sets equal `x`, records one
  history entry (undo restores), and is a **no-op** (no history growth) when already aligned;
  group-aware: a group + a shape aligns the group as a rigid unit (members keep offsets);
  `distribute('hspace')` equalizes gaps and pins ends; `< required` units ⇒ no change.
- **`properties` (integration)** — with 3 shapes selected, an **Align** and a **Distribute**
  `.seg` render; clicking `[data-align="left"]` aligns; with 2 selected, Align shows but
  Distribute does not; with 1, neither shows.
- **`menubar.test.ts`** — View has **Show grid** / **Snap to grid**; clicking toggles
  `app.showGrid` / `app.snapToGrid` and the item's `.active` class; menu stays open.
- **`selectTool.snap.test.ts` (grid)** — with `app.snapToGrid = true`, dragging a shape lands
  its top-left on grid coords and draws no guides; off ⇒ unchanged.
- **`shapeTool.test.ts` (grid)** — with snap on, a drawn/clicked shape's `x`/`y` are on the
  grid and `w`/`h` are grid multiples.
- **`renderer.test.ts` (grid)** — `render(..., showGrid=true)` doesn't throw and (given a
  stubbed non-zero `getBoundingClientRect`) appends grid `<line>`s behind content; `false` ⇒
  none. (If stubbing the rect is awkward under jsdom, rely on `grid.test.ts` for the math and
  assert only the no-throw + group presence.)

Additionally browser-verify against the built single-file `quickdraw.html` (served over HTTP):
toggle the grid, drag with snap on, and align/distribute a few shapes — no console errors,
exports still grid-free.

---

## 11. Module layout

| File | Change |
|------|--------|
| `src/model/align.ts` | **new** — `alignDeltas`, `distributeDeltas`, types (pure). |
| `src/model/grid.ts` | **new** — `GRID_SIZE`, `gridLinePositions`, `snapValueToGrid` (pure). |
| `src/model/document.ts` | `groupedShapeUnits(tab, ids)` helper. |
| `src/app.ts` | `align`/`distribute`; `showGrid`/`snapToGrid` fields; pass `showGrid` to render. |
| `src/render/renderer.ts` | `grid` group behind content; `showGrid` param draws grid lines. |
| `src/ui/properties.ts` | Align (6) + Distribute (2) icon-button rows on multi-select. |
| `src/ui/menubar.ts` | View → Show grid / Snap to grid checkable items. |
| `src/tools/selectTool.ts` | Grid-snap the move when `app.snapToGrid`. |
| `src/tools/shapeTool.ts` | Grid-snap the created box when `app.snapToGrid`. |
| `src/style.css` | `.props .seg` wrap; compact align/distribute icon buttons. |
| `tests/*` | new `align`/`grid` unit tests; `app.align`, grid-snap tool tests; menu + properties + document + renderer additions. |

## 12. Future (not now)
Align/distribute to page; distribute-by-centers; snap-to-grid on resize/rotate/nudge/connector
ends; configurable grid spacing & snap step; persist grid prefs; "align to first/last selected"
reference modes.
