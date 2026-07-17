import type { App } from '../app';
import type { ToolName } from '../tools/types';
import type { Routing } from '../model/types';

// Inline 24×24 icons (stroke = currentColor so they invert on the active button).
interface Item { tool: ToolName; routing?: Routing; arrow?: boolean; label: string; icon: string }

const ITEMS: Item[] = [
  { tool: 'select', label: 'Select / move', icon: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>' },
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
  { tool: 'arrow', routing: 'straight', arrow: false, label: 'Line (no arrow)', icon: '<path d="M4 20L20 4"/>' },
  { tool: 'arrow', routing: 'straight', arrow: true, label: 'Straight arrow', icon: '<path d="M4 12h13"/><path d="M12 7l5 5-5 5"/>' },
  { tool: 'arrow', routing: 'elbow', arrow: true, label: 'Elbow arrow', icon: '<path d="M4 7h7v10h7"/><path d="M14 14l4 3-4 3"/>' },
  { tool: 'arrow', routing: 'curved', arrow: true, label: 'Curved arrow', icon: '<path d="M4 18Q4 8 18 8"/><path d="M14 5l4 3-4 3"/>' },
];

/**
 * A left-side vertical palette of one-click tool shortcuts (Select, the shapes,
 * and the three connector types), MS-Paint / autodraw style. Returns `syncActive`
 * so the caller can highlight the current tool on every render.
 */
// Undo/redo edit actions, pinned to the top of the palette (label, data-action, run,
// enabled-predicate, icon). Kept as `.palette-action` (not `.tool-btn`) so tool-selection
// logic and the tool count stay untouched.
interface Action { name: 'undo' | 'redo'; label: string; run: (app: App) => void; can: (app: App) => boolean; icon: string }
const ACTIONS: Action[] = [
  { name: 'undo', label: 'Undo', run: (a) => a.undo(), can: (a) => a.canUndo(),
    icon: '<path d="M3 10h11a5 5 0 0 1 0 10h-4"/><polyline points="7 6 3 10 7 14"/>' },
  { name: 'redo', label: 'Redo', run: (a) => a.redo(), can: (a) => a.canRedo(),
    icon: '<path d="M21 10H10a5 5 0 0 0 0 10h4"/><polyline points="17 6 21 10 17 14"/>' },
];

export function mountToolPalette(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'toolpalette';
  const buttons: { item: Item; btn: HTMLButtonElement }[] = [];
  const actions: { action: Action; btn: HTMLButtonElement }[] = [];

  // Undo / redo first, then a divider, then the tools.
  for (const action of ACTIONS) {
    const btn = document.createElement('button');
    btn.className = 'palette-action';
    btn.dataset.action = action.name;
    btn.title = action.label;
    btn.setAttribute('aria-label', action.label);
    btn.innerHTML =
      `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${action.icon}</svg>`;
    btn.addEventListener('click', () => action.run(app));
    actions.push({ action, btn });
    bar.appendChild(btn);
  }
  const divider = document.createElement('div');
  divider.className = 'tool-divider';
  bar.appendChild(divider);

  for (const item of ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = item.tool;
    if (item.routing) btn.dataset.routing = item.routing;
    if (item.arrow !== undefined) btn.dataset.arrow = String(item.arrow);
    btn.title = item.label;
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML =
      `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${item.icon}</svg>`;
    btn.addEventListener('click', () => {
      if (item.routing) app.connectorRouting = item.routing;
      if (item.arrow !== undefined) app.connectorArrow = item.arrow;
      app.setTool(item.tool); // renders → onRender → syncActive highlights this button
    });
    buttons.push({ item, btn });
    bar.appendChild(btn);
  }

  const syncActive = () => {
    for (const { item, btn } of buttons) {
      const active = item.tool === app.currentToolName &&
        (item.routing === undefined || item.routing === app.connectorRouting) &&
        (item.arrow === undefined || item.arrow === app.connectorArrow);
      btn.classList.toggle('active', active);
    }
    // Grey out undo/redo when the history stack has nothing in that direction.
    for (const { action, btn } of actions) btn.disabled = !action.can(app);
  };

  container.appendChild(bar);
  syncActive();
  return { syncActive };
}
