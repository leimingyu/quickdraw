import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape } from '../../src/model/document';
import { rotationHandlePos, ROTATION_KNOB_DIST } from '../../src/model/geometry';

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

const pe = (shift = false) => ({ shiftKey: shift } as PointerEvent);

describe('SelectTool rotation', () => {
  it('dragging the rotation knob rotates the shape (undoable)', () => {
    const s = createShape('rect', 0, 0, 100, 100); // center (50,50)
    addNode(app.activeTab, s);
    app.commit(); // baseline (rotation 0)
    app.selection = new Set([s.id]);
    const knob = rotationHandlePos(s, ROTATION_KNOB_DIST); // straight up
    tool.onPointerDown({ x: knob.x, y: knob.y }, pe());
    tool.onPointerMove({ x: 150, y: 50 }, pe()); // pointer to the right of center → 90°
    tool.onPointerUp({ x: 150, y: 50 }, pe());
    expect(s.rotation).toBeCloseTo(90, 4);
    app.undo();
    expect(app.activeTab.nodes[0].rotation ?? 0).toBe(0);
  });

  it('Shift snaps rotation to a multiple of 15°', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    addNode(app.activeTab, s);
    app.selection = new Set([s.id]);
    const knob = rotationHandlePos(s, ROTATION_KNOB_DIST);
    tool.onPointerDown({ x: knob.x, y: knob.y }, pe(true));
    tool.onPointerMove({ x: 150, y: 60 }, pe(true)); // ~96° → snaps
    expect((s.rotation as number) % 15).toBe(0);
  });

  it('selects a rotated shape by a point inside its rotated (not axis-aligned) body', () => {
    const s = createShape('rect', 0, 0, 100, 20); // wide; center (50,10)
    s.rotation = 90; // visually tall
    addNode(app.activeTab, s);
    // (50,-20) is inside the rotated shape but outside the unrotated 0..20 y-band
    tool.onPointerDown({ x: 50, y: -20 }, pe());
    expect(app.selection.has(s.id)).toBe(true);
    tool.onPointerUp({ x: 50, y: -20 }, pe());
  });
});
