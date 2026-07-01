import { describe, it, expect } from 'vitest';
import { contentBounds } from '../../src/model/bounds';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

describe('contentBounds', () => {
  it('returns null for an empty tab', () => {
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

  it('includes free connector endpoints so floating arrows are not cropped', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 50, 50);
    addNode(tab, a);
    addNode(tab, createConnector({ nodeId: a.id }, { x: 300, y: 200 })); // free end past the shape
    expect(contentBounds(tab)).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('bounds a tab that has only a free-floating arrow (no shapes)', () => {
    const tab = createTab();
    addNode(tab, createConnector({ x: 40, y: 60 }, { x: 140, y: 110 }));
    expect(contentBounds(tab)).toEqual({ x: 40, y: 60, w: 100, h: 50 });
  });
});
