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
  it('keeps a normal tab name unchanged', () => {
    expect(safeFileName('Flow chart')).toBe('Flow chart');
  });
});
