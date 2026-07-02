// Cross-platform keyboard-hint helpers. QuickDraw runs in the browser, so it works
// on Windows and macOS alike; the only user-visible difference is the modifier key
// (⌘ on Mac, Ctrl elsewhere). Shortcut *handling* accepts both (metaKey || ctrlKey).

/** True on macOS/iOS, where ⌘ is the primary modifier; false on Windows/Linux (Ctrl). */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const s = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/i.test(s);
}

/**
 * Render a shortcut spec for display, e.g. `formatShortcut('mod+shift+Z')`
 * → "⌘⇧Z" on Mac, "Ctrl+Shift+Z" on Windows/Linux. Plain keys ("Delete")
 * pass through unchanged.
 */
export function formatShortcut(spec: string, mac: boolean = isMac()): string {
  if (mac) {
    return spec.replace(/mod\+/g, '⌘').replace(/shift\+/g, '⇧').replace(/alt\+/g, '⌥');
  }
  return spec.replace(/mod\+/g, 'Ctrl+').replace(/shift\+/g, 'Shift+').replace(/alt\+/g, 'Alt+');
}
