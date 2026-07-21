import { describe, it, expect, afterEach } from 'vitest';
import { clampToViewport, openPopup, openMenu, closeOpenPopup, type MenuEntry } from '../../src/ui/flyout';

afterEach(() => { closeOpenPopup(); document.body.innerHTML = ''; });

describe('clampToViewport', () => {
  it('keeps a popup that fits at its requested point', () => {
    expect(clampToViewport(10, 20, 100, 50, 800, 600)).toEqual({ x: 10, y: 20 });
  });
  it('shifts left/up when it would overflow the right/bottom edge', () => {
    expect(clampToViewport(760, 580, 100, 50, 800, 600)).toEqual({ x: 700, y: 550 });
  });
  it('never returns a negative coordinate', () => {
    expect(clampToViewport(-30, -30, 100, 50, 800, 600)).toEqual({ x: 0, y: 0 });
  });
});

describe('openPopup', () => {
  it('mounts content in a .flyout and closes on the returned handle', () => {
    const content = document.createElement('div');
    content.textContent = 'hi';
    const h = openPopup(content, { x: 10, y: 10 });
    expect(document.querySelector('.flyout')).toBeTruthy();
    expect(document.querySelector('.flyout')!.textContent).toBe('hi');
    h.close();
    expect(document.querySelector('.flyout')).toBeNull();
  });
  it('opening a second popup closes the first', () => {
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    expect(document.querySelectorAll('.flyout')).toHaveLength(1);
  });
  it('closes on an outside pointerdown', () => {
    openPopup(document.createElement('div'), { x: 0, y: 0 });
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.querySelector('.flyout')).toBeNull();
  });
});

describe('openMenu', () => {
  const entries = (calls: string[]): MenuEntry[] => [
    { label: 'Cut', keys: 'mod+X', run: () => calls.push('cut') },
    'separator',
    { label: 'Align', submenu: [{ label: 'Left', run: () => calls.push('left') }] },
  ];

  it('renders items, shortcut hints, and separators', () => {
    openMenu(entries([]), { x: 0, y: 0 });
    expect(document.querySelectorAll('.flyout-item')).toHaveLength(2); // Cut, Align
    expect(document.querySelector('.flyout-sep')).toBeTruthy();
    expect(document.querySelector('.flyout-key')!.textContent).toMatch(/X$/);
  });

  it('runs an item and closes on click', () => {
    const calls: string[] = [];
    openMenu(entries(calls), { x: 0, y: 0 });
    document.querySelector<HTMLButtonElement>('.flyout-item')!.click(); // Cut
    expect(calls).toEqual(['cut']);
    expect(document.querySelector('.flyout-menu')).toBeNull();
  });

  it('opens a submenu and runs a nested item', () => {
    const calls: string[] = [];
    openMenu(entries(calls), { x: 0, y: 0 });
    const align = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent!.includes('Align'))!;
    align.click();
    expect(document.querySelectorAll('.flyout-menu')).toHaveLength(2);
    const left = [...document.querySelectorAll<HTMLButtonElement>('.flyout-item')]
      .find((b) => b.textContent!.includes('Left'))!;
    left.click();
    expect(calls).toEqual(['left']);
    expect(document.querySelector('.flyout-menu')).toBeNull(); // all layers gone
  });

  it('renders a checkmark for checked entries and closes on Escape', () => {
    openMenu([{ label: 'Show grid', checked: true, run: () => {} }], { x: 0, y: 0 });
    expect(document.querySelector('.flyout-item')!.textContent).toContain('✓');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.flyout-menu')).toBeNull();
  });
});
