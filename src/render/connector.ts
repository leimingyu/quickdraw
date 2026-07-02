import type { Connector, ConnectionPoint, Endpoint, Shape, Tab } from '../model/types';
import { isAttached, isShape } from '../model/document';
import { shapeHandlePositions, shapeCenter, clipToOutline, outlineExitNormal, type Point } from '../model/geometry';

/** Drop within this many screen px of a connection point to pin an endpoint to it. */
const PIN_DISTANCE = 22;

/** World-unit stub each elbow end leaves the shape by before turning, so the route
 *  exits perpendicular and clears the shape it leaves. */
const ELBOW_STUB = 16;

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

/** An attached end's point on the shape plus the outward orthogonal direction it leaves
 *  (used to route elbows perpendicular to the edge). */
interface End { p: Point; dir: Point; }

/** Outward, axis-aligned normal for a pinned connection point: the handle's offset from
 *  the shape center, snapped to the dominant axis (world space, rotated with the shape). */
function anchorNormal(shape: Shape, anchor: ConnectionPoint): Point {
  const c = shapeCenter(shape);
  const p = shapeHandlePositions(shape)[anchor];
  const dx = p.x - c.x, dy = p.y - c.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx) || 1, y: 0 }
    : { x: 0, y: Math.sign(dy) || 1 };
}

/** Where an attached end meets its shape and the direction it leaves. A pinned end holds
 *  its fixed connection point; a dynamic end clips to the true outline facing `target`. */
function attachedEnd(shape: Shape, e: Endpoint, target: Point): End {
  const pts = shapeHandlePositions(shape);
  if (isAttached(e) && e.anchor && pts[e.anchor]) {
    return { p: pts[e.anchor], dir: anchorNormal(shape, e.anchor) };
  }
  return { p: clipToOutline(shape, target), dir: outlineExitNormal(shape, target) };
}

/** Resolve both ends of a connector: their points and (for attached ends) exit normals.
 *  A floating end has no exit direction (`null`). Null if an attached shape is missing. */
function connectorEnds(tab: Tab, c: Connector): { a: Point; b: Point; da: Point | null; db: Point | null } | null {
  const ca = endpointCenter(tab, c.from);
  const cb = endpointCenter(tab, c.to);
  if (!ca || !cb) return null;
  const sa = attachedShape(tab, c.from);
  const sb = attachedShape(tab, c.to);
  const from = sa ? attachedEnd(sa, c.from, cb) : { p: ca, dir: null };
  const to = sb ? attachedEnd(sb, c.to, ca) : { p: cb, dir: null };
  return { a: from.p, b: to.p, da: from.dir, db: to.dir };
}

/** Attach an endpoint to `shape` at the connection point nearest `world` when the
 *  drop lands on one (pinned/fixed); otherwise attach to the shape body (auto-snap). */
export function attachEndpoint(shape: Shape, world: Point, zoom: number): Endpoint {
  let name: ConnectionPoint | null = null;
  let bestD = Infinity;
  for (const [handle, p] of Object.entries(shapeHandlePositions(shape))) {
    const d = Math.hypot(p.x - world.x, p.y - world.y);
    if (d < bestD) { bestD = d; name = handle as ConnectionPoint; }
  }
  if (name && bestD <= PIN_DISTANCE / zoom) return { nodeId: shape.id, anchor: name };
  return { nodeId: shape.id };
}

export function connectorSegment(tab: Tab, c: Connector): Segment | null {
  const ends = connectorEnds(tab, c);
  if (!ends) return null;
  return { x1: ends.a.x, y1: ends.a.y, x2: ends.b.x, y2: ends.b.y };
}

/** Dominant-axis direction from `from` toward `to` (fallback exit for a floating end). */
function fallbackDir(from: Point, to: Point): Point {
  const dx = to.x - from.x, dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx) || 1, y: 0 }
    : { x: 0, y: Math.sign(dy) || 1 };
}

/**
 * Orthogonal (right-angle) route between the segment ends.
 *
 * With exit directions (`dir1`/`dir2`, the outward edge normals), each end leaves its
 * shape perpendicular by a short stub, then the stubs are joined by a Z (parallel exits)
 * or an L (perpendicular exits) — so the route never cuts back through the two shapes.
 * With no directions (both ends floating) it falls back to the naive midpoint split.
 */
export function elbowRoute(seg: Segment, dir1?: Point | null, dir2?: Point | null): Point[] {
  const { x1, y1, x2, y2 } = seg;
  const p1 = { x: x1, y: y1 }, p2 = { x: x2, y: y2 };
  if (!dir1 && !dir2) {
    if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
      const mx = (x1 + x2) / 2; // split vertically at the horizontal midpoint
      return [p1, { x: mx, y: y1 }, { x: mx, y: y2 }, p2];
    }
    const my = (y1 + y2) / 2; // split horizontally at the vertical midpoint
    return [p1, { x: x1, y: my }, { x: x2, y: my }, p2];
  }
  const d1 = dir1 ?? fallbackDir(p1, p2);
  const d2 = dir2 ?? fallbackDir(p2, p1);
  const a1 = { x: x1 + d1.x * ELBOW_STUB, y: y1 + d1.y * ELBOW_STUB };
  const a2 = { x: x2 + d2.x * ELBOW_STUB, y: y2 + d2.y * ELBOW_STUB };
  const h1 = Math.abs(d1.x) >= Math.abs(d1.y); // leaves horizontally?
  const h2 = Math.abs(d2.x) >= Math.abs(d2.y);
  let mids: Point[];
  if (h1 && h2) {
    const mx = (a1.x + a2.x) / 2; // both horizontal → Z split at mid-x
    mids = [{ x: mx, y: a1.y }, { x: mx, y: a2.y }];
  } else if (!h1 && !h2) {
    const my = (a1.y + a2.y) / 2; // both vertical → Z split at mid-y
    mids = [{ x: a1.x, y: my }, { x: a2.x, y: my }];
  } else if (h1) {
    mids = [{ x: a2.x, y: a1.y }]; // horizontal then vertical → single L corner
  } else {
    mids = [{ x: a1.x, y: a2.y }]; // vertical then horizontal → single L corner
  }
  return [p1, a1, ...mids, a2, p2];
}

/** Control point for the curved (quadratic) route: chord midpoint pushed perpendicular. */
export function curveControl(seg: Segment): Point {
  const { x1, y1, x2, y2 } = seg;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const k = len * 0.22; // bulge as a fraction of span
  return { x: (x1 + x2) / 2 - (dy / len) * k, y: (y1 + y2) / 2 + (dx / len) * k };
}

function sampleQuad(p0: Point, c: Point, p1: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    });
  }
  return pts;
}

/** The connector's drawn points: straight (2 pts), a smart elbow, or a sampled curve. */
export function connectorRoute(tab: Tab, c: Connector): Point[] | null {
  const ends = connectorEnds(tab, c);
  if (!ends) return null;
  const seg = { x1: ends.a.x, y1: ends.a.y, x2: ends.b.x, y2: ends.b.y };
  if (c.style.routing === 'elbow') return elbowRoute(seg, ends.da, ends.db);
  if (c.style.routing === 'curved') {
    return sampleQuad({ x: seg.x1, y: seg.y1 }, curveControl(seg), { x: seg.x2, y: seg.y2 }, 16);
  }
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
    poly.setAttribute('points', connectorRoute(tab, c)!.map((p) => `${p.x},${p.y}`).join(' '));
    poly.setAttribute('fill', 'none'); // a polyline fills by default — must disable
    el = poly;
  } else if (c.style.routing === 'curved') {
    const path = document.createElementNS(NS, 'path');
    const cc = curveControl(seg);
    path.setAttribute('d', `M${seg.x1} ${seg.y1} Q${cc.x} ${cc.y} ${seg.x2} ${seg.y2}`);
    path.setAttribute('fill', 'none');
    el = path;
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
