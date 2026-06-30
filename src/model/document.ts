import type { Node, Shape, ShapeKind, ShapeStyle, Tab, Workspace } from './types';
import { uid } from '../util/id';

export const DEFAULT_STYLE: ShapeStyle = {
  fill: '#ffffff',
  stroke: '#1e1e1e',
  strokeWidth: 2,
  fontSize: 16,
  fontColor: '#1e1e1e',
};

export function createShape(kind: ShapeKind, x: number, y: number, w = 120, h = 70): Shape {
  const style = { ...DEFAULT_STYLE };
  if (kind === 'text') {
    style.fill = 'none';
    style.stroke = 'none';
  }
  return { id: uid('s'), kind, x, y, w, h, style, text: kind === 'text' ? 'Text' : undefined };
}

export function createTab(name = 'Untitled'): Tab {
  return { id: uid('t'), name, nodes: [], viewport: { panX: 0, panY: 0, zoom: 1 } };
}

export function createWorkspace(): Workspace {
  const tab = createTab();
  return { version: 1, tabs: [tab], activeTabId: tab.id };
}

export function getActiveTab(ws: Workspace): Tab {
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
  if (!tab) throw new Error(`active tab ${ws.activeTabId} not found`);
  return tab;
}

export function findNode(tab: Tab, id: string): Node | undefined {
  return tab.nodes.find((n) => n.id === id);
}

export function addNode(tab: Tab, node: Node): void {
  tab.nodes.push(node);
}

export function removeNodes(tab: Tab, ids: Set<string>): void {
  tab.nodes = tab.nodes.filter((n) => !ids.has(n.id));
}

export function reorder(tab: Tab, id: string, dir: 'front' | 'back'): void {
  const i = tab.nodes.findIndex((n) => n.id === id);
  if (i < 0) return;
  const [node] = tab.nodes.splice(i, 1);
  if (dir === 'front') tab.nodes.push(node);
  else tab.nodes.unshift(node);
}

export function cloneWorkspace(ws: Workspace): Workspace {
  return structuredClone(ws);
}

/** Ids of every node sharing `node`'s group (or just the node itself if ungrouped). */
export function groupMembers(tab: Tab, node: Shape): string[] {
  if (!node.groupId) return [node.id];
  const gid = node.groupId;
  return tab.nodes.filter((n) => n.groupId === gid).map((n) => n.id);
}

/** Expand a selection to include every member of any group it touches. */
export function expandToGroups(tab: Tab, ids: Set<string>): Set<string> {
  const groupIds = new Set<string>();
  for (const n of tab.nodes) {
    if (ids.has(n.id) && n.groupId) groupIds.add(n.groupId);
  }
  if (groupIds.size === 0) return new Set(ids);
  const out = new Set(ids);
  for (const n of tab.nodes) {
    if (n.groupId && groupIds.has(n.groupId)) out.add(n.id);
  }
  return out;
}

/**
 * Assign a shared new group id to the selection (expanded to whole groups).
 * Returns the new group id, or null if fewer than two nodes would be grouped.
 */
export function groupNodes(tab: Tab, ids: Set<string>): string | null {
  const members = expandToGroups(tab, ids);
  if (members.size < 2) return null;
  const gid = uid('g');
  for (const n of tab.nodes) {
    if (members.has(n.id)) n.groupId = gid;
  }
  return gid;
}

/** Remove group membership from the selection (and any of its group-mates). */
export function ungroupNodes(tab: Tab, ids: Set<string>): void {
  const members = expandToGroups(tab, ids);
  for (const n of tab.nodes) {
    if (members.has(n.id)) delete n.groupId;
  }
}
