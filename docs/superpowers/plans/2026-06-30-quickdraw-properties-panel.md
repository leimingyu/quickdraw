# QuickDraw Properties Panel (Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A right-side dock that edits the style of the current selection — fill, line color/width/style, font size/color, connector arrowheads, and bring-to-front/send-to-back — applied live with one undo entry per gesture.

**Architecture:** Two small style fields are added (`arrowStart`, `dashed`). A new DOM-free-ish `ui/properties.ts` dock renders from `App.selection` and writes edits back through new `App` methods (`restyle`/`commitStyle`/`bringToFront`/`sendToBack`); the model is the single source of truth. The panel refreshes via an `App.onRender` hook, rebuilding controls only when the selection changes.

**Tech Stack:** TypeScript (strict), Vite, Vitest (jsdom), SVG. No new dependencies.

## Global Constraints

- Strict TypeScript; all source under `src/`, tests mirror under `tests/`.
- Model is the single source of truth; the panel holds no state. Edits route through `App` and commit via `App.commit()` (history + autosave).
- New style fields are **optional** (`arrowStart?`, `dashed?`) so old autosaves and existing style literals stay valid; defaults set them `false` for new nodes; renderers read them as falsy when absent.
- Style routing is by node **kind** (not by key presence): `fill`/`fontSize`/`fontColor` → shapes; `arrowStart`/`arrowEnd` → connectors; `stroke`/`strokeWidth`/`dashed` → both.
- Undo granularity: a continuous gesture is one history entry (`input` → live `restyle`; `change` → `commitStyle`); discrete toggles/buttons commit in one step.
- Multi-selection applies to every applicable node; displayed values come from the first selected node that has the property.
- Keep the build green and all existing tests passing at every task boundary.

---

## File Structure

| File | Change | Task |
|------|--------|------|
| `src/model/types.ts` | `ShapeStyle.dashed?`; `ConnectorStyle.arrowStart?`/`dashed?` | 1 |
| `src/model/document.ts` | defaults; `StylePatch`; `restyleNodes`; `reorderSelection` | 1 |
| `src/render/shapes.ts` | dashed stroke for shapes | 2 |
| `src/render/connector.ts` | dashed line + `marker-start` | 2 |
| `src/app.ts` | `restyle`/`commitStyle`/`bringToFront`/`sendToBack`; `onRender` hook | 3 |
| `src/ui/properties.ts` | **New** — the dock module + controls | 4 |
| `src/main.ts`, `src/style.css` | right-dock layout; mount + wire `onRender` | 5 |

---

## Task 1: Model — style fields, restyleNodes, reorderSelection

**Files:**
- Modify: `src/model/types.ts`, `src/model/document.ts`
- Test: `tests/model/restyle.test.ts`

**Interfaces:**
- Consumes: `Node`, `Shape`, `Connector`, `Tab`, `ShapeStyle`, `ConnectorStyle`; `isShape`, `isConnector`.
- Produces:
  - `ShapeStyle` gains `dashed?: boolean`; `ConnectorStyle` gains `arrowStart?: boolean` and `dashed?: boolean`.
  - `type StylePatch = Partial<ShapeStyle & ConnectorStyle>`
  - `restyleNodes(tab: Tab, ids: Set<string>, patch: StylePatch): void`
  - `reorderSelection(tab: Tab, ids: Set<string>, dir: 'front' | 'back'): void`

- [ ] **Step 1: Add the optional style fields in `src/model/types.ts`**

In `ShapeStyle`, add `dashed?: boolean;`. In `ConnectorStyle`, add `arrowStart?: boolean;` and `dashed?: boolean;`. Final shapes:

```ts
export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontColor: string;
  dashed?: boolean;
}
export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  arrowEnd: boolean;
  arrowStart?: boolean;
  dashed?: boolean;
}
```

- [ ] **Step 2: Write the failing test `tests/model/restyle.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createTab, addNode, createShape, createConnector,
  restyleNodes, reorderSelection,
} from '../../src/model/document';

function mixedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 50, 50);
  const b = createShape('rect', 100, 0, 50, 50);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(tab, n));
  return { tab, a, b, c };
}

describe('restyleNodes', () => {
  it('applies a common key (stroke) to both shapes and connectors in the selection', () => {
    const { tab, a, c } = mixedTab();
    restyleNodes(tab, new Set([a.id, c.id]), { stroke: '#ff0000' });
    expect(a.style.stroke).toBe('#ff0000');
    expect(c.style.stroke).toBe('#ff0000');
  });

  it('routes shape-only keys to shapes and connector-only keys to connectors', () => {
    const { tab, a, c } = mixedTab();
    restyleNodes(tab, new Set([a.id, c.id]), { fill: '#00ff00', arrowEnd: false });
    expect(a.style.fill).toBe('#00ff00');     // shape got fill
    expect('fill' in c.style).toBe(false);    // connector did NOT get fill
    expect(c.style.arrowEnd).toBe(false);     // connector got arrowEnd
  });

  it('sets a new optional field (dashed) even on a node that lacked it', () => {
    const { tab, a } = mixedTab();
    delete a.style.dashed; // simulate an old node
    restyleNodes(tab, new Set([a.id]), { dashed: true });
    expect(a.style.dashed).toBe(true);
  });

  it('ignores nodes not in the id set', () => {
    const { tab, a, b } = mixedTab();
    restyleNodes(tab, new Set([a.id]), { stroke: '#0000ff' });
    expect(b.style.stroke).not.toBe('#0000ff');
  });
});

describe('reorderSelection', () => {
  it('moves the selection to the front, preserving relative order', () => {
    const { tab, a, b, c } = mixedTab(); // order [a, b, c]
    reorderSelection(tab, new Set([a.id]), 'front');
    expect(tab.nodes.map((n) => n.id)).toEqual([b.id, c.id, a.id]);
  });

  it('moves the selection to the back, preserving relative order', () => {
    const { tab, a, b, c } = mixedTab();
    reorderSelection(tab, new Set([b.id, c.id]), 'back');
    expect(tab.nodes.map((n) => n.id)).toEqual([b.id, c.id, a.id]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/model/restyle.test.ts`
Expected: FAIL — `restyleNodes`/`reorderSelection` not exported.

- [ ] **Step 4: Add defaults and the helpers in `src/model/document.ts`**

Add `dashed: false` to `DEFAULT_STYLE`, and `arrowStart: false, dashed: false` to `DEFAULT_CONNECTOR_STYLE`:

```ts
export const DEFAULT_STYLE: ShapeStyle = {
  fill: '#ffffff', stroke: '#1e1e1e', strokeWidth: 2, fontSize: 16, fontColor: '#1e1e1e',
  dashed: false,
};
```
```ts
export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = {
  stroke: '#1e1e1e', strokeWidth: 2, arrowEnd: true, arrowStart: false, dashed: false,
};
```

Add the patch type and helpers (after `groupMembers`/`expandToGroups`):

```ts
import type { Connector, ConnectorStyle, Endpoint, Node, Shape, ShapeKind, ShapeStyle, Tab, Workspace } from './types';

export type StylePatch = Partial<ShapeStyle & ConnectorStyle>;

const SHAPE_ONLY = new Set(['fill', 'fontSize', 'fontColor']);
const CONNECTOR_ONLY = new Set(['arrowStart', 'arrowEnd']);

/** Apply a style patch to the selected nodes, routing each key by node kind. */
export function restyleNodes(tab: Tab, ids: Set<string>, patch: StylePatch): void {
  for (const n of tab.nodes) {
    if (!ids.has(n.id)) continue;
    for (const [key, value] of Object.entries(patch)) {
      if (SHAPE_ONLY.has(key) && !isShape(n)) continue;
      if (CONNECTOR_ONLY.has(key) && !isConnector(n)) continue;
      (n.style as Record<string, unknown>)[key] = value;
    }
  }
}

/** Move the selected nodes to the front/back of the z-order, preserving relative order. */
export function reorderSelection(tab: Tab, ids: Set<string>, dir: 'front' | 'back'): void {
  const selected = tab.nodes.filter((n) => ids.has(n.id));
  if (selected.length === 0) return;
  const rest = tab.nodes.filter((n) => !ids.has(n.id));
  tab.nodes = dir === 'front' ? [...rest, ...selected] : [...selected, ...rest];
}
```

(The `import type` line already exists from the connectors work — ensure `ShapeStyle`/`ConnectorStyle` are in it; they are.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/model/restyle.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass (existing style literals stay valid because the new fields are optional), build clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: style fields (dashed/arrowStart) + restyleNodes + reorderSelection"
```

---

## Task 2: Rendering — dashed lines and start arrowheads

**Files:**
- Modify: `src/render/shapes.ts`, `src/render/connector.ts`
- Test: `tests/render/style-render.test.ts`

**Interfaces:**
- Consumes: `Shape`/`Connector` styles with `dashed`/`arrowStart`; `connectorToSvg`, `shapeToSvg`.
- Produces: shapes/connectors render `stroke-dasharray` when `dashed`; connectors render `marker-start` when `arrowStart`.

- [ ] **Step 1: Write the failing test `tests/render/style-render.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { shapeToSvg } from '../../src/render/shapes';
import { connectorToSvg } from '../../src/render/connector';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

describe('style rendering', () => {
  it('a dashed shape gets stroke-dasharray', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.style.dashed = true;
    const g = shapeToSvg(s);
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('a non-dashed shape has no stroke-dasharray', () => {
    const g = shapeToSvg(createShape('rect', 0, 0, 100, 100));
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('a connector with arrowStart gets marker-start, and dashed gets stroke-dasharray', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 300, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    c.style.arrowStart = true;
    c.style.dashed = true;
    [a, b, c].forEach((n) => addNode(tab, n));
    const line = connectorToSvg(tab, c, false)!.querySelector('line')!;
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead)');
    expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/style-render.test.ts`
Expected: FAIL — no dasharray / marker-start.

- [ ] **Step 3: Add dashed to `src/render/shapes.ts`**

In `applyStyle`, append after the stroke-width line:

```ts
function applyStyle(el: SVGElement, s: Shape): void {
  el.setAttribute('fill', s.style.fill);
  el.setAttribute('stroke', s.style.stroke);
  el.setAttribute('stroke-width', String(s.style.strokeWidth));
  if (s.style.dashed) el.setAttribute('stroke-dasharray', '6 4');
}
```

- [ ] **Step 4: Add dashed + marker-start to `src/render/connector.ts`**

In `connectorToSvg`, after the `marker-end` line, add:

```ts
  if (c.style.arrowEnd) line.setAttribute('marker-end', 'url(#arrowhead)');
  if (c.style.arrowStart) line.setAttribute('marker-start', 'url(#arrowhead)');
  if (c.style.dashed) line.setAttribute('stroke-dasharray', '6 4');
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/render/style-render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: render dashed shapes/connectors and start arrowheads"
```

---

## Task 3: App — restyle, commitStyle, z-order, onRender hook

**Files:**
- Modify: `src/app.ts`
- Test: `tests/app.restyle.test.ts`

**Interfaces:**
- Consumes: `restyleNodes`, `reorderSelection`, `StylePatch`.
- Produces:
  - `App.restyle(patch: StylePatch): void` — apply to the selection and `render()` (no commit).
  - `App.commitStyle(): void` — `commit()` (one history entry + autosave).
  - `App.bringToFront(): void` / `App.sendToBack(): void` — reorder the selection and `commit()`.
  - `App.onRender?: () => void` — called at the end of `render()`.

- [ ] **Step 1: Write the failing test `tests/app.restyle.test.ts`**

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

describe('App style + z-order', () => {
  it('restyle applies to the selection without adding a history entry', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    const commitSpy = vi.spyOn(app, 'commit');
    app.restyle({ fill: '#abcdef' });
    expect(s.style.fill).toBe('#abcdef');
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('commitStyle commits exactly once', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    const commitSpy = vi.spyOn(app, 'commit');
    app.commitStyle();
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('bringToFront reorders the selection and commits', () => {
    const a = createShape('rect', 0, 0);
    const b = createShape('rect', 10, 0);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id]);
    app.bringToFront();
    expect(app.activeTab.nodes[app.activeTab.nodes.length - 1].id).toBe(a.id);
  });

  it('restyle is a no-op on an empty selection', () => {
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.restyle({ fill: '#000000' });
    expect(s.style.fill).not.toBe('#000000');
  });

  it('render() calls the onRender hook', () => {
    const hook = vi.fn();
    app.onRender = hook;
    app.render();
    expect(hook).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app.restyle.test.ts`
Expected: FAIL — `restyle`/`commitStyle`/`bringToFront`/`onRender` not defined.

- [ ] **Step 3: Add the import, field, and methods in `src/app.ts`**

Extend the `./model/document` import to include the new helpers:

```ts
import { createWorkspace, getActiveTab, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors, restyleNodes, reorderSelection, type StylePatch } from './model/document';
```

Add a public field next to `highlightId`:

```ts
  onRender?: () => void;
```

In `render()`, call the hook at the end:

```ts
  render(): void {
    this.renderer.render(this.activeTab, this.selection, this.highlightId);
    this.onRender?.();
  }
```

Add the methods (next to `group`/`ungroup`):

```ts
  /** Apply a style patch to the selection (live; no history entry). */
  restyle(patch: StylePatch): void {
    if (this.selection.size === 0) return;
    restyleNodes(this.activeTab, this.selection, patch);
    this.render();
  }

  /** Commit the last live restyle as a single history entry. */
  commitStyle(): void {
    this.commit();
  }

  bringToFront(): void {
    if (this.selection.size === 0) return;
    reorderSelection(this.activeTab, this.selection, 'front');
    this.commit();
  }

  sendToBack(): void {
    if (this.selection.size === 0) return;
    reorderSelection(this.activeTab, this.selection, 'back');
    this.commit();
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/app.restyle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: App.restyle/commitStyle/bringToFront/sendToBack + onRender hook"
```

---

## Task 4: The properties panel module

**Files:**
- Create: `src/ui/properties.ts`
- Test: `tests/ui/properties.test.ts`

**Interfaces:**
- Consumes: `App` (`selection`, `activeTab`, `restyle`, `commitStyle`, `bringToFront`, `sendToBack`); `isShape`, `isConnector`; `StylePatch`.
- Produces: `mountProperties(app: App, container: HTMLElement): { update: () => void }`. The dock has class `props`; controls carry `data-prop="<styleKey>"` (inputs/toggles) or `data-action="front|back"` (buttons).

- [ ] **Step 1: Write the failing test `tests/ui/properties.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape, createConnector } from '../../src/model/document';

let app: App;
let container: HTMLElement;
let panel: { update: () => void };
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  container = document.createElement('div');
  document.body.appendChild(container);
  panel = mountProperties(app, container);
});
afterEach(() => app.destroy());

const dock = () => container.querySelector('.props') as HTMLElement;
const q = (sel: string) => dock().querySelector(sel) as HTMLInputElement;

function connected() {
  const a = createShape('rect', 0, 0, 50, 50);
  const b = createShape('rect', 200, 0, 50, 50);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}

describe('properties panel', () => {
  it('is hidden when nothing is selected', () => {
    panel.update();
    expect(dock().style.display).toBe('none');
  });

  it('shows fill + font for a shape and no arrowhead controls', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    expect(dock().style.display).toBe('block');
    expect(q('[data-prop="fill"]')).toBeTruthy();
    expect(q('[data-prop="fontSize"]')).toBeTruthy();
    expect(dock().querySelector('[data-prop="arrowEnd"]')).toBeNull();
  });

  it('shows arrowhead controls for a connector and no fill', () => {
    const { c } = connected();
    app.selection = new Set([c.id]);
    panel.update();
    expect(q('[data-prop="arrowStart"]')).toBeTruthy();
    expect(q('[data-prop="arrowEnd"]')).toBeTruthy();
    expect(dock().querySelector('[data-prop="fill"]')).toBeNull();
  });

  it('mixed selection shows shared + shape + connector sections', () => {
    const { a, c } = connected();
    app.selection = new Set([a.id, c.id]);
    panel.update();
    expect(q('[data-prop="stroke"]')).toBeTruthy();   // shared
    expect(q('[data-prop="fill"]')).toBeTruthy();      // shape
    expect(q('[data-prop="arrowEnd"]')).toBeTruthy();  // connector
  });

  it('reflects the first selected shape fill value', () => {
    const { a } = connected();
    a.style.fill = '#ff0000';
    app.selection = new Set([a.id]);
    panel.update();
    expect(q('[data-prop="fill"]').value).toBe('#ff0000');
  });

  it('editing fill restyles every selected shape and commits on change', () => {
    const { a, b } = connected();
    app.selection = new Set([a.id, b.id]);
    panel.update();
    const commitSpy = vi.spyOn(app, 'commitStyle');
    const input = q('[data-prop="fill"]');
    input.value = '#00ff00';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(a.style.fill).toBe('#00ff00');
    expect(b.style.fill).toBe('#00ff00');
    expect(commitSpy).toHaveBeenCalled();
  });

  it('toggling dashed sets it on the selection', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    q('[data-prop="dashed"]').dispatchEvent(new Event('click'));
    expect(a.style.dashed).toBe(true);
  });

  it('Front button brings the selection to the front', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    (dock().querySelector('[data-action="front"]') as HTMLElement).dispatchEvent(new Event('click'));
    expect(app.activeTab.nodes[app.activeTab.nodes.length - 1].id).toBe(a.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/properties.test.ts`
Expected: FAIL — cannot import `mountProperties`.

- [ ] **Step 3: Create `src/ui/properties.ts`**

```ts
import type { App } from '../app';
import type { Node } from '../model/types';
import { isShape, isConnector, type StylePatch } from '../model/document';

export function mountProperties(app: App, container: HTMLElement): { update: () => void } {
  const dock = document.createElement('div');
  dock.className = 'props';
  dock.style.display = 'none';
  container.appendChild(dock);

  let signature = '';

  const selected = (): Node[] => app.activeTab.nodes.filter((n) => app.selection.has(n.id));

  function update(): void {
    const nodes = selected();
    if (nodes.length === 0) {
      dock.style.display = 'none';
      signature = '';
      return;
    }
    dock.style.display = 'block';
    const sig = nodes.map((n) => n.id).sort().join(',');
    if (sig === signature) return; // unchanged selection → keep controls (and input focus)
    signature = sig;
    rebuild(nodes);
  }

  function rebuild(nodes: Node[]): void {
    dock.replaceChildren();
    const primary = nodes[0];
    const firstShape = nodes.find(isShape);
    const firstConn = nodes.find(isConnector);

    // shared (every node has stroke/strokeWidth/dashed)
    dock.appendChild(colorRow('Line', 'stroke', primary.style.stroke, (v) => ({ stroke: v })));
    dock.appendChild(numberRow('Width', 'strokeWidth', primary.style.strokeWidth, 1, (v) => ({ strokeWidth: v })));
    dock.appendChild(toggleRow('Dashed', 'dashed', !!primary.style.dashed, (v) => ({ dashed: v })));

    if (firstShape) {
      dock.appendChild(colorRow('Fill', 'fill', firstShape.style.fill, (v) => ({ fill: v })));
      dock.appendChild(numberRow('Font', 'fontSize', firstShape.style.fontSize, 4, (v) => ({ fontSize: v })));
      dock.appendChild(colorRow('Text', 'fontColor', firstShape.style.fontColor, (v) => ({ fontColor: v })));
    }
    if (firstConn) {
      dock.appendChild(toggleRow('Arrow start', 'arrowStart', !!firstConn.style.arrowStart, (v) => ({ arrowStart: v })));
      dock.appendChild(toggleRow('Arrow end', 'arrowEnd', firstConn.style.arrowEnd !== false, (v) => ({ arrowEnd: v })));
    }
    dock.appendChild(zorderRow());
  }

  function colorRow(label: string, prop: string, value: string, make: (v: string) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = toHex(value);
    input.dataset.prop = prop;
    input.addEventListener('input', () => app.restyle(make(input.value)));
    input.addEventListener('change', () => app.commitStyle());
    row.appendChild(input);
    return row;
  }

  function numberRow(label: string, prop: string, value: number, min: number, make: (v: number) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.value = String(value);
    input.dataset.prop = prop;
    input.addEventListener('input', () => app.restyle(make(Math.max(min, Number(input.value) || min))));
    input.addEventListener('change', () => app.commitStyle());
    row.appendChild(input);
    return row;
  }

  function toggleRow(label: string, prop: string, on: boolean, make: (v: boolean) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const btn = document.createElement('button');
    btn.dataset.prop = prop;
    btn.textContent = on ? 'On' : 'Off';
    btn.classList.toggle('active', on);
    btn.addEventListener('click', () => {
      const next = !btn.classList.contains('active');
      btn.classList.toggle('active', next);
      btn.textContent = next ? 'On' : 'Off';
      app.restyle(make(next));
      app.commitStyle();
    });
    row.appendChild(btn);
    return row;
  }

  function zorderRow(): HTMLElement {
    const row = labeledRow('Order');
    const front = document.createElement('button');
    front.textContent = 'Front';
    front.dataset.action = 'front';
    front.addEventListener('click', () => app.bringToFront());
    const back = document.createElement('button');
    back.textContent = 'Back';
    back.dataset.action = 'back';
    back.addEventListener('click', () => app.sendToBack());
    row.append(front, back);
    return row;
  }

  function labeledRow(label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'props-row';
    const span = document.createElement('span');
    span.className = 'props-label';
    span.textContent = label;
    row.appendChild(span);
    return row;
  }

  return { update };
}

/** Native color inputs require #rrggbb; pass valid hex through, else fall back. */
function toHex(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ui/properties.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all pass, build clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: properties panel module (controls per selection, live restyle)"
```

---

## Task 5: Integrate the dock into the layout

**Files:**
- Modify: `src/main.ts`, `src/style.css`
- Test: `tests/ui/properties-integration.test.ts`

**Interfaces:**
- Consumes: `mountProperties`; `App.onRender`.
- Produces: the canvas and the dock sit side-by-side; `app.onRender` is wired to `panel.update` so the panel tracks the selection.

- [ ] **Step 1: Write the failing test `tests/ui/properties-integration.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let container: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => app.destroy());

describe('properties panel wired via onRender', () => {
  it('shows the dock after a render once a shape is selected', () => {
    const panel = mountProperties(app, container);
    app.onRender = () => panel.update();
    const s = createShape('rect', 0, 0);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    app.render(); // onRender → panel.update()
    expect((container.querySelector('.props') as HTMLElement).style.display).toBe('block');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui/properties-integration.test.ts`
Expected: FAIL — `app.onRender` is set but nothing wires the panel without this test's manual wiring; this test passes only once `mountProperties` and `onRender` exist (Tasks 3–4). If Tasks 3–4 are merged it will PASS immediately — in that case treat Step 2 as a regression guard and continue. (The real deliverable of this task is the `main.ts`/CSS layout in Steps 3–4.)

- [ ] **Step 3: Wire the dock layout in `src/main.ts`**

Replace the body-layout portion so the canvas and the dock are side-by-side, and wire `onRender`. The full file becomes:

```ts
import { App } from './app';
import { mountToolbar } from './ui/toolbar';
import { mountZoomControls } from './ui/zoom';
import { mountProperties } from './ui/properties';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { ConnectorTool } from './tools/connectorTool';
import { Autosave } from './storage/autosave';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(toolbarHost, bodyHost);

const saved = new Autosave().load();
const app = new App(canvasHost, saved ?? undefined);

app.registerTool('select', new SelectTool(app));
app.setTool('select');
for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
app.registerTool('arrow', new ConnectorTool(app));

mountToolbar(app, toolbarHost);
mountZoomControls(app, toolbarHost.querySelector('.toolbar')!);

const panel = mountProperties(app, propsHost);
app.onRender = () => panel.update();

app.render();
```

- [ ] **Step 4: Add the layout styles to `src/style.css`**

Append:

```css
.app-body { display: flex; flex: 1; min-height: 0; }
.canvas-host { flex: 1; min-width: 0; }
.props-host { flex: 0 0 auto; }
.props { width: 200px; height: 100%; box-sizing: border-box; padding: 8px;
  border-left: 1px solid #ddd; background: #fff; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px; }
.props-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.props-label { color: #444; }
.props button { padding: 2px 8px; cursor: pointer; }
.props button.active { background: #3b82f6; color: #fff; }
.props input[type="number"] { width: 56px; }
```

(Note: `.canvas-host` already had `flex: 1` from Phase 1; the new rule keeps that and adds `min-width: 0`. Leave the prior `.canvas-host { flex: 1; min-height: 0; }` rule in place — the new declaration is additive.)

- [ ] **Step 5: Run the integration test, full suite, and build**

Run: `npx vitest run tests/ui/properties-integration.test.ts && npm test && npm run build`
Expected: integration test passes, full suite green, build clean.

- [ ] **Step 6: Manual check (note in report; can't run a browser in a subagent)**

`npm run dev` → select a shape: the right dock appears with Fill / Line / Width / Dashed / Font / Text / Order. Change the fill color → the shape recolors; toggle Dashed → dashed outline; select a connector → Arrow start/end toggles appear; Front/Back reorder. Confirm `npm run build` succeeds as the automated gate; record that the visual check is pending a Playwright/manual pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: dock the properties panel into the layout and wire onRender"
```

---

## Phase 2b Done — Definition of Done
- A right-side dock appears on selection and edits fill, line color/width/style, font size/color, connector arrowheads (start/end), and bring-to-front/send-to-back.
- Edits apply live; a continuous gesture is one undo entry; discrete toggles are one each.
- Multi-selection applies to all applicable nodes; mixed selections show shared + per-type controls; values reflect the first applicable selected node.
- Connectors are now restylable (completing the connectors phase).
- Old autosaves load fine (new style fields are optional).
- `npm test` green; `npm run build` clean.

## What this phase omits (future)
Opacity, gradients, swatch/recent-color palettes, text alignment, corner-radius control, copy-style/format-painter, custom dash patterns, alternate arrowhead shapes.

---

## Self-Review Notes (against the spec)
- **Spec coverage:** model fields §2 → Task 1; controls §3 → Task 4; apply behavior/undo §4 → Tasks 3–4; components/data flow §5 → Tasks 3–5 (`restyle`/`commitStyle`/`bringToFront`/`sendToBack`/`onRender`, `restyleNodes`, `reorderSelection`, `mountProperties`); rendering §6 → Task 2; module layout §7 → all; testing §9 → each task's tests. Persistence/undo are inherited (style is on nodes; restyle commits through `commit()`).
- **Placeholder scan:** none — every code/test step is complete.
- **Type consistency:** `StylePatch`, `restyleNodes`, `reorderSelection`, `App.restyle`/`commitStyle`/`bringToFront`/`sendToBack`/`onRender`, `mountProperties(app, container): {update}`, the `data-prop`/`data-action` attribute contract, and the optional `dashed`/`arrowStart` fields are used identically across tasks.
- **Deviation from spec (noted):** the spec wrote `dashed: boolean` / `arrowStart: boolean` as required; the plan makes them **optional** (`?`) so existing `ShapeStyle`/`ConnectorStyle` literals (e.g. the `geometry.test.ts` helper) and old autosaves stay valid without edits — this better serves the spec's stated backward-compatibility goal. Defaults still set them `false` for new nodes.
