import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab, removeNodes } from './model/document';
import type { Tab, Workspace } from './model/types';
import type { Tool, ToolName } from './tools/types';
import { History } from './history/history';

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

  constructor(mount: HTMLElement) {
    this.renderer = new Renderer(mount);
    this.history = new History(this.workspace);
    this.bindPointerEvents();
    this.bindKeyboard();
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
