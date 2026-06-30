import type { Point } from '../model/geometry';

export type ToolName = 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';

export interface Tool {
  onPointerDown(world: Point, ev: PointerEvent): void;
  onPointerMove(world: Point, ev: PointerEvent): void;
  onPointerUp(world: Point, ev: PointerEvent): void;
  onDoubleClick?(world: Point, ev: MouseEvent): void;
  /** Begin editing the current single selection's text, optionally seeded with a first character. */
  beginEdit?(initial?: string): void;
  onActivate?(): void;
  onDeactivate?(): void;
}
