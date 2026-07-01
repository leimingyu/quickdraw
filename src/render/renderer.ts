import type { Shape, Tab, Viewport, Connector } from '../model/types';
import { handlePositions, selectionBounds, type Point } from '../model/geometry';
import type { SnapGuide } from '../model/snapping';
import { isShape, isConnector } from '../model/document';
import { shapeToSvg } from './shapes';
import { connectorToSvg, connectorSegment } from './connector';

const NS = 'http://www.w3.org/2000/svg';

export class Renderer {
  readonly svg: SVGSVGElement;
  private content: SVGGElement;
  private overlay: SVGGElement;

  constructor(mount: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.display = 'block';
    this.svg.style.background = '#fafafa';
    this.content = document.createElementNS(NS, 'g');
    this.overlay = document.createElementNS(NS, 'g');
    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(NS, 'path');
    arrow.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    arrow.setAttribute('fill', 'context-stroke');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    this.svg.appendChild(defs);
    this.svg.appendChild(this.content);
    this.svg.appendChild(this.overlay);
    mount.appendChild(this.svg);
  }

  render(tab: Tab, selection: Set<string>, highlightId?: string, guides: SnapGuide[] = []): void {
    const vp = tab.viewport;
    const transform = `translate(${vp.panX} ${vp.panY}) scale(${vp.zoom})`;
    this.content.setAttribute('transform', transform);
    this.overlay.setAttribute('transform', transform);
    const connectors = tab.nodes
      .filter(isConnector)
      .map((c) => connectorToSvg(tab, c, selection.has(c.id)))
      .filter((g): g is SVGGElement => g !== null);
    const shapes = tab.nodes.filter(isShape).map(shapeToSvg);
    this.content.replaceChildren(...connectors, ...shapes);
    this.overlay.replaceChildren();
    this.drawSelection(tab, selection);
    if (selection.size === 1) {
      const n = tab.nodes.find((x) => x.id === [...selection][0]);
      if (n && isConnector(n)) this.drawConnectorHandles(tab, n);
    }
    if (highlightId) this.drawHighlight(tab, highlightId);
    for (const g of guides) this.drawGuide(g, vp.zoom);
  }

  /** Alignment guide shown while a drag is snapped (rose, thin, non-interactive). */
  private drawGuide(g: SnapGuide, zoom: number): void {
    const line = document.createElementNS(NS, 'line');
    const [x1, y1, x2, y2] = g.axis === 'x'
      ? [g.at, g.start, g.at, g.end]
      : [g.start, g.at, g.end, g.at];
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', '#f43f5e');
    line.setAttribute('stroke-width', String(1 / zoom)); // ~1 screen px regardless of zoom
    line.setAttribute('pointer-events', 'none');
    this.overlay.appendChild(line);
  }

  private drawHighlight(tab: Tab, id: string): void {
    const node = tab.nodes.find((n) => n.id === id);
    if (!node || !isShape(node)) return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(node.x));
    r.setAttribute('y', String(node.y));
    r.setAttribute('width', String(node.w));
    r.setAttribute('height', String(node.h));
    r.setAttribute('fill', 'none');
    r.setAttribute('stroke', '#22c55e');
    r.setAttribute('stroke-width', '2');
    r.setAttribute('pointer-events', 'none');
    this.overlay.appendChild(r);
    // Connection-point targets: drop a connector end on one to pin it there.
    for (const p of Object.values(handlePositions({ x: node.x, y: node.y, w: node.w, h: node.h }))) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#22c55e');
      dot.setAttribute('pointer-events', 'none');
      this.overlay.appendChild(dot);
    }
  }

  private drawSelection(tab: Tab, selection: Set<string>): void {
    const shapes = tab.nodes.filter((n): n is Shape => selection.has(n.id) && isShape(n));
    const box = selectionBounds(shapes);
    if (!box) return;
    const outline = document.createElementNS(NS, 'rect');
    outline.setAttribute('x', String(box.x));
    outline.setAttribute('y', String(box.y));
    outline.setAttribute('width', String(box.w));
    outline.setAttribute('height', String(box.h));
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#3b82f6');
    outline.setAttribute('stroke-width', '1');
    outline.setAttribute('stroke-dasharray', '4 3');
    outline.setAttribute('pointer-events', 'none');
    this.overlay.appendChild(outline);
    if (shapes.length === 1) {
      const pos = handlePositions(box);
      for (const [handle, p] of Object.entries(pos)) {
        const h = document.createElementNS(NS, 'rect');
        h.setAttribute('x', String(p.x - 4));
        h.setAttribute('y', String(p.y - 4));
        h.setAttribute('width', '8');
        h.setAttribute('height', '8');
        h.setAttribute('fill', '#fff');
        h.setAttribute('stroke', '#3b82f6');
        h.setAttribute('data-handle', handle);
        this.overlay.appendChild(h);
      }
    }
  }

  private drawConnectorHandles(tab: Tab, c: Connector): void {
    const seg = connectorSegment(tab, c);
    if (!seg) return;
    const ends = [
      ['from', seg.x1, seg.y1],
      ['to', seg.x2, seg.y2],
    ] as const;
    for (const [end, x, y] of ends) {
      const h = document.createElementNS(NS, 'circle');
      h.setAttribute('cx', String(x));
      h.setAttribute('cy', String(y));
      h.setAttribute('r', '5');
      h.setAttribute('fill', '#fff');
      h.setAttribute('stroke', '#3b82f6');
      h.setAttribute('stroke-width', '1.5');
      h.setAttribute('data-endpoint', end);
      this.overlay.appendChild(h);
    }
  }

  toWorld(clientX: number, clientY: number, vp: Viewport): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    };
  }
}
