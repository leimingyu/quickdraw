# QuickDraw — Add Text in Any Tool Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pre-implementation
**Topic:** Add/edit a shape's text without first switching to the Select tool —
via type-to-edit (any tool) and double-click (any tool).
**Builds on:** the current `feat/phase1-core-canvas` branch (Phase 1 core +
type-to-edit, drag-to-draw, continuous-draw, grouping, connectors, properties panel).

---

## 1. Overview

Today, adding a label requires the **Select** tool: the inline text editor lives
*inside* `SelectTool` (`openEditor`/`onDoubleClick`/`beginEdit`/`applyText`), so while
a shape tool is active you can't double-click or type to label a shape. This change
makes text editing **tool-agnostic** so you can:

- **Just start typing** (or press **Enter**/**F2**) right after drawing a shape — it's
  auto-selected, so the label editor opens without leaving the shape tool. *(solution 2)*
- **Double-click any shape in any tool** to edit its text. *(solution 3)*

### Goals
- Lift the inline text editor from `SelectTool` to `App.editText(shape, initial?)` so any
  handler can open it, in any tool.
- Type-to-edit works in any tool when exactly one **shape** is selected.
- Double-click a shape edits its text regardless of the active tool.
- A shape tool no longer creates a shape when you press *on an existing shape* (so a
  double-click in shape mode edits, instead of stacking two junk shapes).

### Non-goals (deferred — YAGNI)
- Right-click context menu with "Add text" / other actions (option 4).
- Text tool labelling existing shapes (option 5).
- Editing text on connectors (connectors have no text in this app).

---

## 2. The refactor: `App.editText`

Move the inline editor out of `SelectTool` and onto `App` (it has the renderer, the
active tab's viewport, and `commit()` — everything the editor needs):

```ts
// app.ts
editText(shape: Shape, initial?: string): void
```
Behavior (identical to the current `SelectTool.openEditor` + `applyText`, just relocated):
- Selects the shape (`this.selection = new Set([shape.id])`) and renders.
- Mounts an `<input class="text-editor">` over the shape, positioned from the shape box
  and the active tab's `viewport` (`left = panX + x*zoom`, `top = panY + (y + h/2 - 12)*zoom`,
  `width = w*zoom`), appended to `renderer.svg.parentElement`.
- Seeds `input.value` with `initial` if given (cursor at end), else the shape's existing
  text (select-all).
- An idempotent `commit(write)` closure (the `done` guard): **Enter** / **blur** → write
  `shape.text = input.value` and `App.commit()`; **Escape** → cancel (no write). The input
  is removed on every exit.

---

## 3. Type-to-edit in any tool (solution 2)

In `App.bindKeyboard`, the type-to-edit block is gated on `currentToolName === 'select'`.
Replace that gate so it fires in **any** tool when exactly one node is selected **and it is
a shape**:

```ts
if (this.selection.size === 1) {
  const id = [...this.selection][0];
  const node = this.activeTab.nodes.find((n) => n.id === id);
  if (node && isShape(node)) {
    if (ev.key === 'Enter' || ev.key === 'F2') { ev.preventDefault(); this.editText(node); }
    else if (ev.key.length === 1 && ev.key !== ' ' && !mod && !ev.altKey) {
      ev.preventDefault(); this.editText(node, ev.key);
    }
  }
}
```
The existing INPUT/TEXTAREA guard at the top of `bindKeyboard` still prevents re-triggering
while editing. Space remains excluded (it pans). Connectors (no text) are skipped via
`isShape`.

---

## 4. Double-click any shape in any tool (solution 3)

`App.bindPointerEvents` currently dispatches `dblclick` to `this.current.onDoubleClick?.()`.
Replace that with a **global** handler that edits the shape under the cursor regardless of
tool:

```ts
svg.addEventListener('dblclick', (ev) => {
  const shape = hitTest(this.activeTab.nodes.filter(isShape), this.world(ev));
  if (shape) this.editText(shape);   // editText selects + opens the editor
}, sig);
```
- Topmost shape via the existing `hitTest`. Connectors are not text-editable, so shapes
  only.
- In the **arrow** tool a click only previews-then-cancels a connector (no shape created),
  so double-click-to-edit composes cleanly there with no extra work.

### The enabler — shape tools only create from empty canvas
In a shape tool a *click* creates a shape, so a double-click would spawn two shapes before
the editor opens. Fix: `ShapeTool.onPointerDown` returns early when the press lands on an
existing shape:

```ts
onPointerDown(world: Point): void {
  if (hitTest(this.app.activeTab.nodes.filter(isShape), world)) return; // don't create on an existing shape
  // ...unchanged: record start, add the 0-size preview, etc.
}
```
A shape is then only created from an empty-canvas click or drag; pressing on an existing
shape does nothing, freeing double-click to edit it. **Trade-off (accepted):** you can no
longer *begin* drawing a new shape on top of an existing one — start the drag from an empty
spot instead.

---

## 5. Cleanup

- **`SelectTool`** — remove `onDoubleClick`, `beginEdit`, `openEditor`, and `applyText`
  (all now superseded by `App.editText` and the global handlers). The Select tool keeps
  selection / move / resize / marquee.
- **`Tool` interface** (`tools/types.ts`) — remove the now-unused optional members
  `onDoubleClick?` and `beginEdit?`.
- **`App.bindPointerEvents`** — the `dblclick` listener no longer dispatches to the current
  tool (see §4).

---

## 6. Module layout

| File | Change |
|------|--------|
| `app.ts` | add `editText`; broaden keyboard type-to-edit to any tool (shape selected); global `dblclick` → `editText`; import `hitTest`, `isShape`, `Shape`. |
| `tools/shapeTool.ts` | `onPointerDown` returns early when pressing on an existing shape. |
| `tools/selectTool.ts` | remove `onDoubleClick`/`beginEdit`/`openEditor`/`applyText`. |
| `tools/types.ts` | remove `onDoubleClick?`/`beginEdit?` from `Tool`. |

---

## 7. Error handling
- `editText` no-ops cleanly if the host element is missing.
- The `done` guard keeps Enter/Escape/blur idempotent (no double-commit, Escape never
  writes) — same guarantee as today.
- Double-click on empty canvas (no shape hit) does nothing.
- Pressing on an existing shape in a shape tool leaves the model unchanged (no stray shape).

---

## 8. Testing (Vitest, jsdom)
- `App.editText` — Enter writes `shape.text` and commits once; Escape cancels (no write);
  blur-after-Enter doesn't double-commit (idempotent); `initial` seeds the value.
- Type-to-edit in a shape tool — with a single shape selected and a shape tool active, a
  printable key / Enter opens the editor (`input.text-editor` present, seeded).
- Double-click in a shape tool — dispatching `dblclick` over a shape opens the editor and
  selects the shape; double-click on empty canvas does nothing.
- Shape tool — `onPointerDown` on an existing shape creates no new shape; on empty canvas it
  still creates (existing behavior preserved).
- Regression — select-mode editing still works (double-click / type while in Select); the
  removed `SelectTool` methods are gone and nothing references them.

---

## 9. Decisions (resolved)
- Solutions **2 + 3** (type-to-edit in any tool; double-click in any tool).
- Text editing lifted to **`App.editText`**; `SelectTool`'s text methods and the
  `Tool.onDoubleClick?`/`beginEdit?` members removed.
- Shape tools **create only from empty canvas** (don't start on an existing shape).
- Connectors are not text-editable; type-to-edit only fires for a selected **shape**.

## 10. Future (not now)
Right-click context menu ("Add text", delete, z-order, …); Text tool labelling existing
shapes; multi-line text; text on connectors (edge labels).
