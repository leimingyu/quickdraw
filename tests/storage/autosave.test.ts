import { describe, it, expect, beforeEach } from 'vitest';
import { Autosave } from '../../src/storage/autosave';
import { createWorkspace, getActiveTab, addNode, createShape } from '../../src/model/document';

beforeEach(() => localStorage.clear());

describe('Autosave', () => {
  it('save then load round-trips the workspace', () => {
    const ws = createWorkspace();
    addNode(getActiveTab(ws), createShape('rect', 5, 6));
    const store = new Autosave('test:ws');
    store.save(ws);
    const loaded = store.load();
    expect(loaded).not.toBeNull();
    expect(getActiveTab(loaded!).nodes[0]).toMatchObject({ x: 5, y: 6, kind: 'rect' });
  });

  it('load returns null when nothing is stored', () => {
    const store = new Autosave('test:empty');
    expect(store.load()).toBeNull();
  });

  it('load returns null on corrupt data', () => {
    localStorage.setItem('test:corrupt', '{not json');
    const store = new Autosave('test:corrupt');
    expect(store.load()).toBeNull();
  });
});
