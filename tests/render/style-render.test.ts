import { describe, it, expect } from 'vitest';
import { shapeToSvg } from '../../src/render/shapes';
import { connectorToSvg } from '../../src/render/connector';
import { createTab, addNode, createShape, createConnector } from '../../src/model/document';

describe('style rendering', () => {
  it('a dashed shape gets stroke-dasharray', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.style.dashed = true;
    const g = shapeToSvg(s);
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('a non-dashed shape has no stroke-dasharray', () => {
    const g = shapeToSvg(createShape('rect', 0, 0, 100, 100));
    expect(g.querySelector('rect')!.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('renders text typography: font-family, bold, italic, and left alignment', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    s.style.fontFamily = 'Georgia, serif';
    s.style.bold = true;
    s.style.italic = true;
    s.style.textAlign = 'left';
    const text = shapeToSvg(s).querySelector('text')!;
    expect(text.getAttribute('font-family')).toBe('Georgia, serif');
    expect(text.getAttribute('font-weight')).toBe('bold');
    expect(text.getAttribute('font-style')).toBe('italic');
    expect(text.getAttribute('text-anchor')).toBe('start');
  });

  it('defaults text to centered, non-bold, non-italic, with a font-family', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    const text = shapeToSvg(s).querySelector('text')!;
    expect(text.getAttribute('text-anchor')).toBe('middle');
    expect(text.getAttribute('font-weight')).toBeNull(); // absent, not 'normal'
    expect(text.getAttribute('font-style')).toBeNull();
    expect(text.getAttribute('font-family')).toBeTruthy();
  });

  it('right-aligned text anchors at the end', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    s.style.textAlign = 'right';
    const text = shapeToSvg(s).querySelector('text')!;
    expect(text.getAttribute('text-anchor')).toBe('end');
  });

  it('a connector with arrowStart gets marker-start, and dashed gets stroke-dasharray', () => {
    const tab = createTab();
    const a = createShape('rect', 0, 0, 100, 100);
    const b = createShape('rect', 300, 0, 100, 100);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    c.style.arrowStart = true;
    c.style.dashed = true;
    [a, b, c].forEach((n) => addNode(tab, n));
    const line = connectorToSvg(tab, c, false)!.querySelector('line')!;
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead)');
    expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
