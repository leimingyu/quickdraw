export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';
export type Anchor = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontColor: string;
}

export interface Shape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  text?: string;
  style: ShapeStyle;
  groupId?: string;
}

/** Phase 2 widens this to `Shape | Connector | Group`. */
export type Node = Shape;

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Tab {
  id: string;
  name: string;
  nodes: Node[]; // z-ordered: later index = drawn on top
  viewport: Viewport;
}

export interface Workspace {
  version: number;
  tabs: Tab[];
  activeTabId: string;
}
