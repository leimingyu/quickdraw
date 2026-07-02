import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../../src/app';
import { mountProperties } from '../../src/ui/properties';
import { addNode, createShape, createConnector } from '../../src/model/document';

let app: App;
let container: HTMLElement;
let panel: { update: () => void };
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  container = document.createElement('div');
  document.body.appendChild(container);
  panel = mountProperties(app, container);
});
afterEach(() => app.destroy());

const dock = () => container.querySelector('.props') as HTMLElement;
const q = (sel: string) => dock().querySelector(sel) as HTMLInputElement;

function connected() {
  const a = createShape('rect', 0, 0, 50, 50);
  const b = createShape('rect', 200, 0, 50, 50);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  [a, b, c].forEach((n) => addNode(app.activeTab, n));
  return { a, b, c };
}

describe('properties panel', () => {
  it('is hidden when nothing is selected', () => {
    panel.update();
    expect(dock().style.display).toBe('none');
  });

  it('shows fill + font for a shape and no arrowhead controls', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    expect(dock().style.display).toBe('block');
    expect(q('[data-prop="fill"]')).toBeTruthy();
    expect(q('[data-prop="fontSize"]')).toBeTruthy();
    expect(dock().querySelector('[data-prop="arrowEnd"]')).toBeNull();
  });

  it('shows arrowhead controls for a connector and no fill', () => {
    const { c } = connected();
    app.selection = new Set([c.id]);
    panel.update();
    expect(q('[data-prop="arrowStart"]')).toBeTruthy();
    expect(q('[data-prop="arrowEnd"]')).toBeTruthy();
    expect(dock().querySelector('[data-prop="fill"]')).toBeNull();
  });

  it('mixed selection shows shared + shape + connector sections', () => {
    const { a, c } = connected();
    app.selection = new Set([a.id, c.id]);
    panel.update();
    expect(q('[data-prop="stroke"]')).toBeTruthy();   // shared
    expect(q('[data-prop="fill"]')).toBeTruthy();      // shape
    expect(q('[data-prop="arrowEnd"]')).toBeTruthy();  // connector
  });

  it('reflects the first selected shape fill value', () => {
    const { a } = connected();
    a.style.fill = '#ff0000';
    app.selection = new Set([a.id]);
    panel.update();
    expect(q('[data-prop="fill"]').value).toBe('#ff0000');
  });

  it('editing fill restyles every selected shape and commits on change', () => {
    const { a, b } = connected();
    app.selection = new Set([a.id, b.id]);
    panel.update();
    const commitSpy = vi.spyOn(app, 'commitStyle');
    const input = q('[data-prop="fill"]');
    input.value = '#00ff00';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(a.style.fill).toBe('#00ff00');
    expect(b.style.fill).toBe('#00ff00');
    expect(commitSpy).toHaveBeenCalled();
  });

  it('toggling dashed sets it on the selection', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    q('[data-prop="dashed"]').dispatchEvent(new Event('click'));
    expect(a.style.dashed).toBe(true);
  });

  it('Front button brings the selection to the front', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    (dock().querySelector('[data-action="front"]') as HTMLElement).dispatchEvent(new Event('click'));
    expect(app.activeTab.nodes[app.activeTab.nodes.length - 1].id).toBe(a.id);
  });

  it('shows a rotation Reset button for a shape but not a connector', () => {
    const { a, c } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    expect(dock().querySelector('[data-action="reset-rotation"]')).toBeTruthy();
    app.selection = new Set([c.id]);
    panel.update();
    expect(dock().querySelector('[data-action="reset-rotation"]')).toBeNull();
  });

  it('rotation Reset button sets the selected shape back to 0°', () => {
    const { a } = connected();
    a.rotation = 72;
    app.selection = new Set([a.id]);
    panel.update();
    (dock().querySelector('[data-action="reset-rotation"]') as HTMLElement).dispatchEvent(new Event('click'));
    expect(a.rotation).toBe(0);
  });

  it('keeps a focused input through a same-selection update (signature gate)', () => {
    const { a } = connected();
    app.selection = new Set([a.id]);
    panel.update();
    const input = q('[data-prop="fill"]');
    input.focus();
    expect(document.activeElement).toBe(input);
    panel.update(); // same selection signature → must NOT rebuild
    expect(document.activeElement).toBe(input); // still the same focused element
  });
});
