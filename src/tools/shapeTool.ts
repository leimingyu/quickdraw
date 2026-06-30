import type { App } from '../app';
import type { ShapeKind } from '../model/types';
import { addNode, createShape } from '../model/document';
import type { Point } from '../model/geometry';
import type { Tool } from './types';

const DEFAULT_W = 120;
const DEFAULT_H = 70;

export class ShapeTool implements Tool {
  private placedId: string | undefined;

  constructor(private app: App, private kind: ShapeKind) {}

  onPointerDown(world: Point, _ev: PointerEvent): void {
    const shape = createShape(this.kind, world.x - DEFAULT_W / 2, world.y - DEFAULT_H / 2, DEFAULT_W, DEFAULT_H);
    addNode(this.app.activeTab, shape);
    this.placedId = shape.id;
    this.app.selection = new Set([shape.id]);
    this.app.commit();
  }

  onPointerMove(_world: Point, _ev: PointerEvent): void {}

  onPointerUp(_world: Point, _ev: PointerEvent): void {
    const id = this.placedId;
    this.placedId = undefined;
    this.app.setTool('select');
    // Restore selection after setTool clears it
    if (id) {
      this.app.selection.add(id);
      this.app.render();
    }
  }
}
