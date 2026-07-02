import type { App } from '../app';
import type { Node } from '../model/types';
import type { Point } from '../model/geometry';
import { isShape, groupMembers } from '../model/document';

/**
 * "Grab an existing shape and drag it" — the move gesture, factored out so the
 * drawing tools can move shapes without a trip to the Select tool. Selects the
 * hit shape's whole group, moves every selected shape by the pointer delta, and
 * commits once on release (only if it actually moved).
 */
export class DragMove {
  private last: Point | null = null;
  private moved = false;

  constructor(private app: App) {}

  /** True while a drag is in progress (between begin and end). */
  get active(): boolean {
    return this.last !== null;
  }

  /** Select the group `hit` belongs to and start dragging from `world`. */
  begin(hit: Node, world: Point): void {
    if (!this.app.selection.has(hit.id)) {
      this.app.selection = new Set(groupMembers(this.app.activeTab, hit));
    }
    this.last = world;
    this.moved = false;
    this.app.render();
  }

  move(world: Point): void {
    if (!this.last) return;
    const dx = world.x - this.last.x;
    const dy = world.y - this.last.y;
    this.last = world;
    for (const s of this.app.activeTab.nodes.filter(isShape)) {
      if (this.app.selection.has(s.id)) {
        s.x += dx;
        s.y += dy;
        this.moved = true;
      }
    }
    this.app.render();
  }

  /** Finish the drag; commits a history entry only if the shape actually moved. */
  end(): void {
    if (this.moved) this.app.commit();
    this.last = null;
    this.moved = false;
  }
}
