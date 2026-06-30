import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab } from './model/document';
import type { Tab, Workspace } from './model/types';
import type { Tool, ToolName } from './tools/types';

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

  constructor(mount: HTMLElement) {
    this.renderer = new Renderer(mount);
    this.bindPointerEvents();
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
    this.selection.clear();
    this.render();
  }

  render(): void {
    this.renderer.render(this.activeTab, this.selection);
  }

  /** Commit a finished mutation. Task 12 adds history; Task 14 adds autosave. */
  commit(): void {
    this.render();
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
