import type { App } from '../app';
import type { Node, Shape } from '../model/types';
import { hitTest, shapeInRect, handlePositions, resizeBox, type Box, type Handle, type Point } from '../model/geometry';
import { groupMembers, expandToGroups, isShape, isConnector } from '../model/document';
import { connectorHit } from '../render/connector';
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
    const hit = this.hitNode(world);
    if (hit) {
      if (ev.shiftKey) this.toggleGroup(hit);
      else if (!this.app.selection.has(hit.id)) {
        this.app.selection = new Set(groupMembers(this.app.activeTab, hit));
      }
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
      for (const s of this.app.activeTab.nodes.filter(isShape)) {
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
    const box = this.marqueeBox(world);
    const shapeIds = new Set(
      this.app.activeTab.nodes.filter(isShape).filter((s) => shapeInRect(s, box)).map((s) => s.id),
    );
    const sel = expandToGroups(this.app.activeTab, shapeIds);
    for (const n of this.app.activeTab.nodes) {
      if (isConnector(n)) {
        const fromIn = 'nodeId' in n.from ? sel.has(n.from.nodeId) : false;
        const toIn = 'nodeId' in n.to ? sel.has(n.to.nodeId) : false;
        if (fromIn && toIn) sel.add(n.id);
      }
    }
    this.app.selection = sel;
  }

  private hitNode(world: Point) {
    const shape = hitTest(this.app.activeTab.nodes.filter(isShape), world);
    if (shape) return shape;
    const tol = 8 / this.app.activeTab.viewport.zoom;
    const connectors = this.app.activeTab.nodes.filter(isConnector);
    for (let i = connectors.length - 1; i >= 0; i--) {
      if (connectorHit(this.app.activeTab, connectors[i], world, tol)) return connectors[i];
    }
    return undefined;
  }

  /** Toggle a node — and its whole group — in or out of the selection. */
  private toggleGroup(hit: Node): void {
    const members = groupMembers(this.app.activeTab, hit);
    const allSelected = members.every((id) => this.app.selection.has(id));
    for (const id of members) {
      if (allSelected) this.app.selection.delete(id);
      else this.app.selection.add(id);
    }
  }

  private marqueeBox(world: Point): Box {
    return {
      x: Math.min(this.start.x, world.x),
      y: Math.min(this.start.y, world.y),
      w: Math.abs(world.x - this.start.x),
      h: Math.abs(world.y - this.start.y),
    };
  }

  private singleSelected(): Shape | null {
    if (this.app.selection.size !== 1) return null;
    const id = [...this.app.selection][0];
    return this.app.activeTab.nodes.filter(isShape).find((s) => s.id === id) ?? null;
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
