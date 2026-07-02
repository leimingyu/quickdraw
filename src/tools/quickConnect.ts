import type { App } from '../app';
import type { Connector, Shape } from '../model/types';
import { addNode, createConnector, isShape, removeNodes } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import { attachEndpoint } from '../render/connector';
import { cloneShapeAt, duplicateInDirection, type Port } from '../model/quickConnect';

const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click (duplicate)

/**
 * Drag a hover port to build flow fast (draw.io/Lucid style). A preview arrow is
 * pinned at the source shape's port and follows the cursor:
 *   - released on empty canvas → a connected clone of the source at the drop,
 *   - released on another shape → connects the two,
 *   - a click with no drag    → duplicates the source in the port's direction.
 * Lives inside the Select tool, mirroring `EndpointDrag`.
 */
export class QuickConnect {
  private src: Shape | null = null;
  private port: Port | null = null;
  private start: Point | null = null;
  private preview: Connector | null = null;

  constructor(private app: App) {}

  get active(): boolean {
    return this.preview !== null;
  }

  /** Begin dragging from `src`'s `port`: drop a preview arrow pinned at the port. */
  begin(src: Shape, port: Port, world: Point): void {
    this.src = src;
    this.port = port;
    this.start = world;
    const c = createConnector({ nodeId: src.id, anchor: port }, { x: world.x, y: world.y });
    if (this.app.connectorRouting !== 'straight') c.style.routing = this.app.connectorRouting;
    c.style.arrowEnd = this.app.connectorArrow;
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  move(world: Point): void {
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.targetAt(world);
    this.app.highlightId = t ? t.id : undefined;
    this.app.render();
  }

  finish(world: Point): void {
    const preview = this.preview;
    const src = this.src;
    const port = this.port;
    const start = this.start;
    this.preview = null; // clear before commit so onDeactivate can't remove the finished arrow
    this.src = null;
    this.port = null;
    this.start = null;
    this.app.highlightId = undefined;
    if (!preview || !src || !port || !start) { this.app.render(); return; }

    const threshold = DRAG_THRESHOLD / this.app.activeTab.viewport.zoom; // screen-constant
    const moved =
      Math.abs(world.x - start.x) >= threshold || Math.abs(world.y - start.y) >= threshold;

    if (!moved) {
      // A click on the port → duplicate the source in that direction, connected.
      removeNodes(this.app.activeTab, new Set([preview.id]));
      const { shape, connector } = duplicateInDirection(src, port);
      addNode(this.app.activeTab, shape);
      addNode(this.app.activeTab, connector);
      this.app.selection = new Set([shape.id]);
      this.app.commit();
      return;
    }

    const target = this.targetAt(world);
    if (target) {
      preview.to = attachEndpoint(target, world, this.app.activeTab.viewport.zoom);
      this.app.selection = new Set([preview.id]);
    } else {
      const clone = cloneShapeAt(src, world.x, world.y);
      addNode(this.app.activeTab, clone);
      preview.to = { nodeId: clone.id };
      this.app.selection = new Set([clone.id]);
    }
    this.app.commit();
  }

  /** Abandon an in-progress drag (tool switch / pointercancel): drop the preview. */
  cancel(): void {
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.src = null;
    this.port = null;
    this.start = null;
    this.app.highlightId = undefined;
    this.app.render();
  }

  /** The shape under `world`, never the source (you can't quick-connect a shape to itself). */
  private targetAt(world: Point): Shape | null {
    const shapes = this.app.activeTab.nodes.filter(isShape).filter((s) => s.id !== this.src?.id);
    return hitTest(shapes, world) ?? null;
  }
}
