import { describe, it, expect } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

function setup() {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const renderer = new Renderer(mount);
  const tab = createTab();
  const a = createShape('rect', 0, 0, 100, 100);
  const b = createShape('rect', 300, 0, 100, 100);
  const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
  addNode(tab, a);
  addNode(tab, b);
  addNode(tab, c);
  return { renderer, tab, a, c };
}

describe('Renderer connector endpoint handles', () => {
  it('draws two circle handles when a single connector is selected', () => {
    const { renderer, tab, c } = setup();
    renderer.render(tab, new Set([c.id]));
    const circles = renderer.svg.querySelectorAll('circle[data-endpoint]');
    expect(circles).toHaveLength(2);
    expect([...circles].map((h) => h.getAttribute('data-endpoint')).sort()).toEqual(['from', 'to']);
  });

  it('draws no endpoint circles for a selected shape (square handles instead)', () => {
    const { renderer, tab, a } = setup();
    renderer.render(tab, new Set([a.id]));
    expect(renderer.svg.querySelectorAll('circle[data-endpoint]')).toHaveLength(0);
    expect(renderer.svg.querySelectorAll('[data-handle]').length).toBeGreaterThan(0);
  });

  it('draws no endpoint circles when nothing is selected', () => {
    const { renderer, tab } = setup();
    renderer.render(tab, new Set());
    expect(renderer.svg.querySelectorAll('circle[data-endpoint]')).toHaveLength(0);
  });
});
