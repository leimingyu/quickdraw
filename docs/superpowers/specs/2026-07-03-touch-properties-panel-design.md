# Touch-friendly properties panel — design

Date: 2026-07-03
Status: design approved (autonomous goal: enlarge the right-side properties panel
for touch-screen laptops without breaking anything)

## Goal

On a touch-screen laptop the right-side properties panel (Line / Width / Dashed /
Fill / Font / Text / Family / Bold / Italic / Align / Rotation / Order, plus the
theme/standard color popover) is hard to use with a finger. Its controls are laid
out for a mouse: `padding: 2px 8px` buttons (~20 px tall), a 38×22 px color chip,
a tiny `3×4 px`-padded caret, `12 px` segmented buttons, and **16 px** color
swatches. Fingers overshoot and mis-tap.

The rest of the app already solves this: an `@media (any-pointer: coarse)` block
grows the tool palette (48 px), menus, and tabs to finger size. That block simply
**does not cover the properties panel or the color popover**. This change extends
the same, proven pattern to them.

## Decisions

- **Mechanism:** CSS-only, additive rules inside the existing
  `@media (any-pointer: coarse)` block. No TypeScript changes, no new DOM, no new
  classes. This is the lowest-risk way to reach every control the panel already
  builds.
- **Trigger:** `any-pointer: coarse` — true on any device with a touchscreen,
  including touch-screen laptops that *also* have a trackpad. This is the same
  query the palette/menu/tab touch sizing already uses, so behavior is consistent
  across the app. Mouse-only desktops are completely unaffected.
- **Target size:** ≥ 40 px tall for every interactive control (Apple 44 pt / Material
  48 dp guidance; the palette already uses 48 px). Inputs use `font-size: 16px` to
  stop mobile Safari's focus-zoom.

## What changes (all in `@media (any-pointer: coarse)` in `src/style.css`)

1. **Panel:** `.props` width `200px → 248px`, `gap`/`padding` `8px → 12px`. The
   canvas is a flexing SVG that reads its live bounding rect on demand, so a wider
   panel just gives it a narrower box — no coordinate or layout breakage.
2. **Rows:** `.props-row` gets `min-height: 44px` and `flex-wrap: wrap`, so a row
   whose enlarged control cannot sit beside its label wraps cleanly instead of
   overflowing (matters for the 3-button Align / Type segmented rows).
3. **Buttons:** `.props button` and `.seg button` → `min-height: 40px`,
   `padding: 8px 14px`, `font-size: 15px` (On/Off toggles, Reset, Front/Back,
   text-align, routing). `.props-arrange .seg button` (align/distribute icons) →
   `min 44×44 px`.
4. **Inputs:** `.props input[type="number"]` → 72 px wide, 40 px tall, 16 px font;
   `.props select` → 40 px tall, 15 px font, wider max.
5. **Color control:** chip `52×40 px`; `.color-caret` `min 40×40 px` so the "open
   theme colors" caret is a real tap target.
6. **Color popover:** swatches `16 → 30 px` **squares** (grid stays 10 columns;
   popover is `position: fixed` and already clamps into the viewport). An explicit
   `min-height` keeps them square, since the general `.props button` touch rule also
   matches them (the popover is a DOM descendant of the panel). `.color-none` /
   `.color-more` rows get `10–12 px` padding and `15 px` text.

## Non-breakage

- Pure CSS additions gated behind an existing media query. Mouse/fine-pointer
  rendering is byte-for-byte unchanged.
- No DOM structure, class names, `data-*` hooks, or handlers change, so every
  existing `properties.test.ts` / `properties-integration.test.ts` assertion
  (which query by `data-prop` / `data-action` / `.seg`) keeps passing.
- `tsc` and the full Vitest suite must stay green.
- `quickdraw.html` single-file build regenerated at the end (tracked artifact).

## Testing

jsdom does not evaluate `@media` or compute layout, so pixel sizing is not
unit-testable there; the existing behavior tests already guard the DOM contract
this change must not break. Verification is therefore:

1. `npm run build` (tsc typecheck) + `npm test` — full suite green (no breakage).
2. Browser check served over HTTP: select a shape, confirm the panel renders and
   is usable; then confirm under coarse-pointer sizing every control is ≥ 40 px and
   the color popover swatches are finger-sized, with the panel still fitting and
   the canvas unaffected.

## Success criteria

- All existing tests pass; `npm run build` + `npm test` green.
- Under a coarse pointer, every properties control and every color swatch is a
  comfortable finger target; mouse desktop is visually unchanged.
- Change is CSS-only, minimal, and merged to `main` via PR.
