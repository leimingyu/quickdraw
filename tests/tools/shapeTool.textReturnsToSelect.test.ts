import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ShapeTool } from '../../src/tools/shapeTool';
import { SelectTool } from '../../src/tools/selectTool';

// Regression: github.com/leimingyu/quickdraw/issues/3 — "after adding the text,
// the application shall return back to the selection tool, otherwise user will
// tend to create more text boxes."
//
// The behavioural fix shipped with issue #2 (PR #6): placing a text box hands off
// to the Select tool. These tests lock in issue #3's specific concern — that once
// a text box is placed, the NEXT click no longer stamps another box.

let app: App;
let select: SelectTool;
let text: ShapeTool;

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  select = new SelectTool(app);
  app.registerTool('select', select);
  text = new ShapeTool(app, 'text');
  app.registerTool('text', text);
  app.setTool('text');
});
afterEach(() => app.destroy());

/** Place a text box with the text tool (a click: press + release, no drag). */
function placeTextBox(x: number, y: number) {
  text.onPointerDown({ x, y });
  text.onPointerUp({ x, y });
}

describe('issue #3: text tool returns to select after adding text', () => {
  it('returns to the select tool once a text box is placed', () => {
    placeTextBox(200, 150);
    expect(app.currentToolName).toBe('select');
    expect(app.activeTab.nodes).toHaveLength(1);
    expect(app.activeTab.nodes[0].kind).toBe('text');
  });

  it('a following click on empty canvas does not stamp another text box', () => {
    placeTextBox(200, 150);
    expect(app.currentToolName).toBe('select'); // handed off, so the next click goes to Select
    const boxId = app.activeTab.nodes[0].id;

    // The dispatcher now routes to the select tool — a click on empty canvas just
    // clears the selection instead of creating a second text box.
    select.onPointerDown({ x: 600, y: 450 }, { shiftKey: false } as PointerEvent);
    select.onPointerUp({ x: 600, y: 450 }, {} as PointerEvent);

    expect(app.activeTab.nodes).toHaveLength(1);     // still exactly one box
    expect(app.activeTab.nodes[0].id).toBe(boxId);   // and it's the original
    expect(app.selection.size).toBe(0);              // empty-canvas click deselected
  });

  it('geometric shape tools also hand off to select after creating', () => {
    // The return-to-select handoff is universal (not text-only): every shape tool
    // returns to Select once a shape is placed.
    const rect = new ShapeTool(app, 'rect');
    app.registerTool('rect', rect);
    app.setTool('rect');
    rect.onPointerDown({ x: 0, y: 0 });
    rect.onPointerUp({ x: 0, y: 0 });
    expect(app.currentToolName).toBe('select');
  });
});
