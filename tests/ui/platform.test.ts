import { describe, it, expect } from 'vitest';
import { formatShortcut } from '../../src/ui/platform';

describe('formatShortcut', () => {
  it('renders ⌘/⇧ on macOS', () => {
    expect(formatShortcut('mod+Z', true)).toBe('⌘Z');
    expect(formatShortcut('mod+shift+Z', true)).toBe('⌘⇧Z');
    expect(formatShortcut('mod+C', true)).toBe('⌘C');
  });

  it('renders Ctrl+/Shift+ on Windows/Linux', () => {
    expect(formatShortcut('mod+Z', false)).toBe('Ctrl+Z');
    expect(formatShortcut('mod+shift+Z', false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut('mod+C', false)).toBe('Ctrl+C');
  });

  it('passes plain keys through on both platforms', () => {
    expect(formatShortcut('Delete', true)).toBe('Delete');
    expect(formatShortcut('Delete', false)).toBe('Delete');
  });
});
