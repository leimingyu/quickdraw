import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../../src/app';
import { SelectTool } from '../../src/tools/selectTool';
import { addNode, createShape, createConnector, isConnector } from '../../src/model/document';

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
afterEach(() => app.destroy());

const pe = () => ({ shiftKey: false } as unknown as PointerEvent);

function scene() {
  const a = createShape('rect', 0, 0, 100, 100);     // (0,0)-(100,100)
  const b = createShape('rect', 300, 0, 100, 100);   // (300,0)-(400,100)
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}
const conn = () => app.activeTab.nodes.filter(isConnector)[0];
// For A→B the resolved handles sit at A's right edge (100,50) and B's left edge (300,50).

describe('SelectTool connector endpoint editing', () => {
  it('dragging the "to" endpoint onto another shape re-attaches it', () => {
    const { a } = scene();
    const d = createShape('rect', 200, 200, 100, 100); // (200,200)-(300,300)
    addNode(app.activeTab, d);
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());   // grab the 'to' handle
    tool.onPointerMove({ x: 250, y: 250 }, pe());  // over D
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(conn().to).toEqual({ nodeId: d.id });
    expect(conn().from).toEqual({ nodeId: a.id });
  });

  it('dragging an endpoint onto empty canvas detaches it (free point)', () => {
    scene();
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());   // 'to' handle
    tool.onPointerMove({ x: 500, y: 400 }, pe());  // empty
    tool.onPointerUp({ x: 500, y: 400 }, pe());
    expect(conn().to).toEqual({ x: 500, y: 400 });
  });

  it('highlights the shape under the cursor while dragging, clears on release', () => {
    scene();
    const d = createShape('rect', 200, 200, 100, 100);
    addNode(app.activeTab, d);
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());
    tool.onPointerMove({ x: 250, y: 250 }, pe());  // over D
    expect(app.highlightId).toBe(d.id);
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(app.highlightId).toBeUndefined();
  });

  it('a press away from the endpoints does not enter endpoint mode', () => {
    const { a, b } = scene();
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 200, y: 50 }, pe());   // mid-line, not near a handle
    tool.onPointerMove({ x: 200, y: 120 }, pe());
    tool.onPointerUp({ x: 200, y: 120 }, pe());
    expect(conn().from).toEqual({ nodeId: a.id });
    expect(conn().to).toEqual({ nodeId: b.id });
  });

  it('re-attaching an endpoint is a single undo entry', () => {
    const { b } = scene();
    const d = createShape('rect', 200, 200, 100, 100);
    addNode(app.activeTab, d);
    app.commit();                                  // baseline: the drawing before the edit
    app.selection = new Set([conn().id]);
    tool.onPointerDown({ x: 300, y: 50 }, pe());
    tool.onPointerMove({ x: 250, y: 250 }, pe());
    tool.onPointerUp({ x: 250, y: 250 }, pe());
    expect(conn().to).toEqual({ nodeId: d.id });
    app.undo();
    expect(conn().to).toEqual({ nodeId: b.id });
  });

  it('a press-and-release near an endpoint without dragging leaves it attached and records no history', () => {
    const { a } = scene();
    app.selection = new Set([conn().id]);
    const spy = vi.spyOn(app, 'commit');
    // (105,50) is within the from-handle halo (10px of (100,50)) but off shape A (x>100).
    tool.onPointerDown({ x: 105, y: 50 }, pe());
    tool.onPointerUp({ x: 105, y: 50 }, pe()); // no drag
    expect(conn().from).toEqual({ nodeId: a.id }); // still attached — not detached to {105,50}
    expect(spy).not.toHaveBeenCalled();
  });
});
