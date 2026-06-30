import type { Connector, Endpoint, Shape, Tab } from '../model/types';
import { isAttached, isShape } from '../model/document';
import type { Box, Point } from '../model/geometry';

const NS = 'http://www.w3.org/2000/svg';

export interface Segment { x1: number; y1: number; x2: number; y2: number; }

function attachedShape(tab: Tab, e: Endpoint): Shape | null {
  if (!isAttached(e)) return null;
  const n = tab.nodes.find((node) => node.id === e.nodeId);
  return n && isShape(n) ? n : null;
}

export function endpointCenter(tab: Tab, e: Endpoint): Point | null {
  if (isAttached(e)) {
    const s = attachedShape(tab, e);
    if (!s) return null;
    return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  }
  return { x: e.x, y: e.y };
}

/** Point where the ray from the box center toward `toward` crosses the box boundary. */
function clipBoxEdge(box: Box, toward: Point): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx !== 0 ? box.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? box.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

function boxOf(s: Shape): Box {
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

export function connectorSegment(tab: Tab, c: Connector): Segment | null {
  const a = endpointCenter(tab, c.from);
  const b = endpointCenter(tab, c.to);
  if (!a || !b) return null;
  const sa = attachedShape(tab, c.from);
  const sb = attachedShape(tab, c.to);
  const p1 = sa ? clipBoxEdge(boxOf(sa), b) : a;
  const p2 = sb ? clipBoxEdge(boxOf(sb), a) : b;
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function distToSegment(p: Point, s: Segment): number {
  const vx = s.x2 - s.x1;
  const vy = s.y2 - s.y1;
  const wx = p.x - s.x1;
  const wy = p.y - s.y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const px = s.x1 + t * vx;
  const py = s.y1 + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}

export function connectorHit(tab: Tab, c: Connector, point: Point, tol: number): boolean {
  const seg = connectorSegment(tab, c);
  return seg ? distToSegment(point, seg) <= tol : false;
}

export function connectorToSvg(tab: Tab, c: Connector, selected: boolean): SVGGElement | null {
  const seg = connectorSegment(tab, c);
  if (!seg) return null;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', c.id);
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', String(seg.x1));
  line.setAttribute('y1', String(seg.y1));
  line.setAttribute('x2', String(seg.x2));
  line.setAttribute('y2', String(seg.y2));
  line.setAttribute('stroke', selected ? '#3b82f6' : c.style.stroke);
  line.setAttribute('stroke-width', String(c.style.strokeWidth));
  if (c.style.arrowEnd) line.setAttribute('marker-end', 'url(#arrowhead)');
  if (c.style.arrowStart) line.setAttribute('marker-start', 'url(#arrowhead)');
  if (c.style.dashed) line.setAttribute('stroke-dasharray', '6 4');
  g.appendChild(line);
  return g;
}
