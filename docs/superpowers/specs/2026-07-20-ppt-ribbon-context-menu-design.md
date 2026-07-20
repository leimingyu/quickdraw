# PowerPoint-style ribbon + right-click context menu — design

**Date:** 2026-07-20
**Status:** approved, ready for implementation plan

## Goal

Make QuickDraw feel familiar to a PowerPoint user without imitating PowerPoint's
scale. Two changes:

1. Replace the left vertical tool palette with a single always-visible **ribbon
   row** that uses PPT vocabulary and layout (Insert a shape from a Shapes
   gallery; Arrange with Group / Order / Align).
2. Add a **right-click context menu** — the reflex a PPT user has for Ungroup,
   Cut/Copy, Bring to front, Delete — which does nothing today (the browser's
   native menu appears instead).

Non-goal: a full ribbon with a tab strip (Home / Insert / Format …). QuickDraw
has ~40 commands, not ~800; a tab band would cost ~100px of permanent height and
read as sparse imitation. We take the *vocabulary and locations* of PowerPoint,
not its chrome.

## Design decisions (from brainstorming)

- **Chrome level:** ribbon-lite — one row, ~44px, no tab strip. Keep the existing
  File / Edit / View dropdown menubar above it unchanged.
- **Left palette:** retired. All 14 tools move into the ribbon's Insert group.
  PowerPoint has no left tool strip; removing it reclaims ~52px of horizontal
  canvas and gives one place to find a tool. Accepted cost: switching shape is
  now two clicks (open gallery → pick) instead of one; drawing *more of the
  last-used* shape stays one click via the split-button face.
- **Context menu:** three contexts (empty canvas / single shape / multi-select),
  not one greyed-out list. Group/Ungroup appear only when actually possible — no
  dead entries.
- **Ribbon groups:** Edit (undo/redo) + Insert (shapes/text/arrow) + Arrange
  (group/ungroup/order/align). **No format controls** — fill / stroke /
  typography stay solely in the properties panel. Nothing appears in two places.

## Division of labor

| Surface | Owns |
|---|---|
| Ribbon row | Insert (shapes, text, connectors) + Arrange (group, order, align) |
| Properties panel | Fill, stroke, typography (unchanged — PPT's Format pane) |
| Right-click menu | Fast path to both, context-sensitive |
| File/Edit/View menubar | File ops, edit ops, view toggles (unchanged) |

## Architecture & file boundaries

Three UI modules, each one job. Nothing in `src/model`, `src/render`,
`src/tools`, `src/io`, or `src/history` changes. `src/app.ts` gains **no new
commands** — every action already exists.

| File | Status | Job |
|---|---|---|
| `src/ui/flyout.ts` | new (~70 ln) | Generic anchored popup: open near an element or at xy, close on outside-click / Escape / pick, flip to stay on-screen. Pure DOM, imports nothing from the app, independently testable. |
| `src/ui/ribbon.ts` | new (~140 ln) | The one-row toolbar: Edit / Insert / Arrange groups. Owns the row, delegates galleries/dropdowns to `flyout.ts`. Absorbs the `ITEMS` and `ACTIONS` data from the old palette verbatim. |
| `src/ui/contextMenu.ts` | new (~120 ln) | Builds the three menus from selection state, positions at the cursor via `flyout.ts`. |
| `src/ui/toolPalette.ts` | deleted | `ITEMS` (14 tools + icons) and `ACTIONS` (undo/redo) move into `ribbon.ts` unchanged; only the container changes. |
| `src/ui/menubar.ts` | untouched | File / Edit / View dropdowns stay as-is. |
| `src/ui/properties.ts` | untouched | Sole owner of fill / stroke / typography. |
| `src/main.ts` | edited | Drop `paletteHost`; mount ribbon into `toolbarHost`; mount context menu on `canvasHost`. |
| `src/style.css` | edited | `.ribbon` row styles; remove `.toolpalette` column; widen canvas. |

**Dependency direction stays flat:** `ribbon.ts` and `contextMenu.ts` both import
`flyout.ts` and call `App` methods. Neither imports the other. `flyout.ts`
depends on nothing app-specific.

**Preserved contract:** every shape button keeps its `data-tool` /
`data-routing` / `data-arrow` attributes, even inside the gallery.
`tests/ui/toolPalette.test.ts` and browser verification (which has no `app`
global) select on those. Keeping the attribute contract means that test is
*renamed and re-pointed*, not rewritten.

## Ribbon row (`ribbon.ts`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ↶ ↷ │ ⬚ Shapes▾   🔤 Text   ↗ Arrow▾ │ ⧉Group ⧈Ungroup ⬚Order▾ ≡Align▾    │
└────────────────────────────────────────────────────────────────────────────┘
  Edit  │             Insert             │              Arrange
```

- **Edit group:** Undo / Redo — the two `ACTIONS` from today's palette, same
  icons, same `can()`-based disabling. Relocated only.
- **Insert group:**
  - `Shapes ▾` — split button. Face = last-used shape (starts Rectangle); click
    the face to re-select that tool, click `▾` to open a gallery flyout of the 6
    shapes + 4 brace/bracket. Mirrors the boxed Shapes button in the reference.
  - `Text` — plain button (single tool, no gallery).
  - `Arrow ▾` — split button over the 4 connector variants (line, straight
    arrow, elbow, curved). Face = last-used connector.
- **Arrange group** — command buttons over existing methods:
  - `Group` → `app.group()`, `Ungroup` → `app.ungroup()`
  - `Order ▾` → flyout: Bring to front (`bringToFront`) / Send to back (`sendToBack`)
  - `Align ▾` → flyout: 6 align + 2 distribute ops (`align` / `distribute`)

**State sync:** returns `{ syncActive }` (same shape the palette returned, so
`main.ts` barely changes). On each render it highlights the active tool (compare
`data-tool`/`routing`/`arrow` against `app.currentToolName` /
`connectorRouting` / `connectorArrow` — logic lifted verbatim), disables
undo/redo via `can()`, and greys Arrange buttons when the selection can't support
them (Group needs 2+, Ungroup needs a group, Order/Align need a selection).

## Right-click context menu (`contextMenu.ts`)

**Wiring:** one `contextmenu` listener on `canvasHost`. It `preventDefault()`s the
native menu, reads selection state, builds the right menu, and opens it at the
cursor via `flyout.ts`.

**Right-click selects first:** right-clicking an *unselected* shape selects it
before building the single-shape menu (PPT acts on what's under the cursor). This
reuses the hit-test `selectTool` already performs — the exact entry point is
confirmed during planning, not reinvented. Right-clicking empty space shows the
canvas menu without altering selection.

**The three menus** (every item maps to an existing `App` method):

| Empty canvas | Single shape | Multi-selection |
|---|---|---|
| Paste `⌘V` | Cut / Copy / Duplicate | Cut / Copy / Duplicate |
| Select all `⌘A` | Edit text* | Group `⌘G` |
| Show grid ✓ | Bring to front / Send to back | Ungroup `⇧⌘G`† |
| Snap to grid ✓ | Delete `⌫` | Align ▸ (submenu) |
| | | Bring to front / Send to back |
| | | Delete `⌫` |

\* *Edit text* appears only for text-bearing shapes (not connectors) —
`app.editText(shape)`.
† *Ungroup* appears only when the selection contains a group; otherwise omitted,
not greyed.

**Positioning & dismissal** (in `flyout.ts`, shared with the ribbon): open at
cursor xy; flip left/up on viewport overflow; close on outside-click, Escape, or
any pick; `Align ▸` opens its submenu to the side. Items render as `<button>`s
with `⌘`/`Ctrl` hints via the existing `formatShortcut` helper — visually
consistent with the menubar dropdowns.

**Reused vs. new:** every action is an existing `App` method. This surface writes
zero new commands; the only new logic is menu assembly + positioning.

## Testing

Vitest specs under jsdom, mirroring each new file:

- `tests/ui/flyout.test.ts` — opens near anchor / at xy; closes on outside-click,
  Escape, and pick; flips when it would overflow.
- `tests/ui/ribbon.test.ts` — renamed/re-pointed from `toolPalette.test.ts`:
  Shapes gallery lists all 10 shape tools with correct `data-tool`; Arrow gallery
  carries `data-routing`/`data-arrow`; clicking a tool sets it; `syncActive`
  highlights the active tool and disables undo/redo/arrange appropriately.
- `tests/ui/contextMenu.test.ts` — the correct menu is built for each selection
  state; Ungroup present only with a group; Edit text absent for connectors; each
  item invokes the expected `App` method.

`npm run build` (typecheck) and `npm test` must pass before commit. Work on
`fix/ppt-ribbon-context-menu`, open a PR — never commit to `main`.

## Explicitly out of scope

- Tab strip / multi-tab ribbon (Home / Insert / Format …).
- Format controls (fill / stroke / font) in the ribbon — they stay in the
  properties panel.
- A connector-specific context menu (routing / arrowhead / reverse) — deferred;
  the three-context design leaves room to add it later.
- Any change to the document model, renderer, tools, or history.
