import type { App } from '../app';
import { saveWorkspace, openWorkspace, exportTabSvg, exportTabPng } from '../io/files';
import { isMac, formatShortcut } from './platform';

type Item = { label: string; run: () => void; keys?: string } | 'separator';
interface Menu { title: string; items: Item[] }

/**
 * A Microsoft-Paint-style menu bar: dropdown menus (File / Edit / View) for
 * commands. Tools live in the left-side tool palette, not here.
 */
export function mountMenuBar(app: App, container: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'menubar';

  const menus: Menu[] = [
    {
      title: 'File',
      items: [
        { label: 'Save…', run: () => saveWorkspace(app), keys: 'mod+S' },
        { label: 'Open…', run: () => openWorkspace(app) },
        'separator',
        { label: 'Export as SVG', run: () => exportTabSvg(app) },
        { label: 'Export as PNG (300 DPI)', run: () => exportTabPng(app) },
        'separator',
        { label: 'Clear canvas', run: () => { if (app.activeTab.nodes.length === 0 || confirm('Clear the whole canvas?')) app.resetTab(); } },
      ],
    },
    {
      title: 'Edit',
      items: [
        { label: 'Undo', run: () => app.undo(), keys: 'mod+Z' },
        { label: 'Redo', run: () => app.redo(), keys: 'mod+shift+Z' },
        'separator',
        { label: 'Cut', run: () => app.cut(), keys: 'mod+X' },
        { label: 'Copy', run: () => app.copySelection(), keys: 'mod+C' },
        { label: 'Paste', run: () => app.paste(), keys: 'mod+V' },
        { label: 'Duplicate', run: () => app.duplicate(), keys: 'mod+D' },
        'separator',
        { label: 'Delete', run: () => app.deleteSelection(), keys: 'Delete' },
        { label: 'Select all', run: () => app.selectAll(), keys: 'mod+A' },
        'separator',
        { label: 'Group', run: () => app.group(), keys: 'mod+G' },
        { label: 'Ungroup', run: () => app.ungroup(), keys: 'mod+shift+G' },
      ],
    },
    {
      title: 'View',
      items: [
        { label: 'Zoom in', run: () => app.zoomBy(1.2) },
        { label: 'Zoom out', run: () => app.zoomBy(1 / 1.2) },
        { label: 'Reset to 100%', run: () => app.resetView() },
      ],
    },
  ];

  const mac = isMac(); // shortcut hints show ⌘ on Mac, Ctrl on Windows/Linux
  let openWrap: HTMLElement | null = null;
  const closeAll = () => { if (openWrap) { openWrap.classList.remove('open'); openWrap = null; } };
  const open = (wrap: HTMLElement) => { closeAll(); wrap.classList.add('open'); openWrap = wrap; };

  for (const menu of menus) {
    const wrap = document.createElement('div');
    wrap.className = 'menu';
    const title = document.createElement('button');
    title.className = 'menu-title';
    title.textContent = menu.title;
    const items = document.createElement('div');
    items.className = 'menu-items';

    for (const it of menu.items) {
      if (it === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menu-sep';
        items.appendChild(sep);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'menu-item';
      const label = document.createElement('span');
      label.textContent = it.label;
      b.appendChild(label);
      if (it.keys) {
        const hint = document.createElement('span');
        hint.className = 'menu-key';
        hint.textContent = formatShortcut(it.keys, mac);
        b.appendChild(hint);
      }
      b.addEventListener('click', () => { it.run(); closeAll(); });
      items.appendChild(b);
    }

    title.addEventListener('click', (e) => {
      e.stopPropagation(); // don't let the document handler immediately re-close it
      if (wrap.classList.contains('open')) closeAll();
      else open(wrap);
    });
    // Once any menu is open, hovering another title switches to it (real menu-bar feel).
    title.addEventListener('mouseenter', () => { if (openWrap && openWrap !== wrap) open(wrap); });

    wrap.append(title, items);
    bar.appendChild(wrap);
  }

  document.addEventListener('click', closeAll); // click anywhere else closes the menu
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  container.appendChild(bar);
}
