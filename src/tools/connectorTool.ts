import type { App } from '../app';
import type { Connector } from '../model/types';
import { addNode, createConnector, removeNodes, isShape } from '../model/document';
import { hitTest, type Point } from '../model/geometry';
import type { Tool } from './types';

/** Draw arrows by dragging from a source shape to a target shape. Stays active for
 *  continuous drawing; Esc returns to the select tool. */
export class ConnectorTool implements Tool {
  private sourceId: string | null = null;
  private preview: Connector | null = null;

  constructor(private app: App) {}

  private shapeAt(world: Point) {
    return hitTest(this.app.activeTab.nodes.filter(isShape), world);
  }

  onPointerDown(world: Point): void {
    const s = this.shapeAt(world);
    if (!s) return;
    this.sourceId = s.id;
    const c = createConnector({ nodeId: s.id }, { x: world.x, y: world.y });
    addNode(this.app.activeTab, c);
    this.preview = c;
    this.app.selection.clear();
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (!this.preview) return;
    this.preview.to = { x: world.x, y: world.y };
    const t = this.shapeAt(world);
    this.app.highlightId = t && t.id !== this.sourceId ? t.id : undefined;
    this.app.render();
  }

  onPointerUp(world: Point): void {
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
    if (this.preview) {
      removeNodes(this.app.activeTab, new Set([this.preview.id]));
      this.preview = null;
    }
    this.sourceId = null;
    this.app.highlightId = undefined;
    this.app.render();
  }
}
