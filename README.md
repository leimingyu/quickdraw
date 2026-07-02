# QuickDraw

A fast, browser-based **diagramming / whiteboard** tool — boxes, arrows, and text, "like PowerPoint but much easier to use." Built with TypeScript + Vite, rendered in SVG, with **no runtime dependencies**.

This repository currently contains **Phase 1 — the core canvas**.

---

## Use it — no install (portable)

Just want to draw? Grab **[`quickdraw.html`](quickdraw.html)** and **double-click it.** It's a single self-contained file — all JS and CSS inlined, no external requests — that runs in any modern browser on **Windows, macOS, or Linux** with **no install, no server, no npm**. Copy it to a USB stick, email it, drop it in any folder.

> Opened this way (`file://`), Save / Open / Export use the browser's normal download & file-picker instead of a native "Save As" folder dialog — everything still works. For the full folder-picker experience, serve it (dev server or a static host).

Regenerate it after code changes with `npm run build:single` (writes `quickdraw.html`).

## Run from source (for development)

The dev entry `index.html` points at `/src/main.ts` (TypeScript), so **don't** double-click *it* — that one needs a build tool. Use the dev server (or a production build):

```bash
npm install      # first time only
npm run dev      # then open the printed URL, e.g. http://localhost:5173/
```

To produce a static, hostable bundle:

```bash
npm run build    # outputs dist/ (compiled JS + a rewritten index.html)
npm run preview  # serve the built dist/ locally
```

### Windows & macOS

QuickDraw runs in the browser, so it works the same on **Windows and macOS** (and Linux) — the commands above are identical on all three (they need only Node.js + a Chromium-based browser, Chrome/Edge, for save/open; other browsers fall back to a plain download/upload). The one platform difference is the modifier key: shortcuts use **⌘ on macOS** and **Ctrl on Windows/Linux**, and both are accepted everywhere. Menu items show whichever applies to your OS.

---

## Features (Phase 1)

- **Shapes** — rectangle, rounded rectangle, ellipse, diamond, triangle, and text box. Pick a tool, then **drag on the canvas** to draw one at the size you want (MS-Paint style, with a live preview) — or just click for a default-sized one. The tool **stays active so you can draw several in a row**; press **Esc** (or click Select) to stop.
- **Select & transform** — click to select, Shift-click to multi-select, drag an empty area to marquee-select; drag to move; drag the handles to resize a single shape.
- **Text** — **select a shape and just start typing** to add a centered label (or double-click). Press **Enter**/**F2** to edit existing text, **Esc** to cancel.
- **Line & connect** — the **Line** shortcut draws a plain straight line (no arrowhead) you can style solid/dashed, recolor, and re-width. To link shapes, pick one of the three arrow connectors (**Straight**, **Elbow**, or **Curved**), then drag from a source shape to a target shape (a live preview follows the cursor and the target highlights). Connectors attach to shape **connection points** and **re-route automatically** when you move a shape; deleting a shape removes its connectors. Select one and switch its **Type** (Straight / Elbow / Curved) in the properties panel. Click to select, **Delete** to remove.
- **Style** — select anything and a **properties panel** appears on the right to edit it: fill color, line color/width, solid/dashed, font size/color, connector arrowheads (start/end), and bring-to-front / send-to-back. Edits apply live; a color-pick or number tweak is a single undo. Multi-select applies to everything selected; mixed selections show the shared controls plus each type's own.
- **Tool palette & menus** — a left-side vertical palette of circular icon shortcuts picks the tool in one click (Select/move, the six shapes, a plain **Line**, and the three arrow connectors — Straight, Elbow, Curved; the active one is highlighted). A compact Microsoft-Paint-style menu bar on top holds the commands: **File** (save / open / export / clear), **Edit** (undo/redo, cut/copy/paste/duplicate, delete, select-all, group/ungroup), and **View** (zoom). The style/properties panel stays docked on the right.
- **Group** — select multiple shapes and group them so they move as a single unit (**Edit → Group** or **⌘/Ctrl+G**; **Ungroup** with **⌘/Ctrl+Shift+G**). Clicking any member selects the whole group.
- **Delete & reset** — remove the selection, or clear the whole canvas (both undoable).
- **Undo / redo** — snapshot-based history.
- **Pan & zoom** — the **View** menu (zoom in / out / reset), ⌘/Ctrl + scroll to zoom at the cursor, hold **Space** (or middle-mouse) and drag to pan.
- **Autosave** — your work is saved to the browser (`localStorage`) and restored on reload.

### Keyboard & mouse

| Action | How |
| --- | --- |
| Draw a shape | pick a shape tool, drag on the canvas (or click for default size) |
| Connect two shapes | pick a connector (Straight / Elbow / Curved), drag between shapes |
| Select | click / Shift-click / drag-marquee / **⌘/Ctrl+A** (all) |
| Nudge selection | arrow keys (1px) · **Shift**+arrow (10px) |
| Move / resize | drag the shape / drag a handle |
| Rotate | select any shape, drag the ↻ handle above it (**Shift** = 15° steps) |
| Edit text | select + start typing, or **Enter** / **F2**, or double-click |
| Commit / cancel text | **Enter** / click away &nbsp;·&nbsp; **Esc** |
| Exit draw mode / deselect | **Esc** |
| Delete selection | **Delete** / **Backspace** |
| Copy / cut / paste | **⌘/Ctrl+C** / **⌘/Ctrl+X** / **⌘/Ctrl+V** |
| Duplicate selection | **⌘/Ctrl+D** |
| Group / ungroup | **⌘/Ctrl+G** / **⌘/Ctrl+Shift+G** |
| Undo / redo | **⌘/Ctrl+Z** / **⌘/Ctrl+Shift+Z** (or **Ctrl+Y**) |
| Zoom | **⌘/Ctrl + scroll**, or the **View** menu |
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
  ui/         menu bar, tabs, properties panel, toast
  app.ts      app state + event wiring · main.ts  bootstrap
```

The design spec and implementation plan live under [`docs/superpowers/`](docs/superpowers/).

---

## Roadmap

- **Shipped** — smart anchored connectors with editable + fixed (pinned) connection points and elbow routing; grouping; the style/properties panel; named tabs; save/open (`.json`) and export (vector SVG + **300-DPI PNG**); copy/cut/paste/duplicate; alignment guides + snapping; shape rotation; keyboard nudge & select-all.
- **Possible next** — per-kind edge clipping for connectors, drag-to-reorder tabs, obstacle-avoiding routing, and cross-tab drag.

## Tech stack

TypeScript (strict) · Vite · Vitest (jsdom) · SVG · zero runtime dependencies.
