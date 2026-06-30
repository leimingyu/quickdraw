import type { Shape, Tab, Viewport } from '../model/types';
import { handlePositions, selectionBounds, type Point } from '../model/geometry';
import { isShape, isConnector } from '../model/document';
import { shapeToSvg } from './shapes';
import { connectorToSvg } from './connector';

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
    arrow.setAttribute('fill', '#1e1e1e');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    this.svg.appendChild(defs);
    this.svg.appendChild(this.content);
    this.svg.appendChild(this.overlay);
    mount.appendChild(this.svg);
  }

  render(tab: Tab, selection: Set<string>): void {
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

  toWorld(clientX: number, clientY: number, vp: Viewport): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - vp.panX) / vp.zoom,
      y: (clientY - rect.top - vp.panY) / vp.zoom,
    };
  }
}
