# Brace `{ }` and Bracket `[ ]` Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new shape kinds — left brace `{`, right brace `}`, left bracket `[`, right bracket `]` — to QuickDraw, drawable from the tool palette like the existing shapes.

**Architecture:** Each new shape is a first-class `Shape` with its own `ShapeKind`. All shape systems (draw, select, resize, rotate, connect, group, save/open, text label) are kind-agnostic and work automatically. The only kind-specific code is (a) an outline-only default fill in `createShape()`, and (b) four `case`s in `render/shapes.ts:primitive()` that build a stroke-only `<path>` (brackets = straight polylines, braces = quadratic curves), plus palette buttons + tool registration.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax` — use `import type` for type-only imports), Vite, Vitest + jsdom. Zero runtime deps. SVG rendering (one `primitive()` path feeds live canvas **and** SVG/PNG export).

## Global Constraints

- **NEVER push to `main`.** All work on branch `fix/brace-bracket-shapes` (already created); open a PR at the end.
- Run `npm run build` (tsc typecheck, `noEmit`) **and** `npm test` before every commit; both must pass.
- Strict TS: `noUnusedLocals` / `noUnusedParameters` on; ES modules; `import type` for type-only imports.
- Keep changes minimal and targeted; do NOT refactor or reformat unrelated code.
- TDD: write the failing test first, watch it fail, then the minimal implementation, then watch it pass.
- Commit message trailer (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- The four new kinds, in canonical order: `'brace-left'`, `'brace-right'`, `'bracket-left'`, `'bracket-right'`.
- Default style comes from `DEFAULT_STYLE`: `stroke: '#1e1e1e'`, `strokeWidth: 2`, `fill: '#ffffff'`, `dashed: false`. Outline kinds override `fill` to `'none'` only (stroke kept — unlike `text`, which also nulls stroke).

---

### Task 1: Model — new shape kinds + outline-only default fill

Adds the four kinds to the `ShapeKind` type and makes `createShape()` seed them as outline-only (`fill: 'none'`, stroke kept, no default text). Save/open needs no change — `serialize.ts` validates `kind` only as "a string" — so this task also adds a round-trip guard test.

**Files:**
- Modify: `src/model/types.ts:1` (extend `ShapeKind`)
- Modify: `src/model/document.ts:33-40` (`createShape` + a new `OUTLINE_ONLY` set)
- Test: `tests/model/document.test.ts` (append a test)
- Test: `tests/io/serialize.test.ts` (append a test)

**Interfaces:**
- Consumes: existing `createShape(kind: ShapeKind, x, y, w?, h?): Shape`, `DEFAULT_STYLE`, `serializeWorkspace`/`deserializeWorkspace`.
- Produces: `ShapeKind` now includes `'brace-left' | 'brace-right' | 'bracket-left' | 'bracket-right'`. `createShape` for those kinds returns a `Shape` with `style.fill === 'none'`, `style.stroke === '#1e1e1e'`, `text === undefined`. Later tasks (render, palette) rely on these kind strings existing in the type.

- [ ] **Step 1: Write the failing tests**

Append to `tests/model/document.test.ts` inside the `describe('document model', …)` block (before its closing `});` at line 61):

```ts
  it('creates brace/bracket shapes as outline-only (fill none, stroke kept, no text)', () => {
    for (const kind of ['brace-left', 'brace-right', 'bracket-left', 'bracket-right'] as const) {
      const s = createShape(kind, 0, 0);
      expect(s.kind).toBe(kind);
      expect(s.style.fill).toBe('none');       // no fillable interior
      expect(s.style.stroke).toBe('#1e1e1e');  // stroke kept, unlike the text kind
      expect(s.text).toBeUndefined();          // no default label
    }
  });
```

Append to `tests/io/serialize.test.ts` inside the `describe('serializeWorkspace / deserializeWorkspace', …)` block (before its closing `});` at line 108):

```ts
  it('round-trips brace and bracket shape kinds', () => {
    const ws = createWorkspace();
    addNode(ws.tabs[0], createShape('brace-left', 0, 0, 40, 80));
    addNode(ws.tabs[0], createShape('bracket-right', 60, 0, 40, 80));
    const restored = deserializeWorkspace(serializeWorkspace(ws));
    expect(restored.tabs[0].nodes.map((n) => n.kind)).toEqual(['brace-left', 'bracket-right']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/model/document.test.ts tests/io/serialize.test.ts`
Expected: FAIL. The `document` test fails on the `createShape('brace-left', …)` call — TypeScript rejects `'brace-left'` as it's not yet in `ShapeKind` (compile error / type error), and at runtime `style.fill` would be `'#ffffff'` not `'none'`. The serialize test fails similarly on the unknown kind literal.

- [ ] **Step 3: Extend the `ShapeKind` type**

In `src/model/types.ts`, replace line 1:

```ts
export type ShapeKind =
  | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text'
  | 'brace-left' | 'brace-right' | 'bracket-left' | 'bracket-right';
```

- [ ] **Step 4: Add the outline-only default in `createShape`**

In `src/model/document.ts`, add this module-level constant just above `createShape` (after the `DEFAULT_CONNECTOR_STYLE` block, near line 24):

```ts
/** Kinds drawn as stroke-only outline glyphs with no fillable interior (braces, brackets). */
const OUTLINE_ONLY: ReadonlySet<ShapeKind> = new Set([
  'brace-left', 'brace-right', 'bracket-left', 'bracket-right',
]);
```

Then change the body of `createShape` (lines 34-39) so the `text` branch gains an `else if`:

```ts
export function createShape(kind: ShapeKind, x: number, y: number, w = 120, h = 70): Shape {
  const style = { ...DEFAULT_STYLE };
  if (kind === 'text') {
    style.fill = 'none';
    style.stroke = 'none';
  } else if (OUTLINE_ONLY.has(kind)) {
    style.fill = 'none'; // outline glyph: keep the stroke, drop the fill
  }
  return { id: uid('s'), kind, x, y, w, h, style, text: kind === 'text' ? 'Text' : undefined };
}
```

(`ShapeKind` is already imported at the top of `document.ts`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/model/document.test.ts tests/io/serialize.test.ts`
Expected: PASS (all tests in both files green).

- [ ] **Step 6: Typecheck the whole project**

Run: `npm run build`
Expected: tsc passes (no errors) and `vite build` completes. `primitive()` and `pointInShape()` both have `default` branches, so the not-yet-handled kinds compile cleanly (they fall back to a bounding-box rect until Task 2).

- [ ] **Step 7: Commit**

```bash
git add src/model/types.ts src/model/document.ts tests/model/document.test.ts tests/io/serialize.test.ts
git commit -m "feat: add brace/bracket shape kinds with outline-only default

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Render — brace/bracket SVG paths

Adds an `outlinePath` helper and four `case`s to `primitive()` so the new kinds render as stroke-only `<path>` glyphs. Brackets are straight polylines; braces are quadratic-curve glyphs pinching at fixed vertical center. Fill is forced to `none` in the renderer (independent of style) so a user-set fill can never paint a nonsensical wedge across an open path.

**Files:**
- Modify: `src/render/shapes.ts` (add `outlineD` + `outlinePath`; add 4 cases in `primitive`, near lines 54-92)
- Test: `tests/render/brace-bracket.test.ts` (new file)

**Interfaces:**
- Consumes: `shapeToSvg(s: Shape): SVGGElement` (unchanged public entry; it calls `primitive(s)` then appends a text label if `s.text`). `NS`, `Shape`.
- Produces: for the four outline kinds, `primitive(s)` returns an `SVGPathElement` with `fill="none"`, `stroke` = `s.style.stroke`, `stroke-width` = `s.style.strokeWidth`, `stroke-linejoin="round"`, `stroke-linecap="round"`, `stroke-dasharray` present iff `s.style.dashed`. `d` uses `L` (no `Q`) for brackets and contains `Q` for braces.

- [ ] **Step 1: Write the failing tests**

Create `tests/render/brace-bracket.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shapeToSvg } from '../../src/render/shapes';
import { createShape } from '../../src/model/document';

describe('brace and bracket rendering', () => {
  it('renders each brace/bracket as a stroke-only <path> (fill none, stroke kept)', () => {
    for (const kind of ['brace-left', 'brace-right', 'bracket-left', 'bracket-right'] as const) {
      const path = shapeToSvg(createShape(kind, 0, 0, 40, 80)).querySelector('path')!;
      expect(path).toBeTruthy();
      expect(path.getAttribute('fill')).toBe('none');
      expect(path.getAttribute('stroke')).toBe('#1e1e1e');
      expect(path.getAttribute('stroke-linejoin')).toBe('round');
      expect(path.getAttribute('stroke-linecap')).toBe('round');
    }
  });

  it('draws brackets as straight polylines and braces with quadratic curves', () => {
    const bracket = shapeToSvg(createShape('bracket-left', 0, 0, 40, 80)).querySelector('path')!;
    expect(bracket.getAttribute('d')).toContain('L');
    expect(bracket.getAttribute('d')).not.toContain('Q'); // no curves in a bracket

    const brace = shapeToSvg(createShape('brace-left', 0, 0, 40, 80)).querySelector('path')!;
    expect(brace.getAttribute('d')).toContain('Q'); // curved arms
  });

  it('a dashed brace gets stroke-dasharray', () => {
    const s = createShape('brace-right', 0, 0, 40, 80);
    s.style.dashed = true;
    const path = shapeToSvg(s).querySelector('path')!;
    expect(path.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('a brace with text still appends a <text> label alongside the path', () => {
    const s = createShape('brace-left', 0, 0, 40, 80);
    s.text = 'Group';
    const g = shapeToSvg(s);
    expect(g.querySelector('path')).toBeTruthy();
    expect(g.querySelector('text')!.textContent).toContain('Group');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/render/brace-bracket.test.ts`
Expected: FAIL. Until the cases exist, `primitive()` hits its `default` branch and returns a `<rect>`, so `querySelector('path')` returns `null` and the first assertion throws / fails.

- [ ] **Step 3: Add the path builders**

In `src/render/shapes.ts`, add these two functions just above `function primitive(s: Shape): SVGElement {` (currently line 54):

```ts
/** The `d` for a brace/bracket glyph, parametrized on the shape's box.
 *  Brackets are three straight segments; braces are two arms of quadratic curves
 *  meeting at a pinch point on the mid-line. `r` rounds the corners/pinch and is
 *  capped at h/4 so the top and bottom halves never overlap on a short box. */
function outlineD(s: Shape): string {
  const { x, y, w, h } = s;
  const xBody = x + w / 2; // vertical spine of a brace's arms
  const ym = y + h / 2;    // mid-line (fixed pinch height)
  const r = Math.min(w / 2, h / 4);
  switch (s.kind) {
    case 'bracket-left':
      return `M${x + w},${y} L${x},${y} L${x},${y + h} L${x + w},${y + h}`;
    case 'bracket-right':
      return `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h}`;
    case 'brace-left': // arms curl right to x+w; pinch pokes left to x
      return `M${x + w},${y} Q${xBody},${y} ${xBody},${y + r}` +
             ` L${xBody},${ym - r} Q${xBody},${ym} ${x},${ym}` +
             ` Q${xBody},${ym} ${xBody},${ym + r} L${xBody},${y + h - r}` +
             ` Q${xBody},${y + h} ${x + w},${y + h}`;
    case 'brace-right': // mirror: arms curl left to x; pinch pokes right to x+w
      return `M${x},${y} Q${xBody},${y} ${xBody},${y + r}` +
             ` L${xBody},${ym - r} Q${xBody},${ym} ${x + w},${ym}` +
             ` Q${xBody},${ym} ${xBody},${ym + r} L${xBody},${y + h - r}` +
             ` Q${xBody},${y + h} ${x},${y + h}`;
    default:
      return ''; // unreachable: only called for the four outline kinds
  }
}

/** A stroke-only outline glyph (brace/bracket). Fill is ALWAYS `none` — an open path
 *  filled as if closed would paint a nonsensical wedge — with stroke/width/dashed from
 *  style and rounded joins/caps for clean corners and open ends. */
function outlinePath(s: Shape): SVGPathElement {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', outlineD(s));
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', s.style.stroke);
  p.setAttribute('stroke-width', String(s.style.strokeWidth));
  p.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('stroke-linecap', 'round');
  if (s.style.dashed) p.setAttribute('stroke-dasharray', '6 4');
  return p;
}
```

- [ ] **Step 4: Wire the cases into `primitive`**

In `src/render/shapes.ts`, inside the `switch (s.kind)` in `primitive()`, add these four cases immediately before the `default:` branch (currently line 78):

```ts
    case 'brace-left':
    case 'brace-right':
    case 'bracket-left':
    case 'bracket-right':
      return outlinePath(s);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render/brace-bracket.test.ts`
Expected: PASS (all four tests green).

- [ ] **Step 6: Full test + typecheck**

Run: `npm test && npm run build`
Expected: entire suite passes; tsc + vite build succeed. (No existing render test breaks — the new kinds were previously falling to the rect default and no test drew them.)

- [ ] **Step 7: Commit**

```bash
git add src/render/shapes.ts tests/render/brace-bracket.test.ts
git commit -m "feat: render brace/bracket shapes as stroke-only SVG paths

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: UI — tool registration + palette buttons

Extends `ToolName`, registers a `ShapeTool` per new kind in `main.ts`, and adds four palette buttons (after Triangle, before Text). Updates the existing `toolPalette` test whose hardcoded count/order would otherwise break, and adds a selection test for the new buttons. This is the task that makes the shapes reachable from the UI.

**Files:**
- Modify: `src/tools/types.ts:3` (extend `ToolName`)
- Modify: `src/main.ts:39` (registration loop array)
- Modify: `src/ui/toolPalette.ts:8-20` (`ITEMS` array — insert 4 entries)
- Test: `tests/ui/toolPalette.test.ts` (update counts/order at lines 27-33 & 80; add a new test)

**Interfaces:**
- Consumes: `ShapeTool(app, kind)`, `app.registerTool(name: ToolName, tool: Tool)`, `app.setTool`, the palette `ITEMS` shape `{ tool: ToolName; routing?; arrow?; label: string; icon: string }`, and its render loop keying buttons by `data-tool`.
- Produces: four `.tool-btn[data-tool="brace-left|brace-right|bracket-left|bracket-right"]` buttons; clicking one calls `app.setTool(kind)` so `app.currentToolName === kind`. Total `.tool-btn` count becomes **15** (11 shapes/select + 4 connectors).

- [ ] **Step 1: Update the failing palette tests**

In `tests/ui/toolPalette.test.ts`, replace the body of the first test (`renders the shapes, a Line, and the three connector types`, lines 25-34) with the new counts and order, and add a new test after it:

```ts
  it('renders the shapes, a Line, and the three connector types', () => {
    const btns = [...host.querySelectorAll<HTMLElement>('.tool-btn')];
    expect(btns).toHaveLength(15);
    expect(btns.slice(0, 11).map((b) => b.dataset.tool))
      .toEqual(['select', 'rect', 'rounded', 'ellipse', 'diamond', 'triangle',
                'brace-left', 'brace-right', 'bracket-left', 'bracket-right', 'text']);
    const connectors = btns.slice(11);
    expect(connectors.map((b) => b.dataset.routing)).toEqual(['straight', 'straight', 'elbow', 'curved']);
    expect(connectors.map((b) => b.dataset.arrow)).toEqual(['false', 'true', 'true', 'true']);
    expect(host.querySelectorAll('.tool-btn svg')).toHaveLength(15);
  });

  it('the brace and bracket shortcuts select their tools', () => {
    for (const kind of ['brace-left', 'brace-right', 'bracket-left', 'bracket-right']) {
      btn(kind).click();
      expect(app.currentToolName).toBe(kind);
    }
  });
```

Also update the count assertion in the undo/redo block at line 80:

```ts
    expect(host.querySelectorAll('.tool-btn')).toHaveLength(15); // tools unchanged
```

- [ ] **Step 2: Run the palette tests to verify they fail**

Run: `npx vitest run tests/ui/toolPalette.test.ts`
Expected: FAIL. The suite still builds only 11 buttons, so `toHaveLength(15)` fails and `btn('brace-left')` is `null` → `.click()` throws in the new test.

- [ ] **Step 3: Extend the `ToolName` type**

In `src/tools/types.ts`, replace line 3:

```ts
export type ToolName =
  | 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text'
  | 'brace-left' | 'brace-right' | 'bracket-left' | 'bracket-right' | 'arrow';
```

- [ ] **Step 4: Register the tools in `main.ts`**

In `src/main.ts`, replace the registration loop (lines 39-41) so the array includes the four new kinds in palette order (text stays last):

```ts
for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle',
                    'brace-left', 'brace-right', 'bracket-left', 'bracket-right', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
```

- [ ] **Step 5: Add the palette buttons**

In `src/ui/toolPalette.ts`, insert four `ITEMS` entries between the `triangle` entry (line 14) and the `text` entry (line 15):

```ts
  { tool: 'triangle', label: 'Triangle', icon: '<path d="M12 5l8 14H4z"/>' },
  { tool: 'brace-left', label: 'Left brace {', icon: '<path d="M15 4c-2 0-3 1-3 3v2c0 1-1 3-3 3 2 0 3 2 3 3v2c0 2 1 3 3 3"/>' },
  { tool: 'brace-right', label: 'Right brace }', icon: '<path d="M9 4c2 0 3 1 3 3v2c0 1 1 3 3 3-2 0-3 2-3 3v2c0 2-1 3-3 3"/>' },
  { tool: 'bracket-left', label: 'Left bracket [', icon: '<path d="M15 4H9v16h6"/>' },
  { tool: 'bracket-right', label: 'Right bracket ]', icon: '<path d="M9 4h6v16H9"/>' },
  { tool: 'text', label: 'Text box', icon: '<path d="M6 7h12M12 7v11"/>' },
```

- [ ] **Step 6: Run the palette tests to verify they pass**

Run: `npx vitest run tests/ui/toolPalette.test.ts`
Expected: PASS (updated counts/order + new selection test green).

- [ ] **Step 7: Full test + typecheck**

Run: `npm test && npm run build`
Expected: entire suite passes; tsc + vite build succeed.

- [ ] **Step 8: Commit**

```bash
git add src/tools/types.ts src/main.ts src/ui/toolPalette.ts tests/ui/toolPalette.test.ts
git commit -m "feat: add brace/bracket tools to the palette

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Browser verification + single-file build

Verifies the feature end-to-end in a real browser (per the project's browser-verify convention: serve over HTTP, drive via `data-tool` buttons and DOM — there is no `app` global), then rebuilds the portable single-file `quickdraw.html`.

**Files:**
- Modify: `quickdraw.html` (regenerated by the build script — do NOT hand-edit)

**Interfaces:**
- Consumes: the finished palette + renderer from Tasks 1-3.
- Produces: a verified, up-to-date single-file build.

- [ ] **Step 1: Build the single-file bundle**

Run: `npm run build:single`
Expected: build succeeds and writes `quickdraw.html` (double-clickable, no server).

- [ ] **Step 2: Serve and open in a browser**

Run: `npm run preview` (serves the built `dist/` over HTTP — file:// is not sufficient).
Then open the previewed URL in a browser.

- [ ] **Step 3: Manually verify each shape**

For each of the four palette buttons (`{`, `}`, `[`, `]`, located after Triangle, before Text):
- Click the palette button, then drag on the canvas to draw the shape. Confirm it appears as a clean stroke-only glyph (no fill).
- Draw one tall and one wide to confirm the glyph scales (braces stay smoothly curved; the pinch stays centered).
- Select it and drag the rotation knob — confirm it rotates.
- Double-click and type a label — confirm the text appears centered.
- Change stroke color and toggle Dashed in the properties panel — confirm both apply.
- Drag from a quick-connect port to another shape — confirm a connector attaches.
- Confirm there are **no console errors** throughout.

- [ ] **Step 4: Verify export**

Export the diagram to SVG and to PNG (menu). Confirm the braces/brackets appear identically in both exports (same render path).

- [ ] **Step 5: Commit the rebuilt single-file bundle**

```bash
git add quickdraw.html
git commit -m "build: regenerate single-file bundle with brace/bracket shapes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Push the branch and open a PR**

```bash
git push -u origin fix/brace-bracket-shapes
```
Then open a PR from `fix/brace-bracket-shapes` into `main` (per the memory note, use the GitHub REST API with `git credential fill` — `gh` CLI is absent). Title: "Add brace `{ }` and bracket `[ ]` shapes". Body: summarize the four new shapes, link the design spec, and note the browser verification.

---

## Notes for the implementer

- **`text` vs outline kinds:** `text` sets both `fill: 'none'` **and** `stroke: 'none'` (an invisible box). Braces/brackets set **only** `fill: 'none'` — the stroke is the visible glyph. Do not copy the `stroke: 'none'` line.
- **Why fill is forced in the renderer** (Task 2 `outlinePath`), not just seeded in the model: a user can later pick a fill color in the properties panel. On an *open* path, SVG fills as if the path were closed, painting a wedge across the glyph. Forcing `fill="none"` at render time makes that impossible.
- **`primitive()` uses `applyStyle` for the other kinds; the outline kinds deliberately do NOT** — `outlinePath` sets its own attributes so it can force `fill="none"` and add rounded joins/caps. Leave `applyStyle` untouched.
- **Kind-agnostic systems you do NOT need to touch:** `ShapeTool` (draw), `geometry.ts` (bounding-box hit-test — the new kinds correctly fall to the `default` branch of `pointInShape`), rotation, connectors/ports, grouping, align/distribute, copy/paste, and `serialize.ts` (validates `kind` as a string only).
- Palette icon `d` strings are hand-tuned 24×24 glyphs; if one looks off in the browser (Task 4), adjust the control points — this is cosmetic and does not affect the actual drawn shape (which comes from `outlineD`).
