import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../../src/render/renderer';
import { createTab, addNode, createShape } from '../../src/model/document';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

describe('Renderer quick-connect ports', () => {
  it('draws no ports without a hovered shape', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    addNode(tab, createShape('rect', 0, 0));
    r.render(tab, new Set());
    expect(r.svg.querySelectorAll('[data-port]')).toHaveLength(0);
  });

  it('draws four ports for a hovered, unselected shape', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    const s = createShape('rect', 0, 0);
    addNode(tab, s);
    r.render(tab, new Set(), undefined, [], s.id);
    expect(r.svg.querySelectorAll('[data-port]')).toHaveLength(4);
  });

  it('suppresses the top (n) port when the hovered shape is the sole selection', () => {
    const r = new Renderer(mount);
    const tab = createTab();
    const s = createShape('rect', 0, 0);
    addNode(tab, s);
    r.render(tab, new Set([s.id]), undefined, [], s.id);
    const ports = [...r.svg.querySelectorAll('[data-port]')].map((e) => e.getAttribute('data-port'));
    expect(ports).toHaveLength(3);
    expect(ports).not.toContain('n');
  });
});
