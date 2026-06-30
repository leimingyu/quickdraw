import type { App } from '../app';
import type { ToolName } from '../tools/types';

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

  const undo = document.createElement('button');
  undo.textContent = 'Undo';
  undo.title = 'Undo (⌘Z / Ctrl+Z)';
  undo.addEventListener('click', () => app.undo());
  bar.appendChild(undo);

  const redo = document.createElement('button');
  redo.textContent = 'Redo';
  redo.title = 'Redo (⌘⇧Z / Ctrl+Y)';
  redo.addEventListener('click', () => app.redo());
  bar.appendChild(redo);

  container.appendChild(bar);
}
