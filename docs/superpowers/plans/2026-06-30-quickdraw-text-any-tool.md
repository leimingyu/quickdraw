# QuickDraw — Edit Text in Any Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add/edit a shape's text without switching to the Select tool — by typing right after drawing (any tool) or double-clicking any shape (any tool).

**Architecture:** Lift the inline text editor from `SelectTool` onto `App.editText(shape, initial?)` so it's tool-agnostic. Broaden the keyboard type-to-edit to fire in any tool for a selected shape, and make `App` handle `dblclick` globally (hit-test → edit). Shape tools stop creating a shape when you press on an existing one, so a double-click can edit it.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom), SVG. No new dependencies.

## Global Constraints

- Strict TypeScript; all source under `src/`, tests mirror under `tests/`.
- The model is the single source of truth; text edits commit through `App.commit()`.
- Text editing lives on `App.editText(shape, initial?)` — not on any tool. The editor's
  exit is idempotent (a `done` guard): Enter/blur write, Escape cancels, never double-commit.
- Type-to-edit fires in any tool only when exactly one **shape** is selected (connectors have
  no text). Double-click edits the topmost **shape** under the cursor, in any tool.
- Shape tools create a shape only from empty canvas — `ShapeTool.onPointerDown` returns early
  when the press lands on an existing shape.
- Keep the build green and all tests passing at every task boundary.

---

## File Structure

| File | Change | Task |
|------|--------|------|
| `src/app.ts` | add `editText`; broaden keyboard type-to-edit; global `dblclick`; imports | 1, 2 |
| `src/tools/selectTool.ts` | remove `onDoubleClick`/`beginEdit`/`openEditor`/`applyText` | 2 |
| `src/tools/types.ts` | remove `onDoubleClick?`/`beginEdit?` from `Tool` | 2 |
| `src/tools/shapeTool.ts` | `onPointerDown` early-returns on an existing shape | 3 |
| `tests/app.editText.test.ts` | **New** | 1 |
| `tests/app.textGestures.test.ts` | **New** | 2 |
| `tests/tools/selectTool.text.test.ts` | **Deleted** (superseded) | 2 |
| `tests/tools/shapeTool.test.ts` | add the no-create-on-existing test | 3 |

---

## Task 1: `App.editText` (the extracted inline editor)

**Files:**
- Modify: `src/app.ts`
- Test: `tests/app.editText.test.ts`

**Interfaces:**
- Consumes: `Shape` from `model/types`; `App`'s `renderer`, `activeTab`, `selection`, `render`, `commit`.
- Produces: `App.editText(shape: Shape, initial?: string): void` — opens the inline editor
  over `shape`, selects it, seeds with `initial` (else existing text), commits on Enter/blur,
  cancels on Escape (idempotent).

- [ ] **Step 1: Write the failing test `tests/app.editText.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

const editor = () => document.querySelector('input.text-editor') as HTMLInputElement | null;

describe('App.editText', () => {
  it('opens an editor seeded with the initial character and selects the shape', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.editText(s, 'H');
    expect(editor()?.value).toBe('H');
    expect(app.selection.has(s.id)).toBe(true);
  });

  it('opens seeded with existing text when no initial is given', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    addNode(app.activeTab, s);
    app.editText(s);
    expect(editor()?.value).toBe('Hi');
  });

  it('Enter writes the text and commits exactly once, even if a blur follows', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    const spy = vi.spyOn(app, 'commit');
    app.editText(s);
    const input = editor()!;
    input.value = 'Label';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(s.text).toBe('Label');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(editor()).toBeNull();
  });

  it('Escape cancels without writing, even if a blur follows', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'orig';
    addNode(app.activeTab, s);
    app.editText(s);
    const input = editor()!;
    input.value = 'changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(s.text).toBe('orig');
    expect(editor()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.editText.test.ts`
Expected: FAIL — `app.editText` is not a function.

- [ ] **Step 3: Add `Shape` to the types import in `src/app.ts`**

Change:
```ts
import type { Tab, Workspace } from './model/types';
```
to:
```ts
import type { Shape, Tab, Workspace } from './model/types';
```

- [ ] **Step 4: Add the `editText` method to `App` (in `src/app.ts`)**

Add this method (e.g. right after `commitStyle()`):

```ts
  /** Open the inline text editor over a shape (any tool). Seeds with `initial` if given,
   *  else the shape's existing text. Enter/blur commit, Escape cancels; idempotent. */
  editText(shape: Shape, initial?: string): void {
    this.selection = new Set([shape.id]);
    this.render();
    const host = this.renderer.svg.parentElement;
    if (!host) return;
    const input = document.createElement('input');
    input.className = 'text-editor';
    input.value = initial !== undefined ? initial : shape.text ?? '';
    const vp = this.activeTab.viewport;
    input.style.position = 'absolute';
    input.style.left = `${vp.panX + shape.x * vp.zoom}px`;
    input.style.top = `${vp.panY + (shape.y + shape.h / 2 - 12) * vp.zoom}px`;
    input.style.width = `${shape.w * vp.zoom}px`;
    host.style.position = 'relative';
    host.appendChild(input);
    input.focus();
    if (initial !== undefined) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } else {
      input.select();
    }
    let done = false;
    const commit = (write: boolean) => {
      if (done) return;
      done = true;
      if (write) {
        shape.text = input.value;
        this.commit();
      }
      input.remove();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      else if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/app.editText.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass (the old `SelectTool` editor still exists in parallel; no conflict), build clean.

- [ ] **Step 7: Commit**

```bash
git add src/app.ts tests/app.editText.test.ts
git commit -m "feat: App.editText — tool-agnostic inline text editor"
```

---

## Task 2: Rewire keyboard + double-click to `editText`; remove Select-tool text code

**Files:**
- Modify: `src/app.ts`, `src/tools/selectTool.ts`, `src/tools/types.ts`
- Create: `tests/app.textGestures.test.ts`
- Delete: `tests/tools/selectTool.text.test.ts`

**Interfaces:**
- Consumes: `App.editText` (Task 1); `hitTest` from `model/geometry`; `isShape` from `model/document`.
- Produces: keyboard type-to-edit fires in any tool for a selected shape; a global `dblclick`
  handler edits the topmost shape under the cursor; `SelectTool` no longer owns text editing;
  `Tool` no longer declares `onDoubleClick?`/`beginEdit?`.

- [ ] **Step 1: Write the failing test `tests/app.textGestures.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { SelectTool } from '../src/tools/selectTool';
import { ShapeTool } from '../src/tools/shapeTool';
import { addNode, createShape, createConnector } from '../src/model/document';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  app.registerTool('select', new SelectTool(app));
  app.registerTool('rect', new ShapeTool(app, 'rect'));
});
afterEach(() => app.destroy());

const editor = () => document.querySelector('input.text-editor') as HTMLInputElement | null;

describe('editing text in any tool', () => {
  it('type-to-edit opens the editor while a shape tool is active', () => {
    app.setTool('rect');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    expect(editor()?.value).toBe('H');
  });

  it('double-click opens the editor in a shape tool and selects the shape', () => {
    app.setTool('rect');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 50, clientY: 50, bubbles: true }));
    expect(editor()).toBeTruthy();
    expect(app.selection.has(s.id)).toBe(true);
  });

  it('double-click still works in the select tool', () => {
    app.setTool('select');
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 50, clientY: 50, bubbles: true }));
    expect(editor()).toBeTruthy();
  });

  it('double-click on empty canvas opens nothing', () => {
    app.setTool('select');
    addNode(app.activeTab, createShape('rect', 0, 0, 100, 100));
    app.render();
    app.renderer.svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 400, clientY: 400, bubbles: true }));
    expect(editor()).toBeNull();
  });

  it('type-to-edit does not fire when a connector is selected', () => {
    app.setTool('select');
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([c.id]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true }));
    expect(editor()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.textGestures.test.ts`
Expected: FAIL — type-to-edit is gated to the select tool, and double-click is dispatched to
the tool (not global), so the shape-tool cases don't open the editor.

- [ ] **Step 3: Add the imports to `src/app.ts`**

Add `hitTest` to the geometry import and `isShape` to the document import:

```ts
import { createWorkspace, getActiveTab, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors, restyleNodes, reorderSelection, isShape, type StylePatch } from './model/document';
import { zoomAt, hitTest } from './model/geometry';
```

- [ ] **Step 4: Broaden the keyboard type-to-edit in `src/app.ts`**

In `bindKeyboard`, replace the existing type-to-edit block (the one guarded by
`this.currentToolName === 'select' && this.selection.size === 1`) with this tool-agnostic,
shape-only version:

```ts
      // Type-to-edit (any tool): one shape selected → Enter/F2 edits it, a printable key
      // starts a fresh label. Space is excluded (it pans); connectors have no text.
      if (this.selection.size === 1) {
        const id = [...this.selection][0];
        const node = this.activeTab.nodes.find((n) => n.id === id);
        if (node && isShape(node)) {
          if (ev.key === 'Enter' || ev.key === 'F2') {
            ev.preventDefault();
            this.editText(node);
          } else if (ev.key.length === 1 && ev.key !== ' ' && !mod && !ev.altKey) {
            ev.preventDefault();
            this.editText(node, ev.key);
          }
        }
      }
```

- [ ] **Step 5: Make `dblclick` global in `src/app.ts`**

In `bindPointerEvents`, replace the `dblclick` listener:

```ts
    svg.addEventListener('dblclick', (ev) => this.current.onDoubleClick?.(this.world(ev), ev), sig);
```
with:
```ts
    svg.addEventListener('dblclick', (ev) => {
      const shape = hitTest(this.activeTab.nodes.filter(isShape), this.world(ev));
      if (shape) this.editText(shape);
    }, sig);
```

- [ ] **Step 6: Remove the text methods from `src/tools/selectTool.ts`**

Delete these four members from `SelectTool` (they are superseded by `App.editText`):
`applyText`, `onDoubleClick`, `beginEdit`, and the private `openEditor`. Leave the rest of the
class (selection / move / resize / marquee / `hitNode`) unchanged. Confirm no remaining
method references them (they were only used by each other).

- [ ] **Step 7: Remove the unused members from the `Tool` interface (`src/tools/types.ts`)**

Delete these two lines from the `Tool` interface (no tool implements them anymore):
```ts
  onDoubleClick?(world: Point, ev: MouseEvent): void;
  /** Begin editing the current single selection's text, optionally seeded with a first character. */
  beginEdit?(initial?: string): void;
```

- [ ] **Step 8: Delete the superseded test file**

```bash
git rm tests/tools/selectTool.text.test.ts
```

- [ ] **Step 9: Run the new test, full suite, and build**

Run: `npx vitest run tests/app.textGestures.test.ts && npm test && npm run build`
Expected: the new gesture tests pass (5), the full suite is green (the deleted file's coverage
is replaced by `app.editText.test.ts` + `app.textGestures.test.ts`), and `tsc` is clean with
no references to the removed methods.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: edit text in any tool (type-to-edit + global double-click); drop SelectTool editor"
```

---

## Task 3: Shape tools create only from empty canvas

**Files:**
- Modify: `src/tools/shapeTool.ts`
- Test: `tests/tools/shapeTool.test.ts`

**Interfaces:**
- Consumes: `hitTest` from `model/geometry`; `isShape` from `model/document`.
- Produces: `ShapeTool.onPointerDown` no-ops (creates nothing) when the press lands on an
  existing shape.

- [ ] **Step 1: Write the failing test (add to `tests/tools/shapeTool.test.ts`)**

Add this test inside the existing `describe('ShapeTool', ...)` block (it uses the file's
existing `makeTool` and `drag` helpers):

```ts
  it('does not create a shape when pressing on an existing shape', () => {
    const tool = makeTool('rect');
    drag(tool, { x: 0, y: 0 }, { x: 100, y: 100 }); // shape A covers (0,0)-(100,100)
    expect(app.activeTab.nodes).toHaveLength(1);
    tool.onPointerDown({ x: 50, y: 50 }); // press inside A
    tool.onPointerUp({ x: 50, y: 50 });
    expect(app.activeTab.nodes).toHaveLength(1); // no second shape created
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tools/shapeTool.test.ts`
Expected: FAIL — a second shape is created (length 2), because `onPointerDown` always starts a shape.

- [ ] **Step 3: Add the guard in `src/tools/shapeTool.ts`**

Update the imports to add `hitTest` and `isShape`:

```ts
import { addNode, createShape, isShape } from '../model/document';
import { hitTest, type Box, type Point } from '../model/geometry';
```

At the very top of `onPointerDown`, return early when the press lands on an existing shape:

```ts
  onPointerDown(world: Point): void {
    if (hitTest(this.app.activeTab.nodes.filter(isShape), world)) return; // don't create on an existing shape
    this.start = world;
    // ...unchanged: create the 0-size preview shape, addNode, clear selection, render...
  }
```

(Leave the rest of `onPointerDown`, and `onPointerMove`/`onPointerUp`, exactly as they are —
`start`/`shape` stay null after an early return, so move/up are no-ops for that gesture.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/tools/shapeTool.test.ts`
Expected: PASS (all shapeTool tests, including the new one; existing tests draw on empty spots so are unaffected).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 6: Commit**

```bash
git add src/tools/shapeTool.ts tests/tools/shapeTool.test.ts
git commit -m "feat: shape tools create only from empty canvas (press on a shape = no new shape)"
```

---

## Done — Definition of Done
- After drawing a shape (any shape tool), **just start typing** — or press **Enter**/**F2** — to
  label it, without switching to Select.
- **Double-click any shape in any tool** to edit its text.
- Pressing on an existing shape in a shape tool no longer stacks a new shape.
- Select-mode editing still works; connectors are never text-edited.
- `npm test` green; `npm run build` clean.

## Deferred (future)
Right-click context menu ("Add text", …); the Text tool labelling existing shapes; multi-line
text; edge labels on connectors.

---

## Self-Review Notes (against the spec)
- **Spec coverage:** refactor §2 → Task 1; type-to-edit §3 → Task 2; global double-click §4 →
  Task 2; shape-tool enabler §4 → Task 3; cleanup §5 → Task 2; testing §8 → each task's tests.
- **Placeholder scan:** none — every code/test step is complete.
- **Type consistency:** `App.editText(shape, initial?)`, `hitTest(...filter(isShape), world)`,
  and the removal of `Tool.onDoubleClick?`/`beginEdit?` are used identically across tasks.
  Task 1 adds `editText` (parallel to the old `SelectTool` editor, no conflict); Task 2 removes
  the old editor and rewires to `editText`; Task 3 is independent.
