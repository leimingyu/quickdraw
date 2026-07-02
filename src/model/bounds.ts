import type { Tab } from './types';
import { isShape, isConnector, isAttached } from './document';
import type { Box } from './geometry';

/** Axis-aligned bounding box of the tab's content — every shape, plus any free
 *  (unattached) connector endpoint so floating arrows aren't cropped from exports.
 *  Attached endpoints are already covered by their shape's box. Null if empty. */
export function contentBounds(tab: Tab): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let has = false;
  const grow = (x: number, y: number, w = 0, h = 0) => {
    has = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const n of tab.nodes) {
    if (isShape(n)) {
      grow(n.x, n.y, n.w, n.h);
    } else if (isConnector(n)) {
      if (!isAttached(n.from)) grow(n.from.x, n.from.y);
      if (!isAttached(n.to)) grow(n.to.x, n.to.y);
    }
  }
  if (!has) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
