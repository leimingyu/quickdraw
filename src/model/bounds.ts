import type { Tab } from './types';
import { isShape } from './document';
import type { Box } from './geometry';

/** Axis-aligned bounding box of all shapes in the tab, or null if there are none. */
export function contentBounds(tab: Tab): Box | null {
  const shapes = tab.nodes.filter(isShape);
  if (shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w);
    maxY = Math.max(maxY, s.y + s.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
