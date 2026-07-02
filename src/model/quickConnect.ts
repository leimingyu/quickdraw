import type { Connector, Shape } from './types';
import { createConnector, createShape } from './document';
import { shapeCenter, shapeHandlePositions, type Point } from './geometry';

/** The four edge ports used for quick-connect. The name doubles as the
 *  `ConnectionPoint` anchor an endpoint pins to. */
export type Port = 'n' | 'e' | 's' | 'w';

export const PORTS: Port[] = ['n', 'e', 's', 'w'];

/** The side of a duplicated shape that faces back toward its source. */
export const OPPOSITE: Record<Port, Port> = { n: 's', e: 'w', s: 'n', w: 'e' };

/** World units a port marker sits outside its edge midpoint. */
export const PORT_OFFSET = 18;

/** Gap (world units) between a source shape and its duplicate. */
export const DUP_GAP = 60;

/** The four port marker positions: each edge midpoint (rotated with the shape)
 *  pushed outward along the center→midpoint normal by `PORT_OFFSET`. */
export function portPoints(s: Shape): Record<Port, Point> {
  const mids = shapeHandlePositions(s); // rotated edge midpoints (n/e/s/w among the 8)
  const c = shapeCenter(s);
  const out = {} as Record<Port, Point>;
  for (const port of PORTS) {
    const m = mids[port];
    const dx = m.x - c.x;
    const dy = m.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    out[port] = { x: m.x + (dx / len) * PORT_OFFSET, y: m.y + (dy / len) * PORT_OFFSET };
  }
  return out;
}

/** A fresh shape with `src`'s kind/size/style, centered at (cx, cy), rotation 0,
 *  no text — the "clone" produced when a quick-connect drag lands on empty. */
export function cloneShapeAt(src: Shape, cx: number, cy: number): Shape {
  const shape = createShape(src.kind, cx - src.w / 2, cy - src.h / 2, src.w, src.h);
  shape.style = { ...src.style };
  return shape;
}

/** Duplicate `src` one `DUP_GAP` away in `port`'s direction (aligned on the cross
 *  axis) and connect the two, source port → the clone's opposite side. */
export function duplicateInDirection(src: Shape, port: Port): { shape: Shape; connector: Connector } {
  let x = src.x;
  let y = src.y;
  switch (port) {
    case 'e': x = src.x + src.w + DUP_GAP; break;
    case 'w': x = src.x - src.w - DUP_GAP; break;
    case 's': y = src.y + src.h + DUP_GAP; break;
    case 'n': y = src.y - src.h - DUP_GAP; break;
  }
  const shape = createShape(src.kind, x, y, src.w, src.h);
  shape.style = { ...src.style };
  const connector = createConnector(
    { nodeId: src.id, anchor: port },
    { nodeId: shape.id, anchor: OPPOSITE[port] },
  );
  return { shape, connector };
}
