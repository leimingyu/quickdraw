import { describe, it, expect, beforeEach } from 'vitest';
import { showToast } from '../../src/ui/toast';

describe('showToast', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows a toast carrying the message text', () => {
    showToast('Exported "Tab_1.png" — check your Downloads folder');
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('Exported "Tab_1.png" — check your Downloads folder');
  });

  it('reuses a single container and stacks toasts', () => {
    showToast('a');
    showToast('b');
    expect(document.querySelectorAll('.toast-container')).toHaveLength(1);
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
  });

  it('recreates the container after the body is cleared', () => {
    showToast('first');
    document.body.innerHTML = ''; // container detached
    showToast('second');
    expect(document.querySelectorAll('.toast-container')).toHaveLength(1);
    expect(document.querySelector('.toast')?.textContent).toBe('second');
  });
});
