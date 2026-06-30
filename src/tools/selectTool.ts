import type { App } from '../app';
import type { Shape } from '../model/types';
import { hitTest, shapeInRect, handlePositions, resizeBox, type Box, type Handle, type Point } from '../model/geometry';
import type { Tool } from './types';

type Mode = 'idle' | 'marquee' | 'move' | 'resize';

export class SelectTool implements Tool {
  private mode: Mode = 'idle';
  private start: Point = { x: 0, y: 0 };
  private last: Point = { x: 0, y: 0 };
  private moved = false;
  protected activeHandle: Handle | null = null;
  private resizeShape: Shape | null = null;
  private startBox: Box = { x: 0, y: 0, w: 0, h: 0 };

  constructor(protected app: App) {}

  onPointerDown(world: Point, ev: PointerEvent): void {
    this.start = world;
    const handle = this.handleAt(world);
    if (handle) {
      const s = this.singleSelected();
      if (s) {
        this.mode = 'resize';
        this.activeHandle = handle;
        this.resizeShape = s;
        this.startBox = { x: s.x, y: s.y, w: s.w, h: s.h };
        return;
      }
    }
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
    if (this.mode === 'resize' && this.resizeShape && this.activeHandle) {
      const dx = world.x - this.start.x;
      const dy = world.y - this.start.y;
      const box = resizeBox(this.startBox, this.activeHandle, dx, dy);
      Object.assign(this.resizeShape, box);
      this.app.render();
      return;
    }
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
    else if (this.mode === 'resize') this.app.commit();
    else if (this.mode === 'move' && this.moved) this.app.commit();
    this.mode = 'idle';
    this.moved = false;
    this.resizeShape = null;
    this.activeHandle = null;
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

  applyText(id: string, value: string): void {
    const s = (this.app.activeTab.nodes as Shape[]).find((n) => n.id === id);
    if (!s) return;
    s.text = value;
    this.app.commit();
  }

  onDoubleClick(world: Point, _ev?: MouseEvent): void {
    const hit = hitTest(this.app.activeTab.nodes as Shape[], world);
    if (!hit) return;
    this.app.selection = new Set([hit.id]);
    this.app.render();
    this.openEditor(hit);
  }

  private openEditor(s: Shape): void {
    const host = this.app.renderer.svg.parentElement;
    if (!host) return;
    const input = document.createElement('input');
    input.className = 'text-editor';
    input.value = s.text ?? '';
    const vp = this.app.activeTab.viewport;
    input.style.position = 'absolute';
    input.style.left = `${vp.panX + s.x * vp.zoom}px`;
    input.style.top = `${vp.panY + (s.y + s.h / 2 - 12) * vp.zoom}px`;
    input.style.width = `${s.w * vp.zoom}px`;
    host.style.position = 'relative';
    host.appendChild(input);
    input.focus();
    input.select();
    const commit = (write: boolean) => {
      if (write) this.applyText(s.id, input.value);
      input.remove();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      else if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }

  private singleSelected(): Shape | null {
    if (this.app.selection.size !== 1) return null;
    const id = [...this.app.selection][0];
    return (this.app.activeTab.nodes as Shape[]).find((s) => s.id === id) ?? null;
  }

  private handleAt(world: Point): Handle | null {
    const s = this.singleSelected();
    if (!s) return null;
    const tol = 8 / this.app.activeTab.viewport.zoom; // screen-constant tolerance in world units
    const pos = handlePositions({ x: s.x, y: s.y, w: s.w, h: s.h });
    for (const [handle, p] of Object.entries(pos)) {
      if (Math.abs(world.x - p.x) <= tol && Math.abs(world.y - p.y) <= tol) return handle as Handle;
    }
    return null;
  }
}
