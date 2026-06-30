import { App } from './app';
import { mountToolbar } from './ui/toolbar';

const root = document.getElementById('app')!;
root.innerHTML = '';

const toolbarHost = document.createElement('div');
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
root.appendChild(toolbarHost);
root.appendChild(canvasHost);

const app = new App(canvasHost);
mountToolbar(app, toolbarHost);
app.render();
