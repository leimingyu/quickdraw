import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { ConnectorTool } from '../../src/tools/connectorTool';
import { addNode, createShape, isConnector } from '../../src/model/document';
import type { Point } from '../../src/model/geometry';

let app: App;
let tool: ConnectorTool;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  tool = new ConnectorTool(app);
  app.registerTool('arrow', tool);
  app.setTool('arrow');
});
afterEach(() => app.destroy());

function twoShapes() {
  const a = createShape('rect', 0, 0, 100, 100);    // (0,0)-(100,100)
  const b = createShape('rect', 300, 0, 100, 100);  // (300,0)-(400,100)
  addNode(app.activeTab, a);
  addNode(app.activeTab, b);
  return { a, b };
}
const conns = () => app.activeTab.nodes.filter(isConnector);
const drag = (from: Point, to: Point) => {
  tool.onPointerDown(from);
  tool.onPointerMove(to);
  tool.onPointerUp(to);
};

describe('ConnectorTool (draw an arrow anywhere)', () => {
  it('drag on empty canvas makes a free-floating arrow', () => {
    twoShapes();
    drag({ x: 150, y: 200 }, { x: 260, y: 260 });
    expect(conns()).toHaveLength(1);
    expect(conns()[0].from).toEqual({ x: 150, y: 200 });
    expect(conns()[0].to).toEqual({ x: 260, y: 260 });
    expect(app.selection.has(conns()[0].id)).toBe(true);
  });

  it('an end that lands on a shape attaches to it', () => {
    const { b } = twoShapes();
    drag({ x: 150, y: 200 }, { x: 350, y: 50 }); // empty → inside B
    expect(conns()[0].from).toEqual({ x: 150, y: 200 });
    expect(conns()[0].to).toEqual({ nodeId: b.id });
  });

  it('drag from shape to shape attaches both ends', () => {
    const { a, b } = twoShapes();
    drag({ x: 50, y: 50 }, { x: 350, y: 50 }); // inside A → inside B
    expect(conns()[0].from).toEqual({ nodeId: a.id });
    expect(conns()[0].to).toEqual({ nodeId: b.id });
  });

  it('a click (no drag) creates no arrow', () => {
    twoShapes();
    tool.onPointerDown({ x: 200, y: 200 });
    tool.onPointerUp({ x: 201, y: 201 }); // moved < DRAG_THRESHOLD
    expect(conns()).toHaveLength(0);
  });

  it('stays on the arrow tool for continuous drawing', () => {
    drag({ x: 10, y: 10 }, { x: 120, y: 120 });
    expect(app.currentToolName).toBe('arrow');
  });

  it('switching tools mid-drag removes the preview', () => {
    tool.onPointerDown({ x: 10, y: 10 });
    tool.onPointerMove({ x: 120, y: 120 });
    expect(conns()).toHaveLength(1);
    app.setTool('select');
    expect(conns()).toHaveLength(0);
    expect(app.highlightId).toBeUndefined();
  });

  it('a pointercancel during a drag cleans up the preview', () => {
    tool.onPointerDown({ x: 10, y: 10 });
    tool.onPointerMove({ x: 120, y: 120 });
    expect(conns()).toHaveLength(1);
    app.renderer.svg.dispatchEvent(new Event('pointercancel'));
    expect(conns()).toHaveLength(0);
  });
});
