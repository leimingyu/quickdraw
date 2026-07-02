import { describe, it, expect } from 'vitest';
import { shapeToSvg, wrapText } from '../../src/render/shapes';
import { createShape } from '../../src/model/document';

// Issue #19 — multi-line / wrapped text in shapes.

describe('wrapText (pure greedy word wrap)', () => {
  const byChars = (s: string) => s.length; // 1 unit per character

  it('wraps at word boundaries to fit the width', () => {
    expect(wrapText('the quick brown fox', 10, byChars)).toEqual(['the quick', 'brown fox']);
  });

  it('puts a word longer than the width on its own line (never breaks mid-word)', () => {
    expect(wrapText('supercalifragilistic word', 10, byChars)).toEqual([
      'supercalifragilistic',
      'word',
    ]);
  });

  it('does not wrap when the width is non-positive', () => {
    expect(wrapText('a b c d', 0, byChars)).toEqual(['a b c d']);
  });

  it('preserves an empty paragraph as a single empty line', () => {
    expect(wrapText('', 10, byChars)).toEqual(['']);
  });
});

describe('textEl multi-line rendering', () => {
  const tspans = (s: Parameters<typeof shapeToSvg>[0]) =>
    [...shapeToSvg(s).querySelectorAll('tspan')];

  it('renders one tspan per explicit line break', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'a\nb\nc';
    const spans = tspans(s);
    expect(spans.map((t) => t.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('centers the block vertically: first line offset up, the rest by one line-height', () => {
    const s = createShape('rect', 0, 0, 100, 100); // fontSize 16 → lineHeight 19.2
    s.text = 'a\nb\nc';
    const spans = tspans(s);
    expect(spans[0].getAttribute('dy')).toBe(String(-19.2)); // -(3-1)/2 * 19.2
    expect(spans[1].getAttribute('dy')).toBe(String(19.2));
    expect(spans[2].getAttribute('dy')).toBe(String(19.2));
    // every line repeats the anchor x so lines don't drift
    expect(spans.map((t) => t.getAttribute('x'))).toEqual(['50', '50', '50']);
  });

  it('renders a single line as exactly one tspan with no vertical offset', () => {
    const s = createShape('rect', 0, 0, 100, 100);
    s.text = 'Hi';
    const spans = tspans(s);
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('Hi');
    expect(spans[0].getAttribute('dy')).toBe('0');
  });

  it('auto-wraps a long line to the shape width (estimator: ~9 chars per 100px box)', () => {
    const s = createShape('rect', 0, 0, 100, 100); // maxW = 88, ~9 chars/line
    s.text = 'aaaa bbbb cccc'; // "aaaa bbbb" (9) fits; + " cccc" overflows
    const spans = tspans(s);
    expect(spans.map((t) => t.textContent)).toEqual(['aaaa bbbb', 'cccc']);
  });
});
