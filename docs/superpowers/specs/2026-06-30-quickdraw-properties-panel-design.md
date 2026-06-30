# QuickDraw — Properties Panel (Phase 2b) Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pre-implementation
**Topic:** A right-side dock that edits the style of the current selection (shapes
and connectors): fill, line color/width/style, font, arrowheads, and z-order.
**Builds on:** the current `feat/phase1-core-canvas` branch (Phase 1 core +
type-to-edit, drag-to-draw, continuous-draw, grouping, and connectors).

---

## 1. Overview

Add a **properties panel** docked on the right edge of the app. It is hidden when
nothing is selected and appears when there is a selection, showing the controls
relevant to what's selected. Editing a control restyles the selected node(s) live,
routing through `App.commit()` so every change is one undo entry and autosaves with
the rest of the workspace. This also completes **connector restyling**, deferred from
the connectors phase.

### Goals
- A right-side dock that renders from the current selection and applies edits back
  through `App` (no state in the panel).
- Edit: **fill** color (shapes); **line color, line width, line style (solid/dashed)**
  (shapes & connectors); **font size, font color** (shapes); **arrowheads** start/end
  (connectors); **bring to front / send to back** (any node).
- Multi-selection applies to every selected node; the panel reflects the **primary
  (first) selected** node's values.
- Live edits with sensible undo granularity (one history entry per edit gesture).

### Non-goals (deferred — YAGNI)
Opacity, gradients, swatch palettes / recent colors, text alignment, a corner-radius
control, copy-style / format-painter, dash-pattern customization (only a solid/dashed
toggle), per-end arrowhead *shapes*.

---

## 2. Model additions (small)

Two new style fields; `fontColor` already exists on `ShapeStyle`.

```ts
// model/types.ts
interface ShapeStyle {
  fill: string; stroke: string; strokeWidth: number;
  fontSize: number; fontColor: string;
  dashed: boolean;            // NEW
}
interface ConnectorStyle {
  stroke: string; strokeWidth: number;
  arrowEnd: boolean;
  arrowStart: boolean;        // NEW
  dashed: boolean;            // NEW
}
```

- `DEFAULT_STYLE` gains `dashed: false`; `DEFAULT_CONNECTOR_STYLE` gains
  `arrowStart: false, dashed: false`.
- **Backward compatibility:** workspaces autosaved before this change lack the new
  fields. Renderers treat them as falsy (`style.dashed` → not dashed;
  `style.arrowStart` → no start arrow), and the panel reads `style.dashed ?? false`
  etc. No migration step is required.

---

## 3. Controls, adapted to the selection

The panel shows only the sections relevant to the current selection:

| Control | Applies to nodes with the property |
|---|---|
| Fill color | shapes |
| Line color | shapes **and** connectors (`stroke`) |
| Line width | shapes **and** connectors (`strokeWidth`) |
| Line style: solid / dashed | shapes **and** connectors (`dashed`) |
| Font size, font color | shapes (`fontSize`, `fontColor`) |
| Arrowhead start / Arrowhead end | connectors (`arrowStart`, `arrowEnd`) |
| Bring to front / Send to back | any node |

- **Mixed selection** (shapes + connectors): the shared sections (line color/width/
  style, front/back) show, plus each type's specific section (fill/font for shapes,
  arrowheads for connectors). A control applies only to the selected nodes that have
  that property (see `restyleNodes` in §5).
- **Displayed values** reflect the **primary (first) selected node**. No tri-state
  "mixed" indicator — editing writes the new value to all applicable selected nodes.
- Control widgets: colors use the native picker (`<input type="color">`); line width
  and font size use small number inputs; line style and arrowheads are toggle buttons;
  front/back are buttons.

---

## 4. Apply behavior & undo granularity

- **Live:** edits apply immediately to the model and re-render the canvas.
- **Undo granularity:** a continuous gesture is one history entry. Native `input`
  events (dragging the color picker, spinning a number) call `App.restyle(patch)` which
  mutates the selected nodes and **renders without committing**; the terminating
  `change` event calls `App.commitStyle()` which pushes **one** history snapshot and
  schedules autosave. Discrete actions (line-style toggle, arrowhead toggles,
  front/back) do both in one step (mutate → commit).
- **Multi-select:** every applicable selected node is patched.
- The panel is shown only when the selection is non-empty; clearing/deleting the
  selection hides it.

---

## 5. Components & data flow

```
selection change / edit → Panel reads App.selection → renders controls (primary node)
Panel control edit → App.restyle(patch) [live] / App.commitStyle() [gesture end]
                    → mutate selected nodes' style → render → autosave/history on commit
App.render() → Panel.update()  (rebuild controls only when the selection changed)
```

- **`ui/properties.ts`** — `mountProperties(app, container): { update(): void }`. Builds
  the dock; `update()` reads `app.selection` + `app.activeTab`, computes a selection
  signature (sorted ids), and **rebuilds the controls only when the signature changes**
  (so live edits don't clobber a focused input). When empty, it hides the dock.
- **`App`** wiring:
  - `restyle(patch: StylePatch): void` — apply the patch to the selected nodes
    (`restyleNodes`) and `render()` (no commit).
  - `commitStyle(): void` — `commit()` (history + autosave).
  - `bringToFront(): void` / `sendToBack(): void` — reorder the selection and `commit()`.
  - `onRender?: () => void` — called at the end of `render()`; `main.ts` wires it to
    `panel.update` so the panel stays in sync. App does not otherwise depend on the panel.
- **`model/document.ts`**:
  - `type StylePatch = Partial<ShapeStyle & ConnectorStyle>`.
  - `restyleNodes(tab, ids, patch): void` — for each node whose id ∈ `ids`, apply each
    patch key, routed by node **kind** (not by whether the key currently exists, so
    nodes loaded from an older autosave that lack the new fields are still patched
    correctly): shape-only keys `fill`/`fontSize`/`fontColor` apply only to shapes
    (`isShape`); connector-only keys `arrowStart`/`arrowEnd` only to connectors
    (`isConnector`); common keys `stroke`/`strokeWidth`/`dashed` to both. Implement the
    routing with two key-sets (`SHAPE_ONLY`, `CONNECTOR_ONLY`); any other key is common.
  - `reorderSelection(tab, ids, dir: 'front' | 'back'): void` — move the selected nodes
    to the end (`front`) or start (`back`) of `tab.nodes`, preserving their relative
    order: `front` → `[...rest, ...selected]`, `back` → `[...selected, ...rest]`.

---

## 6. Rendering changes
- **`render/shapes.ts`**: when `s.style.dashed`, set `stroke-dasharray` (e.g. `"6 4"`)
  on the shape primitive; honor `s.style.fontColor` for text (already wired).
- **`render/connector.ts`**: when `c.style.dashed`, set `stroke-dasharray` on the line;
  when `c.style.arrowStart`, set `marker-start="url(#arrowhead)"` (in addition to the
  existing `marker-end` for `arrowEnd`). The arrowhead marker already follows the line
  color via `context-stroke`.
- No renderer dispatch changes; the selection overlay is unchanged.

---

## 7. Module layout

| File | Change |
|------|--------|
| `ui/properties.ts` | **New** — the dock + controls + `update()`. |
| `model/types.ts` | `ShapeStyle.dashed`, `ConnectorStyle.arrowStart`/`dashed`. |
| `model/document.ts` | defaults; `StylePatch`; `restyleNodes`; `reorderSelection`. |
| `render/shapes.ts` | dashed stroke for shapes. |
| `render/connector.ts` | dashed line + `marker-start`. |
| `app.ts` | `restyle`/`commitStyle`/`bringToFront`/`sendToBack`; `onRender` hook. |
| `main.ts` | mount the panel; wire `app.onRender = () => panel.update()`. |
| `index.html` / `style.css` | a dock container + panel styling. |

---

## 8. Error handling
- Patch keys are routed by node kind, so applying `fill` to a connector or `arrowEnd`
  to a shape is a safe no-op (the key is skipped for nodes of the wrong kind).
- Number inputs clamp to sane minimums (line width ≥ 1, font size ≥ 4) before applying.
- Empty selection hides the panel; `restyle`/`bringToFront`/`sendToBack` are no-ops when
  the selection is empty.
- Old workspaces missing the new style fields render as not-dashed / no start arrow.

---

## 9. Testing (Vitest)
- `restyleNodes` — patches `stroke` on both a shape and a connector; routes `fill` to
  the shape only and `arrowEnd` to the connector only; ignores nodes not in `ids`.
- `reorderSelection` — `front`/`back` move a multi-node selection and preserve relative
  order.
- Renderer — a dashed shape gets `stroke-dasharray`; a connector with `arrowStart` gets
  `marker-start`; old nodes without the fields render without them.
- `App` — `restyle` mutates without a history entry; `commitStyle` adds exactly one;
  `bringToFront`/`sendToBack` reorder + commit; `restyle` is a no-op on empty selection.
- Panel (jsdom) — `update()` shows fill/font controls only when a shape is selected,
  arrowhead controls only when a connector is selected, shared controls for a mixed
  selection; reflects the primary node's values; a control edit calls `app.restyle`
  then `app.commitStyle`; the dock hides on empty selection.

---

## 10. Decisions (resolved)
- Form: **right-side dock**, hidden when nothing is selected.
- Controls: fill, line color/width/style(dashed), font size/color, arrowhead start/end,
  front/back.
- **Mixed selection:** show shared + per-type sections; each control hits the nodes that
  have that property.
- **Displayed value:** primary (first) selected node; no tri-state.
- Live edits with one undo entry per gesture (`input` → live, `change` → commit).
- Model: add `arrowStart` + `dashed` (shapes & connectors); `fontColor` reused.

## 11. Future (not now)
Opacity, gradients, swatch/recent-color palettes, text alignment, corner-radius
control, copy-style/format-painter, custom dash patterns, alternate arrowhead shapes.
