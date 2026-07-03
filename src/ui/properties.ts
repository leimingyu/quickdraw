import type { App } from '../app';
import type { Node, Routing, TextAlign } from '../model/types';
import { isShape, isConnector, groupedShapeUnits, FONT_STACKS, DEFAULT_FONT_FAMILY, type StylePatch } from '../model/document';
import type { AlignOp, DistributeOp } from '../model/align';
import { THEME_GRID, STANDARD_COLORS } from './palette';

// Compact inline glyphs (stroke = currentColor; bars filled). One per align/distribute op.
const ALIGN_ITEMS: [AlignOp, string, string][] = [
  ['left', 'Align left', '<line x1="4" y1="3" x2="4" y2="21"/><rect x="4" y="6" width="13" height="4" rx="1" fill="currentColor" stroke="none"/><rect x="4" y="14" width="8" height="4" rx="1" fill="currentColor" stroke="none"/>'],
  ['hcenter', 'Align horizontal centers', '<line x1="12" y1="3" x2="12" y2="21"/><rect x="5" y="6" width="14" height="4" rx="1" fill="currentColor" stroke="none"/><rect x="8" y="14" width="8" height="4" rx="1" fill="currentColor" stroke="none"/>'],
  ['right', 'Align right', '<line x1="20" y1="3" x2="20" y2="21"/><rect x="7" y="6" width="13" height="4" rx="1" fill="currentColor" stroke="none"/><rect x="12" y="14" width="8" height="4" rx="1" fill="currentColor" stroke="none"/>'],
  ['top', 'Align top', '<line x1="3" y1="4" x2="21" y2="4"/><rect x="6" y="4" width="4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="8" rx="1" fill="currentColor" stroke="none"/>'],
  ['vmiddle', 'Align vertical centers', '<line x1="3" y1="12" x2="21" y2="12"/><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="8" width="4" height="8" rx="1" fill="currentColor" stroke="none"/>'],
  ['bottom', 'Align bottom', '<line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="7" width="4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="12" width="4" height="8" rx="1" fill="currentColor" stroke="none"/>'],
];
const DISTRIBUTE_ITEMS: [DistributeOp, string, string][] = [
  ['hspace', 'Distribute horizontally', '<rect x="3" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="10.5" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="18" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/>'],
  ['vspace', 'Distribute vertically', '<rect x="5" y="3" width="14" height="3" rx="1" fill="currentColor" stroke="none"/><rect x="5" y="10.5" width="14" height="3" rx="1" fill="currentColor" stroke="none"/><rect x="5" y="18" width="14" height="3" rx="1" fill="currentColor" stroke="none"/>'],
];

/** Curated font families offered by the typography control (label, CSS stack). */
const FONT_OPTIONS: [string, string][] = [
  ['Sans', FONT_STACKS.sans],
  ['Serif', FONT_STACKS.serif],
  ['Mono', FONT_STACKS.mono],
  ['Cursive', FONT_STACKS.cursive],
];

export function mountProperties(app: App, container: HTMLElement): { update: () => void } {
  const dock = document.createElement('div');
  dock.className = 'props';
  dock.style.display = 'none';
  container.appendChild(dock);

  let signature = '';

  // At most one color popover is open at a time. Closing removes its listeners.
  let activeAnchor: HTMLElement | null = null;
  let closeActivePopover: (() => void) | null = null;

  const selected = (): Node[] => app.activeTab.nodes.filter((n) => app.selection.has(n.id));

  function update(): void {
    const nodes = selected();
    if (nodes.length === 0) {
      closeActivePopover?.();
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
    closeActivePopover?.(); // a stale popover would be orphaned by replaceChildren
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
      dock.appendChild(selectRow('Family', 'fontFamily', firstShape.style.fontFamily ?? DEFAULT_FONT_FAMILY, FONT_OPTIONS, (v) => ({ fontFamily: v })));
      dock.appendChild(toggleRow('Bold', 'bold', !!firstShape.style.bold, (v) => ({ bold: v })));
      dock.appendChild(toggleRow('Italic', 'italic', !!firstShape.style.italic, (v) => ({ italic: v })));
      dock.appendChild(alignRow(firstShape.style.textAlign ?? 'center'));
      dock.appendChild(rotationRow());
    }
    if (firstConn) {
      dock.appendChild(toggleRow('Arrow start', 'arrowStart', !!firstConn.style.arrowStart, (v) => ({ arrowStart: v })));
      dock.appendChild(toggleRow('Arrow end', 'arrowEnd', firstConn.style.arrowEnd !== false, (v) => ({ arrowEnd: v })));
      dock.appendChild(routingRow(firstConn.style.routing ?? 'straight'));
    }
    // Align needs ≥2 selected units, distribute ≥3 (a group counts as one rigid unit).
    const units = groupedShapeUnits(app.activeTab, app.selection).length;
    if (units >= 2) dock.appendChild(alignRow2());
    if (units >= 3) dock.appendChild(distributeRow());
    dock.appendChild(zorderRow());
  }

  /** A stacked label + a wrapping row of icon buttons (used by align & distribute). */
  function iconSeg(label: string, buttons: HTMLButtonElement[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'props-row props-arrange';
    const span = document.createElement('span');
    span.className = 'props-label';
    span.textContent = label;
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.append(...buttons);
    row.append(span, seg);
    return row;
  }

  function iconButton(icon: string, title: string, set: (b: HTMLButtonElement) => void, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.title = title;
    b.setAttribute('aria-label', title);
    set(b);
    b.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    b.addEventListener('click', onClick);
    return b;
  }

  function alignRow2(): HTMLElement {
    // `data-arrange` (not `data-align`, which the text-align row already uses) for object align.
    const buttons = ALIGN_ITEMS.map(([op, title, icon]) =>
      iconButton(icon, title, (b) => { b.dataset.arrange = op; }, () => app.align(op)));
    return iconSeg('Align', buttons);
  }

  function distributeRow(): HTMLElement {
    const buttons = DISTRIBUTE_ITEMS.map(([op, title, icon]) =>
      iconButton(icon, title, (b) => { b.dataset.distribute = op; }, () => app.distribute(op)));
    return iconSeg('Distribute', buttons);
  }

  function colorRow(label: string, prop: string, value: string, make: (v: string) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const control = document.createElement('div');
    control.className = 'color-control';

    // The native chip is unchanged: it holds the value and is the "More Colors…" OS picker.
    const input = document.createElement('input');
    input.type = 'color';
    input.value = toHex(value);
    input.dataset.prop = prop;
    input.addEventListener('input', () => app.restyle(make(input.value)));
    input.addEventListener('change', () => app.commitStyle());

    // Applying a swatch (incl. 'none', which the native chip can't represent) commits directly.
    const applyColor = (v: string): void => {
      app.restyle(make(v));
      app.commitStyle();
      if (v !== 'none') input.value = toHex(v);
    };

    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'color-caret';
    caret.dataset.colorTrigger = prop;
    caret.title = `${label} — theme & standard colors`;
    caret.setAttribute('aria-label', caret.title);
    caret.innerHTML = '<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor"/></svg>';
    // Fill/line can be cleared to 'none' ("No Fill" / "No Line"); text color cannot.
    const noneLabel = prop === 'fontColor' ? null : `No ${label}`;
    caret.addEventListener('click', () => openColorPopover(control, input.value, noneLabel, applyColor));

    control.append(input, caret);
    row.appendChild(control);
    return row;
  }

  /** PowerPoint-style dropdown: No Fill/Line (optional), Theme Colors, Standard Colors, More Colors…. */
  function openColorPopover(anchor: HTMLElement, current: string, noneLabel: string | null, onPick: (v: string) => void): void {
    const reopeningSame = activeAnchor === anchor;
    closeActivePopover?.();
    if (reopeningSame) return; // second click on the same caret toggles it closed

    const pop = document.createElement('div');
    pop.className = 'color-popover';

    const close = (): void => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      pop.remove();
      if (closeActivePopover === close) { closeActivePopover = null; activeAnchor = null; }
    };
    const onOutside = (e: Event): void => {
      const t = e.target as HTMLElement;
      if (!pop.contains(t) && !anchor.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };

    const swatch = (parent: HTMLElement, v: string): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.swatch = v;
      b.style.background = v;
      b.title = v;
      if (v.toLowerCase() === current.toLowerCase()) b.classList.add('sel');
      b.addEventListener('click', () => { onPick(v); close(); });
      parent.appendChild(b);
    };
    const heading = (text: string): void => {
      const h = document.createElement('div');
      h.className = 'swatch-heading';
      h.textContent = text;
      pop.appendChild(h);
    };
    const grid = (): HTMLElement => {
      const g = document.createElement('div');
      g.className = 'swatch-grid';
      pop.appendChild(g);
      return g;
    };

    if (noneLabel) {
      const none = document.createElement('button');
      none.type = 'button';
      none.className = 'color-none';
      none.dataset.swatch = 'none';
      none.textContent = noneLabel;
      none.addEventListener('click', () => { onPick('none'); close(); });
      pop.appendChild(none);
    }

    heading('Theme Colors');
    const theme = grid();
    for (const rowColors of THEME_GRID) for (const c of rowColors) swatch(theme, c);

    heading('Standard Colors');
    const std = grid();
    for (const c of STANDARD_COLORS) swatch(std, c);

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'color-more';
    more.textContent = 'More Colors…';
    more.addEventListener('click', () => {
      close();
      (anchor.querySelector('input[type="color"]') as HTMLInputElement | null)?.click();
    });
    pop.appendChild(more);

    anchor.appendChild(pop);
    // Fixed positioning escapes the props panel's overflow clip while staying a DOM
    // descendant (so it's still discoverable via the panel). Anchor it under the control,
    // clamped into the viewport; flip above if it would fall off the bottom.
    const cr = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const left = Math.max(8, Math.min(cr.right - pr.width, window.innerWidth - pr.width - 8));
    let top = cr.bottom + 4;
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, cr.top - pr.height - 4);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    activeAnchor = anchor;
    closeActivePopover = close;
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

  function routingRow(current: Routing): HTMLElement {
    const row = labeledRow('Type');
    const seg = document.createElement('div');
    seg.className = 'seg';
    const opts: [Routing, string][] = [['straight', 'Straight'], ['elbow', 'Elbow'], ['curved', 'Curved']];
    for (const [kind, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.routing = kind;
      b.classList.toggle('active', current === kind);
      b.addEventListener('click', () => {
        app.connectorRouting = kind; // also the default for the next drawn connector
        app.restyle({ routing: kind });
        app.commitStyle();
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  function selectRow(label: string, prop: string, value: string, options: [string, string][], make: (v: string) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const select = document.createElement('select');
    select.dataset.prop = prop;
    for (const [optLabel, optValue] of options) {
      const opt = document.createElement('option');
      opt.value = optValue;
      opt.textContent = optLabel;
      if (optValue === value) opt.selected = true;
      select.appendChild(opt);
    }
    // A select change is a single discrete gesture: apply live, then commit once.
    select.addEventListener('change', () => {
      app.restyle(make(select.value));
      app.commitStyle();
    });
    row.appendChild(select);
    return row;
  }

  function alignRow(current: TextAlign): HTMLElement {
    const row = labeledRow('Align');
    const seg = document.createElement('div');
    seg.className = 'seg';
    const opts: [TextAlign, string][] = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
    for (const [val, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.align = val;
      b.classList.toggle('active', current === val);
      b.addEventListener('click', () => {
        app.restyle({ textAlign: val });
        app.commitStyle();
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  /** Reset a rotated shape back to 0° (landscape). Always shown for shapes so it
   *  stays reachable after a rotate drag (which doesn't rebuild this panel). */
  function rotationRow(): HTMLElement {
    const row = labeledRow('Rotation');
    const btn = document.createElement('button');
    btn.textContent = 'Reset';
    btn.dataset.action = 'reset-rotation';
    btn.title = 'Reset rotation to 0° (landscape)';
    btn.addEventListener('click', () => app.resetRotation());
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
