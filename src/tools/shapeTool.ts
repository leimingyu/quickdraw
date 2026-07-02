import type { App } from '../app';
import type { Shape, ShapeKind } from '../model/types';
import { addNode, createShape, isShape } from '../model/document';
import { hitTest, type Box, type Point } from '../model/geometry';
import { DragMove } from './dragMove';
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
 * shape centered on the click. After creating, the tool hands off to Select
 * (like the connector tool) so the new shape can be moved/resized/edited right
 * away — pick the tool again to draw another.
 *
 * Pressing on an EXISTING shape moves it (and its group) instead of drawing, so
 * you don't have to switch to the Select tool just to nudge something; a new
 * shape is only drawn from an empty-canvas press.
 */
export class ShapeTool implements Tool {
  private start: Point | null = null;
  private shape: Shape | null = null;
  private drag: DragMove;

  constructor(private app: App, private kind: ShapeKind) {
    this.drag = new DragMove(app);
  }

  onPointerDown(world: Point): void {
    const hit = hitTest(this.app.activeTab.nodes.filter(isShape), world);
    if (hit) {
      this.drag.begin(hit, world); // move the existing shape instead of drawing
      return;
    }
    this.start = world;
    const shape = createShape(this.kind, world.x, world.y, 0, 0);
    addNode(this.app.activeTab, shape);
    this.shape = shape;
    this.app.selection.clear(); // keep the canvas clean while drawing
    this.app.render();
  }

  onPointerMove(world: Point): void {
    if (this.drag.active) {
      this.drag.move(world);
      return;
    }
    if (!this.start || !this.shape) return;
    Object.assign(this.shape, normalize(this.start, world));
    this.app.render();
  }

  onPointerUp(world: Point): void {
    if (this.drag.active) {
      this.drag.end();
      return;
    }
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
      this.start = null;
      this.shape = null;
      // Hand off to Select after placing any shape, so the new shape's move/resize
      // handles (and, for text, the rotation knob) are live immediately instead of
      // the tool staying in draw mode. Matches the connector tool; pick the shape
      // tool again to draw another.
      this.app.setTool('select');
      return;
    }
    this.start = null;
    this.shape = null;
  }
}
