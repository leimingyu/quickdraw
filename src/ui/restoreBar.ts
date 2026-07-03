// A thin, non-blocking bar offered at startup when a crash-recovery draft exists.
// It never auto-loads the draft — the user explicitly chooses Restore or Discard —
// so a recovered session can't silently clobber a deliberate fresh start.

export interface RestoreBarActions {
  onRestore: () => void; // load the recovered workspace
  onDiscard: () => void; // throw the draft away
}

/** Format the autosave time for the bar; falls back to a generic phrase for a missing/0 stamp. */
export function recoveredLabel(savedAt: number): string {
  if (!savedAt) return 'Recovered unsaved work from a previous session.';
  const when = new Date(savedAt).toLocaleString();
  return `Recovered unsaved work from ${when}.`;
}

/** Prepend the restore bar to `host`. Either button runs its action and removes the bar. */
export function mountRestoreBar(host: HTMLElement, savedAt: number, actions: RestoreBarActions): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'restore-bar';
  bar.setAttribute('role', 'status');
  bar.style.cssText =
    'display:flex;align-items:center;gap:12px;padding:8px 14px;' +
    'background:#fff8e1;border-bottom:1px solid #f0d488;color:#5b4a12;' +
    'font:13px/1.4 system-ui,sans-serif;';

  const msg = document.createElement('span');
  msg.textContent = recoveredLabel(savedAt);
  msg.style.flex = '1';

  const restore = document.createElement('button');
  restore.textContent = 'Restore';
  restore.className = 'restore-bar-restore';
  restore.style.cssText =
    'padding:4px 12px;border:1px solid #b9901f;border-radius:4px;background:#ffd24d;color:#3a2f08;cursor:pointer;';
  restore.addEventListener('click', () => {
    actions.onRestore();
    bar.remove();
  });

  const discard = document.createElement('button');
  discard.textContent = 'Discard';
  discard.className = 'restore-bar-discard';
  discard.style.cssText =
    'padding:4px 12px;border:1px solid #d8cfa8;border-radius:4px;background:transparent;color:#5b4a12;cursor:pointer;';
  discard.addEventListener('click', () => {
    actions.onDiscard();
    bar.remove();
  });

  bar.append(msg, restore, discard);
  host.prepend(bar);
  return bar;
}
