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

  it('braces pinch and brackets open toward the correct side', () => {
    const d = (kind: any) =>
      shapeToSvg(createShape(kind, 0, 0, 40, 80)).querySelector('path')!.getAttribute('d')!;
    // 40-wide box: left variants reach x=0, right variants reach x=40, at mid-height y=40.
    // \b-style boundary via a leading space or start so "20,40" can't match "0,40".
    const hasPoint = (s: string, pt: string) => new RegExp(`(^|\\s)${pt}(\\s|$)`).test(s);
    // Curly braces: pinch tip pokes to the far side.
    expect(hasPoint(d('brace-left'), '0,40')).toBe(true);   // pinch at left edge
    expect(hasPoint(d('brace-left'), '40,40')).toBe(false);
    expect(hasPoint(d('brace-right'), '40,40')).toBe(true);  // pinch at right edge
    expect(hasPoint(d('brace-right'), '0,40')).toBe(false);
    // Square brackets: vertical spine sits on the opening's far side (arms extend the other way).
    // bracket-left spine at x=0 (opens right); bracket-right spine at x=40 (opens left).
    expect(d('bracket-left').startsWith('M40,0')).toBe(true);   // top arm terminates at right, spine at x=0
    expect(d('bracket-right').startsWith('M0,0')).toBe(true);   // top arm terminates at left, spine at x=40
  });
});
