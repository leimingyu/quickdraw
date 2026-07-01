import type { App } from '../app';
import type { ToolName } from '../tools/types';
import { saveWorkspace, openWorkspace, exportTabSvg, exportTabPng } from '../io/files';

const TOOLS: { name: ToolName; label: string }[] = [
  { name: 'select', label: 'Select' },
  { name: 'rect', label: 'Rectangle' },
  { name: 'rounded', label: 'Rounded rectangle' },
  { name: 'ellipse', label: 'Ellipse' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'triangle', label: 'Triangle' },
  { name: 'text', label: 'Text box' },
  { name: 'arrow', label: 'Arrow' },
];

type Item = { label: string; run: () => void } | { tool: ToolName; label: string } | 'separator';
interface Menu { title: string; items: Item[] }

/**
 * A Microsoft-Paint-style menu bar: a few dropdown menus (File / Edit / Shapes /
 * View) replacing the old flat button row. Returns `syncActive` so the caller can
 * reflect the current tool (call it on every render).
 */
export function mountMenuBar(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'menubar';

  const menus: Menu[] = [
    {
      title: 'File',
      items: [
        { label: 'Save…', run: () => saveWorkspace(app) },
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
        { label: 'Undo', run: () => app.undo() },
        { label: 'Redo', run: () => app.redo() },
        'separator',
        { label: 'Cut', run: () => app.cut() },
        { label: 'Copy', run: () => app.copySelection() },
        { label: 'Paste', run: () => app.paste() },
        { label: 'Duplicate', run: () => app.duplicate() },
        'separator',
        { label: 'Delete', run: () => app.deleteSelection() },
        { label: 'Select all', run: () => app.selectAll() },
        'separator',
        { label: 'Group', run: () => app.group() },
        { label: 'Ungroup', run: () => app.ungroup() },
      ],
    },
    { title: 'Shapes', items: TOOLS.map((t) => ({ tool: t.name, label: t.label })) },
    {
      title: 'View',
      items: [
        { label: 'Zoom in', run: () => app.zoomBy(1.2) },
        { label: 'Zoom out', run: () => app.zoomBy(1 / 1.2) },
        { label: 'Reset to 100%', run: () => app.resetView() },
      ],
    },
  ];

  let openWrap: HTMLElement | null = null;
  const closeAll = () => { if (openWrap) { openWrap.classList.remove('open'); openWrap = null; } };
  const open = (wrap: HTMLElement) => { closeAll(); wrap.classList.add('open'); openWrap = wrap; };
  const shapeButtons: { name: ToolName; btn: HTMLButtonElement }[] = [];
  let shapesTitle: HTMLButtonElement | null = null;

  for (const menu of menus) {
    const wrap = document.createElement('div');
    wrap.className = 'menu';
    const title = document.createElement('button');
    title.className = 'menu-title';
    title.textContent = menu.title;
    if (menu.title === 'Shapes') shapesTitle = title;
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
      b.textContent = it.label;
      if ('tool' in it) {
        b.dataset.tool = it.tool;
        shapeButtons.push({ name: it.tool, btn: b });
        b.addEventListener('click', () => { app.setTool(it.tool); closeAll(); });
      } else {
        b.addEventListener('click', () => { it.run(); closeAll(); });
      }
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

  const syncActive = () => {
    for (const { name, btn } of shapeButtons) btn.classList.toggle('active', name === app.currentToolName);
    if (shapesTitle) {
      const cur = TOOLS.find((t) => t.name === app.currentToolName);
      shapesTitle.textContent = cur ? `Shapes: ${cur.label}` : 'Shapes';
    }
  };

  container.appendChild(bar);
  syncActive();
  return { syncActive };
}
