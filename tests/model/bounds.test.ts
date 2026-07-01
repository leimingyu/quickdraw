import { describe, it, expect } from 'vitest';
import { contentBounds } from '../../src/model/bounds';
import { createTab, addNode, createShape } from '../../src/model/document';

describe('contentBounds', () => {
  it('returns null for a tab with no shapes', () => {
    expect(contentBounds(createTab())).toBeNull();
  });

  it('returns the box of a single shape', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 10, 20, 100, 50));
    expect(contentBounds(tab)).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  it('unions multiple shapes', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 10, 20, 100, 50));    // x 10..110, y 20..70
    addNode(tab, createShape('ellipse', 200, 0, 40, 40));   // x 200..240, y 0..40
    expect(contentBounds(tab)).toEqual({ x: 10, y: 0, w: 230, h: 70 });
  });
});
