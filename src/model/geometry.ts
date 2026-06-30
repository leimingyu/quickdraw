import type { Shape, Viewport } from './types';

export interface Point { x: number; y: number; }
export interface Box { x: number; y: number; w: number; h: number; }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_SIZE = 8;

export function pointInShape(s: Shape, p: Point): boolean {
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

export function zoomAt(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const worldX = (screenX - vp.panX) / vp.zoom;
  const worldY = (screenY - vp.panY) / vp.zoom;
  const zoom = Math.min(8, Math.max(0.1, vp.zoom * factor));
  return { zoom, panX: screenX - worldX * zoom, panY: screenY - worldY * zoom };
}
