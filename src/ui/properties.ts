import type { App } from '../app';
import type { Node, Routing, TextAlign } from '../model/types';
import { isShape, isConnector, FONT_STACKS, DEFAULT_FONT_FAMILY, type StylePatch } from '../model/document';

/** Curated font families offered by the typography control (label, CSS stack). */
const FONT_OPTIONS: [string, string][] = [
  ['Sans', FONT_STACKS.sans],
  ['Serif', FONT_STACKS.serif],
  ['Mono', FONT_STACKS.mono],
  ['Cursive', FONT_STACKS.cursive],
];

export function mountProperties(app: App, container: HTMLElement): { update: () => void } {
  const dock = document.createElement('div');
  dock.className = 'props';
  dock.style.display = 'none';
  container.appendChild(dock);

  let signature = '';

  const selected = (): Node[] => app.activeTab.nodes.filter((n) => app.selection.has(n.id));

  function update(): void {
    const nodes = selected();
    if (nodes.length === 0) {
      dock.style.display = 'none';
      signature = '';
      return;
    }
    dock.style.display = 'block';
    const sig = nodes.map((n) => n.id).sort().join(',');
    if (sig === signature) return; // unchanged selection → keep controls (and input focus)
    signature = sig;
    rebuild(nodes);
  }

  function rebuild(nodes: Node[]): void {
    dock.replaceChildren();
    const primary = nodes[0];
    const firstShape = nodes.find(isShape);
    const firstConn = nodes.find(isConnector);

    // shared (every node has stroke/strokeWidth/dashed)
    dock.appendChild(colorRow('Line', 'stroke', primary.style.stroke, (v) => ({ stroke: v })));
    dock.appendChild(numberRow('Width', 'strokeWidth', primary.style.strokeWidth, 1, (v) => ({ strokeWidth: v })));
    dock.appendChild(toggleRow('Dashed', 'dashed', !!primary.style.dashed, (v) => ({ dashed: v })));

    if (firstShape) {
      dock.appendChild(colorRow('Fill', 'fill', firstShape.style.fill, (v) => ({ fill: v })));
      dock.appendChild(numberRow('Font', 'fontSize', firstShape.style.fontSize, 4, (v) => ({ fontSize: v })));
      dock.appendChild(colorRow('Text', 'fontColor', firstShape.style.fontColor, (v) => ({ fontColor: v })));
      dock.appendChild(selectRow('Family', 'fontFamily', firstShape.style.fontFamily ?? DEFAULT_FONT_FAMILY, FONT_OPTIONS, (v) => ({ fontFamily: v })));
      dock.appendChild(toggleRow('Bold', 'bold', !!firstShape.style.bold, (v) => ({ bold: v })));
      dock.appendChild(toggleRow('Italic', 'italic', !!firstShape.style.italic, (v) => ({ italic: v })));
      dock.appendChild(alignRow(firstShape.style.textAlign ?? 'center'));
      dock.appendChild(rotationRow());
    }
    if (firstConn) {
      dock.appendChild(toggleRow('Arrow start', 'arrowStart', !!firstConn.style.arrowStart, (v) => ({ arrowStart: v })));
      dock.appendChild(toggleRow('Arrow end', 'arrowEnd', firstConn.style.arrowEnd !== false, (v) => ({ arrowEnd: v })));
      dock.appendChild(routingRow(firstConn.style.routing ?? 'straight'));
    }
    dock.appendChild(zorderRow());
  }

  function colorRow(label: string, prop: string, value: string, make: (v: string) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = toHex(value);
    input.dataset.prop = prop;
    input.addEventListener('input', () => app.restyle(make(input.value)));
    input.addEventListener('change', () => app.commitStyle());
    row.appendChild(input);
    return row;
  }

  function numberRow(label: string, prop: string, value: number, min: number, make: (v: number) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.value = String(value);
    input.dataset.prop = prop;
    input.addEventListener('input', () => app.restyle(make(Math.max(min, Number(input.value) || min))));
    input.addEventListener('change', () => app.commitStyle());
    row.appendChild(input);
    return row;
  }

  function toggleRow(label: string, prop: string, on: boolean, make: (v: boolean) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const btn = document.createElement('button');
    btn.dataset.prop = prop;
    btn.textContent = on ? 'On' : 'Off';
    btn.classList.toggle('active', on);
    btn.addEventListener('click', () => {
      const next = !btn.classList.contains('active');
      btn.classList.toggle('active', next);
      btn.textContent = next ? 'On' : 'Off';
      app.restyle(make(next));
      app.commitStyle();
    });
    row.appendChild(btn);
    return row;
  }

  function routingRow(current: Routing): HTMLElement {
    const row = labeledRow('Type');
    const seg = document.createElement('div');
    seg.className = 'seg';
    const opts: [Routing, string][] = [['straight', 'Straight'], ['elbow', 'Elbow'], ['curved', 'Curved']];
    for (const [kind, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.routing = kind;
      b.classList.toggle('active', current === kind);
      b.addEventListener('click', () => {
        app.connectorRouting = kind; // also the default for the next drawn connector
        app.restyle({ routing: kind });
        app.commitStyle();
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  function selectRow(label: string, prop: string, value: string, options: [string, string][], make: (v: string) => StylePatch): HTMLElement {
    const row = labeledRow(label);
    const select = document.createElement('select');
    select.dataset.prop = prop;
    for (const [optLabel, optValue] of options) {
      const opt = document.createElement('option');
      opt.value = optValue;
      opt.textContent = optLabel;
      if (optValue === value) opt.selected = true;
      select.appendChild(opt);
    }
    // A select change is a single discrete gesture: apply live, then commit once.
    select.addEventListener('change', () => {
      app.restyle(make(select.value));
      app.commitStyle();
    });
    row.appendChild(select);
    return row;
  }

  function alignRow(current: TextAlign): HTMLElement {
    const row = labeledRow('Align');
    const seg = document.createElement('div');
    seg.className = 'seg';
    const opts: [TextAlign, string][] = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
    for (const [val, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.align = val;
      b.classList.toggle('active', current === val);
      b.addEventListener('click', () => {
        app.restyle({ textAlign: val });
        app.commitStyle();
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  /** Reset a rotated shape back to 0° (landscape). Always shown for shapes so it
   *  stays reachable after a rotate drag (which doesn't rebuild this panel). */
  function rotationRow(): HTMLElement {
    const row = labeledRow('Rotation');
    const btn = document.createElement('button');
    btn.textContent = 'Reset';
    btn.dataset.action = 'reset-rotation';
    btn.title = 'Reset rotation to 0° (landscape)';
    btn.addEventListener('click', () => app.resetRotation());
    row.appendChild(btn);
    return row;
  }

  function zorderRow(): HTMLElement {
    const row = labeledRow('Order');
    const front = document.createElement('button');
    front.textContent = 'Front';
    front.dataset.action = 'front';
    front.addEventListener('click', () => app.bringToFront());
    const back = document.createElement('button');
    back.textContent = 'Back';
    back.dataset.action = 'back';
    back.addEventListener('click', () => app.sendToBack());
    row.append(front, back);
    return row;
  }

  function labeledRow(label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'props-row';
    const span = document.createElement('span');
    span.className = 'props-label';
    span.textContent = label;
    row.appendChild(span);
    return row;
  }

  return { update };
}

/** Native color inputs require #rrggbb; pass valid hex through, else fall back. */
function toHex(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000';
}
