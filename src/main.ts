import { App } from './app';
import { mountToolbar } from './ui/toolbar';
import { mountZoomControls } from './ui/zoom';
import { mountProperties } from './ui/properties';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { ConnectorTool } from './tools/connectorTool';
import { Autosave } from './storage/autosave';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(toolbarHost, bodyHost);

const saved = new Autosave().load();
const app = new App(canvasHost, saved ?? undefined);

app.registerTool('select', new SelectTool(app));
app.setTool('select');
for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
app.registerTool('arrow', new ConnectorTool(app));

mountToolbar(app, toolbarHost);
mountZoomControls(app, toolbarHost.querySelector('.toolbar')!);

const panel = mountProperties(app, propsHost);
app.onRender = () => panel.update();

app.render();
