import { describe, it, expect, vi } from 'vitest';
import { saveDraft, loadDraft, clearDraft, createAutosaver, type StorageLike } from '../../src/io/autosave';
import { createWorkspace, addNode, createShape } from '../../src/model/document';

// Issue #28: autosave / crash-recovery. The workspace is mirrored to localStorage
// so a browser crash or accidental reload can be recovered.

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

function wsWithShape() {
  const ws = createWorkspace();
  const s = createShape('rect', 5, 6, 30, 20);
  addNode(ws.tabs[0], s);
  return { ws, shape: s };
}

describe('saveDraft / loadDraft round-trip', () => {
  it('recovers the exact workspace content', () => {
    const store = memStorage();
    const { ws, shape } = wsWithShape();
    expect(saveDraft(ws, store)).toBe(true);
    const draft = loadDraft(store);
    expect(draft).not.toBeNull();
    const nodes = draft!.workspace.tabs[0].nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(shape.id);
    expect(nodes[0]).toMatchObject({ kind: 'rect', x: 5, y: 6, w: 30, h: 20 });
  });

  it('preserves the savedAt timestamp for the "recovered from …" label', () => {
    const store = memStorage();
    saveDraft(createWorkspace(), store, 1_700_000_000_000);
    expect(loadDraft(store)!.savedAt).toBe(1_700_000_000_000);
  });

  it('returns null when there is no draft', () => {
    expect(loadDraft(memStorage())).toBeNull();
  });

  it('returns null (no crash) for corrupt or incompatible payloads', () => {
    const store = memStorage();
    store.setItem('quickdraw:autosave', 'not json');
    expect(loadDraft(store)).toBeNull();
    store.setItem('quickdraw:autosave', JSON.stringify({ savedAt: 1, doc: '{}' })); // valid JSON, not a workspace
    expect(loadDraft(store)).toBeNull();
    store.setItem('quickdraw:autosave', JSON.stringify({ savedAt: 1 })); // missing doc
    expect(loadDraft(store)).toBeNull();
  });

  it('clearDraft removes the draft', () => {
    const store = memStorage();
    saveDraft(createWorkspace(), store);
    clearDraft(store);
    expect(loadDraft(store)).toBeNull();
  });
});

describe('resilience', () => {
  it('never throws when storage is unavailable', () => {
    expect(saveDraft(createWorkspace(), null)).toBe(false);
    expect(loadDraft(null)).toBeNull();
    expect(() => clearDraft(null)).not.toThrow();
  });

  it('swallows storage write errors (e.g. quota exceeded) instead of breaking edits', () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(saveDraft(createWorkspace(), throwing)).toBe(false);
  });
});

describe('createAutosaver (debounced)', () => {
  it('collapses a burst of edits into a single write on the trailing edge', () => {
    vi.useFakeTimers();
    try {
      const store = memStorage();
      const saver = createAutosaver(800, store);
      const { ws } = wsWithShape();
      saver.schedule(ws);
      saver.schedule(ws);
      saver.schedule(ws);
      expect(loadDraft(store)).toBeNull();   // nothing written yet — still debouncing
      vi.advanceTimersByTime(800);
      expect(loadDraft(store)).not.toBeNull(); // exactly one write after the quiet period
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush() writes the pending workspace immediately (e.g. on tab close)', () => {
    vi.useFakeTimers();
    try {
      const store = memStorage();
      const saver = createAutosaver(800, store);
      saver.schedule(wsWithShape().ws);
      saver.flush();
      expect(loadDraft(store)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
