import type { App } from '../app';
import type { Connector, Endpoint } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import { attachEndpoint } from '../render/connector';
import { EndpointDrag } from './endpointDrag';
import type { Tool } from './types';

const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click, no arrow

/** Draw arrows by dragging between any two points. An end that lands on a shape
 *  attaches to it (`{ nodeId }`), otherwise it floats (`{ x, y }`). Pressing an
 *  existing arrow's endpoint re-routes it instead of drawing a new arrow. Stays
 *  active for continuous drawing; Esc returns to the select tool. */
export class ConnectorTool implements Tool {
  private start: Point | null = null;
  private preview: Connector | null = null;
  private endpoints: EndpointDrag;

  constructor(private app: App) {
    this.endpoints = new EndpointDrag(app);
  }

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  /** A shape under `world` → attached endpoint (pinned to a connection point if the
   *  drop lands on one); otherwise a free point. */
  private endpointAt(world: Point): Endpoint {
    const s = this.shapeAt(world);
    return s ? attachEndpoint(s, world, this.app.activeTab.viewport.zoom) : { x: world.x, y: world.y };
  }

  onPointerDown(world: Point): void {
    // Grabbing an existing arrow's endpoint edits it instead of drawing a new one.
    if (this.endpoints.beginAny(world)) return;
    this.start = world;
    const c = createConnector(this.endpointAt(world), { x: world.x, y: world.y });
    if (this.app.connectorRouting !== 'straight') c.style.routing = this.app.connectorRouting; // straight stays unset
    c.style.arrowEnd = this.app.connectorArrow; // false → a plain line (PowerPoint-style)
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (this.endpoints.active) { this.endpoints.move(world); return; }
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (this.endpoints.active) { this.endpoints.finish(world); return; }
    if (!this.preview || !this.start) return;
    const dx = Math.abs(world.x - this.start.x);
    const dy = Math.abs(world.y - this.start.y);
    const threshold = DRAG_THRESHOLD / this.app.activeTab.viewport.zoom; // screen-constant, like other tolerances
    const preview = this.preview;
    this.preview = null; // clear before commit/setTool so onDeactivate can't remove the finished arrow
    this.start = null;
    if (dx < threshold && dy < threshold) {
      removeNodes(this.app.activeTab, new Set([preview.id])); // a click → no arrow
      this.app.highlightId = undefined;
      this.app.render();
    } else {
      preview.to = this.endpointAt(world);
      this.app.selection = new Set([preview.id]);
      this.app.highlightId = undefined;
      this.app.commit();
      // Hand back to Select so you can immediately move shapes / drag the arrow's ends.
      this.app.setTool('select');
    }
  }

  onDeactivate(): void {
    if (this.endpoints.active) this.endpoints.cancel();
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.start = null;
    this.app.highlightId = undefined;
    this.app.render();
  }
}
