import type { Connector, ConnectorStyle, Endpoint, Node, Shape, ShapeKind, ShapeStyle, Tab, Workspace } from './types';
import { uid } from '../util/id';

/** Curated font stacks for the typography control. Each ends in a generic family
 *  so it still resolves (incl. when PNG export rasterizes the SVG) without web fonts. */
export const FONT_STACKS = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  cursive: "'Comic Sans MS', 'Segoe Script', cursive",
} as const;

export const DEFAULT_FONT_FAMILY = FONT_STACKS.sans;

export const DEFAULT_STYLE: ShapeStyle = {
  fill: '#ffffff', stroke: '#1e1e1e', strokeWidth: 2, fontSize: 16, fontColor: '#1e1e1e',
  fontFamily: DEFAULT_FONT_FAMILY, bold: false, italic: false, textAlign: 'center',
  dashed: false,
};

export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = {
  stroke: '#1e1e1e', strokeWidth: 2, arrowEnd: true, arrowStart: false, dashed: false,
};

export const isConnector = (n: Node): n is Connector => n.kind === 'connector';
export const isShape = (n: Node): n is Shape => n.kind !== 'connector';
export const isAttached = (e: Endpoint): e is Extract<Endpoint, { nodeId: string }> => 'nodeId' in e;

export function createConnector(from: Endpoint, to: Endpoint): Connector {
  return { id: uid('c'), kind: 'connector', from, to, style: { ...DEFAULT_CONNECTOR_STYLE } };
}

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
  const tab = createTab('Tab 1');
  return { version: 1, tabs: [tab], activeTabId: tab.id };
}

export function getActiveTab(ws: Workspace): Tab {
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
  if (!tab) throw new Error(`active tab ${ws.activeTabId} not found`);
  return tab;
}

/** Append a new empty tab named "Tab N" and make it active. Returns the new tab. */
export function addTab(ws: Workspace, name?: string): Tab {
  const tab = createTab(name ?? `Tab ${ws.tabs.length + 1}`);
  ws.tabs.push(tab);
  ws.activeTabId = tab.id;
  return tab;
}

/** Remove a tab. No-op if it's the only tab (a workspace always has ≥1 tab).
 *  If the removed tab was active, activate its left neighbor (or the new first). */
export function removeTab(ws: Workspace, id: string): void {
  if (ws.tabs.length <= 1) return;
  const i = ws.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  ws.tabs.splice(i, 1);
  if (ws.activeTabId === id) {
    const neighbor = ws.tabs[i - 1] ?? ws.tabs[0];
    ws.activeTabId = neighbor.id;
  }
}

/** Rename a tab. A blank/whitespace-only name is ignored (keeps the old name). */
export function renameTab(ws: Workspace, id: string, name: string): void {
  const tab = ws.tabs.find((t) => t.id === id);
  if (!tab) return;
  const trimmed = name.trim();
  if (trimmed) tab.name = trimmed;
}

export function findNode(tab: Tab, id: string): Node | undefined {
  return tab.nodes.find((n) => n.id === id);
}

export function addNode(tab: Tab, node: Node): void {
  tab.nodes.push(node);
}

export function removeNodes(tab: Tab, ids: Set<string>): void {
  const kept = tab.nodes.filter((n) => !ids.has(n.id));
  tab.nodes = kept.filter((n) => {
    if (!isConnector(n)) return true;
    const fromGone = isAttached(n.from) && ids.has(n.from.nodeId);
    const toGone = isAttached(n.to) && ids.has(n.to.nodeId);
    return !fromGone && !toGone;
  });
}

export function pruneDanglingConnectors(tab: Tab): void {
  const shapeIds = new Set(tab.nodes.filter(isShape).map((s) => s.id));
  const endpointOk = (e: Endpoint) => !isAttached(e) || shapeIds.has(e.nodeId);
  tab.nodes = tab.nodes.filter(
    (n) => !isConnector(n) || (endpointOk(n.from) && endpointOk(n.to)),
  );
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
export function groupMembers(tab: Tab, node: Node): string[] {
  if (!node.groupId) return [node.id];
  const gid = node.groupId;
  return tab.nodes.filter((n) => n.groupId === gid).map((n) => n.id);
}

/**
 * Group the selected shapes into rigid units: one array per group (holding its selected
 * members) and one singleton array per ungrouped selected shape. Units are emitted in the
 * order their first member appears in `tab.nodes` (z-order). Connectors are ignored — align,
 * distribute, and grid-snap operate on shapes; attached connectors follow their shapes.
 */
export function groupedShapeUnits(tab: Tab, ids: Set<string>): Shape[][] {
  const units: Shape[][] = [];
  const byGroup = new Map<string, Shape[]>();
  for (const n of tab.nodes) {
    if (!ids.has(n.id) || !isShape(n)) continue;
    if (n.groupId) {
      let bucket = byGroup.get(n.groupId);
      if (!bucket) { bucket = []; byGroup.set(n.groupId, bucket); units.push(bucket); }
      bucket.push(n);
    } else {
      units.push([n]);
    }
  }
  return units;
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

export type StylePatch = Partial<ShapeStyle & ConnectorStyle>;

const SHAPE_ONLY = new Set(['fill', 'fontSize', 'fontColor', 'fontFamily', 'bold', 'italic', 'textAlign']);
const CONNECTOR_ONLY = new Set(['arrowStart', 'arrowEnd', 'routing']);

/** Apply a style patch to the selected nodes, routing each key by node kind. */
export function restyleNodes(tab: Tab, ids: Set<string>, patch: StylePatch): void {
  for (const n of tab.nodes) {
    if (!ids.has(n.id)) continue;
    for (const [key, value] of Object.entries(patch)) {
      if (SHAPE_ONLY.has(key) && !isShape(n)) continue;
      if (CONNECTOR_ONLY.has(key) && !isConnector(n)) continue;
      (n.style as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

/** Move the selected nodes to the front/back of the z-order, preserving relative order. */
export function reorderSelection(tab: Tab, ids: Set<string>, dir: 'front' | 'back'): void {
  const selected = tab.nodes.filter((n) => ids.has(n.id));
  if (selected.length === 0) return;
  const rest = tab.nodes.filter((n) => !ids.has(n.id));
  tab.nodes = dir === 'front' ? [...rest, ...selected] : [...selected, ...rest];
}
