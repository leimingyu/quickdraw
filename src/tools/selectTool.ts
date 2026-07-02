import type { App } from '../app';
import type { Node, Shape, Connector } from '../model/types';
import { hitTest, shapeInRect, resizeBox, resizeRotatedBox, shapeHandlePositions, rotationHandlePos, angleFromCenter, shapeCenter, ROTATION_KNOB_DIST, type Box, type Handle, type Point } from '../model/geometry';
import { groupMembers, expandToGroups, isShape, isConnector } from '../model/document';
import { computeSnap } from '../model/snapping';
import { connectorHit } from '../render/connector';
import { EndpointDrag } from './endpointDrag';
import type { Tool } from './types';

type Mode = 'idle' | 'marquee' | 'move' | 'resize' | 'rotate';

const SNAP_PX = 6; // screen-px tolerance for edge/center alignment snapping while moving

export class SelectTool implements Tool {
  private mode: Mode = 'idle';
  private start: Point = { x: 0, y: 0 };
  private startPos = new Map<string, { x: number; y: number }>(); // selected shapes' positions at drag start
  private moved = false;
  protected activeHandle: Handle | null = null;
  private resizeShape: Shape | null = null;
  private startBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private rotateShape: Shape | null = null;
  private rotateStartAngle = 0;   // pointer angle from center at drag start
  private rotateStartRotation = 0; // shape's rotation at drag start
  private endpoints: EndpointDrag;

  constructor(protected app: App) {
    this.endpoints = new EndpointDrag(app);
  }

  onPointerDown(world: Point, ev: PointerEvent): void {
    this.start = world;
    // Drag an endpoint of the selected connector before anything else.
    if (this.endpoints.beginOn(this.singleSelectedConnector(), world)) return;
    const rot = this.singleSelected();
    if (rot && this.overRotationHandle(rot, world)) {
      this.mode = 'rotate';
      this.rotateShape = rot;
      this.rotateStartRotation = rot.rotation ?? 0;
      this.rotateStartAngle = angleFromCenter(shapeCenter(rot), world);
      return;
    }
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
      this.startPos = new Map(
        this.app.activeTab.nodes
          .filter(isShape)
          .filter((s) => this.app.selection.has(s.id))
          .map((s) => [s.id, { x: s.x, y: s.y }]),
      );
      this.moved = false;
      this.app.render();
    } else {
      if (!ev.shiftKey) this.app.selection.clear();
      this.mode = 'marquee';
      this.app.render();
    }
  }

  onPointerMove(world: Point, ev: PointerEvent): void {
    if (this.endpoints.active) { this.endpoints.move(world); return; }
    if (this.mode === 'rotate' && this.rotateShape) {
      const a = angleFromCenter(shapeCenter(this.rotateShape), world);
      let rot = this.rotateStartRotation + (a - this.rotateStartAngle);
      if (ev.shiftKey) rot = Math.round(rot / 15) * 15; // Shift snaps to 15°
      this.rotateShape.rotation = ((rot % 360) + 360) % 360;
      this.moved = true;
      this.app.render();
      return;
    }
    if (this.mode === 'resize' && this.resizeShape && this.activeHandle) {
      const box = this.resizeShape.rotation
        ? resizeRotatedBox(this.startBox, this.activeHandle, this.resizeShape.rotation, world)
        : resizeBox(this.startBox, this.activeHandle, world.x - this.start.x, world.y - this.start.y);
      Object.assign(this.resizeShape, box);
      this.app.render();
      return;
    }
    if (this.mode === 'move') {
      const totalDx = world.x - this.start.x;
      const totalDy = world.y - this.start.y;
      if (totalDx !== 0 || totalDy !== 0) this.moved = true;
      const selected = this.app.activeTab.nodes.filter(isShape).filter((s) => this.app.selection.has(s.id));
      // Raw bounding box of the selection at the dragged position, then snap it.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of selected) {
        const p = this.startPos.get(s.id)!;
        minX = Math.min(minX, p.x + totalDx); minY = Math.min(minY, p.y + totalDy);
        maxX = Math.max(maxX, p.x + totalDx + s.w); maxY = Math.max(maxY, p.y + totalDy + s.h);
      }
      const statics = this.app.activeTab.nodes
        .filter(isShape)
        .filter((s) => !this.app.selection.has(s.id))
        .map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
      const tol = SNAP_PX / this.app.activeTab.viewport.zoom;
      const snap = computeSnap({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, statics, tol);
      for (const s of selected) {
        const p = this.startPos.get(s.id)!;
        s.x = p.x + totalDx + snap.dx;
        s.y = p.y + totalDy + snap.dy;
      }
      this.app.snapGuides = snap.guides;
      this.app.render();
      return;
    }
    if (this.mode === 'marquee') {
      this.applyMarquee(world);
      this.app.render();
    }
  }

  onPointerUp(world: Point, _ev: PointerEvent): void {
    if (this.endpoints.active) { this.endpoints.finish(world); return; }
    this.app.snapGuides = []; // stop drawing alignment guides on release
    if (this.mode === 'marquee') this.applyMarquee(world);
    else if (this.mode === 'resize') this.app.commit();
    else if (this.mode === 'rotate' && this.moved) this.app.commit();
    else if (this.mode === 'move' && this.moved) this.app.commit();
    this.mode = 'idle';
    this.moved = false;
    this.resizeShape = null;
    this.rotateShape = null;
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

  private singleSelectedConnector(): Connector | null {
    if (this.app.selection.size !== 1) return null;
    const id = [...this.app.selection][0];
    const n = this.app.activeTab.nodes.find((x) => x.id === id);
    return n && isConnector(n) ? n : null;
  }

  private handleAt(world: Point): Handle | null {
    const s = this.singleSelected();
    if (!s) return null;
    const tol = 8 / this.app.activeTab.viewport.zoom; // screen-constant tolerance in world units
    const pos = shapeHandlePositions(s); // rotated with the shape
    for (const [handle, p] of Object.entries(pos)) {
      if (Math.abs(world.x - p.x) <= tol && Math.abs(world.y - p.y) <= tol) return handle as Handle;
    }
    return null;
  }

  private overRotationHandle(s: Shape, world: Point): boolean {
    const knob = rotationHandlePos(s, ROTATION_KNOB_DIST);
    const tol = 8 / this.app.activeTab.viewport.zoom;
    return Math.abs(world.x - knob.x) <= tol && Math.abs(world.y - knob.y) <= tol;
  }
}
