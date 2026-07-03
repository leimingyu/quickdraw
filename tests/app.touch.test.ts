import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/app';
import { SelectTool } from '../src/tools/selectTool';
import { addNode, createShape } from '../src/model/document';

// Touch-screen support (#goal): fingers are less precise than a mouse, so hit
// tolerances widen when the active pointer is touch/pen. `coarsePointer` is set
// from ev.pointerType on each pointerdown; here we drive it directly.

let app: App;
let tool: SelectTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new SelectTool(app);
  app.registerTool('select', tool);
  app.setTool('select');
});

describe('App.grabTolerance', () => {
  it('defaults to the base tolerance for a mouse (coarsePointer=false)', () => {
    expect(app.coarsePointer).toBe(false);
    expect(app.grabTolerance(8)).toBe(8); // zoom 1
  });

  it('doubles the tolerance for touch/pen', () => {
    app.coarsePointer = true;
    expect(app.grabTolerance(8)).toBe(16);
    expect(app.grabTolerance(10)).toBe(20);
  });

  it('stays screen-constant by dividing by zoom', () => {
    app.activeTab.viewport.zoom = 2;
    expect(app.grabTolerance(8)).toBe(4);   // mouse
    app.coarsePointer = true;
    expect(app.grabTolerance(8)).toBe(8);   // touch, same 16 screen-px at 2× zoom
  });
});

describe('finger can grab a resize handle from farther than a mouse', () => {
  // SE handle of this shape is at (100,100). A press at (112,112) is 12px away:
  // outside the 8px mouse tolerance, inside the 16px touch tolerance.
  function selectSquare() {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    return s;
  }

  it('a mouse press 12px off the handle does NOT resize (it misses → marquee)', () => {
    const s = selectSquare();
    app.coarsePointer = false;
    tool.onPointerDown({ x: 112, y: 112 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 140, y: 130 }, {} as PointerEvent);
    tool.onPointerUp({ x: 140, y: 130 }, {} as PointerEvent);
    expect(s.w).toBe(100); // unchanged
    expect(s.h).toBe(100);
  });

  it('a touch press 12px off the same handle DOES grab it and resize', () => {
    const s = selectSquare();
    app.coarsePointer = true; // as set by a touch pointerdown
    tool.onPointerDown({ x: 112, y: 112 }, { shiftKey: false } as PointerEvent);
    tool.onPointerMove({ x: 140, y: 130 }, {} as PointerEvent);
    tool.onPointerUp({ x: 140, y: 130 }, {} as PointerEvent);
    // Grabbed the SE handle and resized. Delta is from the press point (112,112):
    // w = 100 + (140-112) = 128, h = 100 + (130-112) = 118.
    expect(s.w).toBe(128);
    expect(s.h).toBe(118);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });
});
