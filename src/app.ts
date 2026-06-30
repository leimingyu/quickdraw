import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab, removeNodes } from './model/document';
import type { Tab, Workspace } from './model/types';
import type { Tool, ToolName } from './tools/types';
import { History } from './history/history';
import { zoomAt } from './model/geometry';

class NoopTool implements Tool {
  onPointerDown(): void {}
  onPointerMove(): void {}
  onPointerUp(): void {}
}

export class App {
  workspace: Workspace = createWorkspace();
  selection = new Set<string>();
  readonly renderer: Renderer;
  currentToolName: ToolName = 'select';

  private tools = new Map<ToolName, Tool>();
  private current: Tool = new NoopTool();
  private listeners = new AbortController();
  private history: History;
  private spaceDown = false;
  private panning = false;
  private panLast = { x: 0, y: 0 };

  constructor(mount: HTMLElement) {
    this.renderer = new Renderer(mount);
    this.history = new History(this.workspace);
    this.bindPointerEvents();
    this.bindKeyboard();
    this.bindViewport();
  }

  get activeTab(): Tab {
    return getActiveTab(this.workspace);
  }

  registerTool(name: ToolName, tool: Tool): void {
    this.tools.set(name, tool);
    if (name === this.currentToolName) this.current = tool;
  }

  setTool(name: ToolName): void {
    this.current.onDeactivate?.();
    this.currentToolName = name;
    this.current = this.tools.get(name) ?? new NoopTool();
    this.current.onActivate?.();
    // Selection persists across tool switches; it is cleared only by explicit
    // user actions (clicking empty canvas, Esc, or delete).
    this.render();
  }

  render(): void {
    this.renderer.render(this.activeTab, this.selection);
  }

  /** Commit a finished mutation. Task 12 adds history; Task 14 adds autosave. */
  commit(): void {
    this.history.commit(this.workspace);
    this.render();
  }

  undo(): void {
    const ws = this.history.undo();
    if (!ws) return;
    this.workspace = ws;
    this.selection.clear();
    this.render();
  }

  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    this.workspace = ws;
    this.selection.clear();
    this.render();
  }

  deleteSelection(): void {
    if (this.selection.size === 0) return;
    removeNodes(this.activeTab, this.selection);
    this.selection.clear();
    this.commit();
  }

  resetTab(): void {
    this.activeTab.nodes = [];
    this.selection.clear();
    this.commit();
  }

  zoomBy(factor: number, screenX?: number, screenY?: number): void {
    const rect = this.renderer.svg.getBoundingClientRect();
    const sx = screenX ?? rect.width / 2;
    const sy = screenY ?? rect.height / 2;
    this.activeTab.viewport = zoomAt(this.activeTab.viewport, factor, sx, sy);
    this.render();
  }

  panBy(dx: number, dy: number): void {
    const vp = this.activeTab.viewport;
    this.activeTab.viewport = { ...vp, panX: vp.panX + dx, panY: vp.panY + dy };
    this.render();
  }

  resetView(): void {
    this.activeTab.viewport = { panX: 0, panY: 0, zoom: 1 };
    this.render();
  }

  /** Detach all global (window) listeners this App registered. */
  destroy(): void {
    this.listeners.abort();
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        this.redo();
        return;
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        this.deleteSelection();
      }
    }, { signal: this.listeners.signal });
  }

  private bindViewport(): void {
    const svg = this.renderer.svg;
    const sig = { signal: this.listeners.signal };
    svg.addEventListener('wheel', (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        const rect = svg.getBoundingClientRect();
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.zoomBy(factor, ev.clientX - rect.left, ev.clientY - rect.top);
      }
    }, { ...sig, passive: false });

    window.addEventListener('keydown', (ev) => { if (ev.code === 'Space') { ev.preventDefault(); this.spaceDown = true; } }, sig);
    window.addEventListener('keyup', (ev) => { if (ev.code === 'Space') this.spaceDown = false; }, sig);

    svg.addEventListener('pointerdown', (ev) => {
      if (this.spaceDown || ev.button === 1) {
        this.panning = true;
        this.panLast = { x: ev.clientX, y: ev.clientY };
        svg.setPointerCapture(ev.pointerId);
        ev.stopImmediatePropagation();
      }
    }, { ...sig, capture: true });
    svg.addEventListener('pointermove', (ev) => {
      if (!this.panning) return;
      this.panBy(ev.clientX - this.panLast.x, ev.clientY - this.panLast.y);
      this.panLast = { x: ev.clientX, y: ev.clientY };
      ev.stopImmediatePropagation();
    }, { ...sig, capture: true });
    svg.addEventListener('pointerup', (ev) => {
      if (this.panning) {
        this.panning = false;
        svg.releasePointerCapture(ev.pointerId);
        ev.stopImmediatePropagation();
      }
    }, { ...sig, capture: true });
  }

  private bindPointerEvents(): void {
    const svg = this.renderer.svg;
    svg.addEventListener('pointerdown', (ev) => {
      svg.setPointerCapture(ev.pointerId);
      this.current.onPointerDown(this.world(ev), ev);
    });
    svg.addEventListener('pointermove', (ev) => this.current.onPointerMove(this.world(ev), ev));
    svg.addEventListener('pointerup', (ev) => {
      this.current.onPointerUp(this.world(ev), ev);
      svg.releasePointerCapture(ev.pointerId);
    });
    svg.addEventListener('dblclick', (ev) => this.current.onDoubleClick?.(this.world(ev), ev));
  }

  private world(ev: { clientX: number; clientY: number }) {
    return this.renderer.toWorld(ev.clientX, ev.clientY, this.activeTab.viewport);
  }
}
