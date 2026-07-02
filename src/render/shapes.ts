import type { Shape } from '../model/types';
import { DEFAULT_FONT_FAMILY } from '../model/document';

const NS = 'http://www.w3.org/2000/svg';
const ROUNDED_RADIUS = 12;
const TEXT_PAD = 6; // inset from the shape edge for left/right-aligned text

function applyStyle(el: SVGElement, s: Shape): void {
  el.setAttribute('fill', s.style.fill);
  el.setAttribute('stroke', s.style.stroke);
  el.setAttribute('stroke-width', String(s.style.strokeWidth));
  if (s.style.dashed) el.setAttribute('stroke-dasharray', '6 4');
}

function primitive(s: Shape): SVGElement {
  switch (s.kind) {
    case 'ellipse': {
      const e = document.createElementNS(NS, 'ellipse');
      e.setAttribute('cx', String(s.x + s.w / 2));
      e.setAttribute('cy', String(s.y + s.h / 2));
      e.setAttribute('rx', String(s.w / 2));
      e.setAttribute('ry', String(s.h / 2));
      applyStyle(e, s);
      return e;
    }
    case 'diamond': {
      const p = document.createElementNS(NS, 'polygon');
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      p.setAttribute('points', `${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}`);
      applyStyle(p, s);
      return p;
    }
    case 'triangle': {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', `${s.x + s.w / 2},${s.y} ${s.x + s.w},${s.y + s.h} ${s.x},${s.y + s.h}`);
      applyStyle(p, s);
      return p;
    }
    default: { // rect, rounded, text
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(s.x));
      r.setAttribute('y', String(s.y));
      r.setAttribute('width', String(s.w));
      r.setAttribute('height', String(s.h));
      if (s.kind === 'rounded') {
        r.setAttribute('rx', String(ROUNDED_RADIUS));
        r.setAttribute('ry', String(ROUNDED_RADIUS));
      }
      applyStyle(r, s);
      return r;
    }
  }
}

function textEl(s: Shape): SVGTextElement {
  const t = document.createElementNS(NS, 'text');
  const align = s.style.textAlign ?? 'center';
  if (align === 'left') {
    t.setAttribute('x', String(s.x + TEXT_PAD));
    t.setAttribute('text-anchor', 'start');
  } else if (align === 'right') {
    t.setAttribute('x', String(s.x + s.w - TEXT_PAD));
    t.setAttribute('text-anchor', 'end');
  } else {
    t.setAttribute('x', String(s.x + s.w / 2));
    t.setAttribute('text-anchor', 'middle');
  }
  t.setAttribute('y', String(s.y + s.h / 2));
  t.setAttribute('dominant-baseline', 'central');
  t.setAttribute('font-size', String(s.style.fontSize));
  t.setAttribute('font-family', s.style.fontFamily ?? DEFAULT_FONT_FAMILY);
  if (s.style.bold) t.setAttribute('font-weight', 'bold');
  if (s.style.italic) t.setAttribute('font-style', 'italic');
  t.setAttribute('fill', s.style.fontColor);
  t.setAttribute('pointer-events', 'none');
  t.textContent = s.text!;
  return t;
}

export function shapeToSvg(s: Shape): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', s.id);
  if (s.rotation) {
    g.setAttribute('transform', `rotate(${s.rotation} ${s.x + s.w / 2} ${s.y + s.h / 2})`);
  }
  g.appendChild(primitive(s));
  if (s.text) g.appendChild(textEl(s));
  return g;
}
