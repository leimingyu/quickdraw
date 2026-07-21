# PowerPoint-style Ribbon + Right-Click Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace QuickDraw's left tool palette with a single PowerPoint-style ribbon row (Edit / Insert / Arrange) and add a three-context right-click menu, sharing one flyout primitive and adding zero new `App` commands.

**Architecture:** Three new focused UI modules — `flyout.ts` (a pure-DOM anchored popup + menu builder), `ribbon.ts` (the one-row toolbar, absorbing the old palette's tool/action data), and `contextMenu.ts` (builds the three menus from selection state). `main.ts` swaps the palette mount for the ribbon and attaches the context menu to the canvas; `toolPalette.ts` is deleted. Every menu action calls an existing `App` method.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Vite, Vitest + jsdom. Zero runtime dependencies.

## Global Constraints

- NEVER push to `main`. All work on branch `fix/ppt-ribbon-context-menu`; open a PR.
- Strict TS: `noUnusedLocals` / `noUnusedParameters` on. Use `import type` for type-only imports.
- Run `npm run build` (tsc typecheck + vite build) and `npm test` (`vitest run`) before every commit; both must pass.
- Tests use Vitest globals (`describe`/`it`/`expect`) + jsdom; no import of the globals needed.
- Do NOT modify `src/model`, `src/render`, `src/tools`, `src/io`, `src/history`, or add any method to `src/app.ts`. This feature is UI-only.
- Preserve the DOM contract: shape buttons keep `class="tool-btn"` with `data-tool` / `data-routing` / `data-arrow` attributes (tests and browser-verification select on these).
- jsdom returns zero-size `getBoundingClientRect()`; never assert on pixel positions in tests. Test positioning via the pure `clampToViewport` helper only.
- Spec: `docs/superpowers/specs/2026-07-20-ppt-ribbon-context-menu-design.md`.

---

## Task 1: `flyout.ts` — anchored popup + menu builder

The shared popup primitive. Pure DOM, imports only `./platform`. Provides `clampToViewport` (pure, unit-tested), `openPopup` (icon galleries), and `openMenu` (label menus with a one-level submenu). Only one popup is open at a time.

**Files:**
- Create: `src/ui/flyout.ts`
- Test: `tests/ui/flyout.test.ts`

**Interfaces:**
- Consumes: `formatShortcut`, `isMac` from `src/ui/platform.ts`.
- Produces:
  - `clampToViewport(x, y, w, h, vw, vh): { x: number; y: number }`
  - `type PopupPos = { x: number; y: number } | { anchor: HTMLElement; side?: 'below' | 'right' }`
  - `interface PopupHandle { el: HTMLElement; close: () => void }`
  - `type MenuEntry = 'separator' | { heading: string } | { label: string; keys?: string; run?: () => void; checked?: boolean; disabled?: boolean; submenu?: MenuEntry[] }`
  - `openPopup(content: HTMLElement, pos: PopupPos): PopupHandle`
  - `openMenu(entries: MenuEntry[], pos: PopupPos): PopupHandle`
  - `closeOpenPopup(): void`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/flyout.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { clampToViewport, openPopup, openMenu, closeOpenPopup, type MenuEntry } from '../../src/ui/flyout';

afterEach(() => { closeOpenPopup(); document.body.innerHTML = ''; });

describe('clampToViewport', () => {
  it('keeps a popup that fits at its requested point', () => {
    expect(clampToViewport(10, 20, 100, 50, 800, 600)).toEqual({ x: 10, y: 20 });
  });
  it('shifts left/up when it would overflow the right/bottom edge', () => {
    expect(clampToViewport(760, 580, 100, 50, 800, 600)).toEqual({ x: 700, y: 550 });
  });
  it('never returns a negative coordinate', () => {
    expect(clampToViewport(-30, -30, 100, 50, 800, 600)).toEqual({ x: 0, y: 0 });
  });
});

describe('openPopup', () => {
  it('mounts content in a .flyout and closes on the returned handle', () => {
    const content = document.createElement('div');
    content.textContent = 'hi';
    const h = openPopup(content, { x: 10, y: 10 });
    expect(document.querySelector('.flyout')).toBeTruthy();
    expect(document.querySelector('.flyout')!.textContent).toBe('hi');
    h.close();
    expect(document.querySelector('.flyout')).toBeNull();
  });
  it('opening a second popup closes the first', () => {
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    expect(document.querySelectorAll('.flyout')).toHaveLength(1);
  });
  it('closes on an outside pointerdown', () => {
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.querySelector('.flyout')).toBeNull();
  });
});

describe('openMenu', () => {
  const entries = (calls: string[]): MenuEntry[] => [
    { label: 'Cut', keys: 'mod+X', run: () => calls.push('cut') },
    'separator',
    { label: 'Align', submenu: [{ label: 'Left', run: () => calls.push('left') }] },
  ];

  it('renders items, shortcut hints, and separators', () => {
    openMenu(entries([]), { x: 0, y: 0 });
    expect(document.querySelectorAll('.flyout-item')).toHaveLength(2); // Cut, Align
    expect(document.querySelector('.flyout-sep')).toBeTruthy();
    expect(document.querySelector('.flyout-key')!.textContent).toMatch(/X$/);
  });

  it('runs an item and closes on click', () => {
    const calls: string[] = [];
    openMenu(entries(calls), { x: 0, y: 0 });
    document.querySelector<HTMLButtonElement>('.flyout-item')!.click(); // Cut
    expect(calls).toEqual(['cut']);
    expect(document.querySelector('.flyout-menu')).toBeNull();
  });

  it('opens a submenu and runs a nested item', () => {
    const calls: string[] = [];
    openMenu(entries(calls), { x: 0, y: 0 });
    const align = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent!.includes('Align'))!;
    align.click();
    expect(document.querySelectorAll('.flyout-menu')).toHaveLength(2);
    const left = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent!.includes('Left'))!;
    left.click();
    expect(calls).toEqual(['left']);
    expect(document.querySelector('.flyout-menu')).toBeNull(); // all layers gone
  });

  it('renders a checkmark for checked entries and closes on Escape', () => {
    openMenu([{ label: 'Show grid', checked: true, run: () => {} }], { x: 0, y: 0 });
    expect(document.querySelector('.flyout-item')!.textContent).toContain('✓');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.flyout-menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/flyout.test.ts`
Expected: FAIL — cannot find module `../../src/ui/flyout`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/flyout.ts`:

```typescript
// A small anchored-popup primitive shared by the ribbon (dropdowns + icon galleries)
// and the right-click context menu. It owns nothing app-specific: hand it content or a
// list of menu entries and where to put it; it positions the popup, keeps it on screen,
// and dismisses it on outside-click / Escape / after a pick. Only one popup is open at a
// time — opening a new one closes the previous.
//
// Dismissal listeners are attached synchronously. Callers that open a popup from a
// bubbling `click` MUST call `e.stopPropagation()` on that click so the fresh
// document listener doesn't see it and close immediately. (The `contextmenu` opener
// is safe without that: its triggering event is `contextmenu`, not `pointerdown`.)

import { formatShortcut, isMac } from './platform';

export type PopupPos = { x: number; y: number } | { anchor: HTMLElement; side?: 'below' | 'right' };

export interface PopupHandle { el: HTMLElement; close: () => void }

export type MenuEntry =
  | 'separator'
  | { heading: string }
  | { label: string; keys?: string; run?: () => void; checked?: boolean; disabled?: boolean; submenu?: MenuEntry[] };

/** Clamp a popup of size w×h opened at (x,y) so it stays within a vw×vh viewport:
 *  shift it back from the right/bottom edge, never past the top/left. Pure so the
 *  positioning rule is unit-testable without real layout. */
export function clampToViewport(x: number, y: number, w: number, h: number, vw: number, vh: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, vw - w)),
    y: Math.max(0, Math.min(y, vh - h)),
  };
}

let openHandle: PopupHandle | null = null;

export function closeOpenPopup(): void { openHandle?.close(); }

/** Position `el` (already in the DOM) at a cursor point or relative to an anchor,
 *  then clamp it on-screen. */
function place(el: HTMLElement, pos: PopupPos): void {
  let x = 0, y = 0;
  if ('anchor' in pos) {
    const r = pos.anchor.getBoundingClientRect();
    if (pos.side === 'right') { x = r.right; y = r.top; }
    else { x = r.left; y = r.bottom + 2; }
  } else {
    x = pos.x; y = pos.y;
  }
  const box = el.getBoundingClientRect();
  const c = clampToViewport(x, y, box.width, box.height, window.innerWidth, window.innerHeight);
  el.style.left = `${c.x}px`;
  el.style.top = `${c.y}px`;
}

/** Open arbitrary content (e.g. an icon gallery) as a floating popup. */
export function openPopup(content: HTMLElement, pos: PopupPos): PopupHandle {
  closeOpenPopup();
  const el = document.createElement('div');
  el.className = 'flyout';
  el.appendChild(content);
  document.body.appendChild(el);
  place(el, pos);

  const onDocPointer = (e: Event) => { if (!el.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('pointerdown', onDocPointer);
    document.removeEventListener('keydown', onKey);
    el.remove();
    if (openHandle === handle) openHandle = null;
  }
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onKey);

  const handle: PopupHandle = { el, close };
  openHandle = handle;
  return handle;
}

interface MenuCallbacks { onPick: () => void; onSubmenu: (entries: MenuEntry[], row: HTMLElement) => void }

/** Build one menu layer (a list of `<button>` rows) into a `.flyout-menu` element. */
function buildMenuEl(entries: MenuEntry[], cb: MenuCallbacks): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'flyout-menu';
  const mac = isMac();
  for (const entry of entries) {
    if (entry === 'separator') {
      const s = document.createElement('div');
      s.className = 'flyout-sep';
      menu.appendChild(s);
      continue;
    }
    if ('heading' in entry) {
      const h = document.createElement('div');
      h.className = 'flyout-heading';
      h.textContent = entry.heading;
      menu.appendChild(h);
      continue;
    }
    const b = document.createElement('button');
    b.className = 'flyout-item';
    if (entry.disabled) b.disabled = true;
    const label = document.createElement('span');
    label.className = 'flyout-label';
    label.textContent = (entry.checked ? '✓ ' : '') + entry.label;
    b.appendChild(label);
    if (entry.keys) {
      const k = document.createElement('span');
      k.className = 'flyout-key';
      k.textContent = formatShortcut(entry.keys, mac);
      b.appendChild(k);
    }
    if (entry.submenu) {
      b.classList.add('has-submenu');
      const caret = document.createElement('span');
      caret.className = 'flyout-caret';
      caret.textContent = '▸';
      b.appendChild(caret);
      const sub = entry.submenu;
      b.addEventListener('click', (e) => { e.stopPropagation(); cb.onSubmenu(sub, b); });
      b.addEventListener('mouseenter', () => cb.onSubmenu(sub, b));
    } else {
      b.addEventListener('click', () => { entry.run?.(); cb.onPick(); });
    }
    menu.appendChild(b);
  }
  return menu;
}

/** Open a label menu (context menu / ribbon dropdown) with one level of submenus. */
export function openMenu(entries: MenuEntry[], pos: PopupPos): PopupHandle {
  closeOpenPopup();
  const layers: HTMLElement[] = [];

  const close = () => {
    document.removeEventListener('pointerdown', onDocPointer);
    document.removeEventListener('keydown', onKey);
    for (const l of layers) l.remove();
    layers.length = 0;
    if (openHandle === handle) openHandle = null;
  };

  const spawn = (ents: MenuEntry[], p: PopupPos, depth: number): HTMLElement => {
    while (layers.length > depth) layers.pop()!.remove(); // replace this depth + drop deeper
    const el = buildMenuEl(ents, {
      onPick: close,
      onSubmenu: (subEnts, row) => spawn(subEnts, { anchor: row, side: 'right' }, depth + 1),
    });
    document.body.appendChild(el);
    place(el, p);
    // Re-entering a shallower layer collapses any submenu spawned from it.
    el.addEventListener('mouseenter', () => { while (layers.length > depth + 1) layers.pop()!.remove(); });
    layers.push(el);
    return el;
  };

  const onDocPointer = (e: Event) => { if (!layers.some((l) => l.contains(e.target as Node))) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

  spawn(entries, pos, 0);
  const handle: PopupHandle = { el: layers[0], close };
  openHandle = handle;
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onKey);
  return handle;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/flyout.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Add flyout styles**

In `src/style.css`, append (after the existing menubar rules — the exact spot doesn't matter, but keep flyout styles together):

```css
/* Shared floating popup: ribbon galleries/dropdowns + the right-click context menu. */
.flyout { position: fixed; z-index: 1200; }
.flyout-menu { position: fixed; background: #fff; border: 1px solid #ccc; border-radius: 6px;
  padding: 4px; min-width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,0.16); }
.flyout-item { display: flex; align-items: center; justify-content: space-between; gap: 24px;
  width: 100%; text-align: left; padding: 6px 12px; background: none; border: none; font: inherit;
  cursor: pointer; border-radius: 4px; white-space: nowrap; }
.flyout-item:hover:not(:disabled) { background: #eff6ff; }
.flyout-item:disabled { color: #b8bcc2; cursor: default; }
.flyout-key { color: #9aa0a6; font-size: 12px; }
.flyout-caret { color: #9aa0a6; margin-left: auto; }
.flyout-heading { padding: 6px 12px 2px; font-size: 11px; font-weight: 600; color: #9aa0a6;
  text-transform: uppercase; letter-spacing: 0.04em; }
.flyout-sep { height: 1px; background: #eaeaea; margin: 4px 6px; }
/* Icon gallery inside a flyout (Shapes / Arrow). */
.flyout-gallery { display: grid; grid-template-columns: repeat(5, 40px); gap: 6px;
  padding: 8px; background: #fff; border: 1px solid #ccc; border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.16); }
```

- [ ] **Step 6: Verify build and commit**

Run: `npm run build && npx vitest run tests/ui/flyout.test.ts`
Expected: typecheck passes; tests PASS.

```bash
git add src/ui/flyout.ts tests/ui/flyout.test.ts src/style.css
git commit -m "feat: add shared flyout popup + menu primitive"
```

---

## Task 2: `ribbon.ts` — the one-row toolbar

Absorbs the old palette's `ITEMS` (14 tools) and `ACTIONS` (undo/redo) verbatim. Lays out three groups — Edit / Insert / Arrange — with Shapes and Arrow as split-buttons that open icon galleries via `openPopup`, and Order / Align as dropdowns via `openMenu`. Returns `{ syncActive }`, the same shape the palette returned.

**Files:**
- Create: `src/ui/ribbon.ts`
- Test: `tests/ui/ribbon.test.ts`

**Interfaces:**
- Consumes: `App` (methods: `setTool`, `group`, `ungroup`, `bringToFront`, `sendToBack`, `align`, `distribute`, `undo`, `redo`, `canUndo`, `canRedo`; fields: `currentToolName`, `connectorRouting`, `connectorArrow`, `selection`, `activeTab`); `openPopup`, `openMenu`, `type MenuEntry` from `./flyout`.
- Produces: `mountRibbon(app: App, container: HTMLElement): { syncActive: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/ribbon.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountRibbon } from '../../src/ui/ribbon';
import { closeOpenPopup } from '../../src/ui/flyout';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let host: HTMLElement;
let ribbon: { syncActive: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  ribbon = mountRibbon(app, host);
});
afterEach(() => { closeOpenPopup(); app.destroy(); });

const openShapes = () => host.querySelector<HTMLButtonElement>('.ribbon-shapes-caret')!.click();
const openArrow = () => host.querySelector<HTMLButtonElement>('.ribbon-arrow-caret')!.click();
const galleryBtn = (sel: string) => document.querySelector<HTMLButtonElement>(`.flyout-gallery ${sel}`)!;
const cmd = (name: string) => host.querySelector<HTMLButtonElement>(`[data-cmd="${name}"]`)!;
const action = (name: string) => host.querySelector<HTMLButtonElement>(`.ribbon-action[data-action="${name}"]`)!;

describe('ribbon — Insert group', () => {
  it('the Shapes gallery lists all ten shape tools with correct data-tool', () => {
    openShapes();
    const tools = [...document.querySelectorAll<HTMLElement>('.flyout-gallery .tool-btn')].map((b) => b.dataset.tool);
    expect(tools).toEqual(['rect', 'rounded', 'ellipse', 'diamond', 'triangle',
                           'brace-left', 'brace-right', 'bracket-left', 'bracket-right', 'text']);
  });

  it('picking a shape from the gallery sets that tool and updates the split-button face', () => {
    openShapes();
    galleryBtn('[data-tool="diamond"]').click();
    expect(app.currentToolName).toBe('diamond');
    expect(host.querySelector('.ribbon-shapes-face')!.getAttribute('data-tool')).toBe('diamond');
  });

  it('clicking the Shapes face re-selects the last-used shape', () => {
    openShapes();
    galleryBtn('[data-tool="ellipse"]').click();
    app.setTool('select');
    host.querySelector<HTMLButtonElement>('.ribbon-shapes-face')!.click();
    expect(app.currentToolName).toBe('ellipse');
  });

  it('the Text button selects the text tool', () => {
    host.querySelector<HTMLButtonElement>('.tool-btn[data-tool="text"]')!.click();
    expect(app.currentToolName).toBe('text');
  });

  it('the Arrow gallery carries routing + arrow attributes and selects the connector', () => {
    openArrow();
    const routings = [...document.querySelectorAll<HTMLElement>('.flyout-gallery .tool-btn')].map((b) => b.dataset.routing);
    expect(routings).toEqual(['straight', 'straight', 'elbow', 'curved']);
    galleryBtn('[data-routing="curved"]').click();
    expect(app.currentToolName).toBe('arrow');
    expect(app.connectorRouting).toBe('curved');
  });
});

describe('ribbon — Arrange group', () => {
  function addTwoSelected() {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    app.commit();
  }

  it('Group and Ungroup are disabled with nothing selected, Group enabled with 2+', () => {
    ribbon.syncActive();
    expect(cmd('group').disabled).toBe(true);
    addTwoSelected();
    ribbon.syncActive();
    expect(cmd('group').disabled).toBe(false);
  });

  it('the Group button groups the selection', () => {
    addTwoSelected();
    cmd('group').click();
    const grouped = app.activeTab.nodes.filter((n) => 'groupId' in n && n.groupId);
    expect(grouped).toHaveLength(2);
  });

  it('the Align dropdown offers align + distribute ops that call App', () => {
    addTwoSelected();
    cmd('align').click();
    const left = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent!.includes('Align left'))!;
    expect(left).toBeTruthy();
    left.click(); // no throw = App.align invoked
  });
});

describe('ribbon — Edit group', () => {
  it('renders undo/redo, disabled on a fresh document', () => {
    ribbon.syncActive();
    expect(action('undo').disabled).toBe(true);
    expect(action('redo').disabled).toBe(true);
  });

  it('enables undo after a committed change', () => {
    addNode(app.activeTab, createShape('rect', 0, 0, 40, 40));
    app.commit();
    ribbon.syncActive();
    expect(action('undo').disabled).toBe(false);
  });
});

describe('ribbon — syncActive highlighting', () => {
  it('highlights the Shapes face when a shape tool is active', () => {
    app.setTool('rect');
    ribbon.syncActive();
    expect(host.querySelector('.ribbon-shapes-face')!.classList.contains('active')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ribbon.test.ts`
Expected: FAIL — cannot find module `../../src/ui/ribbon`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/ribbon.ts`:

```typescript
import type { App } from '../app';
import type { ToolName } from '../tools/types';
import type { Routing } from '../model/types';
import type { AlignOp, DistributeOp } from '../model/align';
import { openPopup, openMenu, type MenuEntry } from './flyout';

// Inline 24×24 icons (stroke = currentColor so they invert on the active button).
// Shape + connector data is lifted verbatim from the retired tool palette.
interface ShapeItem { tool: ToolName; label: string; icon: string }
interface ConnItem { routing: Routing; arrow: boolean; label: string; icon: string }

const SHAPE_ITEMS: ShapeItem[] = [
  { tool: 'rect', label: 'Rectangle', icon: '<rect x="4" y="6" width="16" height="12" rx="1"/>' },
  { tool: 'rounded', label: 'Rounded rectangle', icon: '<rect x="4" y="6" width="16" height="12" rx="4"/>' },
  { tool: 'ellipse', label: 'Ellipse', icon: '<ellipse cx="12" cy="12" rx="8" ry="6"/>' },
  { tool: 'diamond', label: 'Diamond', icon: '<path d="M12 4l8 8-8 8-8-8z"/>' },
  { tool: 'triangle', label: 'Triangle', icon: '<path d="M12 5l8 14H4z"/>' },
  { tool: 'brace-left', label: 'Left brace {', icon: '<path d="M15 4c-2 0-3 1-3 3v2c0 1-1 3-3 3 2 0 3 2 3 3v2c0 2 1 3 3 3"/>' },
  { tool: 'brace-right', label: 'Right brace }', icon: '<path d="M9 4c2 0 3 1 3 3v2c0 1 1 3 3 3-2 0-3 2-3 3v2c0 2-1 3-3 3"/>' },
  { tool: 'bracket-left', label: 'Left bracket [', icon: '<path d="M15 4H9v16h6"/>' },
  { tool: 'bracket-right', label: 'Right bracket ]', icon: '<path d="M9 4h6v16H9"/>' },
  { tool: 'text', label: 'Text box', icon: '<path d="M6 7h12M12 7v11"/>' },
];
const CONN_ITEMS: ConnItem[] = [
  { routing: 'straight', arrow: false, label: 'Line (no arrow)', icon: '<path d="M4 20L20 4"/>' },
  { routing: 'straight', arrow: true, label: 'Straight arrow', icon: '<path d="M4 12h13"/><path d="M12 7l5 5-5 5"/>' },
  { routing: 'elbow', arrow: true, label: 'Elbow arrow', icon: '<path d="M4 7h7v10h7"/><path d="M14 14l4 3-4 3"/>' },
  { routing: 'curved', arrow: true, label: 'Curved arrow', icon: '<path d="M4 18Q4 8 18 8"/><path d="M14 5l4 3-4 3"/>' },
];

const UNDO_ICON = '<path d="M3 10h11a5 5 0 0 1 0 10h-4"/><polyline points="7 6 3 10 7 14"/>';
const REDO_ICON = '<path d="M21 10H10a5 5 0 0 0 0 10h4"/><polyline points="17 6 21 10 17 14"/>';

const ALIGN_ITEMS: [AlignOp, string][] = [
  ['left', 'Align left'], ['hcenter', 'Align horizontal centers'], ['right', 'Align right'],
  ['top', 'Align top'], ['vmiddle', 'Align vertical centers'], ['bottom', 'Align bottom'],
];
const DISTRIBUTE_ITEMS: [DistributeOp, string][] = [
  ['hspace', 'Distribute horizontally'], ['vspace', 'Distribute vertically'],
];

const SHAPE_KINDS = new Set<ToolName>(SHAPE_ITEMS.map((s) => s.tool));

function svg(icon: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${icon}</svg>`;
}

export function mountRibbon(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'ribbon';

  // Last-used tool for each split-button face. Faces start on the first item.
  let lastShape: ShapeItem = SHAPE_ITEMS[0];
  let lastConn: ConnItem = CONN_ITEMS[1]; // straight arrow

  // --- Edit group: undo / redo ------------------------------------------------
  const editGroup = groupEl();
  const undoBtn = actionBtn('undo', 'Undo', UNDO_ICON, () => app.undo());
  const redoBtn = actionBtn('redo', 'Redo', REDO_ICON, () => app.redo());
  editGroup.append(undoBtn, redoBtn);

  // --- Insert group: Shapes ▾ / Text / Arrow ▾ --------------------------------
  const insertGroup = groupEl();

  const shapesFace = splitFace('ribbon-shapes-face', 'ribbon-shapes-caret');
  const applyShapeFace = () => { shapesFace.face.dataset.tool = lastShape.tool;
    shapesFace.face.title = lastShape.label; shapesFace.icon.innerHTML = svg(lastShape.icon); };
  applyShapeFace();
  shapesFace.face.addEventListener('click', () => app.setTool(lastShape.tool));
  shapesFace.caret.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup(shapeGallery((item) => { lastShape = item; applyShapeFace(); app.setTool(item.tool); }),
      { anchor: shapesFace.caret, side: 'below' });
  });

  const textBtn = document.createElement('button');
  textBtn.className = 'tool-btn';
  textBtn.dataset.tool = 'text';
  textBtn.title = 'Text box';
  textBtn.innerHTML = svg('<path d="M6 7h12M12 7v11"/>');
  textBtn.addEventListener('click', () => app.setTool('text'));

  const arrowFace = splitFace('ribbon-arrow-face', 'ribbon-arrow-caret');
  const applyArrowFace = () => { arrowFace.face.dataset.routing = lastConn.routing;
    arrowFace.face.dataset.arrow = String(lastConn.arrow); arrowFace.face.title = lastConn.label;
    arrowFace.icon.innerHTML = svg(lastConn.icon); };
  applyArrowFace();
  arrowFace.face.addEventListener('click', () => selectConn(lastConn));
  arrowFace.caret.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup(arrowGallery((item) => { lastConn = item; applyArrowFace(); selectConn(item); }),
      { anchor: arrowFace.caret, side: 'below' });
  });

  insertGroup.append(shapesFace.wrap, textBtn, arrowFace.wrap);

  // --- Arrange group: Group / Ungroup / Order ▾ / Align ▾ ----------------------
  const arrangeGroup = groupEl();
  const groupBtn = cmdBtn('group', 'Group', () => app.group());
  const ungroupBtn = cmdBtn('ungroup', 'Ungroup', () => app.ungroup());
  const orderBtn = cmdBtn('order', 'Order ▾', () => {}, true);
  orderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu([
      { label: 'Bring to front', run: () => app.bringToFront() },
      { label: 'Send to back', run: () => app.sendToBack() },
    ], { anchor: orderBtn, side: 'below' });
  });
  const alignBtn = cmdBtn('align', 'Align ▾', () => {}, true);
  alignBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu(alignMenuEntries(app), { anchor: alignBtn, side: 'below' });
  });
  arrangeGroup.append(groupBtn, ungroupBtn, orderBtn, alignBtn);

  bar.append(editGroup, sepEl(), insertGroup, sepEl(), arrangeGroup);
  container.appendChild(bar);

  function selectConn(item: ConnItem): void {
    app.connectorRouting = item.routing;
    app.connectorArrow = item.arrow;
    app.setTool('arrow');
  }

  const syncActive = () => {
    undoBtn.disabled = !app.canUndo();
    redoBtn.disabled = !app.canRedo();
    shapesFace.face.classList.toggle('active', SHAPE_KINDS.has(app.currentToolName) && app.currentToolName !== 'text');
    textBtn.classList.toggle('active', app.currentToolName === 'text');
    arrowFace.face.classList.toggle('active', app.currentToolName === 'arrow');
    const count = app.selection.size;
    const hasGroup = app.activeTab.nodes.some((n) => app.selection.has(n.id) && !!n.groupId);
    groupBtn.disabled = count < 2;
    ungroupBtn.disabled = !hasGroup;
    orderBtn.disabled = count === 0;
    alignBtn.disabled = count < 2;
  };

  syncActive();
  return { syncActive };
}

// --- small element builders ---------------------------------------------------

function groupEl(): HTMLElement { const g = document.createElement('div'); g.className = 'ribbon-group'; return g; }
function sepEl(): HTMLElement { const s = document.createElement('div'); s.className = 'ribbon-sep'; return s; }

function actionBtn(name: 'undo' | 'redo', label: string, icon: string, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'ribbon-action';
  b.dataset.action = name;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = svg(icon);
  b.addEventListener('click', run);
  return b;
}

function cmdBtn(name: string, label: string, run: () => void, dropdown = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = dropdown ? 'ribbon-cmd ribbon-cmd-dd' : 'ribbon-cmd';
  b.dataset.cmd = name;
  b.textContent = label;
  b.addEventListener('click', run);
  return b;
}

interface SplitFace { wrap: HTMLElement; face: HTMLButtonElement; caret: HTMLButtonElement; icon: HTMLElement }
function splitFace(faceClass: string, caretClass: string): SplitFace {
  const wrap = document.createElement('div');
  wrap.className = 'ribbon-split';
  const face = document.createElement('button');
  face.className = `tool-btn ${faceClass}`;
  const icon = document.createElement('span');
  icon.className = 'ribbon-split-icon';
  face.appendChild(icon);
  const caret = document.createElement('button');
  caret.className = `ribbon-caret ${caretClass}`;
  caret.textContent = '▾';
  caret.setAttribute('aria-label', 'More');
  wrap.append(face, caret);
  return { wrap, face, caret, icon };
}

function shapeGallery(pick: (item: ShapeItem) => void): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'flyout-gallery';
  for (const item of SHAPE_ITEMS) {
    const b = document.createElement('button');
    b.className = 'tool-btn';
    b.dataset.tool = item.tool;
    b.title = item.label;
    b.innerHTML = svg(item.icon);
    b.addEventListener('click', () => pick(item));
    grid.appendChild(b);
  }
  return grid;
}

function arrowGallery(pick: (item: ConnItem) => void): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'flyout-gallery';
  for (const item of CONN_ITEMS) {
    const b = document.createElement('button');
    b.className = 'tool-btn';
    b.dataset.routing = item.routing;
    b.dataset.arrow = String(item.arrow);
    b.title = item.label;
    b.innerHTML = svg(item.icon);
    b.addEventListener('click', () => pick(item));
    grid.appendChild(b);
  }
  return grid;
}

function alignMenuEntries(app: App): MenuEntry[] {
  const entries: MenuEntry[] = ALIGN_ITEMS.map(([op, label]) => ({ label, run: () => app.align(op) }));
  entries.push('separator');
  for (const [op, label] of DISTRIBUTE_ITEMS) entries.push({ label, run: () => app.distribute(op) });
  return entries;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ribbon.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Add ribbon styles**

In `src/style.css`, append:

```css
/* PowerPoint-style ribbon row: Edit / Insert / Arrange groups. */
.ribbon { display: flex; align-items: center; gap: 8px; padding: 4px 8px;
  background: #f3f4f6; border-bottom: 1px solid #ddd; user-select: none; }
.ribbon-group { display: flex; align-items: center; gap: 6px; }
.ribbon-sep { width: 1px; align-self: stretch; background: #dcdcdc; margin: 2px 2px; }
.ribbon-action { width: 34px; height: 34px; border-radius: 6px; border: 1px solid #dcdcdc;
  background: #fff; color: #333; cursor: pointer; display: flex; align-items: center;
  justify-content: center; padding: 0; }
.ribbon-action:not(:disabled):hover { background: #eef2ff; }
.ribbon-action:disabled { opacity: 0.4; cursor: default; }
/* Split button: an icon face + a caret that opens the gallery. */
.ribbon-split { display: inline-flex; align-items: stretch; }
.ribbon .tool-btn { width: 34px; height: 34px; border-radius: 6px; border: 1px solid #dcdcdc;
  background: #fff; color: #333; cursor: pointer; display: flex; align-items: center;
  justify-content: center; padding: 0; box-shadow: none; }
.ribbon .tool-btn:hover { background: #eef2ff; }
.ribbon .tool-btn.active { background: #1e1e1e; color: #fff; border-color: #1e1e1e; }
.ribbon-split .tool-btn { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; }
.ribbon-caret { width: 16px; border: 1px solid #dcdcdc; border-top-left-radius: 0;
  border-bottom-left-radius: 0; border-top-right-radius: 6px; border-bottom-right-radius: 6px;
  background: #fff; color: #555; cursor: pointer; font-size: 10px; padding: 0; }
.ribbon-caret:hover { background: #eef2ff; }
.ribbon-cmd { padding: 6px 10px; border-radius: 6px; border: 1px solid #dcdcdc; background: #fff;
  color: #333; cursor: pointer; font: inherit; white-space: nowrap; }
.ribbon-cmd:not(:disabled):hover { background: #eef2ff; }
.ribbon-cmd:disabled { opacity: 0.4; cursor: default; }
/* Gallery icon buttons keep the same look as the ribbon's own tool buttons. */
.flyout-gallery .tool-btn { width: 34px; height: 34px; border-radius: 6px; border: 1px solid #dcdcdc;
  background: #fff; color: #333; cursor: pointer; display: flex; align-items: center;
  justify-content: center; padding: 0; }
.flyout-gallery .tool-btn:hover { background: #eef2ff; }
```

- [ ] **Step 6: Verify build and commit**

Run: `npm run build && npx vitest run tests/ui/ribbon.test.ts`
Expected: typecheck passes; tests PASS.

```bash
git add src/ui/ribbon.ts tests/ui/ribbon.test.ts src/style.css
git commit -m "feat: add PowerPoint-style ribbon row (Edit / Insert / Arrange)"
```

---

## Task 3: `contextMenu.ts` — three-context right-click menu

One `contextmenu` listener on the canvas host. It suppresses the native menu, selects the shape under the cursor when needed, and opens the empty-canvas / single-shape / multi-selection menu via `openMenu`. Every item calls an existing `App` method.

**Files:**
- Create: `src/ui/contextMenu.ts`
- Test: `tests/ui/contextMenu.test.ts`

**Interfaces:**
- Consumes: `App`; `openMenu`, `type MenuEntry` from `./flyout`; `hitTest` from `../model/geometry`; `isShape`, `expandToGroups` from `../model/document`.
- Produces: `mountContextMenu(app: App, canvasHost: HTMLElement): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/contextMenu.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountContextMenu } from '../../src/ui/contextMenu';
import { closeOpenPopup } from '../../src/ui/flyout';
import { addNode, createShape, createConnector, groupNodes } from '../../src/model/document';

let app: App;
let canvasHost: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  canvasHost = document.createElement('div');
  document.body.appendChild(canvasHost);
  app = new App(canvasHost);          // renderer mounts its <svg> into canvasHost
  mountContextMenu(app, canvasHost);
});
afterEach(() => { closeOpenPopup(); app.destroy(); });

const rightClick = () => canvasHost.dispatchEvent(
  new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
const labels = () => [...document.querySelectorAll('.flyout-item')].map((b) => b.textContent!.replace('✓ ', ''));

describe('context menu — selection contexts', () => {
  it('empty canvas → Paste / Select all / grid toggles, and suppresses the native menu', () => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    canvasHost.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(labels()).toEqual(['Paste', 'Select all', 'Show grid', 'Snap to grid']);
  });

  it('multi-selection → Group present, Ungroup absent without a group', () => {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    rightClick();
    expect(labels()).toContain('Group');
    expect(labels()).not.toContain('Ungroup');
  });

  it('multi-selection with a group → Ungroup present', () => {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    groupNodes(app.activeTab, new Set([a.id, b.id]));
    app.selection = new Set([a.id, b.id]);
    rightClick();
    expect(labels()).toContain('Ungroup');
  });

  it('a single connector menu omits Edit text', () => {
    const s1 = createShape('rect', 0, 0, 40, 40);
    const s2 = createShape('rect', 200, 0, 40, 40);
    const c = createConnector({ nodeId: s1.id }, { nodeId: s2.id });
    addNode(app.activeTab, s1); addNode(app.activeTab, s2); addNode(app.activeTab, c);
    app.selection = new Set([c.id]);
    rightClick(); // clicks empty space (5,5) but selection stays → single menu on the connector
    expect(labels()).not.toContain('Edit text');
  });
});

describe('context menu — actions', () => {
  it('Select all from the canvas menu selects every node', () => {
    addNode(app.activeTab, createShape('rect', 0, 0, 40, 40));
    rightClick();
    [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent === 'Select all')!.click();
    expect(app.selection.size).toBe(1);
  });
});
```

Note: the connector test relies on a size-1 selection producing the single menu even when the right-click misses a shape. See Step 3 — when the cursor hits no shape but a selection already exists, the menu reflects that selection.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/contextMenu.test.ts`
Expected: FAIL — cannot find module `../../src/ui/contextMenu`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/contextMenu.ts`:

```typescript
import type { App } from '../app';
import type { Node, Shape } from '../model/types';
import { openMenu, type MenuEntry } from './flyout';
import { hitTest } from '../model/geometry';
import { isShape, expandToGroups } from '../model/document';

/** Attach the right-click context menu to the canvas host. Suppresses the browser's
 *  native menu and opens one of three menus (empty / single / multi) based on what is
 *  under the cursor and what is selected. Every item calls an existing App method. */
export function mountContextMenu(app: App, canvasHost: HTMLElement): void {
  canvasHost.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const world = app.renderer.toWorld(e.clientX, e.clientY, app.activeTab.viewport);
    const hit = hitTest(app.activeTab.nodes.filter(isShape), world);

    if (hit && !app.selection.has(hit.id)) {
      // Right-click acts on what's under the cursor: select it (whole group), like PPT.
      app.selection = expandToGroups(app.activeTab, new Set([hit.id]));
      app.render();
    }

    const selected: Node[] = app.activeTab.nodes.filter((n) => app.selection.has(n.id));
    let entries: MenuEntry[];
    if (selected.length === 0) entries = canvasMenu(app);
    else if (selected.length === 1) entries = singleMenu(app, selected[0]);
    else entries = multiMenu(app, selected);

    openMenu(entries, { x: e.clientX, y: e.clientY });
  });
}

function canvasMenu(app: App): MenuEntry[] {
  return [
    { label: 'Paste', keys: 'mod+V', run: () => app.paste() },
    { label: 'Select all', keys: 'mod+A', run: () => app.selectAll() },
    'separator',
    { label: 'Show grid', checked: app.showGrid, run: () => { app.showGrid = !app.showGrid; app.render(); } },
    { label: 'Snap to grid', checked: app.snapToGrid, run: () => { app.snapToGrid = !app.snapToGrid; } },
  ];
}

function singleMenu(app: App, node: Node): MenuEntry[] {
  const items: MenuEntry[] = [
    { label: 'Cut', keys: 'mod+X', run: () => app.cut() },
    { label: 'Copy', keys: 'mod+C', run: () => app.copySelection() },
    { label: 'Duplicate', keys: 'mod+D', run: () => app.duplicate() },
  ];
  if (isShape(node)) {
    const shape: Shape = node;
    items.push({ label: 'Edit text', run: () => app.editText(shape) });
  }
  items.push('separator',
    { label: 'Bring to front', run: () => app.bringToFront() },
    { label: 'Send to back', run: () => app.sendToBack() },
    'separator',
    { label: 'Delete', keys: 'Delete', run: () => app.deleteSelection() });
  return items;
}

function multiMenu(app: App, selected: Node[]): MenuEntry[] {
  const hasGroup = selected.some((n) => !!n.groupId);
  const items: MenuEntry[] = [
    { label: 'Cut', keys: 'mod+X', run: () => app.cut() },
    { label: 'Copy', keys: 'mod+C', run: () => app.copySelection() },
    { label: 'Duplicate', keys: 'mod+D', run: () => app.duplicate() },
    'separator',
    { label: 'Group', keys: 'mod+G', run: () => app.group() },
  ];
  if (hasGroup) items.push({ label: 'Ungroup', keys: 'mod+shift+G', run: () => app.ungroup() });
  items.push('separator',
    { label: 'Align', submenu: alignSubmenu(app) },
    { label: 'Bring to front', run: () => app.bringToFront() },
    { label: 'Send to back', run: () => app.sendToBack() },
    'separator',
    { label: 'Delete', keys: 'Delete', run: () => app.deleteSelection() });
  return items;
}

function alignSubmenu(app: App): MenuEntry[] {
  return [
    { label: 'Align left', run: () => app.align('left') },
    { label: 'Align horizontal centers', run: () => app.align('hcenter') },
    { label: 'Align right', run: () => app.align('right') },
    { label: 'Align top', run: () => app.align('top') },
    { label: 'Align vertical centers', run: () => app.align('vmiddle') },
    { label: 'Align bottom', run: () => app.align('bottom') },
    'separator',
    { label: 'Distribute horizontally', run: () => app.distribute('hspace') },
    { label: 'Distribute vertically', run: () => app.distribute('vspace') },
  ];
}
```

Note on `createConnector` in the test: confirm the exact factory signature in `src/model/document.ts` before running (search `export function createConnector`). If it differs, adjust the test's connector construction to match — the production code does not depend on it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/contextMenu.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Verify build and commit**

Run: `npm run build && npx vitest run tests/ui/contextMenu.test.ts`
Expected: typecheck passes; tests PASS.

```bash
git add src/ui/contextMenu.ts tests/ui/contextMenu.test.ts
git commit -m "feat: add three-context right-click menu"
```

---

## Task 4: Cutover — wire ribbon + context menu into `main.ts`, delete the palette

Swap the palette mount for the ribbon, attach the context menu, remove the left palette column and its CSS, and delete `toolPalette.ts` + its test. After this task the app runs the new UI end-to-end and the full suite is green.

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Delete: `src/ui/toolPalette.ts`
- Delete: `tests/ui/toolPalette.test.ts`

- [ ] **Step 1: Rewire `main.ts`**

In `src/main.ts`, change the imports (lines 2-3): replace the `mountToolPalette` import and add the ribbon + context menu imports.

Replace:
```typescript
import { mountMenuBar } from './ui/menubar';
import { mountToolPalette } from './ui/toolPalette';
```
with:
```typescript
import { mountMenuBar } from './ui/menubar';
import { mountRibbon } from './ui/ribbon';
import { mountContextMenu } from './ui/contextMenu';
```

Replace the layout block (lines 16-27) — remove `paletteHost` and drop it from the body:
```typescript
const tabStripHost = document.createElement('div');
const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(tabStripHost, toolbarHost, bodyHost);
```

Replace the mount + onRender wiring (lines 45-50):
```typescript
mountMenuBar(app, toolbarHost);
const ribbon = mountRibbon(app, toolbarHost);
mountContextMenu(app, canvasHost);

const tabs = mountTabs(app, tabStripHost);
const panel = mountProperties(app, propsHost);
app.onRender = () => { panel.update(); tabs.update(); ribbon.syncActive(); };
```

- [ ] **Step 2: Remove dead palette CSS**

In `src/style.css`, delete the three now-unused palette rules:
- `.palette-host { flex: 0 0 auto; }` (line ~25)
- the `.toolpalette { ... }` block (lines ~26-27)
- the `.tool-divider { ... }` rule and its comment (lines ~34-35)

Also delete the base `.tool-btn, .palette-action { ... }` rule and the two follow-on rules that reference `.palette-action` (lines ~28-33) — the ribbon defines its own `.ribbon .tool-btn`, `.ribbon-action`, and `.flyout-gallery .tool-btn` styles, so the circular-button palette styling is no longer referenced.

Keep the two `.tool-btn.active` behaviors via the ribbon rules already added in Task 2. Verify no remaining selector references `toolpalette`, `palette-action`, `palette-host`, or `tool-divider`:

Run: `grep -nE 'toolpalette|palette-action|palette-host|tool-divider' src/style.css`
Expected: no output.

- [ ] **Step 3: Delete the old palette module and its test**

```bash
git rm src/ui/toolPalette.ts tests/ui/toolPalette.test.ts
```

- [ ] **Step 4: Full typecheck + test suite**

Run: `npm run build && npm test`
Expected: `tsc` reports no errors (no dangling `mountToolPalette` / `paletteHost` references); `vitest run` passes the whole suite, including the new `flyout`, `ribbon`, and `contextMenu` specs. If tsc flags an unused import or variable, remove it.

- [ ] **Step 5: Rebuild the single-file bundle**

The portable `quickdraw.html` is generated; regenerate it so the shipped build carries the new UI.

Run: `npm run build:single`
Expected: `quickdraw.html` rewritten with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace tool palette with ribbon + context menu, retire palette"
```

- [ ] **Step 7: Manual browser verification**

Per the browser-verify convention (serve over HTTP, drive via `data-*` DOM — there is no `app` global):

```bash
npm run dev
```
Then in the browser confirm:
1. The ribbon row shows Edit / Insert / Arrange; no left palette column; canvas is wider.
2. `Shapes ▾` opens the 10-shape gallery; picking one lets you draw it; the face updates and re-drawing that shape is one click.
3. `Arrow ▾` opens the 4 connector types; drawing reverts to the select cursor afterward.
4. `Group` / `Ungroup` / `Order ▾` / `Align ▾` enable/disable with the selection and act correctly.
5. Right-click on empty canvas → Paste / Select all / grid toggles; on a shape → single menu (with Edit text); on a multi-selection → Group + (conditionally) Ungroup + Align ▸ submenu. The browser's native menu never appears.
6. Undo/redo buttons enable after an edit and work.

---

## Self-Review

**Spec coverage:**
- Ribbon-lite one row, no tab strip, menubar unchanged → Task 2 (ribbon) + Task 4 (menubar left in place). ✓
- Left palette retired, tools in galleries, last-used one-click face → Task 2. ✓
- Three context menus, Group/Ungroup only when possible → Task 3. ✓
- Edit / Insert / Arrange groups, no format controls → Task 2 (no fill/stroke/font anywhere in ribbon). ✓
- Shared `flyout.ts` behind galleries + menus → Task 1, consumed in Tasks 2-3. ✓
- Zero new `App` commands → every `run`/handler calls an existing method (verified against `src/app.ts`). ✓
- Preserve `data-tool`/`data-routing`/`data-arrow` contract → Task 2 gallery buttons + `ribbon.test.ts`. ✓
- Properties panel untouched → not modified in any task. ✓
- Right-click selects shape under cursor first → Task 3 (`expandToGroups` on hit). ✓
- Out of scope (tab strip, ribbon format group, connector context menu, model/render/tool changes) → none introduced. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The two "confirm the factory signature" notes are verification instructions for existing exports, not deferred implementation. ✓

**Type consistency:** `mountRibbon`/`mountContextMenu`/`mountRibbon().syncActive` names match between definition, `main.ts` wiring, and tests. `MenuEntry`, `PopupPos`, `PopupHandle`, `clampToViewport`, `openPopup`, `openMenu`, `closeOpenPopup` are defined once in Task 1 and consumed with matching signatures in Tasks 2-3. `AlignOp`/`DistributeOp` op strings (`left`/`hcenter`/`right`/`top`/`vmiddle`/`bottom`, `hspace`/`vspace`) match `src/model/align.ts`. ✓
