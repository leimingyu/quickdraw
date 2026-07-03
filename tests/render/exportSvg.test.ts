import { describe, it, expect } from 'vitest';
import { tabToSvgString, EXPORT_PADDING } from '../../src/render/exportSvg';
import { createTab, addNode, createShape } from '../../src/model/document';

const P = EXPORT_PADDING;

describe('tabToSvgString', () => {
  it('produces a standalone svg cropped to padded content bounds', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 100, 100, 200, 100)); // bounds x100 y100 w200 h100
    const svg = tabToSvgString(tab);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="${100 - P} ${100 - P} ${200 + 2 * P} ${100 + 2 * P}"`);
    expect(svg).toContain(`width="${200 + 2 * P}"`);
    expect(svg).toContain(`height="${100 + 2 * P}"`);
    expect(svg).toContain('<rect');
  });

  it('does not mutate the source tab viewport', () => {
    const tab = createTab();
    tab.viewport = { panX: 5, panY: 6, zoom: 1.5 };
    addNode(tab, createShape('rect', 0, 0, 50, 50));
    tabToSvgString(tab);
    expect(tab.viewport).toEqual({ panX: 5, panY: 6, zoom: 1.5 });
  });

  it('falls back to a 400x300 canvas for an empty tab', () => {
    const svg = tabToSvgString(createTab());
    expect(svg).toContain(`width="${400 + 2 * P}"`);
    expect(svg).toContain(`height="${300 + 2 * P}"`);
  });

  it('paints an opaque background rect covering the viewBox when a background is given', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 100, 100, 200, 100)); // viewBox 80 80 240 140
    const svg = tabToSvgString(tab, EXPORT_PADDING, '#ffffff');
    expect(svg).toContain(
      `<rect x="${100 - P}" y="${100 - P}" width="${200 + 2 * P}" height="${100 + 2 * P}" fill="#ffffff"/>`,
    );
  });

  it('omits the background rect (stays transparent) by default', () => {
    const tab = createTab();
    addNode(tab, createShape('rect', 100, 100, 200, 100));
    const svg = tabToSvgString(tab);
    // the full-viewBox-sized fill rect must not be present (the content shape rect is w200 h100)
    expect(svg).not.toContain(`width="${200 + 2 * P}" height="${100 + 2 * P}" fill="#ffffff"/>`);
  });
});
