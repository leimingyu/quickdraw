import type { App } from '../app';
import { serializeWorkspace, deserializeWorkspace } from './serialize';
import { tabToSvgString } from '../render/exportSvg';
import { showToast } from '../ui/toast';

const SCALE = 2; // PNG raster scale for crispness
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

/** Sanitize a user-entered export name and ensure it ends with `.ext`. */
export function exportFileName(input: string, ext: string): string {
  let name = safeFileName(input);
  if (!name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) name += `.${ext}`;
  return name;
}

/** Prompt (synchronously, inside the click gesture) for the export file name,
 *  pre-filled with `<tab name>.<ext>`. Returns the sanitized name, or null if
 *  the user cancels or clears it. */
function promptExportName(app: App, ext: string): string | null {
  const suggested = `${safeFileName(app.activeTab.name)}.${ext}`;
  const input = window.prompt(`Export ${ext.toUpperCase()} — file name:`, suggested);
  if (input === null || input.trim() === '') return null;
  return exportFileName(input, ext);
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
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user cancelled the picker
      throw err;
    }
  } else {
    downloadBlob(new Blob([text], { type: 'application/json' }), 'drawing.quickdraw.json');
  }
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
      throw err;
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
  const filename = promptExportName(app, 'svg');
  if (!filename) return; // cancelled
  const svg = tabToSvgString(app.activeTab);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
  showToast(`Exported "${filename}" — check your Downloads folder`);
}

export function exportTabPng(app: App): void {
  const filename = promptExportName(app, 'png'); // prompt synchronously, before the async raster
  if (!filename) return; // cancelled
  const svg = tabToSvgString(app.activeTab);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * SCALE;
    canvas.height = img.height * SCALE;
    const ctx = canvas.getContext('2d');
    URL.revokeObjectURL(url);
    if (!ctx) return; // canvas unavailable — nothing to export
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, filename);
      showToast(`Exported "${filename}" — check your Downloads folder`);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url); // don't leak the blob URL if the SVG can't be decoded
  img.src = url;
}
