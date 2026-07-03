import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountMenuBar } from '../../src/ui/menubar';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  mountMenuBar(app, host);
});
afterEach(() => app.destroy());

const title = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.menu-title')].find((b) => b.textContent === name)!;
const item = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.menu-item')]
    .find((b) => b.querySelector('span')?.textContent === label)!; // first span = the label

describe('menu bar', () => {
  it('renders File / Edit / View menus (tools live in the palette)', () => {
    expect([...host.querySelectorAll('.menu-title')].map((b) => b.textContent)).toEqual(['File', 'Edit', 'View']);
  });

  it('opens a menu on title click and closes on an outside click', () => {
    title('File').click();
    expect(title('File').closest('.menu')!.classList.contains('open')).toBe(true);
    document.body.click();
    expect(title('File').closest('.menu')!.classList.contains('open')).toBe(false);
  });

  it('an Edit item runs its action (Select all)', () => {
    addNode(app.activeTab, createShape('rect', 0, 0));
    addNode(app.activeTab, createShape('rect', 60, 0));
    title('Edit').click();
    item('Select all').click();
    expect(app.selection.size).toBe(2);
  });

  it('a View item runs its action (Reset to 100%)', () => {
    app.zoomBy(2, 0, 0);
    title('View').click();
    item('Reset to 100%').click();
    expect(app.activeTab.viewport.zoom).toBe(1);
  });

  it('shows a platform-appropriate keyboard hint on shortcut items', () => {
    title('Edit').click();
    const hint = item('Undo').querySelector('.menu-key');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toMatch(/^(⌘Z|Ctrl\+Z)$/); // ⌘ on Mac, Ctrl on Windows/Linux
  });

  it('offers "Copy to clipboard (PNG)" in File with a ⌘⇧C hint', () => {
    title('File').click();
    const copy = item('Copy to clipboard (PNG)');
    expect(copy).toBeTruthy();
    const hint = copy.querySelector('.menu-key');
    expect(hint!.textContent).toMatch(/^(⌘⇧C|Ctrl\+Shift\+C)$/);
  });

  it('clicking "Copy to clipboard (PNG)" runs without throwing (clipboard absent in jsdom)', () => {
    title('File').click();
    expect(() => item('Copy to clipboard (PNG)').click()).not.toThrow();
  });
});

describe('export options (background + PNG resolution)', () => {
  it('defaults to a transparent background and marks it active', () => {
    title('File').click();
    expect(app.exportBackground).toBe('transparent');
    expect(item('Transparent').classList.contains('active')).toBe(true);
    expect(item('White').classList.contains('active')).toBe(false);
  });

  it('choosing "White" sets a white export background and moves the active mark', () => {
    title('File').click();
    item('White').click();
    expect(app.exportBackground).toBe('white');
    expect(item('White').classList.contains('active')).toBe(true);
    expect(item('Transparent').classList.contains('active')).toBe(false);
  });

  it('keeps the menu open after choosing an option (pick first, then export — no download-time modal)', () => {
    title('File').click();
    item('White').click();
    expect(title('File').closest('.menu')!.classList.contains('open')).toBe(true);
  });

  it('defaults PNG resolution to 300 DPI and lets 1×/2×/3× override it', () => {
    title('File').click();
    expect(app.exportDpi).toBe(300);
    expect(item('300 DPI').classList.contains('active')).toBe(true);
    item('2×').click();
    expect(app.exportDpi).toBe(192); // 2× = 192 DPI (96 px/in base)
    expect(item('2×').classList.contains('active')).toBe(true);
    expect(item('300 DPI').classList.contains('active')).toBe(false);
  });
});
