# QuickDraw

A fast, browser-based **diagramming / whiteboard** tool — boxes, arrows, and text, "like PowerPoint but much easier to use." Built with TypeScript + Vite, rendered in SVG, with **no runtime dependencies**.

This repository currently contains **Phase 1 — the core canvas**.

---

## ⚠️ Run it, don't open it

QuickDraw is a Vite app. **Do not** double-click `index.html` or open it via `file://` — you'll get a **blank page**. The entry `index.html` points at `/src/main.ts` (TypeScript), which only a build tool can serve and transpile. Use the dev server (or a production build) instead:

```bash
npm install      # first time only
npm run dev      # then open the printed URL, e.g. http://localhost:5173/
```

To produce a static, hostable bundle:

```bash
npm run build    # outputs dist/ (compiled JS + a rewritten index.html)
npm run preview  # serve the built dist/ locally
```

---

## Features (Phase 1)

- **Shapes** — rectangle, rounded rectangle, ellipse, diamond, triangle, and text box. Pick a tool, then **drag on the canvas** to draw one at the size you want (MS-Paint style, with a live preview) — or just click for a default-sized one. The tool **stays active so you can draw several in a row**; press **Esc** (or click Select) to stop.
- **Select & transform** — click to select, Shift-click to multi-select, drag an empty area to marquee-select; drag to move; drag the handles to resize a single shape.
- **Text** — **select a shape and just start typing** to add a centered label (or double-click). Press **Enter**/**F2** to edit existing text, **Esc** to cancel.
- **Connect** — link two shapes with an arrow: pick the **Arrow** tool, then drag from a source shape to a target shape (a live preview follows the cursor and the target highlights). Arrows attach to shape **edges** and **re-route automatically** when you move a shape; deleting a shape removes its arrows. Click an arrow to select it, **Delete** to remove. The Arrow tool stays active for several; **Esc** exits.
- **Style** — select anything and a **properties panel** appears on the right to edit it: fill color, line color/width, solid/dashed, font size/color, connector arrowheads (start/end), and bring-to-front / send-to-back. Edits apply live; a color-pick or number tweak is a single undo. Multi-select applies to everything selected; mixed selections show the shared controls plus each type's own.
- **Group** — select multiple shapes and group them so they move as a single unit (the **Group** button or **⌘/Ctrl+G**; **Ungroup** with **⌘/Ctrl+Shift+G**). Clicking any member selects the whole group. (Arrows join groups once connectors land in Phase 2.)
- **Delete & reset** — remove the selection, or clear the whole canvas (both undoable).
- **Undo / redo** — snapshot-based history.
- **Pan & zoom** — zoom buttons, ⌘/Ctrl + scroll to zoom at the cursor, hold **Space** (or middle-mouse) and drag to pan, **100%** to reset the view.
- **Autosave** — your work is saved to the browser (`localStorage`) and restored on reload.

### Keyboard & mouse

| Action | How |
| --- | --- |
| Draw a shape | pick a shape tool, drag on the canvas (or click for default size) |
| Connect two shapes | pick the **Arrow** tool, drag from one shape to another |
| Select | click / Shift-click / drag-marquee / **⌘/Ctrl+A** (all) |
| Nudge selection | arrow keys (1px) · **Shift**+arrow (10px) |
| Move / resize | drag the shape / drag a handle |
| Rotate | select a shape, drag the round knob above it (**Shift** = 15° steps) |
| Edit text | select + start typing, or **Enter** / **F2**, or double-click |
| Commit / cancel text | **Enter** / click away &nbsp;·&nbsp; **Esc** |
| Exit draw mode / deselect | **Esc** |
| Delete selection | **Delete** / **Backspace** |
| Copy / cut / paste | **⌘/Ctrl+C** / **⌘/Ctrl+X** / **⌘/Ctrl+V** |
| Duplicate selection | **⌘/Ctrl+D** |
| Group / ungroup | **⌘/Ctrl+G** / **⌘/Ctrl+Shift+G** |
| Undo / redo | **⌘/Ctrl+Z** / **⌘/Ctrl+Shift+Z** (or **Ctrl+Y**) |
| Zoom | **⌘/Ctrl + scroll**, or the −/+/100% buttons |
| Pan | hold **Space** (or middle-mouse) and drag |

> Note: Space is the pan modifier, so a label can't *start* with a space — every other position is fine.

---

## Develop

```bash
npm run dev          # Vite dev server with HMR
npm test             # run the Vitest suite once
npm run test:watch   # watch mode
npm run build        # type-check (tsc) + production build
```

### Architecture

The data model (`Workspace → Tab → Shape`) is the **single source of truth**; the SVG is rendered *from* the model — no application state lives in the DOM. Every edit routes through one `commit()` choke point, which records an undo snapshot and schedules autosave. Logic-heavy modules are DOM-free and unit-tested; DOM/event glue is thin.

```
src/
  model/      types, document factories/mutations, pure geometry
  render/     model → SVG (shape factory + renderer)
  tools/      interaction state machines (select, shape placement)
  history/    snapshot undo/redo
  storage/    localStorage autosave
  ui/         toolbar, zoom controls
  app.ts      app state + event wiring · main.ts  bootstrap
```

The design spec and implementation plan live under [`docs/superpowers/`](docs/superpowers/).

---

## Roadmap

- **Shipped** — smart anchored connectors with editable + fixed (pinned) connection points and elbow routing; grouping; the style/properties panel; named tabs; save/open (`.json`) and export (vector SVG + **300-DPI PNG**); copy/cut/paste/duplicate; alignment guides + snapping; shape rotation; keyboard nudge & select-all.
- **Possible next** — per-kind edge clipping for connectors, drag-to-reorder tabs, obstacle-avoiding routing, and cross-tab drag.

## Tech stack

TypeScript (strict) · Vite · Vitest (jsdom) · SVG · zero runtime dependencies.
