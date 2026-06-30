import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape } from '../../src/model/document';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

describe('Renderer', () => {
  it('mounts a single <svg> element', () => {
    const r = new Renderer(mount);
    expect(r.svg.tagName.toLowerCase()).toBe('svg');
    expect(mount.querySelectorAll('svg')).toHaveLength(1);
  });

  it('renders one <g data-id> per node', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    addNode(tab, createShape('rect', 0, 0));
    addNode(tab, createShape('ellipse', 10, 10));
    r.render(tab, new Set());
    expect(r.svg.querySelectorAll('g[data-id]')).toHaveLength(2);
  });

  it('rebuilds (does not accumulate) on repeated render', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    addNode(tab, createShape('rect', 0, 0));
    r.render(tab, new Set());
    r.render(tab, new Set());
    expect(r.svg.querySelectorAll('g[data-id]')).toHaveLength(1);
  });

  it('draws selection handles for a single selected shape', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    const s = createShape('rect', 0, 0);
    addNode(tab, s);
    r.render(tab, new Set([s.id]));
    expect(r.svg.querySelectorAll('[data-handle]').length).toBe(8);
  });
});
