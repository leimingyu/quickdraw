# Undo / Redo buttons in the tool palette — design

Date: 2026-07-03
Status: design approved (placement = left palette top; visibility = all devices)

## Goal

Give touch-screen laptops a one-tap Undo / Redo. Today undo/redo are reachable
only via keyboard (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) and the Edit menu (two taps).
Undo is the most-used editing command, so a finger user pays the highest cost on
the most frequent action. Add always-visible `↶` / `↷` buttons.

## Decisions (confirmed with user)

- **Placement:** top of the existing left tool palette, above the shape/connector
  tools, separated by a divider.
- **Visibility:** shown on **all devices** (not gated to coarse pointers). The
  existing `@media (any-pointer: coarse)` rule already enlarges `.tool-btn` to
  48px, so touch devices get finger-sized targets automatically.

## Why this placement

Reuses everything the recent touch work already built: `.tool-btn` styling, the
coarse-pointer 48px sizing, and `palette.syncActive()` — which already runs on
every `onRender`, so button state stays correct after any edit / undo / redo / tab
switch with no new wiring. No new top-bar or floating surface; lowest risk.

## Behavior

- Tap `↶` → `app.undo()`; tap `↷` → `app.redo()`.
- **Disabled + greyed when nothing to undo/redo.** `History` already exposes
  `canUndo()` / `canRedo()`. A disabled `<button disabled>` ignores clicks natively,
  so no-op taps are impossible. State is refreshed inside the palette's existing
  per-render sync.
- Keyboard shortcuts and the Edit menu are unchanged and keep working.

## Components

### `src/app.ts`
Add two one-line public pass-throughs (history is a private field today):
```ts
canUndo(): boolean { return this.history.canUndo(); }
canRedo(): boolean { return this.history.canRedo(); }
```

### `src/ui/toolPalette.ts`
- Prepend two action buttons to the `.toolpalette` bar, then a `.tool-divider`,
  then the existing tools (unchanged).
- Buttons carry `data-action="undo"` / `data-action="redo"`, reuse `.tool-btn`,
  and use inline curved-arrow SVG icons.
- `syncActive()` gains responsibility for the buttons' enabled state:
  `undoBtn.disabled = !app.canUndo(); redoBtn.disabled = !app.canRedo();`
  (renamed conceptually to "sync palette state"; the exported name `syncActive`
  stays so `main.ts` wiring is untouched).
- Clicks call `app.undo()` / `app.redo()`.

### `src/style.css`
- `.tool-divider` — a short horizontal rule (e.g. width 24px, 1px, `#ddd`) that
  works inside the `align-items: center` column.
- `.tool-btn:disabled` — `opacity: .4; cursor: default;` and no hover highlight.

### `src/main.ts`
No change — `app.onRender = () => { …; palette.syncActive(); }` already fires the
sync each render.

## Data flow

```
tap ↶  ─► app.undo() ─► history.undo() ─► render() ─► onRender ─► syncActive()
                                                        └► undo/redo disabled recomputed
```

## Non-breakage

- Tool-selection behavior and every `data-tool` button are untouched; existing
  `toolPalette` tests keep passing.
- Only additions: two buttons, a divider, two `App` methods, two CSS rules.
- `quickdraw.html` single-file build regenerated at the end (tracked artifact).

## Testing (TDD, additive)

`tests/ui/toolPalette.test.ts` (new or extended):
- palette renders `[data-action="undo"]` and `[data-action="redo"]`.
- on a fresh document both are `disabled` (nothing to undo/redo).
- after a committed change, undo is enabled; clicking it calls `app.undo()` and
  the change reverts; redo then becomes enabled.
- clicking redo calls `app.redo()`.
- existing tool-selection assertions still pass.

`tests/app.*` (if needed): `canUndo()/canRedo()` reflect history state.

## Success criteria

- All existing tests pass; new tests pass; `npm run build` (tsc) + `npm test` green.
- Manual browser check: buttons appear atop the palette, disabled on load, enable
  after drawing, undo/redo work by tap, and are finger-sized under coarse pointer.
