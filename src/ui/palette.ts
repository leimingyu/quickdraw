// PowerPoint-style color palette: a theme grid (base colors + auto tints/shades)
// and a fixed row of standard colors. Pure data + math — no DOM.

/** Ten base theme colors (classic Office theme): bg1, txt1, bg2, txt2, accent1-6. */
export const THEME_BASE: readonly string[] = [
  '#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4',
  '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47',
];

/** Ten fixed standard colors, matching PowerPoint's Standard Colors row. */
export const STANDARD_COLORS: readonly string[] = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050',
  '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0',
];

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('');
}

/** Mix `hex` toward white by `amount` (0..1): c + (255 - c) * amount. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

/** Mix `hex` toward black by `amount` (0..1): c * (1 - amount). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/** A theme column: base color + Lighter 80/60/40 + Darker 25/50 (6 cells). */
export function themeColumn(base: string): string[] {
  return [base, tint(base, 0.8), tint(base, 0.6), tint(base, 0.4), shade(base, 0.25), shade(base, 0.5)];
}

/** 6 rows × 10 columns, row-major: row 0 is THEME_BASE, rows 1-5 are tints/shades. */
export const THEME_GRID: string[][] = (() => {
  const columns = THEME_BASE.map(themeColumn);
  return Array.from({ length: 6 }, (_, row) => columns.map((col) => col[row]));
})();
