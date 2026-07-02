export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle' | 'text';
export type Anchor = 'top' | 'right' | 'bottom' | 'left' | 'center';
/** A shape's 8 connection points (corners + edge midpoints), matching the resize handles. */
export type ConnectionPoint = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Horizontal alignment of a shape's text label. Absent = centered. */
export type TextAlign = 'left' | 'center' | 'right';

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontColor: string;
  fontFamily?: string; // CSS font stack; absent = default sans-serif
  bold?: boolean;
  italic?: boolean;
  textAlign?: TextAlign; // absent = 'center'
  dashed?: boolean;
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
  arrowStart?: boolean;
  dashed?: boolean;
  routing?: Routing; // absent/'straight' = direct line; 'elbow' = orthogonal; 'curved' = bezier
}

/** Connector path style. */
export type Routing = 'straight' | 'elbow' | 'curved';

// An attached endpoint pins to a specific connection point when `anchor` is set
// (fixed, PowerPoint-style); without it, the endpoint auto-snaps to the nearest
// connection point facing the other end.
export type Endpoint = { nodeId: string; anchor?: ConnectionPoint } | { x: number; y: number };

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
