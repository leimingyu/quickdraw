import { describe, it, expect } from 'vitest';
import { shapeToSvg } from '../../src/render/shapes';
import { createShape } from '../../src/model/document';

describe('brace and bracket rendering', () => {
  it('renders each brace/bracket as a stroke-only <path> (fill none, stroke kept)', () => {
    for (const kind of ['brace-left', 'brace-right', 'bracket-left', 'bracket-right'] as const) {
      const path = shapeToSvg(createShape(kind, 0, 0, 40, 80)).querySelector('path')!;
      expect(path).toBeTruthy();
      expect(path.getAttribute('fill')).toBe('none');
      expect(path.getAttribute('stroke')).toBe('#1e1e1e');
      expect(path.getAttribute('stroke-linejoin')).toBe('round');
      expect(path.getAttribute('stroke-linecap')).toBe('round');
    }
  });

  it('draws brackets as straight polylines and braces with quadratic curves', () => {
    const bracket = shapeToSvg(createShape('bracket-left', 0, 0, 40, 80)).querySelector('path')!;
    expect(bracket.getAttribute('d')).toContain('L');
    expect(bracket.getAttribute('d')).not.toContain('Q'); // no curves in a bracket

    const brace = shapeToSvg(createShape('brace-left', 0, 0, 40, 80)).querySelector('path')!;
    expect(brace.getAttribute('d')).toContain('Q'); // curved arms
  });

  it('a dashed brace gets stroke-dasharray', () => {
    const s = createShape('brace-right', 0, 0, 40, 80);
    s.style.dashed = true;
    const path = shapeToSvg(s).querySelector('path')!;
    expect(path.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('a brace with text still appends a <text> label alongside the path', () => {
    const s = createShape('brace-left', 0, 0, 40, 80);
    s.text = 'Group';
    const g = shapeToSvg(s);
    expect(g.querySelector('path')).toBeTruthy();
    expect(g.querySelector('text')!.textContent).toContain('Group');
  });
});
