import type { App } from '../app';
import type { Node, Shape } from '../model/types';
import { openMenu, type MenuEntry } from './flyout';
import { hitTest, type Point } from '../model/geometry';
import { isShape, isConnector, expandToGroups } from '../model/document';
import { connectorHit } from '../render/connector';

/** Attach the right-click context menu to the canvas host. Suppresses the browser's
 *  native menu and opens one of three menus (empty / single / multi) based on what is
 *  under the cursor and what is selected. Every item calls an existing App method. */
export function mountContextMenu(app: App, canvasHost: HTMLElement): void {
  canvasHost.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const world = app.renderer.toWorld(e.clientX, e.clientY, app.activeTab.viewport);
    const hit = hitNode(app, world);

    if (hit && !app.selection.has(hit.id)) {
      // Right-click acts on what's under the cursor: select it (whole group), like PPT.
      app.selection = expandToGroups(app.activeTab, new Set([hit.id]));
      app.render();
    } else if (!hit && app.selection.size > 0) {
      // Right-click on empty canvas deselects — PowerPoint behavior.
      app.selection.clear();
      app.render();
    }

    const selected: Node[] = app.activeTab.nodes.filter((n) => app.selection.has(n.id));
    let entries: MenuEntry[];
    if (selected.length === 0) entries = canvasMenu(app);
    else if (selected.length === 1) entries = singleMenu(app, selected[0]);
    else entries = multiMenu(app, selected);

    openMenu(entries, { x: e.clientX, y: e.clientY });
  });
}

/** Hit-test a shape (topmost) or, failing that, a connector line — mirroring the
 *  select tool, so a right-click on any object acts on it and only a truly empty
 *  click clears the selection. */
function hitNode(app: App, world: Point): Node | undefined {
  const shape = hitTest(app.activeTab.nodes.filter(isShape), world);
  if (shape) return shape;
  const tol = app.grabTolerance(8);
  const connectors = app.activeTab.nodes.filter(isConnector);
  for (let i = connectors.length - 1; i >= 0; i--) {
    if (connectorHit(app.activeTab, connectors[i], world, tol)) return connectors[i];
  }
  return undefined;
}

function canvasMenu(app: App): MenuEntry[] {
  return [
    { label: 'Paste', keys: 'mod+V', run: () => app.paste() },
    { label: 'Select all', keys: 'mod+A', run: () => app.selectAll() },
    'separator',
    { label: 'Show grid', checked: app.showGrid, run: () => { app.showGrid = !app.showGrid; app.render(); } },
    { label: 'Snap to grid', checked: app.snapToGrid, run: () => { app.snapToGrid = !app.snapToGrid; } },
  ];
}

function singleMenu(app: App, node: Node): MenuEntry[] {
  const items: MenuEntry[] = [
    { label: 'Cut', keys: 'mod+X', run: () => app.cut() },
    { label: 'Copy', keys: 'mod+C', run: () => app.copySelection() },
    { label: 'Duplicate', keys: 'mod+D', run: () => app.duplicate() },
  ];
  if (isShape(node)) {
    const shape: Shape = node;
    items.push({ label: 'Edit text', run: () => app.editText(shape) });
  }
  items.push('separator',
    { label: 'Bring to front', run: () => app.bringToFront() },
    { label: 'Send to back', run: () => app.sendToBack() },
    'separator',
    { label: 'Delete', keys: 'Delete', run: () => app.deleteSelection() });
  return items;
}

function multiMenu(app: App, selected: Node[]): MenuEntry[] {
  const hasGroup = selected.some((n) => !!n.groupId);
  const items: MenuEntry[] = [
    { label: 'Cut', keys: 'mod+X', run: () => app.cut() },
    { label: 'Copy', keys: 'mod+C', run: () => app.copySelection() },
    { label: 'Duplicate', keys: 'mod+D', run: () => app.duplicate() },
    'separator',
    { label: 'Group', keys: 'mod+G', run: () => app.group() },
  ];
  if (hasGroup) items.push({ label: 'Ungroup', keys: 'mod+shift+G', run: () => app.ungroup() });
  items.push('separator',
    { label: 'Align', submenu: alignSubmenu(app) },
    { label: 'Bring to front', run: () => app.bringToFront() },
    { label: 'Send to back', run: () => app.sendToBack() },
    'separator',
    { label: 'Delete', keys: 'Delete', run: () => app.deleteSelection() });
  return items;
}

function alignSubmenu(app: App): MenuEntry[] {
  return [
    { label: 'Align left', run: () => app.align('left') },
    { label: 'Align horizontal centers', run: () => app.align('hcenter') },
    { label: 'Align right', run: () => app.align('right') },
    { label: 'Align top', run: () => app.align('top') },
    { label: 'Align vertical centers', run: () => app.align('vmiddle') },
    { label: 'Align bottom', run: () => app.align('bottom') },
    'separator',
    { label: 'Distribute horizontally', run: () => app.distribute('hspace') },
    { label: 'Distribute vertically', run: () => app.distribute('vspace') },
  ];
}
