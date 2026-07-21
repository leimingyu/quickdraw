import type { App } from '../app';
import type { ToolName } from '../tools/types';
import type { Routing } from '../model/types';
import type { AlignOp, DistributeOp } from '../model/align';
import { openPopup, openMenu, type MenuEntry } from './flyout';

// Inline 24×24 icons (stroke = currentColor so they invert on the active button).
// Shape + connector data is lifted verbatim from the retired tool palette.
interface ShapeItem { tool: ToolName; label: string; icon: string }
interface ConnItem { routing: Routing; arrow: boolean; label: string; icon: string }

const SHAPE_ITEMS: ShapeItem[] = [
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
];
const CONN_ITEMS: ConnItem[] = [
  { routing: 'straight', arrow: false, label: 'Line (no arrow)', icon: '<path d="M4 20L20 4"/>' },
  { routing: 'straight', arrow: true, label: 'Straight arrow', icon: '<path d="M4 12h13"/><path d="M12 7l5 5-5 5"/>' },
  { routing: 'elbow', arrow: true, label: 'Elbow arrow', icon: '<path d="M4 7h7v10h7"/><path d="M14 14l4 3-4 3"/>' },
  { routing: 'curved', arrow: true, label: 'Curved arrow', icon: '<path d="M4 18Q4 8 18 8"/><path d="M14 5l4 3-4 3"/>' },
];

const UNDO_ICON = '<path d="M3 10h11a5 5 0 0 1 0 10h-4"/><polyline points="7 6 3 10 7 14"/>';
const REDO_ICON = '<path d="M21 10H10a5 5 0 0 0 0 10h4"/><polyline points="17 6 21 10 17 14"/>';

const ALIGN_ITEMS: [AlignOp, string][] = [
  ['left', 'Align left'], ['hcenter', 'Align horizontal centers'], ['right', 'Align right'],
  ['top', 'Align top'], ['vmiddle', 'Align vertical centers'], ['bottom', 'Align bottom'],
];
const DISTRIBUTE_ITEMS: [DistributeOp, string][] = [
  ['hspace', 'Distribute horizontally'], ['vspace', 'Distribute vertically'],
];

const SHAPE_KINDS = new Set<ToolName>(SHAPE_ITEMS.map((s) => s.tool));

function svg(icon: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${icon}</svg>`;
}

export function mountRibbon(app: App, container: HTMLElement): { syncActive: () => void } {
  const bar = document.createElement('div');
  bar.className = 'ribbon';

  // Last-used tool for each split-button face. Faces start on the first item.
  let lastShape: ShapeItem = SHAPE_ITEMS[0];
  let lastConn: ConnItem = CONN_ITEMS[1]; // straight arrow

  // --- Edit group: undo / redo ------------------------------------------------
  const editGroup = groupEl();
  const undoBtn = actionBtn('undo', 'Undo', UNDO_ICON, () => app.undo());
  const redoBtn = actionBtn('redo', 'Redo', REDO_ICON, () => app.redo());
  editGroup.append(undoBtn, redoBtn);

  // --- Insert group: Shapes ▾ / Text / Arrow ▾ --------------------------------
  const insertGroup = groupEl();

  const shapesFace = splitFace('ribbon-shapes-face', 'ribbon-shapes-caret');
  const applyShapeFace = () => { shapesFace.face.dataset.tool = lastShape.tool;
    shapesFace.face.title = lastShape.label; shapesFace.icon.innerHTML = svg(lastShape.icon); };
  applyShapeFace();
  shapesFace.face.addEventListener('click', () => app.setTool(lastShape.tool));
  shapesFace.caret.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup(shapeGallery((item) => { lastShape = item; applyShapeFace(); app.setTool(item.tool); }),
      { anchor: shapesFace.caret, side: 'below' });
  });

  const textBtn = document.createElement('button');
  textBtn.className = 'tool-btn';
  textBtn.dataset.tool = 'text';
  textBtn.title = 'Text box';
  textBtn.innerHTML = svg('<path d="M6 7h12M12 7v11"/>');
  textBtn.addEventListener('click', () => app.setTool('text'));

  const arrowFace = splitFace('ribbon-arrow-face', 'ribbon-arrow-caret');
  const applyArrowFace = () => { arrowFace.face.dataset.routing = lastConn.routing;
    arrowFace.face.dataset.arrow = String(lastConn.arrow); arrowFace.face.title = lastConn.label;
    arrowFace.icon.innerHTML = svg(lastConn.icon); };
  applyArrowFace();
  arrowFace.face.addEventListener('click', () => selectConn(lastConn));
  arrowFace.caret.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup(arrowGallery((item) => { lastConn = item; applyArrowFace(); selectConn(item); }),
      { anchor: arrowFace.caret, side: 'below' });
  });

  insertGroup.append(shapesFace.wrap, textBtn, arrowFace.wrap);

  // --- Arrange group: Group / Ungroup / Order ▾ / Align ▾ ----------------------
  const arrangeGroup = groupEl();
  const groupBtn = cmdBtn('group', 'Group', () => app.group());
  const ungroupBtn = cmdBtn('ungroup', 'Ungroup', () => app.ungroup());
  const orderBtn = cmdBtn('order', 'Order ▾', () => {}, true);
  orderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu([
      { label: 'Bring to front', run: () => app.bringToFront() },
      { label: 'Send to back', run: () => app.sendToBack() },
    ], { anchor: orderBtn, side: 'below' });
  });
  const alignBtn = cmdBtn('align', 'Align ▾', () => {}, true);
  alignBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu(alignMenuEntries(app), { anchor: alignBtn, side: 'below' });
  });
  arrangeGroup.append(groupBtn, ungroupBtn, orderBtn, alignBtn);

  bar.append(editGroup, sepEl(), insertGroup, sepEl(), arrangeGroup);
  container.appendChild(bar);

  function selectConn(item: ConnItem): void {
    app.connectorRouting = item.routing;
    app.connectorArrow = item.arrow;
    app.setTool('arrow');
  }

  const syncActive = () => {
    undoBtn.disabled = !app.canUndo();
    redoBtn.disabled = !app.canRedo();
    shapesFace.face.classList.toggle('active', SHAPE_KINDS.has(app.currentToolName) && app.currentToolName !== 'text');
    textBtn.classList.toggle('active', app.currentToolName === 'text');
    arrowFace.face.classList.toggle('active', app.currentToolName === 'arrow');
    const count = app.selection.size;
    const hasGroup = app.activeTab.nodes.some((n) => app.selection.has(n.id) && !!n.groupId);
    groupBtn.disabled = count < 2;
    ungroupBtn.disabled = !hasGroup;
    orderBtn.disabled = count === 0;
    alignBtn.disabled = count < 2;
  };

  return { syncActive };
}

// --- small element builders ---------------------------------------------------

function groupEl(): HTMLElement { const g = document.createElement('div'); g.className = 'ribbon-group'; return g; }
function sepEl(): HTMLElement { const s = document.createElement('div'); s.className = 'ribbon-sep'; return s; }

function actionBtn(name: 'undo' | 'redo', label: string, icon: string, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'ribbon-action';
  b.dataset.action = name;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = svg(icon);
  b.addEventListener('click', run);
  return b;
}

function cmdBtn(name: string, label: string, run: () => void, dropdown = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = dropdown ? 'ribbon-cmd ribbon-cmd-dd' : 'ribbon-cmd';
  b.dataset.cmd = name;
  b.textContent = label;
  b.addEventListener('click', run);
  return b;
}

interface SplitFace { wrap: HTMLElement; face: HTMLButtonElement; caret: HTMLButtonElement; icon: HTMLElement }
function splitFace(faceClass: string, caretClass: string): SplitFace {
  const wrap = document.createElement('div');
  wrap.className = 'ribbon-split';
  const face = document.createElement('button');
  face.className = `tool-btn ${faceClass}`;
  const icon = document.createElement('span');
  icon.className = 'ribbon-split-icon';
  face.appendChild(icon);
  const caret = document.createElement('button');
  caret.className = `ribbon-caret ${caretClass}`;
  caret.textContent = '▾';
  caret.setAttribute('aria-label', 'More');
  wrap.append(face, caret);
  return { wrap, face, caret, icon };
}

function shapeGallery(pick: (item: ShapeItem) => void): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'flyout-gallery';
  for (const item of SHAPE_ITEMS) {
    const b = document.createElement('button');
    b.className = 'tool-btn';
    b.dataset.tool = item.tool;
    b.title = item.label;
    b.innerHTML = svg(item.icon);
    b.addEventListener('click', () => pick(item));
    grid.appendChild(b);
  }
  return grid;
}

function arrowGallery(pick: (item: ConnItem) => void): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'flyout-gallery';
  for (const item of CONN_ITEMS) {
    const b = document.createElement('button');
    b.className = 'tool-btn';
    b.dataset.routing = item.routing;
    b.dataset.arrow = String(item.arrow);
    b.title = item.label;
    b.innerHTML = svg(item.icon);
    b.addEventListener('click', () => pick(item));
    grid.appendChild(b);
  }
  return grid;
}

function alignMenuEntries(app: App): MenuEntry[] {
  const entries: MenuEntry[] = ALIGN_ITEMS.map(([op, label]) => ({ label, run: () => app.align(op) }));
  entries.push('separator');
  for (const [op, label] of DISTRIBUTE_ITEMS) entries.push({ label, run: () => app.distribute(op) });
  return entries;
}
