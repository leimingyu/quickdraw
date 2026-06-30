import type { Shape } from '../model/types';

const NS = 'http://www.w3.org/2000/svg';

function applyStyle(el: SVGElement, s: Shape): void {
  el.setAttribute('fill', s.style.fill);
  el.setAttribute('stroke', s.style.stroke);
  el.setAttribute('stroke-width', String(s.style.strokeWidth));
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
        r.setAttribute('rx', '12');
        r.setAttribute('ry', '12');
      }
      applyStyle(r, s);
      return r;
    }
  }
}

function textEl(s: Shape): SVGTextElement {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', String(s.x + s.w / 2));
  t.setAttribute('y', String(s.y + s.h / 2));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'central');
  t.setAttribute('font-size', String(s.style.fontSize));
  t.setAttribute('fill', s.style.fontColor);
  t.setAttribute('pointer-events', 'none');
  t.textContent = s.text ?? '';
  return t;
}

export function shapeToSvg(s: Shape): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-id', s.id);
  g.appendChild(primitive(s));
  if (s.text) g.appendChild(textEl(s));
  return g;
}
