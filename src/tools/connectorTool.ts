import type { App } from '../app';
import type { Connector, Endpoint } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import type { Tool } from './types';

const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click, no arrow

/** Draw arrows by dragging between any two points. An end that lands on a shape
 *  attaches to it (`{ nodeId }`), otherwise it floats (`{ x, y }`). Stays active for
 *  continuous drawing; Esc returns to the select tool. */
export class ConnectorTool implements Tool {
  private start: Point | null = null;
  private preview: Connector | null = null;

  constructor(private app: App) {}

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  /** A shape under `world` → attached endpoint; otherwise a free point. */
  private endpointAt(world: Point): Endpoint {
    const s = this.shapeAt(world);
    return s ? { nodeId: s.id } : { x: world.x, y: world.y };
  }

  onPointerDown(world: Point): void {
    this.start = world;
    const c = createConnector(this.endpointAt(world), { x: world.x, y: world.y });
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (!this.preview || !this.start) return;
    const dx = Math.abs(world.x - this.start.x);
    const dy = Math.abs(world.y - this.start.y);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      removeNodes(this.app.activeTab, new Set([this.preview.id])); // a click → no arrow
      this.app.highlightId = undefined;
      this.app.render();
    } else {
      this.preview.to = this.endpointAt(world);
      this.app.selection = new Set([this.preview.id]);
      this.app.highlightId = undefined;
      this.app.commit();
    }
    this.preview = null;
    this.start = null;
  }

  onDeactivate(): void {
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.start = null;
    this.app.highlightId = undefined;
    this.app.render();
  }
}
