import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../../src/app';
import { addNode, createShape } from '../../src/model/document';
import { exportTabSvg, exportTabPng } from '../../src/io/files';

// Issue #29: image export must let the user choose a folder AND type a custom
// filename (via the native save dialog / File System Access API), instead of
// always downloading a fixed name into the Downloads folder.

let app: App;

beforeEach(() => {
  document.body.innerHTML = '';
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  app = new App(mount);
  addNode(app.activeTab, createShape('rect', 0, 0, 40, 40)); // non-empty content to export
  // downloadBlob (the fallback path) needs these; jsdom doesn't provide them.
  if (!('createObjectURL' in URL)) (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:x';
  if (!('revokeObjectURL' in URL)) (URL as unknown as Record<string, unknown>).revokeObjectURL = () => {};
});

afterEach(() => {
  app.destroy();
  delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fake File System Access save picker that captures what gets written. */
function fakePicker() {
  const chunks: Blob[] = [];
  const writable = {
    write: vi.fn(async (b: Blob) => { chunks.push(b); }),
    close: vi.fn(async () => {}),
  };
  const handle = { createWritable: vi.fn(async () => writable) };
  const showSaveFilePicker = vi.fn(async (opts: { suggestedName: string }) => {
    (showSaveFilePicker as unknown as Record<string, unknown>).opts = opts;
    return handle;
  });
  (window as unknown as Record<string, unknown>).showSaveFilePicker = showSaveFilePicker;
  const lastOpts = () => (showSaveFilePicker as unknown as { opts: { suggestedName: string } }).opts;
  return { showSaveFilePicker, handle, writable, chunks, lastOpts };
}

describe('SVG export — save to a chosen folder + custom name (#29)', () => {
  it('writes the SVG to the file the user picks, named from the tab', async () => {
    const p = fakePicker();
    app.activeTab.name = 'My Flow';
    await exportTabSvg(app);
    expect(p.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(p.lastOpts().suggestedName).toBe('My_Flow.svg'); // editable default in the dialog
    expect(p.writable.write).toHaveBeenCalledOnce();
    const written = p.chunks[0];
    expect(written).toBeInstanceOf(Blob);
    expect(written.type).toBe('image/svg+xml');
    expect(written.size).toBeGreaterThan(0);
    expect(p.writable.close).toHaveBeenCalledOnce(); // stream flushed
  });

  it('does nothing (no write, no download) when the user cancels the dialog', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn().mockRejectedValue(abort);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportTabSvg(app);
    expect(click).not.toHaveBeenCalled(); // must NOT fall back to a download after an explicit cancel
  });

  it('falls back to a normal download when the save picker is unavailable', async () => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker; // e.g. opened from file://
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportTabSvg(app);
    expect(click).toHaveBeenCalledOnce(); // export still lands, via the browser download
  });
});

describe('PNG export — save to a chosen folder + custom name (#29)', () => {
  it('opens the save picker (with a .png name) BEFORE rasterizing, so the gesture survives', async () => {
    // Force rasterization to fail fast & deterministically so the test can't hang on
    // jsdom's non-loading <img>. What matters for #29: the picker fired with a .png name.
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    class FakeImg {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 0;
      height = 0;
      set src(_v: string) { queueMicrotask(() => this.onerror && this.onerror()); }
    }
    vi.stubGlobal('Image', FakeImg);
    const p = fakePicker();
    app.activeTab.name = 'Chart';
    await exportTabPng(app);
    expect(p.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(p.lastOpts().suggestedName).toBe('Chart.png'); // folder + editable name offered for PNG too
  });
});
