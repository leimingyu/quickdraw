import { Renderer } from './render/renderer';
import { createWorkspace, getActiveTab, addNode, removeNodes, groupNodes, ungroupNodes, expandToGroups, pruneDanglingConnectors, restyleNodes, reorderSelection, isShape, addTab as addTabModel, removeTab as removeTabModel, renameTab as renameTabModel, type StylePatch } from './model/document';
import { copyNodes, pasteNodes } from './model/copyPaste';
import type { Node, Routing, Shape, Tab, Workspace } from './model/types';
import type { SnapGuide } from './model/snapping';
import type { Tool, ToolName } from './tools/types';
import { History } from './history/history';
import { zoomAt, hitTest } from './model/geometry';

const PASTE_STEP = 16; // world-unit offset applied to each paste so it doesn't cover the original

class NoopTool implements Tool {
  onPointerDown(): void {}
  onPointerMove(): void {}
  onPointerUp(): void {}
}

export class App {
  workspace: Workspace;
  selection = new Set<string>();
  highlightId?: string;
  snapGuides: SnapGuide[] = []; // alignment guides shown during a snapped drag
  connectorRouting: Routing = 'straight'; // routing applied to newly drawn connectors
  connectorArrow = true; // whether newly drawn connectors get an end arrowhead (false = plain line)
  onRender?: () => void;
  onSave?: () => void;
  readonly renderer: Renderer;
  currentToolName: ToolName = 'select';

  private tools = new Map<ToolName, Tool>();
  private current: Tool = new NoopTool();
  private listeners = new AbortController();
  private history: History;
  private clipboard: Node[] = []; // in-app clipboard (survives across tabs, not the OS clipboard)
  private pasteOffset = 0;
  private spaceDown = false;
  private panning = false;
  private panLast = { x: 0, y: 0 };
  // Manual double-click detection on pointerup. We can't rely on the native
  // `dblclick` event: tools that re-render on pointerdown (e.g. Select) replace
  // the pressed element before the release, so the browser never synthesizes a
  // click/dblclick. Tracking pointer-up timing/position works in every tool.
  private lastTapAt = 0;
  private lastTap = { x: 0, y: 0 };

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
    this.renderer.render(this.activeTab, this.selection, this.highlightId, this.snapGuides);
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
    const keepId = this.activeTab.id;            // stay on the current tab if it survives
    const vp = { ...this.activeTab.viewport };   // its live camera
    this.workspace = ws;
    if (ws.tabs.some((t) => t.id === keepId)) {
      ws.activeTabId = keepId;
      this.activeTab.viewport = vp;              // keep the live camera only for the tab we stayed on
    }
    // else: fell back to the snapshot's active tab — keep its own stored camera.
    this.selection.clear();
    this.render();
  }

  redo(): void {
    const ws = this.history.redo();
    if (!ws) return;
    const keepId = this.activeTab.id;            // stay on the current tab if it survives
    const vp = { ...this.activeTab.viewport };   // its live camera
    this.workspace = ws;
    if (ws.tabs.some((t) => t.id === keepId)) {
      ws.activeTabId = keepId;
      this.activeTab.viewport = vp;              // keep the live camera only for the tab we stayed on
    }
    // else: fell back to the snapshot's active tab — keep its own stored camera.
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

  /** Create a new tab, switch to it, and record it (undoable). */
  addTab(): void {
    addTabModel(this.workspace);
    this.selection.clear();
    this.commit();
  }

  /** Close a tab (undoable). No-op on the last remaining tab. */
  closeTab(id: string): void {
    if (this.workspace.tabs.length <= 1) return;
    const wasActive = this.workspace.activeTabId === id;
    removeTabModel(this.workspace, id);
    if (wasActive) this.selection.clear();
    this.commit();
  }

  /** Rename a tab. Undoable only when the name actually changes — a blank or
   *  unchanged name is a no-op (the model ignores it) and records no history entry. */
  renameTab(id: string, name: string): void {
    const before = this.workspace.tabs.find((t) => t.id === id)?.name;
    renameTabModel(this.workspace, id, name);
    const after = this.workspace.tabs.find((t) => t.id === id)?.name;
    if (after !== before) this.commit();
    else this.render(); // no change: rebuild the strip (e.g. after an aborted rename), no history entry
  }

  /** Switch the active tab. Not undoable — mutates activeTabId and re-renders only. */
  switchTab(id: string): void {
    if (this.workspace.activeTabId === id) return;
    if (!this.workspace.tabs.some((t) => t.id === id)) return; // ignore unknown ids
    this.workspace.activeTabId = id;
    this.selection.clear(); // selection ids belong to the previous tab's nodes
    this.render();
  }

  /** Load a document: swap the workspace, reset history to it, clear selection, render.
   *  Honors the loaded workspace's activeTabId (deserialize guarantees it is valid),
   *  so reopening a file lands on the tab you were viewing when you saved. */
  replaceWorkspace(ws: Workspace): void {
    this.workspace = ws;
    this.workspace.tabs.forEach(pruneDanglingConnectors);
    this.history = new History(this.workspace); // the opened file is the new baseline
    this.selection.clear();
    this.render();
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
    const host = this.renderer.svg.parentElement;
    if (!host) return; // no-op cleanly if unmounted, before touching any state
    host.querySelector('input.text-editor')?.remove(); // flush any open editor first
    this.selection = new Set([shape.id]);
    this.render();
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

  /** Reset every selected shape's rotation back to 0° (the landscape default).
   *  Undoable; records no history entry when nothing in the selection is rotated. */
  resetRotation(): void {
    if (this.selection.size === 0) return;
    let changed = false;
    for (const n of this.activeTab.nodes) {
      if (this.selection.has(n.id) && isShape(n) && n.rotation) {
        n.rotation = 0;
        changed = true;
      }
    }
    if (changed) this.commit();
  }

  /** Select every node in the active tab. Not undoable (selection change only). */
  selectAll(): void {
    this.selection = new Set(this.activeTab.nodes.map((n) => n.id));
    this.render();
  }

  /** Nudge the selection by (dx,dy) world units (undoable). Shapes move; connectors
   *  follow via their attached ends, and any free ends shift too. */
  nudgeSelection(dx: number, dy: number): void {
    if (this.selection.size === 0) return;
    for (const n of this.activeTab.nodes) {
      if (!this.selection.has(n.id)) continue;
      if (isShape(n)) { n.x += dx; n.y += dy; }
      else {
        if (!('nodeId' in n.from)) { n.from.x += dx; n.from.y += dy; }
        if (!('nodeId' in n.to)) { n.to.x += dx; n.to.y += dy; }
      }
    }
    this.commit();
  }

  /** Copy the selection (whole groups) to the in-app clipboard. No history entry. */
  copySelection(): void {
    if (this.selection.size === 0) return;
    this.clipboard = copyNodes(this.activeTab, this.selection);
    this.pasteOffset = 0; // next paste starts one step out from the original
  }

  /** Copy then delete the selection (undoable via the delete). */
  cut(): void {
    if (this.selection.size === 0) return;
    this.copySelection();
    this.deleteSelection();
  }

  /** Paste the clipboard into the active tab, offset and selected (undoable). */
  paste(): void {
    if (this.clipboard.length === 0) return;
    this.pasteOffset += PASTE_STEP;
    const pasted = pasteNodes(this.clipboard, this.pasteOffset, this.pasteOffset);
    pasted.forEach((n) => addNode(this.activeTab, n));
    this.selection = new Set(pasted.map((n) => n.id));
    this.commit();
  }

  /** Duplicate the selection in place (offset), without touching the clipboard. */
  duplicate(): void {
    if (this.selection.size === 0) return;
    const pasted = pasteNodes(copyNodes(this.activeTab, this.selection), PASTE_STEP, PASTE_STEP);
    pasted.forEach((n) => addNode(this.activeTab, n));
    this.selection = new Set(pasted.map((n) => n.id));
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
      if (mod && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        this.onSave?.();
        return;
      }
      if (mod && ev.key.toLowerCase() === 'g') {
        ev.preventDefault();
        if (ev.shiftKey) this.ungroup();
        else this.group();
        return;
      }
      // Clipboard: only intercept when there's something to act on, so an empty
      // ⌘C/⌘X/⌘V still does the browser's normal thing (e.g. copy selected UI text).
      if (mod && ev.key.toLowerCase() === 'c') {
        if (this.selection.size) { ev.preventDefault(); this.copySelection(); }
        return;
      }
      if (mod && ev.key.toLowerCase() === 'x') {
        if (this.selection.size) { ev.preventDefault(); this.cut(); }
        return;
      }
      if (mod && ev.key.toLowerCase() === 'v') {
        if (this.clipboard.length) { ev.preventDefault(); this.paste(); }
        return;
      }
      if (mod && ev.key.toLowerCase() === 'd') {
        if (this.selection.size) { ev.preventDefault(); this.duplicate(); }
        return;
      }
      if (mod && ev.key.toLowerCase() === 'a') {
        ev.preventDefault();
        this.selectAll();
        return;
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        this.deleteSelection();
        return;
      }
      // Arrow keys nudge the selection (1px, or 10px with Shift). Not printable, so
      // they never trigger type-to-edit below.
      if (ev.key.startsWith('Arrow') && this.selection.size > 0) {
        ev.preventDefault();
        const step = ev.shiftKey ? 10 : 1;
        const d: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
        };
        const nudge = d[ev.key];
        if (nudge) this.nudgeSelection(nudge[0], nudge[1]);
        return;
      }
      // Type-to-edit (any tool): one shape selected → Enter/F2 edits it, a printable key
      // starts a fresh label. Space is excluded (it pans); connectors have no text.
      if (this.selection.size === 1) {
        const id = [...this.selection][0];
        const node = this.activeTab.nodes.find((n) => n.id === id);
        if (node && isShape(node)) {
          if (ev.key === 'Enter' || ev.key === 'F2') {
            ev.preventDefault();
            this.editText(node);
          } else if (ev.key.length === 1 && ev.key !== ' ' && !mod && !ev.altKey) {
            ev.preventDefault();
            this.editText(node, ev.key);
          }
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
      if (svg.hasPointerCapture?.(ev.pointerId)) svg.releasePointerCapture(ev.pointerId);
      this.detectDoubleClick(ev);
    }, sig);
    svg.addEventListener('pointercancel', () => this.current.onDeactivate?.(), sig);
  }

  /** Two pointer-ups close in time and space over a shape = double-click → edit it.
   *  Works in any tool (unlike the native `dblclick`, which render-on-press suppresses). */
  private detectDoubleClick(ev: PointerEvent): void {
    const now = performance.now();
    const near = Math.abs(ev.clientX - this.lastTap.x) <= 6 && Math.abs(ev.clientY - this.lastTap.y) <= 6;
    // A second up within 400ms and ~6px of the first = double-click. Reset after
    // firing so a triple-click (or a stray follow-up up) doesn't re-fire.
    if (this.lastTapAt !== 0 && now - this.lastTapAt <= 400 && near) {
      this.lastTapAt = 0;
      const shape = hitTest(this.activeTab.nodes.filter(isShape), this.world(ev));
      if (shape) this.editText(shape);
      return;
    }
    this.lastTapAt = now;
    this.lastTap = { x: ev.clientX, y: ev.clientY };
  }

  private world(ev: { clientX: number; clientY: number }) {
    return this.renderer.toWorld(ev.clientX, ev.clientY, this.activeTab.viewport);
  }
}
