import type { App } from '../app';
import type { Connector, Shape } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import { DragMove } from './dragMove';
import type { Tool } from './types';

/** Screen-space band around a shape's border that starts a connector; pressing
 *  further inside (the body) moves the shape instead. */
const EDGE_BAND = 12;

/** Draw arrows by dragging from a source shape's edge to a target shape. Pressing
 *  a shape's body instead moves it (and its group), so you don't have to switch
 *  tools to reposition. Stays active for continuous drawing; Esc returns to select. */
export class ConnectorTool implements Tool {
  private sourceId: string | null = null;
  private preview: Connector | null = null;
  private drag: DragMove;

  constructor(private app: App) {
    this.drag = new DragMove(app);
  }

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  /** Is `world` in the shape's interior (body) rather than its edge band? */
  private inBody(s: Shape, world: Point): boolean {
    const inset = EDGE_BAND / this.app.activeTab.viewport.zoom; // screen-constant
    const ix = Math.min(inset, s.w / 2);
    const iy = Math.min(inset, s.h / 2);
    return (
      world.x >= s.x + ix && world.x <= s.x + s.w - ix &&
      world.y >= s.y + iy && world.y <= s.y + s.h - iy
    );
  }

  onPointerDown(world: Point): void {
    const s = this.shapeAt(world);
    if (!s) return;
    if (this.inBody(s, world)) {
      this.drag.begin(s, world); // grab the body → move the shape
      return;
    }
    // near the edge → start a connector from this shape
    this.sourceId = s.id;
    const c = createConnector({ nodeId: s.id }, { x: world.x, y: world.y });
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (this.drag.active) {
      this.drag.move(world);
      return;
    }
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t && t.id !== this.sourceId ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (this.drag.active) {
      this.drag.end();
      return;
    }
    if (this.preview && this.sourceId) {
      const t = this.shapeAt(world);
      if (t && t.id !== this.sourceId) {
        this.preview.to = { nodeId: t.id };
        this.app.selection = new Set([this.preview.id]);
        this.app.highlightId = undefined;
        this.app.commit();
      } else {
        removeNodes(this.app.activeTab, new Set([this.preview.id]));
        this.app.highlightId = undefined;
        this.app.render();
      }
    }
    this.sourceId = null;
    this.preview = null;
  }

  onDeactivate(): void {
    if (this.drag.active) this.drag.end(); // finish any in-progress move cleanly
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.sourceId = null;
    this.app.highlightId = undefined;
    this.app.render();
  }
}
