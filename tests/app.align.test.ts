import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';
import { addNode, createShape, groupNodes } from '../src/model/document';
import type { Shape } from '../src/model/types';

let app: App;
beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

const rect = (x: number, y: number, w = 40, h = 20) => createShape('rect', x, y, w, h);

describe('App.align / App.distribute', () => {
  it('align("left") pulls every selected shape to the leftmost edge', () => {
    const a = rect(0, 0), b = rect(100, 50), c = rect(200, 10);
    [a, b, c].forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set([a.id, b.id, c.id]);
    app.align('left');
    expect([a.x, b.x, c.x]).toEqual([0, 0, 0]);
  });

  it('align("bottom") pulls every selected shape to the lowest edge', () => {
    const a = rect(0, 0, 40, 20), b = rect(100, 50, 40, 40), c = rect(200, 10, 40, 30);
    [a, b, c].forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set([a.id, b.id, c.id]);
    app.align('bottom'); // max bottom = 50+40 = 90
    expect([a.y + a.h, b.y + b.h, c.y + c.h]).toEqual([90, 90, 90]);
  });

  it('is undoable as a single step', () => {
    const a = rect(0, 0), b = rect(100, 50);
    [a, b].forEach((s) => addNode(app.activeTab, s));
    app.commit(); // baseline: the shapes exist
    app.selection = new Set([a.id, b.id]);
    app.align('left');
    expect(b.x).toBe(0);
    app.undo();
    expect((app.activeTab.nodes[1] as Shape).x).toBe(100); // original restored
  });

  it('records no history entry when the selection is already aligned', () => {
    const a = rect(0, 0), b = rect(0, 50); // already left-aligned
    [a, b].forEach((s) => addNode(app.activeTab, s));
    app.commit(); // the only entry: the shapes exist
    app.selection = new Set([a.id, b.id]);
    app.align('left'); // no movement → no commit
    app.undo(); // undoes the add, not a phantom align
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('treats a group as one rigid unit — members keep their relative offset', () => {
    const a = rect(100, 0), b = rect(110, 30); // grouped; group bbox left = 100
    const c = rect(0, 0); // loose, leftmost
    [a, b, c].forEach((s) => addNode(app.activeTab, s));
    groupNodes(app.activeTab, new Set([a.id, b.id]));
    app.selection = new Set([a.id, b.id, c.id]);
    app.align('left'); // units: {a,b} @100, {c} @0 → selection left = 0
    expect(c.x).toBe(0); // loose shape unchanged (already leftmost)
    expect(a.x).toBe(0); // group shifted left by 100
    expect(b.x).toBe(10); // …offset preserved (was 110-100 = 10)
  });

  it('align is a no-op for a single unit (nothing to align against)', () => {
    const a = rect(30, 30), b = rect(40, 40);
    [a, b].forEach((s) => addNode(app.activeTab, s));
    groupNodes(app.activeTab, new Set([a.id, b.id])); // one unit
    app.selection = new Set([a.id, b.id]);
    app.align('left');
    expect([a.x, b.x]).toEqual([30, 40]); // unchanged
  });

  it('distribute("hspace") equalizes gaps and pins the extreme shapes', () => {
    const a = rect(0, 0, 40, 20), b = rect(100, 0, 60, 20), c = rect(200, 0, 20, 20);
    [a, b, c].forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set([a.id, b.id, c.id]);
    app.distribute('hspace');
    expect(a.x).toBe(0); // first pinned
    expect(c.x + c.w).toBe(220); // last pinned (right edge)
    expect(b.x - (a.x + a.w)).toBe(c.x - (b.x + b.w)); // equal gaps
  });

  it('distribute is a no-op for fewer than three units', () => {
    const a = rect(0, 0), b = rect(100, 0);
    [a, b].forEach((s) => addNode(app.activeTab, s));
    app.selection = new Set([a.id, b.id]);
    app.distribute('hspace');
    expect([a.x, b.x]).toEqual([0, 100]); // unchanged
  });
});
