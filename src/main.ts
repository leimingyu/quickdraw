import { App } from './app';
import { mountToolbar } from './ui/toolbar';
import { mountZoomControls } from './ui/zoom';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { Autosave } from './storage/autosave';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
root.appendChild(toolbarHost);
root.appendChild(canvasHost);

const saved = new Autosave().load();
const app = new App(canvasHost, saved ?? undefined);

app.registerTool('select', new SelectTool(app));
app.setTool('select');

for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}

mountToolbar(app, toolbarHost);
mountZoomControls(app, toolbarHost.querySelector('.toolbar')!);
app.render();
