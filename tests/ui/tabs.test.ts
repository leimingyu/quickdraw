import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountTabs } from '../../src/ui/tabs';

let app: App;
let host: HTMLElement;
let strip: { update: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  strip = mountTabs(app, host);
  app.onRender = () => strip.update();
  app.render();
});
afterEach(() => app.destroy());

const tabs = () => [...host.querySelectorAll('.tab')] as HTMLElement[];
const names = () => tabs().map((t) => t.querySelector('.tab-name')!.textContent);
const activeName = () => host.querySelector('.tab.active .tab-name')?.textContent ?? null;
const addBtn = () => host.querySelector('.tab-add') as HTMLButtonElement;

describe('tab strip UI', () => {
  it('renders one tab per workspace tab plus an add button', () => {
    expect(tabs()).toHaveLength(1);
    expect(names()).toEqual(['Tab 1']);
    expect(addBtn()).toBeTruthy();
  });

  it('marks the active tab', () => {
    expect(activeName()).toBe('Tab 1');
  });

  it('the add button adds a tab and activates it', () => {
    addBtn().click();
    expect(tabs()).toHaveLength(2);
    expect(activeName()).toBe('Tab 2');
  });

  it('clicking a tab switches to it', () => {
    addBtn().click();                 // Tab 2 active
    tabs()[0].click();                // click Tab 1
    expect(activeName()).toBe('Tab 1');
    expect(app.activeTab.name).toBe('Tab 1');
  });

  it('shows no close button when only one tab exists', () => {
    expect(host.querySelector('.tab-close')).toBeNull();
  });

  it('shows a close button per tab when >1, and closing removes that tab', () => {
    addBtn().click();                 // now 2 tabs
    expect(host.querySelectorAll('.tab-close')).toHaveLength(2);
    (tabs()[1].querySelector('.tab-close') as HTMLButtonElement).click();
    expect(tabs()).toHaveLength(1);
    expect(names()).toEqual(['Tab 1']);
  });

  it('clicking close does not also switch to that tab', () => {
    addBtn().click();                 // Tab 2 active
    (tabs()[0].querySelector('.tab-close') as HTMLButtonElement).click(); // close Tab 1
    expect(app.activeTab.name).toBe('Tab 2');
    expect(tabs()).toHaveLength(1);
  });

  it('double-clicking a tab name opens a rename input; Enter commits', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'Flow';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.activeTab.name).toBe('Flow');
    expect(names()).toEqual(['Flow']);
    expect(host.querySelector('input.tab-rename')).toBeNull();
  });

  it('rename via Escape cancels (keeps the old name)', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.activeTab.name).toBe('Tab 1');
    expect(host.querySelector('input.tab-rename')).toBeNull();
  });

  it('a blank rename keeps the previous name', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(app.activeTab.name).toBe('Tab 1');
  });

  it('blurring a blank rename keeps the previous name', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = host.querySelector('input.tab-rename') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(app.activeTab.name).toBe('Tab 1');
    expect(host.querySelector('input.tab-rename')).toBeNull();
  });

  it('update() does not tear down an open rename input (no focus drop mid-edit)', () => {
    (tabs()[0].querySelector('.tab-name') as HTMLElement)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.querySelector('input.tab-rename')).toBeTruthy();
    strip.update(); // a stray render while editing must not wipe the input
    expect(host.querySelector('input.tab-rename')).toBeTruthy();
  });
});
