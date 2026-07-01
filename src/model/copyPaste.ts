import type { Endpoint, Node, Tab } from './types';
import { expandToGroups, isConnector, isShape, isAttached } from './document';
import { uid } from '../util/id';

/** Deep-clone the selected nodes (expanded to whole groups) for the clipboard. */
export function copyNodes(tab: Tab, ids: Set<string>): Node[] {
  const sel = expandToGroups(tab, ids);
  return structuredClone(tab.nodes.filter((n) => sel.has(n.id)));
}

function remapEndpoint(
  e: Endpoint,
  idMap: Map<string, string>,
  copiedShapeIds: Set<string>,
  dx: number,
  dy: number,
): Endpoint | null {
  if (isAttached(e)) {
    if (!copiedShapeIds.has(e.nodeId)) return null; // attaches to a shape outside the copy → drop
    return { ...e, nodeId: idMap.get(e.nodeId)! };
  }
  return { x: e.x + dx, y: e.y + dy };
}

/**
 * Clone clipboard nodes with fresh ids (and fresh, independent group ids),
 * offsetting shapes and free connector endpoints by (dx, dy). A connector keeps
 * only endpoints that are free or attach to a copied shape; a connector that
 * references a shape outside the copy is dropped (it would otherwise dangle).
 */
export function pasteNodes(nodes: Node[], dx: number, dy: number): Node[] {
  const idMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const copiedShapeIds = new Set(nodes.filter(isShape).map((n) => n.id));
  for (const n of nodes) idMap.set(n.id, uid(isConnector(n) ? 'c' : 's'));

  const out: Node[] = [];
  for (const n of nodes) {
    const clone = structuredClone(n);
    clone.id = idMap.get(n.id)!;
    if (clone.groupId) {
      const orig = clone.groupId;
      let g = groupMap.get(orig);
      if (!g) { g = uid('g'); groupMap.set(orig, g); }
      clone.groupId = g;
    }
    if (isConnector(clone)) {
      const from = remapEndpoint(clone.from, idMap, copiedShapeIds, dx, dy);
      const to = remapEndpoint(clone.to, idMap, copiedShapeIds, dx, dy);
      if (from && to) { clone.from = from; clone.to = to; out.push(clone); }
    } else {
      clone.x += dx;
      clone.y += dy;
      out.push(clone);
    }
  }
  return out;
}
