import type { App } from '../app';
import type { ExportBackground } from '../model/types';
import { serializeWorkspace, deserializeWorkspace } from './serialize';
import { tabToSvgString, EXPORT_PADDING } from '../render/exportSvg';
import { isConnector, isAttached } from '../model/document';
import { pngWithDpi } from './png';
import { showToast } from '../ui/toast';

// SVG user units are CSS px (96 per inch). Rasterizing at dpi/96 and tagging the PNG
// with that DPI yields an image that prints at its natural size; the default 300 DPI
// is print quality, while 1×/2×/3× (96/192/288 DPI) are on-screen pixel multiples.
const EXPORT_DPI = 300;
const JSON_TYPES = [{ description: 'QuickDraw drawing', accept: { 'application/json': ['.json'] } }];
const SVG_TYPES = [{ description: 'SVG image', accept: { 'image/svg+xml': ['.svg'] } }];
const PNG_TYPES = [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }];

/** The SVG/canvas fill for an export background choice: 'white' → opaque white,
 *  'transparent' → undefined so nothing is painted (the image stays clear). */
export function backgroundFill(bg: ExportBackground): string | undefined {
  return bg === 'white' ? '#ffffff' : undefined;
}
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

/** Offer the native "Save As" dialog (folder + editable filename) and return the
 *  chosen file handle, or a sentinel telling the caller to fall back to a plain
 *  browser download ('download') or to abort silently after a user cancel ('cancel').
 *  MUST be called synchronously within a user gesture — the picker requires one. */
async function pickSaveHandle(
  suggestedName: string,
  types: unknown,
): Promise<{ handle: any } | 'download' | 'cancel'> {
  if (!('showSaveFilePicker' in window)) return 'download';
  try {
    const handle = await (window as any).showSaveFilePicker({ suggestedName, types });
    return { handle };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'cancel'; // user dismissed the dialog
    return 'download'; // picker unavailable/blocked (e.g. opened from file://) → download instead
  }
}

/** Write a blob to a File System Access handle (save-in-place at the chosen path). */
async function writeToHandle(handle: any, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function exportTabSvg(app: App): Promise<void> {
  // The background choice is a persistent setting (File menu), read here — not a
  // prompt at export time — so nothing consumes the click's user activation before
  // the save picker / download fires.
  const filename = exportFileName(app.activeTab.name, 'svg');
  const svg = tabToSvgString(app.activeTab, EXPORT_PADDING, backgroundFill(app.exportBackground));
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const dest = await pickSaveHandle(filename, SVG_TYPES); // let the user choose folder + name (#29)
  if (dest === 'cancel') return;
  if (dest !== 'download') {
    try {
      await writeToHandle(dest.handle, blob);
      showToast(`Saved "${filename}"`);
      return;
    } catch {
      // write failed after the pick — fall through so the export still lands somewhere
    }
  }
  downloadBlob(blob, filename);
  showToast(`Exported "${filename}" — check your Downloads folder`);
}

/** Rasterize an SVG document string to a DPI-tagged PNG blob. `dpi` sets both the
 *  pixel scale (dpi/96) and the pHYs tag, so the PNG prints at natural size. When
 *  `background` is given (e.g. '#ffffff'), it is painted as an opaque fill behind
 *  the drawing so the PNG isn't transparent; omit it to keep the background clear.
 *  Rejects if the SVG can't be decoded or the canvas 2D context is unavailable. */
export function svgToPngBlob(svg: string, background?: string, dpi = EXPORT_DPI): Promise<Blob> {
  const scale = dpi / 96; // SVG user units are CSS px (96/in)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
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
        pngWithDpi(blob, dpi).then(resolve, reject);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG could not be decoded')); };
    img.src = url;
  });
}

/** A short human label for a raster DPI: the 1×/2×/3× multiple when it's a clean
 *  multiple of 96 (screen density), otherwise the plain DPI (e.g. the 300 default). */
function scaleLabel(dpi: number): string {
  return dpi % 96 === 0 ? `${dpi / 96}×` : `${dpi} DPI`;
}

export async function exportTabPng(app: App): Promise<void> {
  const filename = exportFileName(app.activeTab.name, 'png');
  const dpi = app.exportDpi;
  // Background is composited onto the canvas at raster time (the SVG stays transparent),
  // so a transparent PNG drops onto any slide background; white bakes an opaque fill.
  const fill = backgroundFill(app.exportBackground);
  // Pick the destination FIRST, inside the click's user activation (#29): rasterizing
  // the PNG is async and would outlive the gesture, so a picker opened afterward is rejected.
  const dest = await pickSaveHandle(filename, PNG_TYPES);
  if (dest === 'cancel') return;
  let blob: Blob;
  try {
    blob = await svgToPngBlob(tabToSvgString(app.activeTab), fill, dpi);
  } catch {
    return; // canvas/SVG unavailable — nothing to export (matches prior silent no-op)
  }
  if (dest !== 'download') {
    try {
      await writeToHandle(dest.handle, blob);
      showToast(`Saved "${filename}" (${scaleLabel(dpi)})`);
      return;
    } catch {
      // write failed after the pick — fall through to a plain download
    }
  }
  downloadBlob(blob, filename);
  showToast(`Exported "${filename}" (${scaleLabel(dpi)}) — check your Downloads folder`);
}

/** The SVG document to export or copy as an image: just the selected nodes, cropped
 *  to their bounds, when there's a selection ("copy selection only"); otherwise the
 *  whole diagram. */
export function tabExportSvg(app: App): string {
  const tab = app.activeTab;
  if (app.selection.size === 0) return tabToSvgString(tab);
  const ids = new Set(app.selection);
  // Pull in any connector whose both attached ends land on selected shapes, so copying
  // connected shapes brings their connectors along (mirrors marquee-select behavior).
  for (const n of tab.nodes) {
    if (!isConnector(n) || ids.has(n.id)) continue;
    if (isAttached(n.from) && ids.has(n.from.nodeId) && isAttached(n.to) && ids.has(n.to.nodeId)) {
      ids.add(n.id);
    }
  }
  const nodes = tab.nodes.filter((n) => ids.has(n.id));
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
