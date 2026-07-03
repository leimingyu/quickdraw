import { describe, it, expect } from 'vitest';
import { gridLinePositions, snapValueToGrid, GRID_SIZE } from '../../src/model/grid';
import type { Viewport } from '../../src/model/types';

const vp = (o: Partial<Viewport> = {}): Viewport => ({ panX: 0, panY: 0, zoom: 1, ...o });

describe('gridLinePositions', () => {
  it('lists grid lines inside the visible region at zoom 1', () => {
    // 100×40 viewport, spacing 20 → x at 0,20,40,60,80,100; y at 0,20,40
    const { xs, ys } = gridLinePositions(vp(), 100, 40, 20);
    expect(xs).toEqual([0, 20, 40, 60, 80, 100]);
    expect(ys).toEqual([0, 20, 40]);
  });

  it('accounts for pan (world = (screen - pan) / zoom)', () => {
    // panX 10 shifts the world origin: visible world x in [(0-10),(100-10)] = [-10,90]
    const { xs } = gridLinePositions(vp({ panX: 10 }), 100, 40, 20);
    expect(xs).toEqual([0, 20, 40, 60, 80]); // -10..90 → multiples of 20 within
  });

  it('accounts for zoom (fewer world lines when zoomed in)', () => {
    // zoom 2: visible world x in [0, 50] → 0,20,40
    const { xs } = gridLinePositions(vp({ zoom: 2 }), 100, 40, 20);
    expect(xs).toEqual([0, 20, 40]);
  });

  it('returns nothing when the viewport is unmeasured (jsdom 0×0)', () => {
    expect(gridLinePositions(vp(), 0, 0, 20)).toEqual({ xs: [], ys: [] });
  });

  it('skips an over-dense grid (zoomed far out beyond the line cap)', () => {
    // huge world span at spacing 20 exceeds MAX_LINES → empty rather than flooding the DOM
    const { xs, ys } = gridLinePositions(vp({ zoom: 0.001 }), 1000, 1000, 20);
    expect(xs).toEqual([]);
    expect(ys).toEqual([]);
  });

  it('defaults spacing to GRID_SIZE', () => {
    const { xs } = gridLinePositions(vp(), GRID_SIZE * 2, GRID_SIZE, undefined);
    expect(xs).toEqual([0, GRID_SIZE, GRID_SIZE * 2]);
  });
});

describe('snapValueToGrid', () => {
  it('rounds to the nearest grid line', () => {
    expect(snapValueToGrid(0, 20)).toBe(0);
    expect(snapValueToGrid(9, 20)).toBe(0);
    expect(snapValueToGrid(11, 20)).toBe(20);
    expect(snapValueToGrid(31, 20)).toBe(40);
  });

  it('handles negatives', () => {
    expect(snapValueToGrid(-9, 20)).toBe(0);
    expect(snapValueToGrid(-11, 20)).toBe(-20);
  });

  it('defaults spacing to GRID_SIZE', () => {
    expect(snapValueToGrid(GRID_SIZE * 3 + 1)).toBe(GRID_SIZE * 3);
  });
});
