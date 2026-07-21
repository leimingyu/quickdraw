import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountContextMenu } from '../../src/ui/contextMenu';
import { closeOpenPopup } from '../../src/ui/flyout';
import { addNode, createShape, createConnector, groupNodes } from '../../src/model/document';

let app: App;
let canvasHost: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  canvasHost = document.createElement('div');
  document.body.appendChild(canvasHost);
  app = new App(canvasHost);          // renderer mounts its <svg> into canvasHost
  mountContextMenu(app, canvasHost);
});
afterEach(() => { closeOpenPopup(); app.destroy(); });

const rightClick = () => canvasHost.dispatchEvent(
  new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
const rightClickAt = (x: number, y: number) => canvasHost.dispatchEvent(
  new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
const labels = () => [...document.querySelectorAll('.flyout-item .flyout-label')].map((b) => b.textContent!.replace('✓ ', ''));

describe('context menu — selection contexts', () => {
  it('empty canvas → Paste / Select all / grid toggles, and suppresses the native menu', () => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    canvasHost.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(labels()).toEqual(['Paste', 'Select all', 'Show grid', 'Snap to grid']);
  });

  it('multi-selection → Group present, Ungroup absent without a group', () => {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    app.selection = new Set([a.id, b.id]);
    rightClick();
    expect(labels()).toContain('Group');
    expect(labels()).not.toContain('Ungroup');
  });

  it('multi-selection with a group → Ungroup present', () => {
    const a = createShape('rect', 0, 0, 40, 40);
    const b = createShape('rect', 80, 0, 40, 40);
    addNode(app.activeTab, a); addNode(app.activeTab, b);
    groupNodes(app.activeTab, new Set([a.id, b.id]));
    app.selection = new Set([a.id, b.id]);
    rightClick();
    expect(labels()).toContain('Ungroup');
  });

  it('a single connector menu omits Edit text', () => {
    const s1 = createShape('rect', 100, 100, 40, 40);
    const s2 = createShape('rect', 300, 100, 40, 40);
    const c = createConnector({ nodeId: s1.id }, { nodeId: s2.id });
    addNode(app.activeTab, s1); addNode(app.activeTab, s2); addNode(app.activeTab, c);
    app.selection = new Set([c.id]);
    rightClickAt(220, 120); // right-clicks the connector line → single connector menu
    expect(labels()).not.toContain('Edit text');
    expect(labels()).toContain('Delete');
  });
});

describe('context menu — deselection', () => {
  it('right-clicking empty space clears the selection and shows the canvas menu', () => {
    const a = createShape('rect', 100, 100, 40, 40);
    addNode(app.activeTab, a);
    app.selection = new Set([a.id]);
    rightClickAt(5, 5); // empty space, away from the shape
    expect(app.selection.size).toBe(0);
    expect(labels()).toEqual(['Paste', 'Select all', 'Show grid', 'Snap to grid']);
  });
});

describe('context menu — actions', () => {
  it('Select all from the canvas menu selects every node', () => {
    addNode(app.activeTab, createShape('rect', 100, 100, 40, 40));
    rightClick();
    [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.querySelector('.flyout-label')?.textContent === 'Select all')!.click();
    expect(app.selection.size).toBe(1);
  });
});
