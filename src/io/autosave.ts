import type { Workspace } from '../model/types';
import { serializeWorkspace, deserializeWorkspace } from './serialize';

// Crash-recovery autosave: the whole workspace is continuously mirrored to the
// browser's localStorage under one key. It is NOT auto-loaded on startup (that was
// deliberately dropped in favor of explicit save/open) — instead the app offers to
// restore it, so a browser crash or accidental reload never silently loses work.

const KEY = 'quickdraw:autosave';

export interface Draft {
  workspace: Workspace;
  savedAt: number; // epoch ms of the autosave, for a human-readable "recovered from …" label
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's localStorage, or null when it's unavailable (SSR, disabled, or a
 *  privacy mode that throws on access). Callers treat null as "can't autosave". */
export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // accessing localStorage can itself throw under strict privacy settings
  }
}

/** Mirror the workspace to the single crash-recovery draft slot. Best-effort: any
 *  storage error (quota exceeded, disabled) is swallowed so a failed autosave can
 *  never interrupt editing. Returns whether the write succeeded. */
export function saveDraft(ws: Workspace, storage: StorageLike | null = defaultStorage(), now = Date.now()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ savedAt: now, doc: serializeWorkspace(ws) }));
    return true;
  } catch {
    return false;
  }
}

/** Read back the crash-recovery draft, or null if there is none / it's unreadable /
 *  it fails schema validation (e.g. written by an incompatible future version). */
export function loadDraft(storage: StorageLike | null = defaultStorage()): Draft | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as { savedAt?: unknown; doc?: unknown };
    if (typeof env.doc !== 'string') return null;
    const workspace = deserializeWorkspace(env.doc); // reuses the .json save-file validation
    return { workspace, savedAt: typeof env.savedAt === 'number' ? env.savedAt : 0 };
  } catch {
    return null; // corrupt JSON or an invalid/incompatible workspace — ignore, don't crash boot
  }
}

/** Delete the draft (e.g. the user chose to discard the recovered work). */
export function clearDraft(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    /* nothing we can do; ignore */
  }
}

export interface Autosaver {
  /** Record the latest workspace; writes at most once per `delay` ms (trailing edge). */
  schedule(ws: Workspace): void;
  /** Write any pending workspace immediately (e.g. on tab hide / page unload). */
  flush(): void;
}

/** A debounced autosaver so a burst of edits collapses into one localStorage write. */
export function createAutosaver(delay = 800, storage: StorageLike | null = defaultStorage()): Autosaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Workspace | null = null;
  const write = (): void => {
    timer = null;
    if (pending) {
      saveDraft(pending, storage);
      pending = null;
    }
  };
  return {
    schedule(ws: Workspace): void {
      pending = ws;
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, delay);
    },
    flush(): void {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    },
  };
}
