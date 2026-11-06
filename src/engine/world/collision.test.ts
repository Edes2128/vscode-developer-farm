import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../math/coords';
import { CollisionGrid, moveBox, SLIDE_ASSIST } from './collision';

/** A 6x6 grid with a solid column at x=3. */
function wallGrid(): CollisionGrid {
  const grid = new CollisionGrid(6, 6);
  for (let y = 0; y < 6; y += 1) grid.setSolid(3, y, true);
  return grid;
}

const box = (x: number, y: number) => ({ x, y, w: 10, h: 6 });

describe('CollisionGrid', () => {
  it('treats everything outside the map as solid', () => {
    const grid = new CollisionGrid(4, 4);
    expect(grid.isSolid(-1, 0)).toBe(true);
    expect(grid.isSolid(0, 4)).toBe(true);
    expect(grid.isSolid(2, 2)).toBe(false);
  });

  it('finds a box that overlaps a blocked cell, but not one that merely touches it', () => {
    const grid = new CollisionGrid(4, 4);
    grid.setSolid(2, 1, true);
    expect(grid.boxHitsSolid({ x: 2 * TILE_SIZE - 5, y: TILE_SIZE, w: 10, h: 6 })).toBe(true);
    expect(grid.boxHitsSolid({ x: 2 * TILE_SIZE - 10, y: TILE_SIZE, w: 10, h: 6 })).toBe(false);
  });
});

describe('moveBox', () => {
  it('moves freely through open space', () => {
    const grid = new CollisionGrid(6, 6);
    const r = moveBox(grid, box(10, 10), 1.5, 0.5);
    expect(r.x).toBeCloseTo(11.5);
    expect(r.y).toBeCloseTo(10.5);
    expect(r.blockedX || r.blockedY).toBe(false);
  });

  it('stops flush against a wall instead of stopping short or sinking in', () => {
    const grid = wallGrid();
    let b = box(20, 20);
    for (let i = 0; i < 100; i += 1) {
      const r = moveBox(grid, b, 1.7, 0);
      b = { ...b, x: r.x, y: r.y };
    }
    expect(b.x + b.w).toBeCloseTo(3 * TILE_SIZE); // right edge exactly on the wall
    expect(grid.boxHitsSolid(b)).toBe(false);
  });

  it('stops flush against a wall on the other side too', () => {
    const grid = wallGrid();
    let b = box(5 * TILE_SIZE, 20);
    for (let i = 0; i < 200; i += 1) {
      const r = moveBox(grid, b, -1.7, 0);
      b = { ...b, x: r.x, y: r.y };
    }
    expect(b.x).toBeCloseTo(4 * TILE_SIZE);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const grid = wallGrid();
    const start = box(3 * TILE_SIZE - 10, 20);
    const r = moveBox(grid, start, 2, 2);
    expect(r.blockedX).toBe(true);
    expect(r.x).toBeCloseTo(start.x); // held back by the wall
    expect(r.y).toBeCloseTo(22); // but free to go along it
  });

  it('cannot tunnel through a wall, however fast it moves', () => {
    const grid = wallGrid();
    for (const delta of [3, 7, 15, 30, 80]) {
      const r = moveBox(grid, box(20, 20), delta, 0);
      expect(r.x + 10).toBeLessThanOrEqual(3 * TILE_SIZE + 1e-6);
    }
  });

  it('cannot leave the map', () => {
    const grid = new CollisionGrid(4, 4);
    const r = moveBox(grid, box(1, 1), -50, -50);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    const r2 = moveBox(grid, box(40, 40), 80, 80);
    expect(r2.x + 10).toBeLessThanOrEqual(4 * TILE_SIZE + 1e-6);
    expect(r2.y + 6).toBeLessThanOrEqual(4 * TILE_SIZE + 1e-6);
  });

  it('slides round a corner it only clips by a few pixels', () => {
    // One block at cell (3, 2): x 48..64, y 32..48. The box walks right with its top 2px inside the block's
    // bottom edge, and would be stopped dead by a plain collision. The assist nudges it down and past.
    const grid = new CollisionGrid(8, 8);
    grid.setSolid(3, 2, true);
    const clipped = box(36, 3 * TILE_SIZE - 2); // right edge at 46, two pixels from the block
    const r = moveBox(grid, clipped, 3, 0);
    expect(r.blockedX).toBe(false);
    expect(r.x).toBeCloseTo(39); // it got to move the full distance
    expect(r.y).toBeCloseTo(3 * TILE_SIZE); // after being nudged clear of the block
    expect(grid.boxHitsSolid({ ...clipped, x: r.x, y: r.y })).toBe(false);
  });

  it('does not slide round a corner clipped by more than the assist allows', () => {
    const grid = new CollisionGrid(8, 8);
    grid.setSolid(3, 2, true);
    const clipped = box(36, 3 * TILE_SIZE - (SLIDE_ASSIST + 1));
    const r = moveBox(grid, clipped, 3, 0);
    expect(r.blockedX).toBe(true);
    expect(r.y).toBeCloseTo(clipped.y);
  });

  it('does not slide when a wall is hit head-on', () => {
    const grid = wallGrid();
    const r = moveBox(grid, box(3 * TILE_SIZE - 11, 20), 3, 0);
    expect(r.blockedX).toBe(true);
    expect(r.y).toBeCloseTo(20);
  });
});
