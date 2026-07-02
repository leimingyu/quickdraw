# QuickDraw — Typography Controls Design Spec

**Date:** 2026-07-02
**Status:** Implemented
**Issue:** [#18](https://github.com/leimingyu/quickdraw/issues/18) — *Typography controls — add
font family (a short curated list), bold/italic, and text alignment.*
**Builds on:** the properties panel (Phase 2b), which shipped font **size** + **color** and
explicitly deferred font family and text alignment to "Future".

---

## 1. Overview

Extend a shape's text styling from *size + color* to full typography: a **curated font
family** dropdown, **bold** and **italic** toggles, and **left / center / right
alignment**. Controls live in the existing right-side properties panel and route through
the same `App.restyle` → `App.commitStyle` path, so every edit is one undo entry and
autosaves with the workspace. Text is drawn as a single SVG `<text>` element (the one
`textEl` code path shared by live render **and** SVG/PNG export), so the change touches
exactly one render function.

### Goals
- Add `fontFamily`, `bold`, `italic`, `textAlign` to a shape's style.
- Panel controls: a font-family `<select>` (curated list), Bold/Italic toggle buttons,
  and a Left/Center/Right segmented alignment control — shown only for shapes.
- Live edits with one history entry per gesture; multi-selection applies to all shapes.

### Non-goals (YAGNI)
Per-run rich text (mixed styles within one label), font size presets, line-height /
letter-spacing, vertical alignment, underline/strikethrough, custom/uploaded fonts,
reflecting the style inside the inline text editor while typing (the editor is a plain
`<input>`, as it already is for size/color).

---

## 2. Model additions

```ts
// model/types.ts
export type TextAlign = 'left' | 'center' | 'right';

interface ShapeStyle {
  /* …fill, stroke, strokeWidth, fontSize, fontColor… */
  fontFamily?: string;   // NEW — CSS font stack; absent = default sans-serif
  bold?: boolean;        // NEW
  italic?: boolean;      // NEW
  textAlign?: TextAlign; // NEW — absent = 'center'
  dashed?: boolean;
}
```

- All four are **optional**, so documents (and test fixtures) predating this change still
  typecheck and load; the renderer defaults them (`textAlign ?? 'center'`,
  `fontFamily ?? DEFAULT_FONT_FAMILY`, falsy `bold`/`italic`). **No migration / version bump.**
- `DEFAULT_STYLE` gains `fontFamily: DEFAULT_FONT_FAMILY, bold: false, italic: false,
  textAlign: 'center'` so new shapes carry explicit values.
- **Curated fonts** (`document.ts`): `FONT_STACKS = { sans, serif, mono, cursive }`. Each
  stack ends in a **generic family** (`sans-serif`/`serif`/`monospace`/`cursive`) so it
  resolves without web fonts — important because PNG export rasterizes the SVG and only
  system/generic fonts are guaranteed there. `DEFAULT_FONT_FAMILY = FONT_STACKS.sans`.

---

## 3. Style-patch routing

`StylePatch = Partial<ShapeStyle & ConnectorStyle>` already covers the new keys. The four
new keys are added to `SHAPE_ONLY` in `restyleNodes` so they apply only to shapes and are
safe no-ops on connectors in a mixed selection.

---

## 4. Rendering (`render/shapes.ts` — `textEl`)

The single `textEl(s)` function (used by on-screen render **and** `exportSvg`) now emits:

| Property | SVG output |
|---|---|
| `textAlign` | `text-anchor` = `start`/`middle`/`end`, and `x` = left inset / center / right inset (6px pad) |
| `fontFamily` | `font-family` = `style.fontFamily ?? DEFAULT_FONT_FAMILY` |
| `bold` | `font-weight="bold"` (attribute omitted when false) |
| `italic` | `font-style="italic"` (attribute omitted when false) |

Omitting the attribute (rather than writing `"normal"`) keeps exported SVG clean and makes
"is it bold?" a simple attribute-presence check in tests.

---

## 5. Panel controls (`ui/properties.ts`)

Added inside the existing `if (firstShape)` block, after Font size + Text color:
- **Family** — `selectRow(...)`: a `<select>` built from `FONT_OPTIONS`
  (Sans/Serif/Mono/Cursive); `change` → `restyle` + `commitStyle` (one discrete gesture).
- **Bold**, **Italic** — reuse `toggleRow` (On/Off buttons, mutate → commit), the same
  pattern as the Dashed toggle.
- **Align** — `alignRow(...)`: a `.seg` segmented Left/Center/Right control, mirroring the
  connector `routingRow` pattern (button click → `restyle({ textAlign })` + `commitStyle`).

All controls read their initial value off the **primary selected shape** and reflect old
documents' missing fields via the same `?? default` fallbacks used at the render site.

---

## 6. Testing (Vitest / jsdom)

- **`restyleNodes`** — the four typography keys route to shapes only; a connector in the
  same selection is untouched (`'fontFamily' in c.style === false`).
- **Renderer** — a shape with `fontFamily`/`bold`/`italic`/`textAlign:'left'` emits the
  matching `font-family`/`font-weight`/`font-style`/`text-anchor='start'`; defaults render
  centered with a font-family and no weight/style attributes; right-align anchors at `end`.
- **Panel** — the four controls appear for a shape and not for a connector; toggling Bold
  and choosing a font family/alignment mutate every selected shape and call `commitStyle`.

Verified additionally in a real browser against the built single-file `quickdraw.html`:
drawing a text box and toggling the controls updates the live SVG `<text>` (serif, bold,
italic, right-aligned) with no console errors.

---

## 7. Module layout

| File | Change |
|------|--------|
| `model/types.ts` | `TextAlign`; `fontFamily?`/`bold?`/`italic?`/`textAlign?` on `ShapeStyle`. |
| `model/document.ts` | `FONT_STACKS`, `DEFAULT_FONT_FAMILY`; `DEFAULT_STYLE` defaults; `SHAPE_ONLY` keys. |
| `render/shapes.ts` | `textEl` emits family/weight/style + align-driven anchor & `x`. |
| `ui/properties.ts` | `FONT_OPTIONS`; `selectRow`, `alignRow`; Family/Bold/Italic/Align rows. |
| `style.css` | one `.props select` rule so the dropdown fits the 200px dock. |

## 8. Future (not now)
Rich text / per-run styles, underline/strikethrough, vertical alignment, line-height &
letter-spacing, size presets, custom fonts, styled inline editor.
