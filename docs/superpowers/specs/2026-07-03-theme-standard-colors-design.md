# Theme Colors & Standard Colors picker — design

Date: 2026-07-03
Status: approved-by-goal-directive

## Goal

Add PowerPoint-style **Theme Colors** and **Standard Colors** swatch pickers to
QuickDraw's properties panel, matching the PPT fill/line/font color dropdown. The
picker applies to all three color properties: **Line** (stroke), **Fill**, and
**Text** (fontColor). Nothing existing may break.

## Reference

PowerPoint's color dropdown shows, top to bottom:
- (Fill/Line only) a **No Fill / No Line** row.
- **Theme Colors**: a top row of ~10 base colors, and 5 rows of automatically
  generated tints (lighter) / shades (darker) beneath each base color.
- **Standard Colors**: a fixed row of 10 saturated colors.
- **More Colors…**: opens the full OS color picker.

## Non-breakage strategy (central constraint)

The existing control is a native `<input type="color" data-prop="{stroke|fill|fontColor}">`.
Every existing test reads `.value` off it, dispatches `input`/`change` on it, and one
test focuses it and asserts it stays focused across a same-selection update.

Therefore the native input is **kept exactly as-is** — same element, same
`data-prop`, same visibility (must remain focusable; `display:none` would break the
focus test in jsdom), same `input`/`change` listeners. We only **add** a caret
button beside it (a split-button, like PowerPoint) that opens the new swatch
popover. This is purely additive: no existing test is modified.

`'none'` (No Fill / No Line) is already supported end-to-end — default frame shapes
set `fill:'none'` / `stroke:'none'`, and the renderer/SVG export pass the value
straight through to SVG `fill`/`stroke` attributes. So No Fill is safe.

Zero new runtime dependencies (project rule).

## Components

### 1. `src/ui/palette.ts` (new, pure)
Color data and math, no DOM. Unit-testable in isolation.

- `THEME_BASE: readonly string[]` — 10 base theme colors (classic Office theme):
  `#FFFFFF, #000000, #E7E6E6, #44546A, #4472C4, #ED7D31, #A5A5A5, #FFC000,
  #5B9BD5, #70AD47`.
- `STANDARD_COLORS: readonly string[]` — 10 PPT standard colors:
  `#C00000, #FF0000, #FFC000, #FFFF00, #92D050, #00B050, #00B0F0, #0070C0,
  #002060, #7030A0`.
- `tint(hex, amount)` — mix toward white: `c + (255 - c) * amount`.
- `shade(hex, amount)` — mix toward black: `c * (1 - amount)`.
- `themeColumn(base): string[]` — `[base, tint .8, tint .6, tint .4, shade .25,
  shade .5]` (6 cells: base + Lighter 80/60/40 + Darker 25/50).
- `THEME_GRID: string[][]` — `THEME_BASE.map(themeColumn)` → 10 columns × 6 rows,
  laid out row-major for rendering.

All returned hex is normalized `#rrggbb` lowercase.

### 2. Color popover (in `src/ui/properties.ts`, or small helper)
`openColorPopover(anchor, current, allowNone, onPick)` builds and shows a popover:
- optional `No Fill`/`No Line` button (`data-swatch="none"`) when `allowNone`.
- Theme Colors grid: buttons `data-swatch="<hex>"`, 10 per row × 6 rows.
- Standard Colors row: 10 buttons `data-swatch="<hex>"`.
- `More Colors…` button → triggers the native input's OS picker (`nativeInput.click()`).
- Closes on pick, outside pointerdown, or Escape. Only one popover open at a time.
- The document-level outside-click/Escape listeners are attached on open and
  removed on close (and on panel rebuild / app.destroy) — no leaks.

### 3. `colorRow` in `src/ui/properties.ts` (modified)
- Keep the native `<input type="color" data-prop=prop>` and its `input`/`change`
  listeners unchanged.
- Wrap chip + caret in a `.color-control` container.
- Add caret button `data-color-trigger="{prop}"` opening the popover with
  `allowNone = prop !== 'fontColor'`.
- `applyColor(value)`: `app.restyle(make(value)); app.commitStyle();` then sync the
  native chip display via `toHex(value)`. Used by every swatch pick (including
  `'none'`, which the native input can't represent — hence the direct restyle path
  rather than dispatching on the native input).

## Data flow

```
caret click ─► openColorPopover(...)
swatch click ─► applyColor(hex|'none') ─► app.restyle(make(v)) + app.commitStyle()
                                        └► sync native chip value, close popover
"More Colors…" ─► nativeInput.click() ─► (existing input/change path unchanged)
```

## Styling (`src/style.css`)
`.color-control` (inline flex: chip + caret), `.color-caret`, `.color-popover`
(absolute, above other UI, light card), `.swatch-grid` (CSS grid, 10 cols),
`.swatch` (small square, hover ring, `none` shows a diagonal red slash), section
labels `.swatch-heading`. Keep within the 200px panel width; popover may overflow
the panel horizontally (absolute-positioned).

## Testing (TDD — all additive)

`tests/ui/palette.test.ts`:
- `THEME_BASE` length 10; `STANDARD_COLORS` length 10.
- `THEME_GRID` is 6 rows × 10 cols; row 0 equals `THEME_BASE` (lowercased).
- `tint('#ffffff', x) === '#ffffff'`; `shade('#000000', x) === '#000000'`.
- `tint('#000000', 0.5) === '#808080'`; `shade('#ffffff', 0.5) === '#808080'`.
- `themeColumn(base)` length 6, cell 0 === base.

`tests/ui/properties.test.ts` (added cases):
- a `[data-color-trigger="fill"]` caret exists for a shape's Fill row.
- clicking the caret opens a `.color-popover`; clicking a `[data-swatch]` applies
  the color to every selected shape and calls `commitStyle`.
- Standard-color swatch applies its hex.
- `No Fill` (`data-swatch="none"`) sets `fill:'none'`; the text-color popover has no
  `data-swatch="none"`.
- Existing native-input tests (value reflect, edit-restyles, focus-through-update)
  remain unchanged and passing.

## Success criteria
- All 484 existing specs still pass; new specs pass.
- `npm run build` (tsc) and `npm test` green.
- Manual: caret opens PPT-like grid; theme/standard/none/more-colors all restyle
  the selection and persist; no console errors.
