import { describe, expect, it } from 'vitest';
import { findPath, type PathGrid } from './astar';

/** A grid from ASCII: '#' is a wall. */
const grid = (rows: readonly string[]): PathGrid => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  walkable: (x, y) => rows[y]?.[x] === '.',
});

describe('findPath', () => {
  it('walks straight across open ground by the shortest way', () => {
    const path = findPath(grid(['.....', '.....', '.....']), { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(path).toHaveLength(4);
    expect(path?.at(-1)).toEqual({ x: 4, y: 1 });
  });

  it('goes round walls', () => {
    const g = grid(['.....', '.###.', '.#...', '.#.#.', '...#.']);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(path).toBeDefined();
    for (const cell of path ?? []) expect(g.walkable(cell.x, cell.y)).toBe(true);
    expect(path?.at(-1)).toEqual({ x: 4, y: 4 });
  });

  it('only steps one cell at a time and never cuts a corner', () => {
    const g = grid(['.#', '#.']);
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeUndefined();
    const open = findPath(grid(['..', '..']), { x: 0, y: 0 }, { x: 1, y: 1 }) ?? [];
    let previous = { x: 0, y: 0 };
    for (const cell of open) {
      expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
      previous = cell;
    }
  });

  it('is empty when already there, and undefined when the goal is a wall or cannot be reached', () => {
    const g = grid(['..#..', '..#..']);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeUndefined();
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 1 })).toBeUndefined();
  });

  it('can start from a cell that is not walkable', () => {
    const path = findPath(grid(['#..']), { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('copes with a large map quickly', () => {
    const rows = Array.from({ length: 200 }, (_, y) => (y % 2 === 1 ? '.'.repeat(199) + '#' : '#' + '.'.repeat(199)));
    const t0 = performance.now();
    const path = findPath(grid(rows), { x: 1, y: 0 }, { x: 198, y: 199 });
    expect(path).toBeDefined();
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
