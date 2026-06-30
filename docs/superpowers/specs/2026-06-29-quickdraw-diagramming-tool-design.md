# QuickDraw — Design Spec

**Date:** 2026-06-29
**Status:** Approved design, pre-implementation
**Topic:** Browser-based diagramming / whiteboard tool ("easy PowerPoint" for boxes-and-arrows)

---

## 1. Overview

QuickDraw is a single-page web app for making boxes-and-arrows diagrams quickly. You
place shapes on a canvas, connect them with arrows that stay attached when shapes move,
type text inside shapes, group/move/resize things, organize drawings into named tabs, and
export your work. The target feel is "PowerPoint's diagramming, minus the friction."

### Goals
- Place, move, resize, and style shapes on an infinite canvas.
- Connect shapes with **smart arrows** that re-route automatically when a shape moves.
- Double-click a shape to edit its text inline.
- Undo / redo, delete selection, reset the canvas.
- Multiple **named tabs**, each its own drawing, in one workspace.
- Zoom in/out and pan.
- Move and **group** objects (PowerPoint-style).
- **Autosave** the whole workspace in the browser; survive refresh/close.
- **Save to disk**: re-editable `.json` project file, plus PNG and SVG export.

### Non-goals (explicitly cut — YAGNI)
- No AI / sketch-recognition (this is *not* AutoDraw's doodle-guessing feature).
- No real-time multi-user collaboration (rules out CRDT/event-sourcing).
- No PDF export (may revisit later).
- No cloud accounts or server — fully client-side.

---

## 2. Tech stack
- **TypeScript + Vite**, modular ES modules. Builds to static files you can host or open.
- **SVG** rendering (not Canvas): gives hit-testing, text, and selection handles cheaply.
- **Vitest** for unit tests (ships with Vite).
- No UI framework; plain DOM for chrome. No heavy runtime dependencies.

---

## 3. Architecture & data flow

A plain **data model is the single source of truth**. The SVG is *rendered from* the
model; no application state lives in the DOM. This single rule keeps undo, autosave, and
export correct by construction.

```
pointer / UI events → Tool (state machine) → mutate Model → Renderer → SVG
                                                 │
                                                 ├── History (snapshot push)
                                                 └── Autosave (debounced persist)
```

Every committed user action: (1) mutates the model, (2) the renderer reconciles the SVG,
(3) a snapshot is pushed to history, (4) autosave is scheduled.

---

## 4. Data model

```ts
interface Document {
  tabs: Tab[];
  activeTabId: string;
  version: number;          // schema version for migration
}

interface Tab {
  id: string;
  name: string;
  nodes: Node[];            // z-ordered: later = on top
  viewport: { panX: number; panY: number; zoom: number };
}

type Node = Shape | Connector | Group;

interface Shape {
  id: string;
  kind: 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';
  x: number; y: number; w: number; h: number;
  rotation?: number;        // degrees; default 0 (phase 3+ for UI)
  text?: string;
  style: ShapeStyle;
  groupId?: string;
}

interface Connector {
  id: string;
  kind: 'connector';
  from: Endpoint;
  to: Endpoint;
  style: ConnectorStyle;    // includes arrowhead settings
  groupId?: string;
}

// Anchored to a shape (preferred) OR a free-floating point.
type Endpoint =
  | { nodeId: string; anchor: 'top' | 'right' | 'bottom' | 'left' | 'center' }
  | { x: number; y: number };

interface Group {
  id: string;
  kind: 'group';
  childIds: string[];       // ids of member nodes (may include nested groups)
}

interface ShapeStyle {
  fill: string; stroke: string; strokeWidth: number;
  fontSize: number; fontColor: string;
}
interface ConnectorStyle {
  stroke: string; strokeWidth: number;
  arrowStart: boolean; arrowEnd: boolean;
}
```

**Key decision — connectors store `nodeId + anchor`, not coordinates.** The renderer
computes the absolute endpoint from the shape's *current* box and clips the line to the
shape edge. Moving a shape therefore re-routes its arrows automatically with no extra
bookkeeping. v1 routing is a straight line between (clipped) anchor points; elbow /
obstacle-avoiding routing is a phase-3 enhancement.

---

## 5. Module layout (`src/`)

| File | Responsibility |
|------|----------------|
| `model/types.ts` | All interfaces above. |
| `model/document.ts` | Document/Tab/Node store + mutation methods (add/remove/move/restyle/reorder/group). Pure data; no DOM. |
| `render/renderer.ts` | Reconcile a Tab's nodes → SVG. Applies viewport transform. |
| `render/shapes.ts` | SVG element factory per shape kind. |
| `render/connector.ts` | Arrow geometry: anchor→absolute point, edge clipping, arrowhead markers. |
| `tools/selectTool.ts` | Click/shift/marquee select, drag-move, resize handles, double-click→text. |
| `tools/shapeTool.ts` | Place a new shape by click or drag. |
| `tools/connectorTool.ts` | Draw an arrow from one shape anchor to another. |
| `tools/textTool.ts` | Inline text editing overlay. |
| `history/history.ts` | Snapshot-based undo/redo stacks. |
| `storage/autosave.ts` | Debounced load/save of the workspace to the browser. |
| `storage/exporter.ts` | Export current tab to PNG and SVG. |
| `storage/fileio.ts` | Save/open `.json` project file (download / file picker). |
| `ui/toolbar.ts` | Tool buttons + actions (undo, delete, reset, zoom, export). |
| `ui/tabs.ts` | Tab bar: add, rename, switch, close. |
| `ui/properties.ts` | Style panel for the current selection. |
| `ui/zoom.ts` | Zoom/pan controls and viewport math. |
| `app.ts` | Wiring + app state: active tab, current tool, selection set. |
| `main.ts` | Bootstrap. |

Each file has one job and a narrow interface so it can be understood and unit-tested in
isolation. The model and geometry modules (the logic-heavy parts) carry no DOM dependency.

---

## 6. Interaction model

One active **tool** at a time: Select, Rect, Rounded, Ellipse, Diamond, Triangle, Text,
Arrow. Tools are small state machines fed pointer events on the SVG surface.

The **Select** tool is the default and does the heavy lifting:
- Click a node to select; shift-click to add/remove from selection.
- Drag on empty canvas = marquee select.
- Drag a selected node = move (all selected move together).
- Drag a resize handle = resize (single shape; group resizes its combined box).
- Double-click a shape = inline text edit.
- Clicking a grouped node selects the whole group.

---

## 7. Feature behaviors

- **Undo/redo (snapshot-based).** Before each committed change, push a deep clone of the
  active tab onto the undo stack; clear the redo stack on new actions. Continuous
  operations (a drag, a burst of typing) debounce into a single history entry, committed on
  pointerup / blur. Bounded stack depth (e.g. 100) to cap memory.
- **Delete / erase.** Removes the current selection (and connectors whose endpoints
  reference a deleted shape). Undoable.
- **Reset.** Clears the active tab to empty. Undoable; confirm if the tab is non-empty.
- **Zoom / pan.** Per-tab viewport `{panX, panY, zoom}` applied as one SVG group transform
  `translate(panX,panY) scale(zoom)`. Toolbar zoom buttons; Ctrl/⌘-scroll zooms at the
  cursor; space-drag or middle-drag pans; "fit to content" button.
- **Tabs.** `+` adds an empty drawing. Double-click a tab to rename. `×` closes (confirm if
  non-empty). Switching tabs swaps the rendered Tab. All tabs autosave together.
- **Grouping.** Ctrl+G groups the selection into a Group node; selecting any child selects
  the group; move/resize acts on the combined bbox. Ctrl+Shift+G ungroups. Nested groups
  allowed.
- **Properties panel.** Shown on selection: fill, stroke color, stroke width, text +
  font size/color, arrowhead toggles (for connectors), and z-order (bring to front/back).
- **Starter shapes:** rectangle, rounded rectangle, ellipse, diamond, triangle, text box —
  plus the arrow connector.

---

## 8. Persistence & export

- **Autosave.** Debounced write of the whole workspace (all tabs) to the browser on every
  change; loaded on startup. Default store: `localStorage`; if a workspace exceeds the
  quota, fall back to `IndexedDB`. On startup with no saved workspace, open one empty tab.
- **Project file (`.json`).** "Save to disk" downloads the serialized workspace (schema
  version included). "Open" loads a `.json` back, replacing the workspace after validation.
- **PNG export.** Serialize the active tab's SVG, draw it onto a canvas sized to the
  content bounds, export a PNG.
- **SVG export.** Serialize the active tab's content (bounds-cropped) to a standalone
  `.svg` file.

---

## 9. Keyboard shortcuts (initial)
- Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z (or Ctrl+Y) redo
- Delete / Backspace = delete selection
- Ctrl/⌘+G group, Ctrl/⌘+Shift+G ungroup
- Ctrl/⌘+C / V copy / paste (phase 3)
- Ctrl/⌘+A select all; Esc clears selection / cancels current tool

---

## 10. Error handling
- **Autosave quota exceeded** → fall back to IndexedDB; if that also fails, surface a
  non-blocking warning ("changes aren't being saved"), keep the app usable.
- **Opening an invalid/corrupt `.json`** → validate against the schema/version; on failure
  show an error and leave the current workspace untouched (never partially overwrite).
- **Export of an empty tab** → no-op with a gentle notice rather than a blank file.
- **Dangling connectors** (endpoint references a deleted shape) → pruned on delete; on load,
  any unresolved anchored endpoint is dropped or converted to its last-known point.

---

## 11. Testing approach (Vitest)
Priority on the logic-heavy, DOM-free modules:
- `model/document.ts` — add/remove/move/group/reorder invariants.
- `render/connector.ts` — anchor→point math, edge clipping, re-route on shape move.
- `history/history.ts` — undo/redo round-trips, redo-cleared-on-new-action, debounce/commit.
- `storage` — JSON save→open round-trip preserves the model exactly; version handling.
Tool/UI interactions get lightweight DOM tests where cheap, otherwise manual QA.

---

## 12. Architecture decisions (resolved)
- **Undo:** snapshot-based (deep-clone active tab), not command-pattern or CRDT. Simple and
  impossible to desync; fine for diagram-sized documents. Model is built so a switch to the
  command pattern is possible later if memory ever matters.
- **Arrows:** anchored smart connectors (nodeId + named anchor), straight routing for v1.
- **Rendering:** SVG, model-as-source-of-truth (no DOM state).

---

## 13. Build order (all listed features ship — this is sequence, not scope-cutting)
1. **Core canvas** — shapes; select/move/resize; inline text; delete; undo/redo; autosave;
   pan/zoom.
2. **Diagramming** — smart anchored connectors; grouping; properties panel; multi-tab + naming.
3. **In/out & polish** — JSON/PNG/SVG export + open; copy/paste; alignment guides; elbow
   routing; keyboard-shortcut pass.

---

## 14. Open questions / future
- Elbow / orthogonal connector routing and obstacle avoidance (phase 3+).
- Rotation UI for shapes (model already has `rotation`).
- Alignment guides / snapping.
- Copy/paste across tabs.
- Optional PDF export.
