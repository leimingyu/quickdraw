import type { Shape, Viewport } from './types';

export interface Point { x: number; y: number; }
export interface Box { x: number; y: number; w: number; h: number; }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_SIZE = 8;
const DEG = Math.PI / 180;

/** World-unit distance the rotation knob sits above a shape's top edge. */
export const ROTATION_KNOB_DIST = 24;

const OPPOSITE: Record<Handle, Handle> = {
  nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e',
};
export const oppositeHandle = (h: Handle): Handle => OPPOSITE[h];

/** Rotate vector (px,py) by `deg` (clockwise in screen coords) around the origin. */
function rotateVec(px: number, py: number, deg: number): Point {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  return { x: px * c - py * s, y: px * s + py * c };
}

/** Rotate `p` by `deg` around `center`. */
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  const v = rotateVec(p.x - center.x, p.y - center.y, deg);
  return { x: center.x + v.x, y: center.y + v.y };
}

export const shapeCenter = (s: { x: number; y: number; w: number; h: number }): Point =>
  ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

export function pointInShape(s: Shape, p: Point): boolean {
  if (s.rotation) p = rotatePoint(p, shapeCenter(s), -s.rotation); // test in the shape's unrotated frame
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const rx = s.w / 2;
  const ry = s.h / 2;
  if (rx <= 0 || ry <= 0) return false;
  switch (s.kind) {
    case 'ellipse': {
      const nx = (p.x - cx) / rx;
      const ny = (p.y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }
    case 'diamond': {
      return Math.abs((p.x - cx) / rx) + Math.abs((p.y - cy) / ry) <= 1;
    }
    default: // rect, rounded, triangle, text: bounding box
      return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
  }
}

export function hitTest(nodes: Shape[], p: Point): Shape | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (pointInShape(nodes[i], p)) return nodes[i];
  }
  return undefined;
}

export function shapeInRect(s: Shape, box: Box): boolean {
  return !(s.x > box.x + box.w || s.x + s.w < box.x || s.y > box.y + box.h || s.y + s.h < box.y);
}

export function selectionBounds(shapes: Shape[]): Box | null {
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

export function resizeBox(box: Box, handle: Handle, dx: number, dy: number): Box {
  let { x, y, w, h } = box;
  if (handle.includes('e')) w += dx;
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) { x += dx; w -= dx; }
  if (handle.includes('n')) { y += dy; h -= dy; }
  if (w < MIN_SIZE) { if (handle.includes('w')) x -= (MIN_SIZE - w); w = MIN_SIZE; }
  if (h < MIN_SIZE) { if (handle.includes('n')) y -= (MIN_SIZE - h); h = MIN_SIZE; }
  return { x, y, w, h };
}

export function handlePositions(b: Box): Record<Handle, Point> {
  const { x, y, w, h } = b;
  return {
    nw: { x, y }, n: { x: x + w / 2, y }, ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 }, se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h }, sw: { x, y: y + h }, w: { x, y: y + h / 2 },
  };
}

/** Handle positions in world space, rotated with the shape. */
export function shapeHandlePositions(s: Shape): Record<Handle, Point> {
  const base = handlePositions({ x: s.x, y: s.y, w: s.w, h: s.h });
  if (!s.rotation) return base;
  const c = shapeCenter(s);
  const out = {} as Record<Handle, Point>;
  for (const k of Object.keys(base) as Handle[]) out[k] = rotatePoint(base[k], c, s.rotation);
  return out;
}

/** The rotation knob position: `dist` world units past the top-middle edge, rotated. */
export function rotationHandlePos(s: Shape, dist: number): Point {
  const c = shapeCenter(s);
  return rotatePoint({ x: c.x, y: s.y - dist }, c, s.rotation ?? 0);
}

/**
 * Resize a rotated box: drag `handle` to `pointer` (world) while keeping the
 * opposite handle pinned in world space. Returns the new axis-aligned box (its
 * rotation is unchanged). With deg=0 this is a normal opposite-corner-fixed resize.
 */
export function resizeRotatedBox(box0: Box, handle: Handle, deg: number, pointer: Point): Box {
  const center0 = shapeCenter(box0);
  const opp = OPPOSITE[handle];
  const anchor = rotatePoint(handlePositions(box0)[opp], center0, deg); // fixed in world
  const d = rotateVec(pointer.x - anchor.x, pointer.y - anchor.y, -deg); // extents in local frame
  let w = box0.w, h = box0.h;
  if (handle.includes('e') || handle.includes('w')) w = Math.max(MIN_SIZE, Math.abs(d.x));
  if (handle.includes('n') || handle.includes('s')) h = Math.max(MIN_SIZE, Math.abs(d.y));
  const sx = opp.includes('w') ? -1 : opp.includes('e') ? 1 : 0;
  const sy = opp.includes('n') ? -1 : opp.includes('s') ? 1 : 0;
  const oa = rotateVec((sx * w) / 2, (sy * h) / 2, deg); // anchor offset from center in the new box
  const center = { x: anchor.x - oa.x, y: anchor.y - oa.y };
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}

/** The angle (degrees) from a shape's center to a world point, 0 = straight up. */
export function angleFromCenter(center: Point, p: Point): number {
  return Math.atan2(p.x - center.x, center.y - p.y) / DEG;
}

export function zoomAt(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const worldX = (screenX - vp.panX) / vp.zoom;
  const worldY = (screenY - vp.panY) / vp.zoom;
  const zoom = Math.min(8, Math.max(0.1, vp.zoom * factor));
  return { zoom, panX: screenX - worldX * zoom, panY: screenY - worldY * zoom };
}
