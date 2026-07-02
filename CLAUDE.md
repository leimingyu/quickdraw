# CLAUDE.md — guidance for CI agents

QuickDraw is a browser-based diagramming tool. Zero runtime deps; TypeScript + Vite,
tested with Vitest (jsdom). All UI logic lives in `src/`, tests mirror it in `tests/`.

## Setup
- `npm ci` — install dev deps (typescript, vite, vitest, jsdom). Required before anything.

## Build
- `npm run build` — `tsc` typecheck (noEmit) then `vite build` → `dist/`.
- `npm run build:single` — build, then `node scripts/build-single-file.mjs` to emit the
  portable single-file `quickdraw.html` (double-clickable, no server).
- `npm run dev` — Vite dev server. `npm run preview` — serve the built `dist/`.

## Test
- `npm test` — run the full suite once (`vitest run`).
- `npm run test:watch` — watch mode (`vitest`). Do NOT use in CI (never exits).
- Single file: `npx vitest run tests/model/geometry.test.ts`
- Single test by name: `npx vitest run -t "snaps to nearest grid"`
- Tests use Vitest globals (`describe`/`it`/`expect`) + jsdom; no import needed.

## Directory layout
- `src/model/`   — document model, geometry, bounds, snapping, copy/paste, types
- `src/render/`  — canvas renderer, shapes, connectors, SVG export
- `src/tools/`   — interactive tools (select, shape, connector, drag, endpoint)
- `src/ui/`      — menubar, tabs, properties panel, tool palette, toast, platform
- `src/io/`      — save/open, serialize, PNG export
- `src/history/` — undo/redo stack
- `src/util/`    — id generation and misc helpers
- `src/app.ts` `src/main.ts` `src/style.css` — app wiring, entry point, styles
- `tests/`       — Vitest specs, mirroring `src/` (plus `app.*` integration specs)
- `scripts/`     — build tooling (`build-single-file.mjs`)
- `docs/superpowers/{specs,plans}/` — design specs and implementation plans
- `quickdraw.html` — generated portable single-file build (do not hand-edit)
- `index.html` — Vite dev/build entry

## Conventions
- NEVER push to `main`. Do all work on a `fix/<slug>` branch and open a PR.
- Keep fixes minimal and targeted. Reproduce the bug, add a failing test first when
  feasible, then make the smallest change that turns it green.
- Do NOT refactor or reformat unrelated code. Touch only what the fix requires.
- Run `npm run build` (typecheck) and `npm test` before committing; both must pass.
- Match existing style: strict TS (`noUnusedLocals`/`noUnusedParameters` on),
  ES modules, `verbatimModuleSyntax` — use `import type` for type-only imports.
- If you cannot reproduce or fix an issue, push nothing; report findings instead.
