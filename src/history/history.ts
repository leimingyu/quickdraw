import type { Workspace } from '../model/types';
import { cloneWorkspace } from '../model/document';

const LIMIT = 100;

export class History {
  private undoStack: Workspace[] = [];
  private redoStack: Workspace[] = [];
  private present: Workspace;

  constructor(initial: Workspace) {
    this.present = cloneWorkspace(initial);
  }

  commit(next: Workspace): void {
    this.undoStack.push(this.present);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.present = cloneWorkspace(next);
    this.redoStack = [];
  }

  undo(): Workspace | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(this.present);
    this.present = prev;
    return cloneWorkspace(prev);
  }

  redo(): Workspace | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(this.present);
    this.present = next;
    return cloneWorkspace(next);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
