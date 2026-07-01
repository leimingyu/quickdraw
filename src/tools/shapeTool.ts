import type { App } from '../app';
import type { Shape, ShapeKind } from '../model/types';
import { addNode, createShape, isShape } from '../model/document';
import { hitTest, type Box, type Point } from '../model/geometry';
import type { Tool } from './types';

const DEFAULT_W = 120;
const DEFAULT_H = 70;
const MIN_SIZE = 8; // floor for an intentional (dragged) shape
const DRAG_THRESHOLD = 4; // world units; below this in both axes = a click

/** Bounding box from two corners, regardless of drag direction. */
function normalize(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/**
 * Places shapes by drag-to-draw (MS Paint style): press to start, drag to
 * rubber-band a live preview from the start corner, release to create the
 * shape at that size. A click with no meaningful drag drops a default-sized
 * shape centered on the click. After creating, reverts to the select tool.
 */
export class ShapeTool implements Tool {
  private start: Point | null = null;
  private shape: Shape | null = null;

  constructor(private app: App, private kind: ShapeKind) {}

  onPointerDown(world: Point): void {
    if (hitTest(this.app.activeTab.nodes.filter(isShape), world)) return; // don't create on an existing shape
    this.start = world;
    const shape = createShape(this.kind, world.x, world.y, 0, 0);
    addNode(this.app.activeTab, shape);
    this.shape = shape;
    this.app.selection.clear(); // keep the canvas clean while drawing
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (!this.start || !this.shape) return;
    Object.assign(this.shape, normalize(this.start, world));
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (this.start && this.shape) {
      const dx = Math.abs(world.x - this.start.x);
      const dy = Math.abs(world.y - this.start.y);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        // a click → default-sized shape centered on the start point
        Object.assign(this.shape, {
          x: this.start.x - DEFAULT_W / 2,
          y: this.start.y - DEFAULT_H / 2,
          w: DEFAULT_W,
          h: DEFAULT_H,
        });
      } else {
        const box = normalize(this.start, world);
        box.w = Math.max(box.w, MIN_SIZE);
        box.h = Math.max(box.h, MIN_SIZE);
        Object.assign(this.shape, box);
      }
      this.app.selection = new Set([this.shape.id]);
      this.app.commit();
    }
    this.start = null;
    this.shape = null;
    // Stay on the same shape tool so you can keep drawing. Press Esc (or click
    // Select) to switch back to the select tool.
  }
}
