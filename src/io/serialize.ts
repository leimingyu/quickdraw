import type { Workspace } from '../model/types';

export const SAVE_VERSION = 1;

export interface QuickDrawFile {
  format: 'quickdraw';
  version: number;
  workspace: Workspace;
}

/** Serialize the workspace to a pretty-printed QuickDraw file string. */
export function serializeWorkspace(ws: Workspace): string {
  const file: QuickDrawFile = { format: 'quickdraw', version: SAVE_VERSION, workspace: ws };
  return JSON.stringify(file, null, 2);
}

/** Parse + validate a QuickDraw file string. Throws Error (user-facing message) on anything invalid. */
export function deserializeWorkspace(text: string): Workspace {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const file = obj as Partial<QuickDrawFile> | null;
  if (!file || file.format !== 'quickdraw') {
    throw new Error("This isn't a QuickDraw file.");
  }
  if (typeof file.version !== 'number') {
    throw new Error('This QuickDraw file is corrupt or incomplete.');
  }
  if (file.version > SAVE_VERSION) {
    throw new Error('This file was made with a newer version of QuickDraw.');
  }
  const ws = file.workspace;
  if (!isValidWorkspace(ws)) {
    throw new Error('This QuickDraw file is corrupt or incomplete.');
  }
  if (!ws.tabs.some((t) => t.id === ws.activeTabId)) {
    ws.activeTabId = ws.tabs[0].id; // repair a dangling active id
  }
  return ws;
}

function isValidWorkspace(ws: unknown): ws is Workspace {
  if (!ws || typeof ws !== 'object') return false;
  const w = ws as Record<string, unknown>;
  if (!Array.isArray(w.tabs) || w.tabs.length === 0) return false;
  if (typeof w.activeTabId !== 'string') return false;
  return w.tabs.every((t) => {
    if (!t || typeof t !== 'object') return false;
    const tab = t as Record<string, unknown>;
    const vp = tab.viewport as Record<string, unknown> | undefined;
    return (
      typeof tab.id === 'string' &&
      typeof tab.name === 'string' &&
      Array.isArray(tab.nodes) &&
      (tab.nodes as unknown[]).every(isValidNode) &&
      !!vp &&
      typeof vp.panX === 'number' &&
      typeof vp.panY === 'number' &&
      typeof vp.zoom === 'number'
    );
  });
}

/** A node is well-enough-formed that pruning and rendering won't throw on it.
 *  (Shapes need numeric geometry + a style object; connectors need object endpoints + style.) */
function isValidNode(n: unknown): boolean {
  if (!n || typeof n !== 'object') return false;
  const node = n as Record<string, unknown>;
  if (typeof node.kind !== 'string') return false;
  if (!node.style || typeof node.style !== 'object') return false;
  if (node.kind === 'connector') {
    return !!node.from && typeof node.from === 'object' && !!node.to && typeof node.to === 'object';
  }
  return (
    typeof node.x === 'number' &&
    typeof node.y === 'number' &&
    typeof node.w === 'number' &&
    typeof node.h === 'number'
  );
}
