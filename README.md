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
- **Group** — select multiple shapes and group them so they move as a single unit (the **Group** button or **⌘/Ctrl+G**; **Ungroup** with **⌘/Ctrl+Shift+G**). Clicking any member selects the whole group. (Arrows join groups once connectors land in Phase 2.)
- **Delete & reset** — remove the selection, or clear the whole canvas (both undoable).
- **Undo / redo** — snapshot-based history.
- **Pan & zoom** — zoom buttons, ⌘/Ctrl + scroll to zoom at the cursor, hold **Space** (or middle-mouse) and drag to pan, **100%** to reset the view.
- **Autosave** — your work is saved to the browser (`localStorage`) and restored on reload.

### Keyboard & mouse

| Action | How |
| --- | --- |
| Draw a shape | pick a shape tool, drag on the canvas (or click for default size) |
| Select | click / Shift-click / drag-marquee |
| Move / resize | drag the shape / drag a handle |
| Edit text | select + start typing, or **Enter** / **F2**, or double-click |
| Commit / cancel text | **Enter** / click away &nbsp;·&nbsp; **Esc** |
| Exit draw mode / deselect | **Esc** |
| Delete selection | **Delete** / **Backspace** |
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

- **Phase 2** — smart anchored connectors (arrows that follow shapes), grouping, a properties/style panel, and multiple named tabs.
- **Phase 3** — export to JSON / PNG / SVG, open saved projects, copy/paste, alignment guides, elbow routing.

## Tech stack

TypeScript (strict) · Vite · Vitest (jsdom) · SVG · zero runtime dependencies.
