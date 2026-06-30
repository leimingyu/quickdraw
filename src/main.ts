import { App } from './app';
import { mountToolbar } from './ui/toolbar';
import { ShapeTool } from './tools/shapeTool';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
root.appendChild(toolbarHost);
root.appendChild(canvasHost);

const app = new App(canvasHost);

for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}

mountToolbar(app, toolbarHost);
app.render();
