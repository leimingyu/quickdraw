let n = 0;
/** Deterministic-per-process unique id. Reset via resetIds() in tests. */
export function uid(prefix = 'n'): string {
  return `${prefix}${(++n).toString(36)}`;
}
export function resetIds(): void {
  n = 0;
}
