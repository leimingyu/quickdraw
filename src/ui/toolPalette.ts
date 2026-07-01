import type { App } from '../app';
import type { ToolName } from '../tools/types';
import type { Routing } from '../model/types';

// Inline 24×24 icons (stroke = currentColor so they invert on the active button).
interface Item { tool: ToolName; routing?: Routing; label: string; icon: string }

const ITEMS: Item[] = [
  { tool: 'select', label: 'Select / move', icon: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>' },
  { tool: 'rect', label: 'Rectangle', icon: '<rect x="4" y="6" width="16" height="12" rx="1"/>' },
  { tool: 'rounded', label: 'Rounded rectangle', icon: '<rect x="4" y="6" width="16" height="12" rx="4"/>' },
  { tool: 'ellipse', label: 'Ellipse', icon: '<ellipse cx="12" cy="12" rx="8" ry="6"/>' },
  { tool: 'diamond', label: 'Diamond', icon: '<path d="M12 4l8 8-8 8-8-8z"/>' },
  { tool: 'triangle', label: 'Triangle', icon: '<path d="M12 5l8 14H4z"/>' },
  { tool: 'text', label: 'Text box', icon: '<path d="M6 7h12M12 7v11"/>' },
  { tool: 'arrow', routing: 'straight', label: 'Straight connector', icon: '<path d="M4 12h13"/><path d="M12 7l5 5-5 5"/>' },
  { tool: 'arrow', routing: 'elbow', label: 'Elbow connector', icon: '<path d="M4 7h7v10h7"/><path d="M14 14l4 3-4 3"/>' },
  { tool: 'arrow', routing: 'curved', label: 'Curved connector', icon: '<path d="M4 18Q4 8 18 8"/><path d="M14 5l4 3-4 3"/>' },
];

/**
 * A left-side vertical palette of one-click tool shortcuts (Select, the shapes,
 * and the three connector types), MS-Paint / autodraw style. Returns `syncActive`
 * so the caller can highlight the current tool on every render.
 */
export function mountToolPalette(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'toolpalette';
  const buttons: { item: Item; btn: HTMLButtonElement }[] = [];

  for (const item of ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = item.tool;
    if (item.routing) btn.dataset.routing = item.routing;
    btn.title = item.label;
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML =
      `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${item.icon}</svg>`;
    btn.addEventListener('click', () => {
      if (item.routing) app.connectorRouting = item.routing;
      app.setTool(item.tool); // renders → onRender → syncActive highlights this button
    });
    buttons.push({ item, btn });
    bar.appendChild(btn);
  }

  const syncActive = () => {
    for (const { item, btn } of buttons) {
      const active = item.tool === app.currentToolName &&
        (item.routing === undefined || item.routing === app.connectorRouting);
      btn.classList.toggle('active', active);
    }
  };

  container.appendChild(bar);
  syncActive();
  return { syncActive };
}
