import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors, restyleNodes, reorderSelection, type StylePatch } from './model/document';
import type { Shape, Tab, Workspace } from './model/types';
import type { Tool, ToolName } from './tools/types';
import { History } from './history/history';
import { zoomAt } from './model/geometry';

class NoopTool implements Tool {
  onPointerDown(): void {}
  onPointerMove(): void {}
  onPointerUp(): void {}
}

export class App {
  workspace: Workspace;
  selection = new Set<string>();
  highlightId?: string;
  onRender?: () => void;
  readonly renderer: Renderer;
  currentToolName: ToolName = 'select';

  private tools = new Map<ToolName, Tool>();
  private current: Tool = new NoopTool();
  private listeners = new AbortController();
  private history: History;
  private spaceDown = false;
  private panning = false;
  private panLast = { x: 0, y: 0 };

  constructor(mount: HTMLElement, initial?: Workspace) {
    this.workspace = initial ?? createWorkspace();
    this.workspace.tabs.forEach(pruneDanglingConnectors);
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
    this.renderer.render(this.activeTab, this.selection, this.highlightId);
    this.onRender?.();
  }

  /** Commit a finished mutation: snapshot history and re-render. */
  commit(): void {
    this.history.commit(this.workspace);
    this.render();
  }

  undo(): void {
    const ws = this.history.undo();
    if (!ws) return;
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }

  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    const vp = { ...this.activeTab.viewport };   // keep the live camera
    this.workspace = ws;
    this.activeTab.viewport = vp;
    this.selection.clear();
    this.render();
  }

  /** Group the current selection into one movable unit. No-op for < 2 nodes. */
  group(): void {
    const gid = groupNodes(this.activeTab, this.selection);
    if (!gid) return;
    this.selection = expandToGroups(this.activeTab, this.selection);
    this.commit();
  }

  /** Dissolve the group(s) the current selection belongs to. */
  ungroup(): void {
    if (this.selection.size === 0) return;
    ungroupNodes(this.activeTab, this.selection);
    this.commit();
  }

  /** Apply a style patch to the selection (live; no history entry). */
  restyle(patch: StylePatch): void {
    if (this.selection.size === 0) return;
    restyleNodes(this.activeTab, this.selection, patch);
    this.render();
  }

  /** Commit the last live restyle as a single history entry. */
  commitStyle(): void {
    if (this.selection.size === 0) return;
    this.commit();
  }

  /** Open the inline text editor over a shape (any tool). Seeds with `initial` if given,
   *  else the shape's existing text. Enter/blur commit, Escape cancels; idempotent. */
  editText(shape: Shape, initial?: string): void {
    this.selection = new Set([shape.id]);
    this.render();
    const host = this.renderer.svg.parentElement;
    if (!host) return;
    host.querySelector('input.text-editor')?.remove();
    const input = document.createElement('input');
    input.className = 'text-editor';
    input.value = initial !== undefined ? initial : shape.text ?? '';
    const vp = this.activeTab.viewport;
    input.style.position = 'absolute';
    input.style.left = `${vp.panX + shape.x * vp.zoom}px`;
    input.style.top = `${vp.panY + (shape.y + shape.h / 2) * vp.zoom - 12}px`;
    input.style.width = `${shape.w * vp.zoom}px`;
    host.style.position = 'relative';
    host.appendChild(input);
    input.focus();
    if (initial !== undefined) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } else {
      input.select();
    }
    let done = false;
    const commit = (write: boolean) => {
      if (done) return;
      done = true;
      if (write) {
        shape.text = input.value;
        this.commit();
      }
      input.remove();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      else if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }

  bringToFront(): void {
    if (this.selection.size === 0) return;
    reorderSelection(this.activeTab, this.selection, 'front');
    this.commit();
  }

  sendToBack(): void {
    if (this.selection.size === 0) return;
    reorderSelection(this.activeTab, this.selection, 'back');
    this.commit();
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
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (this.currentToolName !== 'select') {
          this.setTool('select'); // leave draw mode
        } else {
          this.selection.clear();
          this.render();
        }
        return;
      }
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
      if (mod && ev.key.toLowerCase() === 'g') {
        ev.preventDefault();
        if (ev.shiftKey) this.ungroup();
        else this.group();
        return;
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        this.deleteSelection();
        return;
      }
      // Type-to-edit: with a single shape selected in the select tool, Enter/F2
      // edits its text and any printable key starts a fresh centered label.
      // (Space is excluded so it keeps panning; labels just can't start with one.)
      if (this.currentToolName === 'select' && this.selection.size === 1) {
        if (ev.key === 'Enter' || ev.key === 'F2') {
          ev.preventDefault();
          this.current.beginEdit?.();
        } else if (ev.key.length === 1 && ev.key !== ' ' && !mod && !ev.altKey) {
          ev.preventDefault();
          this.current.beginEdit?.(ev.key);
        }
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

    window.addEventListener('keydown', (ev) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (ev.code === 'Space') { ev.preventDefault(); this.spaceDown = true; }
    }, sig);
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
    const sig = { signal: this.listeners.signal };
    svg.addEventListener('pointerdown', (ev) => {
      svg.setPointerCapture(ev.pointerId);
      this.current.onPointerDown(this.world(ev), ev);
    }, sig);
    svg.addEventListener('pointermove', (ev) => this.current.onPointerMove(this.world(ev), ev), sig);
    svg.addEventListener('pointerup', (ev) => {
      this.current.onPointerUp(this.world(ev), ev);
      svg.releasePointerCapture(ev.pointerId);
    }, sig);
    svg.addEventListener('dblclick', (ev) => this.current.onDoubleClick?.(this.world(ev), ev), sig);
    svg.addEventListener('pointercancel', () => this.current.onDeactivate?.(), sig);
  }

  private world(ev: { clientX: number; clientY: number }) {
    return this.renderer.toWorld(ev.clientX, ev.clientY, this.activeTab.viewport);
  }
}
