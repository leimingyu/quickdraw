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
  [...host.querySelectorAll<HTMLButtonElement>('.menu-item')].find((b) => b.textContent === label)!;

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
});
