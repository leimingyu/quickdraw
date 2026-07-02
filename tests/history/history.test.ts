import { describe, it, expect } from 'vitest';
import { History } from '../../src/history/history';
import { createWorkspace, getActiveTab, addNode, createShape } from '../../src/model/document';

describe('History', () => {
  it('undo restores the previous workspace state', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    expect(getActiveTab(ws).nodes).toHaveLength(1);

    const prev = h.undo()!;
    expect(getActiveTab(prev).nodes).toHaveLength(0);
  });

  it('redo re-applies an undone change', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    const undone = h.undo()!;
    const redone = h.redo()!;
    expect(getActiveTab(undone).nodes).toHaveLength(0);
    expect(getActiveTab(redone).nodes).toHaveLength(1);
  });

  it('a new commit clears the redo stack', () => {
    const ws = createWorkspace();
    const h = new History(ws);
    addNode(getActiveTab(ws), createShape('rect', 0, 0));
    h.commit(ws);
    h.undo();
    addNode(getActiveTab(ws), createShape('ellipse', 0, 0));
    h.commit(ws);
    expect(h.canRedo()).toBe(false);
  });

  it('returns null when there is nothing to undo/redo', () => {
    const h = new History(createWorkspace());
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });
});
