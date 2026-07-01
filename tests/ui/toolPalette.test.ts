import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { mountToolPalette } from '../../src/ui/toolPalette';

let app: App;
let host: HTMLElement;
let palette: { syncActive: () => void };

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  host = document.createElement('div');
  document.body.appendChild(host);
  palette = mountToolPalette(app, host);
});
afterEach(() => app.destroy());

const btn = (tool: string) => host.querySelector<HTMLButtonElement>(`.tool-btn[data-tool="${tool}"]`)!;

describe('tool palette', () => {
  it('renders a shortcut button for every tool, each with an icon', () => {
    const tools = [...host.querySelectorAll('.tool-btn')].map((b) => (b as HTMLElement).dataset.tool);
    expect(tools).toEqual(['select', 'rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text', 'arrow']);
    expect(host.querySelectorAll('.tool-btn svg')).toHaveLength(8);
  });

  it('clicking a shape shortcut selects that tool', () => {
    btn('ellipse').click();
    expect(app.currentToolName).toBe('ellipse');
  });

  it('clicking the connector shortcut selects the arrow tool', () => {
    btn('arrow').click();
    expect(app.currentToolName).toBe('arrow');
  });

  it('syncActive highlights only the current tool', () => {
    btn('diamond').click();
    palette.syncActive();
    expect(btn('diamond').classList.contains('active')).toBe(true);
    expect(btn('select').classList.contains('active')).toBe(false);
  });

  it('defaults to Select highlighted', () => {
    expect(btn('select').classList.contains('active')).toBe(true);
  });
});
