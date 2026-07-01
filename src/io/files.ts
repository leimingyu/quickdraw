import type { App } from '../app';
import { serializeWorkspace, deserializeWorkspace } from './serialize';
import { tabToSvgString } from '../render/exportSvg';

const SCALE = 2; // PNG raster scale for crispness
const JSON_TYPES = [{ description: 'QuickDraw drawing', accept: { 'application/json': ['.json'] } }];
let fileHandle: any = null; // File System Access handle remembered for save-in-place

/** Strip characters invalid in filenames; fall back to "drawing". */
export function safeFileName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return clean || 'drawing';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  const svg = tabToSvgString(app.activeTab);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeFileName(app.activeTab.name)}.svg`);
}

export function exportTabPng(app: App): void {
  const svg = tabToSvgString(app.activeTab);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const name = safeFileName(app.activeTab.name);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * SCALE;
    canvas.height = img.height * SCALE;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${name}.png`); }, 'image/png');
  };
  img.src = url;
}
