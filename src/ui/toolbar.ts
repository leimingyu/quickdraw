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
  container.appendChild(bar);
}
