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

export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  arrowEnd: boolean;
}

export type Endpoint = { nodeId: string } | { x: number; y: number };

export interface Connector {
  id: string;
  kind: 'connector';
  from: Endpoint;
  to: Endpoint;
  style: ConnectorStyle;
  groupId?: string;
}

export type Node = Shape | Connector;

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
