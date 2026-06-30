import { App } from './app';
import { mountToolbar } from './ui/toolbar';
import { mountZoomControls } from './ui/zoom';
import { mountProperties } from './ui/properties';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { ConnectorTool } from './tools/connectorTool';

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

// Start every page load with a fresh, empty canvas — the previous drawing is
// not auto-restored from the browser. (Explicit save/open to disk is Phase 3.)
const app = new App(canvasHost);

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
