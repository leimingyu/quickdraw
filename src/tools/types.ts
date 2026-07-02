import type { Point } from '../model/geometry';

export type ToolName = 'select' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'arrow';

export interface Tool {
  onPointerDown(world: Point, ev: PointerEvent): void;
  onPointerMove(world: Point, ev: PointerEvent): void;
  onPointerUp(world: Point, ev: PointerEvent): void;
  onActivate?(): void;
  onDeactivate?(): void;
}
