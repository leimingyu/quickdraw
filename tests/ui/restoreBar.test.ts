import { describe, it, expect, beforeEach } from 'vitest';
import { mountRestoreBar, recoveredLabel } from '../../src/ui/restoreBar';

beforeEach(() => { document.body.innerHTML = ''; });

describe('recoveredLabel', () => {
  it('names the autosave time when known', () => {
    const label = recoveredLabel(1_700_000_000_000);
    expect(label).toContain('Recovered');
    expect(label).not.toContain('previous session');
  });
  it('falls back to a generic phrase for a missing timestamp', () => {
    expect(recoveredLabel(0)).toContain('previous session');
  });
});

describe('mountRestoreBar', () => {
  it('prepends the bar as the first child of the host', () => {
    const host = document.createElement('div');
    host.appendChild(document.createElement('p')); // existing content
    mountRestoreBar(host, 0, { onRestore() {}, onDiscard() {} });
    expect(host.firstElementChild?.className).toBe('restore-bar');
  });

  it('Restore runs onRestore and removes the bar', () => {
    const host = document.createElement('div');
    let restored = 0;
    let discarded = 0;
    mountRestoreBar(host, Date.now(), { onRestore: () => { restored++; }, onDiscard: () => { discarded++; } });
    (host.querySelector('.restore-bar-restore') as HTMLButtonElement).click();
    expect(restored).toBe(1);
    expect(discarded).toBe(0);
    expect(host.querySelector('.restore-bar')).toBeNull(); // dismissed after acting
  });

  it('Discard runs onDiscard and removes the bar', () => {
    const host = document.createElement('div');
    let restored = 0;
    let discarded = 0;
    mountRestoreBar(host, Date.now(), { onRestore: () => { restored++; }, onDiscard: () => { discarded++; } });
    (host.querySelector('.restore-bar-discard') as HTMLButtonElement).click();
    expect(discarded).toBe(1);
    expect(restored).toBe(0);
    expect(host.querySelector('.restore-bar')).toBeNull();
  });
});
