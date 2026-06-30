import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

function connectedTab() {
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  addNode(tab, a);
  addNode(tab, b);
  addNode(tab, c);
  return { tab, a, b, c };
}

describe('connector rendering', () => {
  it('renders a connector as a <g data-id> containing a <line>', () => {
    const r = new Renderer(mount);
    const { tab, c } = connectedTab();
    r.render(tab, new Set());
    const g = r.svg.querySelector(`g[data-id="${c.id}"]`);
    expect(g).toBeTruthy();
    expect(g!.querySelector('line')).toBeTruthy();
  });

  it('defines a reusable arrowhead marker once', () => {
    const r = new Renderer(mount);
    expect(r.svg.querySelectorAll('marker#arrowhead')).toHaveLength(1);
  });

  it('draws connectors behind shapes (connector g precedes shape g in the content)', () => {
    const r = new Renderer(mount);
    const { tab, a, c } = connectedTab();
    r.render(tab, new Set());
    const ids = [...r.svg.querySelectorAll('g[data-id]')].map((g) => g.getAttribute('data-id'));
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it('highlights a selected connector', () => {
    const r = new Renderer(mount);
    const { tab, c } = connectedTab();
    r.render(tab, new Set([c.id]));
    const line = r.svg.querySelector(`g[data-id="${c.id}"] line`)!;
    expect(line.getAttribute('stroke')).toBe('#3b82f6');
  });
});
