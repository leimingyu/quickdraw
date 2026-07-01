import { describe, it, expect } from 'vitest';
import { safeFileName } from '../../src/io/files';

describe('safeFileName', () => {
  it('replaces filesystem-invalid characters with underscores', () => {
    expect(safeFileName('a/b:c*d')).toBe('a_b_c_d');
  });
  it('trims and falls back to "drawing" when empty/blank', () => {
    expect(safeFileName('   ')).toBe('drawing');
    expect(safeFileName('')).toBe('drawing');
  });
  it('collapses whitespace to underscores', () => {
    expect(safeFileName('Tab 1')).toBe('Tab_1');
    expect(safeFileName('  Flow   chart  ')).toBe('Flow_chart');
  });
  it('keeps a whitespace-free name unchanged', () => {
    expect(safeFileName('Diagram')).toBe('Diagram');
  });
});
