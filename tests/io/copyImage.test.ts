import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/app';
import { tabExportSvg, copyTabPng } from '../../src/io/files';
import { EXPORT_PADDING } from '../../src/render/exportSvg';
import { addNode, createShape, createConnector } from '../../src/model/document';

const P = EXPORT_PADDING;
let app: App;

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
});
afterEach(() => app.destroy());

describe('tabExportSvg — what a clipboard/export image contains', () => {
  it('exports the whole diagram when nothing is selected', () => {
    addNode(app.activeTab, createShape('rect', 0, 0, 50, 50)); // A: x0..50
    addNode(app.activeTab, createShape('rect', 200, 0, 50, 50)); // B: x200..250
    const svg = tabExportSvg(app);
    // bounds span both shapes: x0..250, y0..50 → padded viewBox
    expect(svg).toContain(`viewBox="${0 - P} ${0 - P} ${250 + 2 * P} ${50 + 2 * P}"`);
  });

  it('exports only the selection, cropped to its bounds ("copy selection only")', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    addNode(app.activeTab, a);
    addNode(app.activeTab, b);
    app.selection = new Set([a.id]); // only A
    const svg = tabExportSvg(app);
    // cropped to A alone (w50 h50), not the full 250-wide diagram
    expect(svg).toContain(`viewBox="${0 - P} ${0 - P} ${50 + 2 * P} ${50 + 2 * P}"`);
    expect(svg).not.toContain(`${250 + 2 * P}`); // the whole-diagram width must not appear
  });
});

describe('tabExportSvg — connectors between selected shapes', () => {
  it('pulls in a connector when both its shapes are selected (copying connected shapes)', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, b.id]); // the two shapes only — NOT the connector itself
    const svg = tabExportSvg(app);
    expect(svg).toContain(`data-id="${c.id}"`); // the connector came along
  });

  it('omits a connector when only one of its endpoints is on a selected shape', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id]); // only A → the connector would dangle
    const svg = tabExportSvg(app);
    expect(svg).not.toContain(`data-id="${c.id}"`);
  });

  it('still exports an explicitly-selected connector (id in the selection)', () => {
    const a = createShape('rect', 0, 0, 50, 50);
    const b = createShape('rect', 200, 0, 50, 50);
    const c = createConnector({ nodeId: a.id }, { nodeId: b.id });
    [a, b, c].forEach((n) => addNode(app.activeTab, n));
    app.selection = new Set([a.id, b.id, c.id]);
    const svg = tabExportSvg(app);
    expect(svg).toContain(`data-id="${c.id}"`);
  });
});

describe('copyTabPng — clipboard copy', () => {
  it('degrades gracefully (no throw) when the clipboard image API is unavailable', async () => {
    // jsdom provides neither navigator.clipboard.write nor ClipboardItem.
    await expect(copyTabPng(app)).resolves.toBeUndefined();
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toMatch(/clipboard|Export as PNG/i);
  });
});
