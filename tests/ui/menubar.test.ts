import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountMenuBar } from '../../src/ui/menubar';
import { addNode, createShape } from '../../src/model/document';

let app: App;
let host: HTMLElement;
let menubar: { syncActive: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  menubar = mountMenuBar(app, host);
});
afterEach(() => app.destroy());

const title = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.menu-title')].find((b) => b.textContent!.startsWith(name))!;
const item = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.menu-item')].find((b) => b.textContent === label)!;

describe('menu bar', () => {
  it('renders File / Edit / Shapes / View menus', () => {
    const titles = [...host.querySelectorAll('.menu-title')].map((b) => b.textContent!.replace(/:.*/, '').trim());
    expect(titles).toEqual(['File', 'Edit', 'Shapes', 'View']);
  });

  it('opens a menu on title click and closes on an outside click', () => {
    const file = title('File');
    file.click();
    expect(file.closest('.menu')!.classList.contains('open')).toBe(true);
    document.body.click();
    expect(file.closest('.menu')!.classList.contains('open')).toBe(false);
  });

  it('a Shapes item sets the active tool and reflects it in the title + checkmark', () => {
    title('Shapes').click();
    item('Rectangle').click();
    expect(app.currentToolName).toBe('rect');
    menubar.syncActive();
    expect(title('Shapes').textContent).toContain('Rectangle');
    title('Shapes').click(); // reopen
    expect(host.querySelector('.menu-item[data-tool="rect"]')!.classList.contains('active')).toBe(true);
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
});
