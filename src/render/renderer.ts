import type { Tab, Viewport } from '../model/types';
import { handlePositions, selectionBounds, type Point } from '../model/geometry';
import { shapeToSvg } from './shapes';

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
    this.svg.appendChild(this.content);
    this.svg.appendChild(this.overlay);
    mount.appendChild(this.svg);
  }

  render(tab: Tab, selection: Set<string>): void {
    const vp = tab.viewport;
    const transform = `translate(${vp.panX} ${vp.panY}) scale(${vp.zoom})`;
    this.content.setAttribute('transform', transform);
    this.overlay.setAttribute('transform', transform);
    this.content.replaceChildren(...tab.nodes.map(shapeToSvg));
    this.overlay.replaceChildren();
    this.drawSelection(tab, selection);
  }

  private drawSelection(tab: Tab, selection: Set<string>): void {
    const shapes = tab.nodes.filter((n) => selection.has(n.id));
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
