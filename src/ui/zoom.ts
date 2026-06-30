import type { App } from '../app';

export function mountZoomControls(app: App, bar: HTMLElement): void {
  const zoomOut = document.createElement('button');
  zoomOut.textContent = '−';
  zoomOut.title = 'Zoom out';
  zoomOut.addEventListener('click', () => app.zoomBy(1 / 1.2));

  const zoomIn = document.createElement('button');
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  zoomIn.addEventListener('click', () => app.zoomBy(1.2));

  const fit = document.createElement('button');
  fit.textContent = '100%';
  fit.title = 'Reset view';
  fit.addEventListener('click', () => app.resetView());

  bar.append(zoomOut, zoomIn, fit);
}
