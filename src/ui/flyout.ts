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
