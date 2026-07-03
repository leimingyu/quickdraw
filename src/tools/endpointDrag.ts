import type { App } from '../app';
import type { Connector } from '../model/types';
import { hitTest, type Point } from '../model/geometry';
import { isShape, isConnector } from '../model/document';
import { connectorSegment, attachEndpoint } from '../render/connector';

const GRAB = 10; // screen px within which a press grabs an endpoint handle

/**
 * Drag a connector's endpoint: it follows the cursor, attaches to a shape it is
 * released on (`{ nodeId }`) or floats otherwise (`{ x, y }`). Shared by the
 * Select and Arrow tools so both edit endpoints identically; a press with no
 * drag is a no-op (leaves the endpoint untouched, records no history).
 */
export class EndpointDrag {
  private conn: Connector | null = null;
  private end: 'from' | 'to' | null = null;
  private moved = false;

  constructor(private app: App) {}

  get active(): boolean {
    return this.conn !== null;
  }

  private grab(conn: Connector, world: Point): boolean {
    const seg = connectorSegment(this.app.activeTab, conn);
    if (!seg) return false;
    const tol = this.app.grabTolerance(GRAB); // screen-constant, widened for touch/pen
    const near = (x: number, y: number) =>
      Math.abs(world.x - x) <= tol && Math.abs(world.y - y) <= tol;
    if (near(seg.x1, seg.y1)) { this.conn = conn; this.end = 'from'; this.moved = false; return true; }
    if (near(seg.x2, seg.y2)) { this.conn = conn; this.end = 'to'; this.moved = false; return true; }
    return false;
  }

  /** Start dragging an endpoint of the given connector (the selected one), or no-op. */
  beginOn(conn: Connector | null, world: Point): boolean {
    return conn ? this.grab(conn, world) : false;
  }

  /** Start dragging an endpoint of ANY connector under `world` (topmost first),
   *  selecting it — so an arrow's end can be re-routed without first selecting it. */
  beginAny(world: Point): boolean {
    const connectors = this.app.activeTab.nodes.filter(isConnector);
    for (let i = connectors.length - 1; i >= 0; i--) {
      if (this.grab(connectors[i], world)) {
        this.app.selection = new Set([connectors[i].id]);
        this.app.render();
        return true;
      }
    }
    return false;
  }

  move(world: Point): void {
    if (!this.conn || !this.end) return;
    this.moved = true;
    this.conn[this.end] = { x: world.x, y: world.y };
    const t = hitTest(this.app.activeTab.nodes.filter(isShape), world);
    this.app.highlightId = t ? t.id : undefined;
    this.app.render();
  }

  finish(world: Point): void {
    if (!this.conn || !this.end) return;
    this.app.highlightId = undefined;
    if (this.moved) {
      const t = hitTest(this.app.activeTab.nodes.filter(isShape), world);
      this.conn[this.end] = t
        ? attachEndpoint(t, world, this.app.activeTab.viewport.zoom)
        : { x: world.x, y: world.y };
      this.app.commit(); // commit() re-renders with the final endpoint
    } else {
      this.app.render(); // a click with no drag leaves the endpoint untouched
    }
    this.reset();
  }

  /** Abandon an in-progress drag (tool switch / pointercancel), committing any move so far. */
  cancel(): void {
    if (!this.conn) return;
    if (this.moved) this.app.commit();
    this.app.highlightId = undefined;
    this.reset();
  }

  private reset(): void {
    this.conn = null;
    this.end = null;
    this.moved = false;
  }
}
