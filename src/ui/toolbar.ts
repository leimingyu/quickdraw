import type { App } from '../app';
import type { ToolName } from '../tools/types';
import { saveWorkspace, openWorkspace, exportTabSvg, exportTabPng } from '../io/files';

const TOOLS: { name: ToolName; label: string }[] = [
  { name: 'select', label: 'Select' },
  { name: 'rect', label: 'Rect' },
  { name: 'rounded', label: 'Rounded' },
  { name: 'ellipse', label: 'Ellipse' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'triangle', label: 'Triangle' },
  { name: 'text', label: 'Text' },
  { name: 'arrow', label: 'Arrow' },
];

export function mountToolbar(app: App, container: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'toolbar';
  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.dataset.tool = t.name;
    btn.addEventListener('click', () => {
      app.setTool(t.name);
      for (const b of bar.querySelectorAll('button[data-tool]')) {
        b.classList.toggle('active', (b as HTMLElement).dataset.tool === app.currentToolName);
      }
    });
    bar.appendChild(btn);
  }

  const sep = document.createElement('span');
  sep.style.width = '12px';
  bar.appendChild(sep);

  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.addEventListener('click', () => app.deleteSelection());
  bar.appendChild(del);

  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    if (app.activeTab.nodes.length === 0 || confirm('Clear the whole canvas?')) app.resetTab();
  });
  bar.appendChild(reset);

  const group = document.createElement('button');
  group.textContent = 'Group';
  group.title = 'Group selection (⌘/Ctrl+G)';
  group.addEventListener('click', () => app.group());
  bar.appendChild(group);

  const ungroup = document.createElement('button');
  ungroup.textContent = 'Ungroup';
  ungroup.title = 'Ungroup selection (⌘/Ctrl+Shift+G)';
  ungroup.addEventListener('click', () => app.ungroup());
  bar.appendChild(ungroup);

  const isMac = /mac/i.test(navigator.platform || navigator.userAgent || '');

  const undo = document.createElement('button');
  undo.textContent = isMac ? 'Undo ⌘Z' : 'Undo Ctrl+Z';
  undo.title = 'Undo (⌘Z / Ctrl+Z)';
  undo.addEventListener('click', () => app.undo());
  bar.appendChild(undo);

  const redo = document.createElement('button');
  redo.textContent = isMac ? 'Redo ⌘⇧Z' : 'Redo Ctrl+Y';
  redo.title = 'Redo (⌘⇧Z / Ctrl+Y)';
  redo.addEventListener('click', () => app.redo());
  bar.appendChild(redo);

  const sep2 = document.createElement('span');
  sep2.style.width = '12px';
  bar.appendChild(sep2);

  const save = document.createElement('button');
  save.textContent = 'Save';
  save.title = 'Save drawing (⌘/Ctrl+S)';
  save.addEventListener('click', () => saveWorkspace(app));
  bar.appendChild(save);

  const open = document.createElement('button');
  open.textContent = 'Open';
  open.addEventListener('click', () => openWorkspace(app));
  bar.appendChild(open);

  const exportLabel = document.createElement('span');
  exportLabel.textContent = 'Export:';
  exportLabel.style.alignSelf = 'center';
  exportLabel.style.marginLeft = '8px';
  bar.appendChild(exportLabel);

  const svgBtn = document.createElement('button');
  svgBtn.textContent = 'SVG';
  svgBtn.title = 'Export current tab as SVG';
  svgBtn.addEventListener('click', () => exportTabSvg(app));
  bar.appendChild(svgBtn);

  const pngBtn = document.createElement('button');
  pngBtn.textContent = 'PNG';
  pngBtn.title = 'Export current tab as PNG';
  pngBtn.addEventListener('click', () => exportTabPng(app));
  bar.appendChild(pngBtn);

  container.appendChild(bar);
}
