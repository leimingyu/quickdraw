import type { App } from '../app';
import { serializeWorkspace, deserializeWorkspace } from './serialize';
import { tabToSvgString } from '../render/exportSvg';
import { pngWithDpi } from './png';
import { showToast } from '../ui/toast';

// SVG user units are CSS px (96 per inch). Rasterizing at EXPORT_DPI/96 and tagging
// the PNG with that DPI yields a print-quality 300-DPI image at its natural size.
const EXPORT_DPI = 300;
const SCALE = EXPORT_DPI / 96; // = 3.125
const JSON_TYPES = [{ description: 'QuickDraw drawing', accept: { 'application/json': ['.json'] } }];
let fileHandle: any = null; // File System Access handle remembered for save-in-place

/** Strip characters invalid in filenames and collapse whitespace to underscores;
 *  fall back to "drawing". */
export function safeFileName(name: string): string {
  const clean = name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .trim()
    .replace(/\s+/g, '_');
  return clean || 'drawing';
}

/** The export file name for a tab: sanitized tab name with the right extension. */
export function exportFileName(input: string, ext: string): string {
  let name = safeFileName(input);
  if (!name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) name += `.${ext}`;
  return name;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a); // some browsers only honor a detached-anchor click when it's in the DOM
  a.click();
  // Keep the anchor AND the object URL alive: Chrome resolves the download's
  // filename asynchronously, so removing the anchor or revoking the URL
  // synchronously drops the `download` name and the file is saved as the blob's
  // UUID with no extension. Clean up on a long delay instead.
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 40_000);
}

export async function saveWorkspace(app: App): Promise<void> {
  const text = serializeWorkspace(app.workspace);
  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle) {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: 'drawing.quickdraw.json',
          types: JSON_TYPES,
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user cancelled the picker
      fileHandle = null; // picker unavailable/blocked (e.g. opened from file://) → download instead
    }
  }
  downloadBlob(new Blob([text], { type: 'application/json' }), 'drawing.quickdraw.json');
}

export async function openWorkspace(app: App): Promise<void> {
  if (app.workspace.tabs.some((t) => t.nodes.length > 0)) {
    if (!confirm('Discard the current drawing and open this file?')) return;
  }
  let text: string;
  let handle: any = null;
  if ('showOpenFilePicker' in window) {
    try {
      const [h] = await (window as any).showOpenFilePicker({ types: JSON_TYPES });
      handle = h;
      text = await (await h.getFile()).text();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // cancelled
      text = await pickFileText(); // picker blocked (e.g. opened from file://) → hidden file input
    }
  } else {
    text = await pickFileText();
  }
  try {
    const ws = deserializeWorkspace(text);
    app.replaceWorkspace(ws);
    fileHandle = handle; // remember for save-in-place (null in the fallback path)
  } catch (err) {
    alert((err as Error).message); // current drawing left untouched
  }
}

/** Fallback open: a hidden file input. Resolves with the file's text; if the user
 *  cancels, the promise simply never resolves (no state change). */
function pickFileText(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) resolve(await file.text());
    });
    input.click();
  });
}

export function exportTabSvg(app: App): void {
  // Download directly inside the click gesture — no modal in between, which would
  // consume the page's user activation and make Chrome silently drop the download.
  const filename = exportFileName(app.activeTab.name, 'svg');
  const svg = tabToSvgString(app.activeTab);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
  showToast(`Exported "${filename}" — check your Downloads folder`);
}

/** Rasterize an SVG document string to a DPI-tagged PNG blob at EXPORT_DPI. When
 *  `background` is given (e.g. '#ffffff'), it is painted as an opaque fill behind
 *  the drawing so the PNG isn't transparent; omit it to keep the background clear.
 *  Rejects if the SVG can't be decoded or the canvas 2D context is unavailable. */
export function svgToPngBlob(svg: string, background?: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * SCALE;
      canvas.height = img.height * SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas 2D context unavailable')); return; }
      if (background) { // fill first so the drawing composites over an opaque background
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url); // revoke only AFTER drawing: SVG images rasterize at draw time
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('PNG encoding failed')); return; }
        pngWithDpi(blob, EXPORT_DPI).then(resolve, reject);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG could not be decoded')); };
    img.src = url;
  });
}

export function exportTabPng(app: App): void {
  const filename = exportFileName(app.activeTab.name, 'png');
  void svgToPngBlob(tabToSvgString(app.activeTab)).then((blob) => {
    downloadBlob(blob, filename);
    showToast(`Exported "${filename}" (${EXPORT_DPI} DPI) — check your Downloads folder`);
  }, () => {}); // canvas/SVG unavailable — nothing to export (matches prior silent no-op)
}

/** The SVG document to export or copy as an image: just the selected nodes, cropped
 *  to their bounds, when there's a selection ("copy selection only"); otherwise the
 *  whole diagram. */
export function tabExportSvg(app: App): string {
  const tab = app.activeTab;
  if (app.selection.size === 0) return tabToSvgString(tab);
  const nodes = tab.nodes.filter((n) => app.selection.has(n.id));
  return tabToSvgString({ ...tab, nodes });
}

/** Copy the diagram — or just the selection, if any — to the OS clipboard as a PNG,
 *  so it can be pasted straight into slides, docs, or chat. No modal beforehand: a
 *  picker/alert would consume the click's user activation and make the write fail. */
export async function copyTabPng(app: App): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    showToast('Copying images to the clipboard isn\'t supported here — use "Export as PNG" instead');
    return;
  }
  const scope = app.selection.size > 0 ? 'selection' : 'diagram';
  const svg = tabExportSvg(app);
  try {
    // Paint a white background: a transparent PNG pastes as a blank/see-through figure
    // in PowerPoint & Google Slides (they render clipboard transparency unreliably).
    // Hand the write a Promise for the blob so clipboard.write fires inside the user
    // gesture (Safari requires this); the rasterization resolves it a moment later.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': svgToPngBlob(svg, '#ffffff') })]);
    showToast(`Copied ${scope} to clipboard — paste into your slides or doc`);
  } catch {
    showToast('Couldn\'t copy to the clipboard — use "Export as PNG" instead');
  }
}
