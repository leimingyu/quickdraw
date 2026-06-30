import type { Workspace } from '../model/types';

const DEBOUNCE_MS = 400;

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private key = 'quickdraw:workspace') {}

  save(ws: Workspace): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(ws));
    } catch {
      // quota or serialization failure: keep the app usable, drop the write
    }
  }

  load(): Workspace | null {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Workspace;
      if (!parsed || !Array.isArray(parsed.tabs) || !parsed.activeTabId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  schedule(ws: Workspace): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.save(ws); this.timer = null; }, DEBOUNCE_MS);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
