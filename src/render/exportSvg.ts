import type { Tab } from '../model/types';
import { Renderer } from './renderer';
import { contentBounds } from '../model/bounds';

export const EXPORT_PADDING = 20;

/** A self-contained SVG document string for the tab, cropped to content bounds
 *  + padding. Independent of (and does not mutate) the tab's live viewport. When
 *  `background` is given (e.g. '#ffffff'), an opaque rect covering the whole
 *  viewBox is painted behind the drawing; omit it to keep the SVG transparent. */
export function tabToSvgString(tab: Tab, padding = EXPORT_PADDING, background?: string): string {
  const raw = contentBounds(tab) ?? { x: 0, y: 0, w: 400, h: 300 };
  const x = raw.x - padding;
  const y = raw.y - padding;
  const w = raw.w + padding * 2;
  const h = raw.h + padding * 2;

  const holder = document.createElement('div'); // detached mount — keeps export side-effect-free
  const renderer = new Renderer(holder);
  // Identity viewport → content <g> children are in world coords. Shallow copy so
  // the real tab's viewport is untouched; nodes are shared by reference (read-only).
  renderer.render({ ...tab, viewport: { panX: 0, panY: 0, zoom: 1 } }, new Set<string>());

  const svg = renderer.svg;
  const defs = svg.querySelector('defs')?.outerHTML ?? '';
  // The content layer, tagged by the Renderer (other layers — grid, overlay — are empty here
  // and deliberately excluded, so exports never carry the working grid or selection chrome).
  const content = svg.querySelector('g[data-layer="content"]')?.innerHTML ?? '';
  // Painted first (SVG paints in document order) so it sits behind the drawing.
  const bg = background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${defs}<g>${bg}${content}</g></svg>`;
}
