import type { Connector, ConnectionPoint, Endpoint, Shape, Tab } from '../model/types';
import { isAttached, isShape } from '../model/document';
import { handlePositions, type Box, type Point } from '../model/geometry';

/** Drop within this many screen px of a connection point to pin an endpoint to it. */
const PIN_DISTANCE = 22;

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

/** The shape's connection point (one of the 8 resize-handle positions — 4 corners
 *  + 4 edge midpoints) nearest to `target`. So an attached arrow end always lands
 *  on a "small square", PowerPoint-style, and re-snaps as the shape moves. */
function nearestConnectionPoint(box: Box, target: Point): Point {
  let best: Point = { x: box.x, y: box.y };
  let bestD = Infinity;
  for (const p of Object.values(handlePositions(box))) {
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function boxOf(s: Shape): Box {
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

/** Where an attached end sits on its shape: the pinned point if `anchor` is set,
 *  else the connection point facing the other end's center. */
function attachedPoint(box: Box, e: Endpoint, target: Point): Point {
  if (isAttached(e) && e.anchor) {
    const pinned = handlePositions(box)[e.anchor];
    if (pinned) return pinned; // a valid pinned connection point
  }
  return nearestConnectionPoint(box, target); // dynamic (no/invalid anchor)
}

/** Attach an endpoint to `shape` at the connection point nearest `world` when the
 *  drop lands on one (pinned/fixed); otherwise attach to the shape body (auto-snap). */
export function attachEndpoint(shape: Shape, world: Point, zoom: number): Endpoint {
  let name: ConnectionPoint | null = null;
  let bestD = Infinity;
  for (const [handle, p] of Object.entries(handlePositions(boxOf(shape)))) {
    const d = Math.hypot(p.x - world.x, p.y - world.y);
    if (d < bestD) { bestD = d; name = handle as ConnectionPoint; }
  }
  if (name && bestD <= PIN_DISTANCE / zoom) return { nodeId: shape.id, anchor: name };
  return { nodeId: shape.id };
}

export function connectorSegment(tab: Tab, c: Connector): Segment | null {
  const a = endpointCenter(tab, c.from);
  const b = endpointCenter(tab, c.to);
  if (!a || !b) return null;
  const sa = attachedShape(tab, c.from);
  const sb = attachedShape(tab, c.to);
  const p1 = sa ? attachedPoint(boxOf(sa), c.from, b) : a;
  const p2 = sb ? attachedPoint(boxOf(sb), c.to, a) : b;
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Orthogonal (right-angle) route between the segment ends: a 4-point Z that
 *  splits along the dominant axis. */
export function elbowRoute(seg: Segment): Point[] {
  const { x1, y1, x2, y2 } = seg;
  if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
    const mx = (x1 + x2) / 2; // split vertically at the horizontal midpoint
    return [{ x: x1, y: y1 }, { x: mx, y: y1 }, { x: mx, y: y2 }, { x: x2, y: y2 }];
  }
  const my = (y1 + y2) / 2; // split horizontally at the vertical midpoint
  return [{ x: x1, y: y1 }, { x: x1, y: my }, { x: x2, y: my }, { x: x2, y: y2 }];
}

/** The connector's drawn points: a 2-point straight line, or the elbow route. */
export function connectorRoute(tab: Tab, c: Connector): Point[] | null {
  const seg = connectorSegment(tab, c);
  if (!seg) return null;
  if (c.style.routing === 'elbow') return elbowRoute(seg);
  return [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];
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
  const pts = connectorRoute(tab, c);
  if (!pts) return false;
  for (let i = 0; i + 1 < pts.length; i++) {
    const s = { x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y };
    if (distToSegment(point, s) <= tol) return true;
  }
  return false;
}

export function connectorToSvg(tab: Tab, c: Connector, selected: boolean): SVGGElement | null {
  const seg = connectorSegment(tab, c);
  if (!seg) return null;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', c.id);
  const stroke = selected ? '#3b82f6' : c.style.stroke;
  let el: SVGElement;
  if (c.style.routing === 'elbow') {
    const poly = document.createElementNS(NS, 'polyline');
    poly.setAttribute('points', elbowRoute(seg).map((p) => `${p.x},${p.y}`).join(' '));
    poly.setAttribute('fill', 'none'); // a polyline fills by default — must disable
    el = poly;
  } else {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(seg.x1));
    line.setAttribute('y1', String(seg.y1));
    line.setAttribute('x2', String(seg.x2));
    line.setAttribute('y2', String(seg.y2));
    el = line;
  }
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', String(c.style.strokeWidth));
  if (c.style.arrowEnd) el.setAttribute('marker-end', 'url(#arrowhead)');
  if (c.style.arrowStart) el.setAttribute('marker-start', 'url(#arrowhead)');
  if (c.style.dashed) el.setAttribute('stroke-dasharray', '6 4');
  g.appendChild(el);
  return g;
}
