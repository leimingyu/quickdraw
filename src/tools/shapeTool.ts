import type { App } from '../app';
import type { ShapeKind } from '../model/types';
import { addNode, createShape } from '../model/document';
import type { Point } from '../model/geometry';
import type { Tool } from './types';

const DEFAULT_W = 120;
const DEFAULT_H = 70;

export class ShapeTool implements Tool {
  constructor(private app: App, private kind: ShapeKind) {}

  onPointerDown(world: Point): void {
    const shape = createShape(
      this.kind,
      world.x - DEFAULT_W / 2,
      world.y - DEFAULT_H / 2,
      DEFAULT_W,
      DEFAULT_H,
    );
    addNode(this.app.activeTab, shape);
    this.app.selection = new Set([shape.id]);
    this.app.commit();
  }

  onPointerMove(): void {}

  onPointerUp(): void {
    this.app.setTool('select');
  }
}
