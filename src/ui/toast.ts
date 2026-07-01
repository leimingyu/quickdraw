/** A brief, non-blocking confirmation that fades out — used for export feedback so
 *  the user knows what was saved and where to find it. */
let container: HTMLElement | null = null;

export function showToast(message: string): void {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  // fade in next frame; fade out and remove after a few seconds
  requestAnimationFrame(() => el.classList.add('toast-show'));
  window.setTimeout(() => {
    el.classList.remove('toast-show');
    window.setTimeout(() => el.remove(), 300);
  }, 4500);
}
