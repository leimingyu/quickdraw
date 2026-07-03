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

  it('toWorld inverts the viewport transform (jsdom rect offsets are 0)', () => {
    const r = new Renderer(mount);
    expect(r.toWorld(100, 100, { panX: 10, panY: 10, zoom: 2 })).toEqual({ x: 45, y: 45 });
  });

  // jsdom reports a 0×0 rect, so stub a measured viewport to exercise the grid math.
  const sizeSvg = (r: Renderer, width: number, height: number) => {
    r.svg.getBoundingClientRect = () =>
      ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, toJSON() {} }) as DOMRect;
  };

  it('paints grid lines when showGrid is on', () => {
    const r = new Renderer(mount);
    sizeSvg(r, 100, 40); // zoom 1 → x at 0..100 step 20 (6), y at 0..40 (3)
    r.render(createTab(), new Set(), undefined, [], undefined, true);
    expect(r.svg.querySelectorAll('line').length).toBe(9);
  });

  it('paints no grid lines when showGrid is off (the default)', () => {
    const r = new Renderer(mount);
    sizeSvg(r, 100, 40);
    r.render(createTab(), new Set());
    expect(r.svg.querySelectorAll('line').length).toBe(0);
  });

  it('clears grid lines when the grid is toggled back off', () => {
    const r = new Renderer(mount);
    sizeSvg(r, 100, 40);
    r.render(createTab(), new Set(), undefined, [], undefined, true);
    expect(r.svg.querySelectorAll('line').length).toBe(9);
    r.render(createTab(), new Set(), undefined, [], undefined, false);
    expect(r.svg.querySelectorAll('line').length).toBe(0);
  });
});
