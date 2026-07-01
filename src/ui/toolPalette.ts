import type { App } from '../app';
import type { ToolName } from '../tools/types';

// Inline 24×24 icons (stroke = currentColor so they invert on the active button).
const ICON: Record<ToolName, string> = {
  select: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  rounded: '<rect x="4" y="6" width="16" height="12" rx="4"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  diamond: '<path d="M12 4l8 8-8 8-8-8z"/>',
  triangle: '<path d="M12 5l8 14H4z"/>',
  text: '<path d="M6 7h12M12 7v11"/>',
  arrow: '<path d="M4 12h13M12 7l5 5-5 5"/>',
};

const TOOLS: { name: ToolName; label: string }[] = [
  { name: 'select', label: 'Select / move' },
  { name: 'rect', label: 'Rectangle' },
  { name: 'rounded', label: 'Rounded rectangle' },
  { name: 'ellipse', label: 'Ellipse' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'triangle', label: 'Triangle' },
  { name: 'text', label: 'Text box' },
  { name: 'arrow', label: 'Arrow / connector' },
];

/**
 * A left-side vertical palette of one-click tool shortcuts (Select, the shapes,
 * and the connector), MS-Paint / autodraw style. Returns `syncActive` so the
 * caller can highlight the current tool on every render.
 */
export function mountToolPalette(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'toolpalette';
  const buttons: { name: ToolName; btn: HTMLButtonElement }[] = [];

  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = t.name;
    btn.title = t.label;
    btn.setAttribute('aria-label', t.label);
    btn.innerHTML =
      `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${ICON[t.name]}</svg>`;
    btn.addEventListener('click', () => app.setTool(t.name));
    buttons.push({ name: t.name, btn });
    bar.appendChild(btn);
  }

  const syncActive = () => {
    for (const { name, btn } of buttons) btn.classList.toggle('active', name === app.currentToolName);
  };

  container.appendChild(bar);
  syncActive();
  return { syncActive };
}
