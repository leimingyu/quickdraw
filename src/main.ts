import { App } from './app';
import { mountMenuBar } from './ui/menubar';
import { mountToolPalette } from './ui/toolPalette';
import { saveWorkspace } from './io/files';
import { mountProperties } from './ui/properties';
import { mountTabs } from './ui/tabs';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { ConnectorTool } from './tools/connectorTool';

const root = document.getElementById('app')!;
root.innerHTML = '';

const tabStripHost = document.createElement('div');
const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const paletteHost = document.createElement('div');
paletteHost.className = 'palette-host';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(paletteHost, canvasHost, propsHost);
root.append(tabStripHost, toolbarHost, bodyHost);

// Start every page load with a fresh, empty canvas — the previous drawing is
// not auto-restored from the browser. (Explicit save/open to disk is Phase 3.)
const app = new App(canvasHost);

app.registerTool('select', new SelectTool(app));
app.setTool('select');
for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
app.registerTool('arrow', new ConnectorTool(app));

mountMenuBar(app, toolbarHost);
const palette = mountToolPalette(app, paletteHost);

const tabs = mountTabs(app, tabStripHost);
const panel = mountProperties(app, propsHost);
app.onRender = () => { panel.update(); tabs.update(); palette.syncActive(); };
app.onSave = () => saveWorkspace(app);

app.render();
