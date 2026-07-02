import type { Shape, ShapeStyle } from '../model/types';
import { DEFAULT_FONT_FAMILY } from '../model/document';

const NS = 'http://www.w3.org/2000/svg';
const ROUNDED_RADIUS = 12;
const TEXT_PAD = 6; // inset from the shape edge for left/right-aligned text
const LINE_HEIGHT = 1.2; // multiple of font-size between baselines of wrapped/broken lines

/** Greedy word-wrap: break `text` into lines that each measure ≤ `maxW`, splitting only at
 *  whitespace. A single word wider than `maxW` gets its own line (never split mid-word); a
 *  non-positive `maxW` or empty text yields the text as one line. Pure — the caller injects
 *  `measure` (canvas metrics in the browser, an estimator under jsdom), so it is testable. */
export function wrapText(text: string, maxW: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (maxW <= 0 || words.length === 0) return [text];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`;
    if (measure(next) <= maxW) cur = next;
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

/** A text-width estimator for `style`: ~0.6em per character (a touch wider when bold). It
 *  deliberately errs generous so wrapped text stays inside the box rather than overflowing,
 *  and — being pure arithmetic — renders identically in the browser and under jsdom (no
 *  canvas/DOM measurement needed), so tests exercise exactly the production wrap path. */
function makeMeasurer(style: ShapeStyle): (s: string) => number {
  const perChar = style.fontSize * 0.6 * (style.bold ? 1.05 : 1);
  return (s: string) => s.length * perChar;
}

/** The shape's label as visual lines: split on explicit newlines, then word-wrap each
 *  paragraph to the shape's inner width. Blank lines are preserved. */
function layoutLines(s: Shape): string[] {
  const measure = makeMeasurer(s.style);
  const maxW = s.w - TEXT_PAD * 2;
  return (s.text ?? '').split('\n').flatMap((para) => wrapText(para, maxW, measure));
}

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
  let anchorX: number;
  if (align === 'left') {
    anchorX = s.x + TEXT_PAD;
    t.setAttribute('text-anchor', 'start');
  } else if (align === 'right') {
    anchorX = s.x + s.w - TEXT_PAD;
    t.setAttribute('text-anchor', 'end');
  } else {
    anchorX = s.x + s.w / 2;
    t.setAttribute('text-anchor', 'middle');
  }
  t.setAttribute('x', String(anchorX));
  t.setAttribute('y', String(s.y + s.h / 2));
  t.setAttribute('dominant-baseline', 'central');
  t.setAttribute('font-size', String(s.style.fontSize));
  t.setAttribute('font-family', s.style.fontFamily ?? DEFAULT_FONT_FAMILY);
  if (s.style.bold) t.setAttribute('font-weight', 'bold');
  if (s.style.italic) t.setAttribute('font-style', 'italic');
  t.setAttribute('fill', s.style.fontColor);
  t.setAttribute('pointer-events', 'none');

  // One <tspan> per visual line, stacked and vertically centered on the shape's middle.
  const lines = layoutLines(s);
  const lineHeight = s.style.fontSize * LINE_HEIGHT;
  lines.forEach((line, i) => {
    const span = document.createElementNS(NS, 'tspan');
    span.setAttribute('x', String(anchorX));
    // First line rises by half the block height; each subsequent line drops one line-height.
    span.setAttribute('dy', String(i === 0 ? (-(lines.length - 1) / 2) * lineHeight : lineHeight));
    span.textContent = line;
    t.appendChild(span);
  });
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
