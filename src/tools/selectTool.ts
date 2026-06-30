import type { App } from '../app';
import type { Shape } from '../model/types';
import { hitTest, shapeInRect, type Box, type Handle, type Point } from '../model/geometry';
import type { Tool } from './types';

type Mode = 'idle' | 'marquee' | 'move' | 'resize';

export class SelectTool implements Tool {
  private mode: Mode = 'idle';
  private start: Point = { x: 0, y: 0 };
  private last: Point = { x: 0, y: 0 };
  private moved = false;
  protected activeHandle: Handle | null = null;

  constructor(protected app: App) {}

  onPointerDown(world: Point, ev: PointerEvent): void {
    this.start = world;
    const hit = hitTest(this.app.activeTab.nodes as Shape[], world);
    if (hit) {
      if (ev.shiftKey) this.toggle(hit.id);
      else if (!this.app.selection.has(hit.id)) this.app.selection = new Set([hit.id]);
      this.mode = 'move';
      this.last = world;
      this.moved = false;
      this.app.render();
    } else {
      if (!ev.shiftKey) this.app.selection.clear();
      this.mode = 'marquee';
      this.app.render();
    }
  }

  onPointerMove(world: Point, _ev: PointerEvent): void {
    if (this.mode === 'move') {
      const dx = world.x - this.last.x;
      const dy = world.y - this.last.y;
      this.last = world;
      for (const s of this.app.activeTab.nodes as Shape[]) {
        if (this.app.selection.has(s.id)) { s.x += dx; s.y += dy; this.moved = true; }
      }
      this.app.render();
      return;
    }
    if (this.mode === 'marquee') {
      this.applyMarquee(world);
      this.app.render();
    }
  }

  onPointerUp(world: Point, _ev: PointerEvent): void {
    if (this.mode === 'marquee') this.applyMarquee(world);
    else if (this.mode === 'move' && this.moved) this.app.commit();
    this.mode = 'idle';
    this.moved = false;
    this.app.render();
  }

  private applyMarquee(world: Point): void {
    this.app.selection = new Set(
      (this.app.activeTab.nodes as Shape[])
        .filter((s) => shapeInRect(s, this.marqueeBox(world)))
        .map((s) => s.id),
    );
  }

  private toggle(id: string): void {
    if (this.app.selection.has(id)) this.app.selection.delete(id);
    else this.app.selection.add(id);
  }

  private marqueeBox(world: Point): Box {
    return {
      x: Math.min(this.start.x, world.x),
      y: Math.min(this.start.y, world.y),
      w: Math.abs(world.x - this.start.x),
      h: Math.abs(world.y - this.start.y),
    };
  }
}
