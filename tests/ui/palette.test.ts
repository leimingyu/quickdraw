import { describe, it, expect } from 'vitest';
import { THEME_BASE, STANDARD_COLORS, THEME_GRID, tint, shade, themeColumn } from '../../src/ui/palette';

describe('color palette', () => {
  it('exposes 10 theme base colors and 10 standard colors', () => {
    expect(THEME_BASE).toHaveLength(10);
    expect(STANDARD_COLORS).toHaveLength(10);
  });

  it('normalizes every palette color to lowercase #rrggbb', () => {
    const hex = /^#[0-9a-f]{6}$/;
    for (const c of [...THEME_BASE, ...STANDARD_COLORS]) expect(c).toMatch(hex);
  });

  it('tint(white) stays white and shade(black) stays black at any amount', () => {
    expect(tint('#ffffff', 0.8)).toBe('#ffffff');
    expect(shade('#000000', 0.8)).toBe('#000000');
  });

  it('tint and shade move a channel the expected distance', () => {
    expect(tint('#000000', 0.5)).toBe('#808080'); // 0 + (255-0)*0.5 = 127.5 → 128
    expect(shade('#ffffff', 0.5)).toBe('#808080'); // 255 * 0.5 = 127.5 → 128
  });

  it('themeColumn returns 6 cells starting with the base color', () => {
    const col = themeColumn('#4472c4');
    expect(col).toHaveLength(6);
    expect(col[0]).toBe('#4472c4');
    // rows below are lighter tints then darker shades (monotonic on the whole column is not required,
    // but the 3 tints must be lighter than base and the 2 shades darker)
    expect(col.slice(1, 4).every((c) => c > '#4472c4')).toBe(true);
    expect(col.slice(4).every((c) => c < '#4472c4')).toBe(true);
  });

  it('THEME_GRID is 6 rows of 10 columns, row 0 equal to THEME_BASE', () => {
    expect(THEME_GRID).toHaveLength(6);
    for (const row of THEME_GRID) expect(row).toHaveLength(10);
    expect(THEME_GRID[0]).toEqual(THEME_BASE.map((c) => c.toLowerCase()));
  });
});
