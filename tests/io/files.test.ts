import { describe, it, expect } from 'vitest';
import { safeFileName, exportFileName, backgroundFill } from '../../src/io/files';

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

describe('exportFileName', () => {
  it('appends the extension when the user omits it', () => {
    expect(exportFileName('MyDiagram', 'svg')).toBe('MyDiagram.svg');
  });
  it('does not double the extension (case-insensitive)', () => {
    expect(exportFileName('MyDiagram.svg', 'svg')).toBe('MyDiagram.svg');
    expect(exportFileName('Chart.SVG', 'svg')).toBe('Chart.SVG');
  });
  it('sanitizes invalid characters and whitespace', () => {
    expect(exportFileName('My Diagram', 'png')).toBe('My_Diagram.png');
    expect(exportFileName('a/b:c', 'svg')).toBe('a_b_c.svg');
  });
  it('falls back to "drawing" for a blank name', () => {
    expect(exportFileName('   ', 'svg')).toBe('drawing.svg');
  });
});

describe('backgroundFill', () => {
  it('maps "white" to an opaque hex fill', () => {
    expect(backgroundFill('white')).toBe('#ffffff');
  });
  it('maps "transparent" to undefined so nothing is painted', () => {
    expect(backgroundFill('transparent')).toBeUndefined();
  });
});
