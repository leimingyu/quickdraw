import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountToolPalette } from '../../src/ui/toolPalette';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let host: HTMLElement;
let palette: { syncActive: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  palette = mountToolPalette(app, host);
});
afterEach(() => app.destroy());

const btn = (tool: string) => host.querySelector<HTMLButtonElement>(`.tool-btn[data-tool="${tool}"]`)!;
const conn = (routing: string) => host.querySelector<HTMLButtonElement>(`.tool-btn[data-routing="${routing}"]`)!;

describe('tool palette', () => {
  it('renders the shapes, a Line, and the three connector types', () => {
    const btns = [...host.querySelectorAll<HTMLElement>('.tool-btn')];
    expect(btns).toHaveLength(11);
    expect(btns.slice(0, 7).map((b) => b.dataset.tool))
      .toEqual(['select', 'rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text']);
    const connectors = btns.slice(7);
    expect(connectors.map((b) => b.dataset.routing)).toEqual(['straight', 'straight', 'elbow', 'curved']);
    expect(connectors.map((b) => b.dataset.arrow)).toEqual(['false', 'true', 'true', 'true']);
    expect(host.querySelectorAll('.tool-btn svg')).toHaveLength(11);
  });

  it('the Line shortcut selects the connector tool with no arrowhead', () => {
    host.querySelector<HTMLButtonElement>('.tool-btn[data-arrow="false"]')!.click();
    expect(app.currentToolName).toBe('arrow');
    expect(app.connectorArrow).toBe(false);
    expect(app.connectorRouting).toBe('straight');
  });

  it('clicking a shape shortcut selects that tool', () => {
    btn('ellipse').click();
    expect(app.currentToolName).toBe('ellipse');
  });

  it('clicking a connector type selects the arrow tool with that routing, and highlights it', () => {
    conn('curved').click();
    expect(app.currentToolName).toBe('arrow');
    expect(app.connectorRouting).toBe('curved');
    palette.syncActive();
    expect(conn('curved').classList.contains('active')).toBe(true);
    expect(conn('straight').classList.contains('active')).toBe(false);
  });

  it('syncActive highlights only the current tool', () => {
    btn('diamond').click();
    palette.syncActive();
    expect(btn('diamond').classList.contains('active')).toBe(true);
    expect(btn('select').classList.contains('active')).toBe(false);
  });

  it('defaults to Select highlighted', () => {
    expect(btn('select').classList.contains('active')).toBe(true);
  });
});

describe('undo / redo palette buttons', () => {
  const action = (name: string) => host.querySelector<HTMLButtonElement>(`.palette-action[data-action="${name}"]`)!;

  function commitAnEdit() {
    addNode(app.activeTab, createShape('rect', 0, 0, 40, 40));
    app.commit(); // snapshots history → canUndo becomes true
  }

  it('renders undo and redo action buttons without changing the tool count', () => {
    expect(action('undo')).toBeTruthy();
    expect(action('redo')).toBeTruthy();
    expect(host.querySelectorAll('.tool-btn')).toHaveLength(11); // tools unchanged
  });

  it('disables both on a fresh document (nothing to undo/redo)', () => {
    palette.syncActive();
    expect(action('undo').disabled).toBe(true);
    expect(action('redo').disabled).toBe(true);
  });

  it('enables undo after a committed change; clicking it reverts and enables redo', () => {
    commitAnEdit();
    palette.syncActive();
    expect(action('undo').disabled).toBe(false);
    expect(action('redo').disabled).toBe(true);

    action('undo').click();
    expect(app.activeTab.nodes).toHaveLength(0); // the added shape is gone

    palette.syncActive();
    expect(action('redo').disabled).toBe(false);
    expect(action('undo').disabled).toBe(true);
  });

  it('clicking redo re-applies the undone change', () => {
    commitAnEdit();
    app.undo();
    expect(app.activeTab.nodes).toHaveLength(0);
    palette.syncActive();
    action('redo').click();
    expect(app.activeTab.nodes).toHaveLength(1);
  });
});
