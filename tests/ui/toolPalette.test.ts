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
const conn = (routing: string) => host.querySelector<HTMLButtonElement>(`.tool-btn[data-routing="${routing}"]`)!;

describe('tool palette', () => {
  it('renders the shape shortcuts plus the three connector types', () => {
    const btns = [...host.querySelectorAll<HTMLElement>('.tool-btn')];
    expect(btns).toHaveLength(10);
    expect(btns.slice(0, 7).map((b) => b.dataset.tool))
      .toEqual(['select', 'rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text']);
    expect(btns.slice(7).map((b) => b.dataset.routing)).toEqual(['straight', 'elbow', 'curved']);
    expect(host.querySelectorAll('.tool-btn svg')).toHaveLength(10);
  });

  it('clicking a shape shortcut selects that tool', () => {
    btn('ellipse').click();
    expect(app.currentToolName).toBe('ellipse');
  });

  it('clicking a connector type selects the arrow tool with that routing, and highlights it', () => {
    conn('curved').click();
    expect(app.currentToolName).toBe('arrow');
    expect(app.connectorRouting).toBe('curved');
    palette.syncActive();
    expect(conn('curved').classList.contains('active')).toBe(true);
    expect(conn('straight').classList.contains('active')).toBe(false);
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
