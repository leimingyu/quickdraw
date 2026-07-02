import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/app';

let mount: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

describe('App', () => {
  it('starts with one empty tab and select tool', () => {
    const app = new App(mount);
    expect(app.workspace.tabs).toHaveLength(1);
    expect(app.currentToolName).toBe('select');
    expect(app.activeTab.nodes).toHaveLength(0);
  });

  it('switches the current tool', () => {
    const app = new App(mount);
    app.setTool('rect');
    expect(app.currentToolName).toBe('rect');
  });

  it('renders an svg into the mount', () => {
    const app = new App(mount);
    app.render();
    expect(mount.querySelector('svg')).toBeTruthy();
  });
});
