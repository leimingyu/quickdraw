# QuickDraw — Brace `{ }` and Bracket `[ ]` Shapes Design Spec

**Date:** 2026-07-17
**Status:** Approved (not yet implemented)
**Request:** Add left and right brace shapes to QuickDraw's tools/shapes, like PowerPoint.
Extended during brainstorming to also include left/right square brackets (PowerPoint groups
braces and brackets together under "Basic Shapes").
**Builds on:** the kind-agnostic shape system — `ShapeKind` (`model/types.ts`), the shared
`primitive()` renderer (`render/shapes.ts`) that feeds both live canvas and SVG/PNG export,
and the generic `ShapeTool` / hit-test / palette pipeline.

---

## 1. Overview

Add four new shape kinds — left brace `{`, right brace `}`, left bracket `[`, right
bracket `]` — as first-class shapes. Each is an **outline glyph**: a single stroke-only
SVG `<path>` computed from the shape's bounding box. Everything else about a shape is
inherited for free because the surrounding systems are kind-agnostic:

- **Drawing:** drag-to-draw and click-for-default-size (`ShapeTool`), unchanged.
- **Selection / move / resize / rotate:** bounding-box hit-test and handles, unchanged.
- **Connectors & ports:** 8 connection points on the bounding box, unchanged.
- **Grouping, align/distribute, grid-snap, copy/paste:** operate on any `Shape`, unchanged.
- **Save / open:** `serialize.ts` round-trips the whole shape object; **no schema change,
  no version bump.**
- **Text label:** per the brainstorm decision, braces/brackets behave exactly like every
  other shape — double-click to type an optional centered label (no special-casing).

The only kind-specific code is: (a) four `case` branches in `primitive()` that build the
path, and (b) an outline-only default fill in `createShape()`.

### Goals
- Four new tools in the palette: `{`, `}`, `[`, `]`, placed after Triangle, before Text.
- Each renders as a clean stroke-only glyph that scales to any width/height the user draws.
- Stroke color, stroke width, and the dashed toggle all work via the existing style path.
- Live render, SVG export, and PNG export all show identical output (one render path).

### Non-goals (YAGNI)
- **PowerPoint's adjustable pinch handle** (the yellow diamond that slides a brace's middle
  up/down). The model has no per-shape adjustment parameters; adding them is a separate,
  larger feature. Braces pinch at a **fixed vertical center**.
- A meaningful **fill** for the enclosed area. Braces/brackets are open outline glyphs;
  render **forces `fill="none"`** regardless of the style's fill (an open path filled as if
  closed produces a nonsensical wedge). The fill control simply has no visible effect on
  these kinds — the same as it does for the `text` kind today.
- Angle brackets `< >`, chevrons, or other enclosure variants.

---

## 2. Model (`model/types.ts`, `tools/types.ts`, `main.ts`)

- **`ShapeKind`** gains four members:
  ```ts
  export type ShapeKind =
    | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text'
    | 'brace-left' | 'brace-right' | 'bracket-left' | 'bracket-right';
  ```
- **`ToolName`** (`tools/types.ts`) gains the same four names (the tool-name union mirrors
  the shape kinds one-for-one).
- **`main.ts`** registers a `ShapeTool` per kind by iterating a literal array; append the
  four new kinds to that array:
  ```ts
  for (const kind of ['rect','rounded','ellipse','diamond','triangle','text',
                       'brace-left','brace-right','bracket-left','bracket-right'] as const) {
    app.registerTool(kind, new ShapeTool(app, kind));
  }
  ```

No exhaustiveness breakage: `primitive()` and `pointInShape()` both use a `default` branch,
so the new kinds fall through to sensible defaults until their explicit cases are added.

---

## 3. Default style (`model/document.ts` — `createShape`)

Braces/brackets are outline glyphs, so seed `fill: 'none'` while keeping the default stroke
(so the glyph is visible). Extend the existing `text` special-case:

```ts
const OUTLINE_ONLY = new Set<ShapeKind>(['brace-left','brace-right','bracket-left','bracket-right']);
// in createShape:
if (kind === 'text') { style.fill = 'none'; style.stroke = 'none'; }
else if (OUTLINE_ONLY.has(kind)) { style.fill = 'none'; }
```

Stroke (`#1e1e1e`), stroke width (`2`), and `dashed:false` come from `DEFAULT_STYLE`. No
default `text` is set (only the `text` kind seeds `"Text"`), so braces start label-less.

---

## 4. Rendering (`render/shapes.ts` — `primitive`)

Add four `case`s that return an SVG `<path>`. All share a helper that applies stroke,
stroke-width, and dashed from style but **forces `fill="none"`** and adds rounded
joins/caps for clean corners and open ends:

```ts
function outlinePath(s: Shape, d: string): SVGPathElement {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', s.style.stroke);
  p.setAttribute('stroke-width', String(s.style.strokeWidth));
  p.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('stroke-linecap', 'round');
  if (s.style.dashed) p.setAttribute('stroke-dasharray', '6 4');
  return p;
}
```

Geometry, parametrized on the box (`x, y, w, h`), with corner radius
`r = Math.min(w / 2, h / 4)` (scales with the box; capped at half-height so the top and
bottom halves never overlap):

- **`bracket-left` `[`** — three straight segments, opening to the right:
  `M ${x+w} ${y} L ${x} ${y} L ${x} ${y+h} L ${x+w} ${y+h}`
- **`bracket-right` `]`** — mirror, opening to the left:
  `M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h}`
- **`brace-left` `{`** — spine (the vertical body of the two arms) at `xBody = x + w/2`;
  arms curl right to `xOut = x + w` at top and bottom; the pinch point pokes left to
  `xTip = x` at mid-height (`ym = y + h/2`). Four quadratic curves + two straight spine runs:
  ```
  M ${xOut} ${y}
  Q ${xBody} ${y}      ${xBody} ${y + r}
  L ${xBody} ${ym - r}
  Q ${xBody} ${ym}     ${xTip}  ${ym}
  Q ${xBody} ${ym}     ${xBody} ${ym + r}
  L ${xBody} ${y + h - r}
  Q ${xBody} ${y + h}  ${xOut}  ${y + h}
  ```
- **`brace-right` `}`** — mirror: `xOut = x` (arms curl left), `xBody = x + w/2` (spine),
  `xTip = x + w` (pinch pokes right).

The existing `applyStyle` (used by the polygon/rect/ellipse cases) is **not** used for
these — `outlinePath` replaces it so fill is unconditionally `none`. The surrounding
`shapeToSvg` wrapper (`<g>` with rotation transform + optional text label) is unchanged, so
rotation and text labels apply automatically.

---

## 5. Tool palette (`ui/toolPalette.ts`)

Add four `ITEMS` entries after the `triangle` item and before `text`, each a 24×24 inline
icon (`stroke=currentColor`, so it inverts on the active button like the others):

| kind | label | icon `d` (approx; final values tuned in impl) |
|------|-------|-----------------------------------------------|
| `brace-left`    | Left brace `{`    | `M15 4c-2 0-3 1-3 3v2c0 1-1 3-3 3 2 0 3 2 3 3v2c0 2 1 3 3 3` |
| `brace-right`   | Right brace `}`   | `M9 4c2 0 3 1 3 3v2c0 1 1 3 3 3-2 0-3 2-3 3v2c0 2-1 3-3 3` |
| `bracket-left`  | Left bracket `[`  | `M15 4H9v16h6` |
| `bracket-right` | Right bracket `]` | `M9 4h6v16H9` |

No other palette wiring changes — buttons carry `data-tool` and call `app.setTool(kind)`
through the existing loop; `syncActive` highlights them like any shape tool.

---

## 6. Testing (Vitest / jsdom)

- **`render/shapes`** — `shapeToSvg({kind:'bracket-left', …})` produces a `<path>` whose `d`
  is the 3-segment polyline and whose `fill` is `"none"`, `stroke` is the style stroke.
  `shapeToSvg({kind:'brace-left', …})` produces a `<path>` with `fill="none"` and a `d`
  containing quadratic (`Q`) commands. A `dashed` brace sets `stroke-dasharray`. A brace with
  `text` still appends a `<text>` child (label path unchanged).
- **`model/document`** — `createShape('brace-left'/'bracket-right'/…)` sets `style.fill`
  to `'none'`, keeps `style.stroke` at the default (not `'none'`), and sets no `text`.
- **`io/serialize`** — a `brace-left` shape survives serialize → deserialize with its kind
  intact (guards against an accidental kind allow-list somewhere in IO).

Additionally verified in a real browser against the built single-file `quickdraw.html`
(served over HTTP per project convention): draw each of the four shapes from the palette,
resize tall/wide, rotate, set stroke color + dashed, attach a connector, add a text label,
and export SVG/PNG — glyphs render correctly with no console errors.

---

## 7. Module layout

| File | Change |
|------|--------|
| `model/types.ts` | 4 kinds added to `ShapeKind`. |
| `tools/types.ts` | 4 names added to `ToolName`. |
| `main.ts` | 4 kinds appended to the tool-registration array. |
| `model/document.ts` | `createShape` seeds `fill:'none'` for the 4 outline kinds. |
| `render/shapes.ts` | `outlinePath` helper + 4 `case`s in `primitive()` (brace/bracket path builders). |
| `ui/toolPalette.ts` | 4 `ITEMS` buttons with `{ } [ ]` icons, after Triangle / before Text. |
| `tests/*` | shape-render tests, `createShape` default-style tests, serialize round-trip test. |

## 8. Future (not now)
Adjustable pinch handle (per-shape adjustment params), angle brackets `< >` / chevrons,
fillable enclosed area.
