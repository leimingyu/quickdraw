import type { Viewport } from './types';

/** World-unit spacing between grid lines (and the snap step). */
export const GRID_SIZE = 20;
/** Density cap: a grid this dense (e.g. zoomed far out) isn't useful, so we draw none. */
const MAX_LINES = 400;

/** Normalize -0 to 0 so grid coords compare cleanly (Math.round/ceil can yield -0). */
const nz = (n: number): number => (n === 0 ? 0 : n);

/**
 * The world-space X positions (vertical lines) and Y positions (horizontal lines) that fall
 * inside the currently visible region, at `spacing`. Screen→world uses the viewport:
 * `world = (screen - pan) / zoom`. Returns empty arrays when the viewport isn't measured yet
 * (jsdom reports 0×0) or when the grid would exceed `MAX_LINES` on either axis.
 */
export function gridLinePositions(
  vp: Viewport,
  width: number,
  height: number,
  spacing: number = GRID_SIZE,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  if (width <= 0 || height <= 0 || spacing <= 0) return { xs, ys };
  const x0 = (0 - vp.panX) / vp.zoom;
  const x1 = (width - vp.panX) / vp.zoom;
  const y0 = (0 - vp.panY) / vp.zoom;
  const y1 = (height - vp.panY) / vp.zoom;
  if ((x1 - x0) / spacing > MAX_LINES || (y1 - y0) / spacing > MAX_LINES) return { xs, ys };
  for (let x = Math.ceil(x0 / spacing) * spacing; x <= x1; x += spacing) xs.push(nz(x));
  for (let y = Math.ceil(y0 / spacing) * spacing; y <= y1; y += spacing) ys.push(nz(y));
  return { xs, ys };
}

/** Round a world coordinate to the nearest grid line. */
export function snapValueToGrid(v: number, spacing: number = GRID_SIZE): number {
  return nz(Math.round(v / spacing) * spacing);
}
