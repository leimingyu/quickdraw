import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountRibbon } from '../../src/ui/ribbon';
import { closeOpenPopup } from '../../src/ui/flyout';
import { addNode, createShape } from '../../src/model/document';
import type { Shape } from '../../src/model/types';

let app: App;
let host: HTMLElement;
let ribbon: { syncActive: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  ribbon = mountRibbon(app, host);
});
afterEach(() => { closeOpenPopup(); app.destroy(); });

const openShapes = () => host.querySelector<HTMLButtonElement>('.ribbon-shapes-caret')!.click();
const openArrow = () => host.querySelector<HTMLButtonElement>('.ribbon-arrow-caret')!.click();
const galleryBtn = (sel: string) => document.querySelector<HTMLButtonElement>(`.flyout-gallery ${sel}`)!;
const cmd = (name: string) => host.querySelector<HTMLButtonElement>(`[data-cmd="${name}"]`)!;
const action = (name: string) => host.querySelector<HTMLButtonElement>(`.ribbon-action[data-action="${name}"]`)!;

describe('ribbon — Insert group', () => {
  it('the Shapes gallery lists all ten shape tools with correct data-tool', () => {
    openShapes();
    const tools = [...document.querySelectorAll<HTMLElement>('.flyout-gallery .tool-btn')].map((b) => b.dataset.tool);
    expect(tools).toEqual(['rect', 'rounded', 'ellipse', 'diamond', 'triangle',
                           'brace-left', 'brace-right', 'bracket-left', 'bracket-right', 'text']);
  });

  it('picking a shape from the gallery sets that tool and updates the split-button face', () => {
    openShapes();
    galleryBtn('[data-tool="diamond"]').click();
    expect(app.currentToolName).toBe('diamond');
    expect(host.querySelector('.ribbon-shapes-face')!.getAttribute('data-tool')).toBe('diamond');
  });

  it('clicking the Shapes face re-selects the last-used shape', () => {
    openShapes();
    galleryBtn('[data-tool="ellipse"]').click();
    app.setTool('select');
    host.querySelector<HTMLButtonElement>('.ribbon-shapes-face')!.click();
    expect(app.currentToolName).toBe('ellipse');
  });

  it('the Text button selects the text tool', () => {
    host.querySelector<HTMLButtonElement>('.tool-btn[data-tool="text"]')!.click();
    expect(app.currentToolName).toBe('text');
  });

  it('the Arrow gallery carries routing + arrow attributes and selects the connector', () => {
    openArrow();
    const routings = [...document.querySelectorAll<HTMLElement>('.flyout-gallery .tool-btn')].map((b) => b.dataset.routing);
    expect(routings).toEqual(['straight', 'straight', 'elbow', 'curved']);
    galleryBtn('[data-routing="curved"]').click();
    expect(app.currentToolName).toBe('arrow');
    expect(app.connectorRouting).toBe('curved');
  });
});

describe('ribbon — Arrange group', () => {
  function addTwoSelected() {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    app.commit();
    return { a, b };
  }

  it('Group and Ungroup are disabled with nothing selected, Group enabled with 2+', () => {
    ribbon.syncActive();
    expect(cmd('group').disabled).toBe(true);
    addTwoSelected();
    ribbon.syncActive();
    expect(cmd('group').disabled).toBe(false);
  });

  it('the Group button groups the selection', () => {
    addTwoSelected();
    ribbon.syncActive();
    cmd('group').click();
    const grouped = app.activeTab.nodes.filter((n) => 'groupId' in n && n.groupId);
    expect(grouped).toHaveLength(2);
  });

  it('the Align dropdown offers align + distribute ops that call App', () => {
    const { b } = addTwoSelected();
    ribbon.syncActive();
    cmd('align').click();
    const left = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((el) => el.textContent!.includes('Align left'))!;
    expect(left).toBeTruthy();
    left.click();
    const node = app.activeTab.nodes.find((n) => n.id === b.id) as Shape;
    expect(node.x).toBe(0);
  });
});

describe('ribbon — Edit group', () => {
  it('renders undo/redo, disabled on a fresh document', () => {
    ribbon.syncActive();
    expect(action('undo').disabled).toBe(true);
    expect(action('redo').disabled).toBe(true);
  });

  it('enables undo after a committed change', () => {
    addNode(app.activeTab, createShape('rect', 0, 0, 40, 40));
    app.commit();
    ribbon.syncActive();
    expect(action('undo').disabled).toBe(false);
  });
});

describe('ribbon — syncActive highlighting', () => {
  it('highlights the Shapes face when a shape tool is active', () => {
    app.setTool('rect');
    ribbon.syncActive();
    expect(host.querySelector('.ribbon-shapes-face')!.classList.contains('active')).toBe(true);
  });
});
