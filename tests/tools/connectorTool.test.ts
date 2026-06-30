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
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  addNode(app.activeTab, a);
  addNode(app.activeTab, b);
  return { a, b };
}
const at = (p: Point) => p;

describe('ConnectorTool', () => {
  it('drag from shape A to shape B creates a connector between them', () => {
    const { a, b } = twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));   // inside A
    tool.onPointerMove(at({ x: 200, y: 50 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));    // inside B
    const conns = app.activeTab.nodes.filter(isConnector);
    expect(conns).toHaveLength(1);
    expect(conns[0].from).toEqual({ nodeId: a.id });
    expect(conns[0].to).toEqual({ nodeId: b.id });
    expect(app.selection.has(conns[0].id)).toBe(true);
  });

  it('stays on the arrow tool for continuous drawing', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));
    expect(app.currentToolName).toBe('arrow');
  });

  it('release on empty space cancels (no connector, no leftover node)', () => {
    const before = app.activeTab.nodes.length;
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerMove(at({ x: 600, y: 400 }));
    tool.onPointerUp(at({ x: 600, y: 400 }));    // empty
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
    expect(app.activeTab.nodes.length).toBe(before + 2); // just the two shapes
  });

  it('release on the same shape cancels', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 50, y: 50 }));
    tool.onPointerUp(at({ x: 60, y: 60 }));      // still inside A
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
  });

  it('pressing on empty space starts nothing', () => {
    twoShapes();
    tool.onPointerDown(at({ x: 600, y: 400 }));
    tool.onPointerUp(at({ x: 350, y: 50 }));
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
  });

  it('switching tools mid-drag removes the preview and clears the highlight', () => {
    twoShapes();
    tool.onPointerDown({ x: 50, y: 50 });   // start a drag (preview added)
    tool.onPointerMove({ x: 200, y: 50 });
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(1);
    app.setTool('select');                  // switch away mid-drag → onDeactivate fires
    expect(app.activeTab.nodes.filter(isConnector)).toHaveLength(0);
    expect(app.highlightId).toBeUndefined();
  });
});
