# QuickDraw — Multi-line / Wrapped Text in Shapes Design Spec

**Date:** 2026-07-02
**Status:** Implemented
**Issue:** [#19](https://github.com/leimingyu/quickdraw/issues/19) — *Multi-line / wrapped
text in shapes. Today labels are a single-line `<input>`. Real flowchart/box text needs
line breaks and wrapping.*
**Builds on:** the inline text editor (`App.editText`, an `<input>`) and the single
`textEl` render path shared by live render **and** SVG/PNG export (Typography Controls, #18).

---

## 1. Overview

A shape's label graduates from one line to a real block of text: users can insert explicit
**line breaks**, and long lines **wrap** to the shape's width. Two touch points:

1. **Editor** (`App.editText`) — swap the single-line `<input>` for a `<textarea>` sized to
   the shape box. **Enter commits** (unchanged muscle memory + existing behavior);
   **Shift+Enter inserts a newline** (the draw.io / Slack convention). Escape cancels, blur
   commits — all unchanged.
2. **Renderer** (`render/shapes.ts` → `textEl`) — draw the label as stacked `<tspan>`s:
   split on `\n` for explicit breaks, then word-wrap each paragraph to the box width, and
   center the whole block vertically. One code path, so SVG **and** PNG export inherit it.

The model is unchanged: `Shape.text` stays a plain `string`, with newlines embedded as
`\n`. JSON save/open round-trips `\n` for free — **no schema change, no version bump.**

### Goals
- Type multiple lines in a shape (Shift+Enter) and have them render on separate lines.
- Long lines auto-wrap at word boundaries to fit the shape's width.
- Live render, SVG export, and PNG export all show the same wrapped, multi-line text.

### Non-goals (YAGNI)
Auto-growing the box to fit the text (the box stays the size the user drew/resized; extra
lines overflow visually, exactly as an over-long single line does today), vertical-align
options, rich text / per-run styles, hyphenation, wrapping inset to non-rectangular shape
outlines (ellipse/diamond wrap to their bounding width, as their single line already does),
right-to-left text.

---

## 2. Editor (`app.ts` — `App.editText`)

- Create a `<textarea class="text-editor">` instead of an `<input>`. `value`, seeding,
  and selection semantics are identical (`setSelectionRange` / `select` both exist on
  `<textarea>`).
- **Geometry:** overlay the shape box — `left/top` at the shape origin, `width = w·zoom`,
  `height = h·zoom` (screen space). `resize:none`, no scrollbars, centered text, a
  translucent panel so the shape shows through. (This replaces the old center-minus-12px
  single-line placement.)
- **Keys:** on `keydown`, `Enter` **without** Shift → `preventDefault` + `commit(true)`;
  `Enter` **with** Shift → let the textarea insert the newline; `Escape` → `commit(false)`.
  `blur` → `commit(true)`. Commit still writes `shape.text = textarea.value` and calls
  `commit()` exactly once (idempotent `done` guard unchanged).
- The global keyboard handler already early-returns when the focused element is an
  `INPUT`/`TEXTAREA` (`app.ts:355`), so Delete/⌘-shortcuts don't fire while editing.

---

## 3. Rendering (`render/shapes.ts` — `textEl` + `wrapText`)

`textEl(s)` keeps its single `<text>` element and all existing attributes (`text-anchor`,
`font-*`, `fill`, `dominant-baseline="central"`, alignment `x`) — the Typography tests that
query `<text>` stay green. Its **content** becomes one `<tspan>` per visual line:

- **Lines** = `layoutLines(s)`: split `s.text` on `\n`; for each paragraph, `wrapText` it to
  the available width `maxW = w − 2·TEXT_PAD` (`TEXT_PAD = 6`). An empty paragraph yields one
  empty line (blank lines are preserved).
- **`wrapText(text, maxW, measure): string[]`** — a pure, exported, unit-tested function.
  Greedy word wrap: accumulate words while `measure(candidate) ≤ maxW`; a single word wider
  than `maxW` is placed on its own line (no mid-word breaking). `maxW ≤ 0` or a
  non-positive measure ⇒ no wrapping (one line per paragraph). This keeps the algorithm
  deterministic and independent of the DOM.
- **`measure`** — `makeMeasurer(style)` returns a pure text-width estimator: `≈ 0.6·fontSize`
  per char (`×1.05` when bold). It deliberately errs generous so wrapped text stays *inside*
  the box rather than overflowing, and — being pure arithmetic with no canvas/DOM measurement
  — behaves identically in the browser and under jsdom, so tests exercise the exact production
  wrap path. (A canvas `measureText` path was prototyped but dropped: it produced jsdom
  "not-implemented" console noise and made in-browser wrapping diverge from what tests verify;
  swapping in glyph-accurate metrics later is a localized change behind this one seam.)
- **Vertical centering:** `lineHeight = 1.2·fontSize`; the block is centered on the shape
  center. First `<tspan>` gets `dy = −(n−1)/2 · lineHeight`; each subsequent `<tspan>` gets
  `dy = lineHeight`. Every `<tspan>` repeats the anchor `x` so lines don't drift under
  `dominant-baseline="central"`.
- A single-line label produces exactly one `<tspan>` with `dy = 0` — visually identical to
  today.

---

## 4. Export

SVG export (`render/exportSvg.ts`) reuses the live `Renderer`, and PNG export rasterizes the
rendered SVG — both go through `textEl`, so multi-line + wrapping appear in exports with
**no export-specific code**. The estimator/canvas measurer runs the same at export time.

---

## 5. Testing (Vitest / jsdom)

- **`wrapText` (pure)** — with an injected `measure = len·k`: wraps at word boundaries to
  fit; an over-long single word gets its own line; `maxW ≤ 0` ⇒ single line; empty string ⇒
  `['']`.
- **Renderer (`textEl`)** — `"a\nb\nc"` ⇒ three `<tspan>`s; first `dy` = `−(n−1)/2·lineHeight`,
  rest = `lineHeight`, all sharing the anchor `x`; a single line ⇒ one `<tspan>`, `dy=0`;
  a wide single-word-free string wraps into multiple `<tspan>`s via the estimator. Existing
  `<text>`-attribute assertions still pass.
- **`App.editText`** — the editor is now a `<textarea.text-editor>`; Enter commits once
  (even if a blur follows); **Shift+Enter does not commit** and keeps the editor open;
  Escape cancels; seeding/selection unchanged; geometry overlays the box.
- **Serialize** — a shape whose `text` contains `\n` survives serialize → deserialize.

Verified additionally in a real browser against the built single-file `quickdraw.html`:
a text box with Shift+Enter line breaks and an over-long line renders on multiple, wrapped,
vertically-centered lines, and exports (SVG/PNG) match — no console errors.

---

## 6. Module layout

| File | Change |
|------|--------|
| `render/shapes.ts` | `wrapText` (exported, pure); `makeMeasurer`; `textEl` emits stacked, wrapped, centered `<tspan>`s. |
| `app.ts` | `editText` builds a `<textarea>`; Enter commits / Shift+Enter newline; box-overlay geometry. |
| `style.css` | `.text-editor` textarea rule (font, centered, translucent, no resize/scroll). |
| `tests/*` | `wrapText` unit test; multi-line render tests; updated `editText` tests; newline serialize test. |

## 7. Future (not now)
Auto-grow box to fit, vertical alignment, rich text / per-run styles, hyphenation,
shape-outline-aware insets, RTL.
