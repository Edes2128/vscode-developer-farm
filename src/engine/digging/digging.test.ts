import { describe, expect, it } from 'vitest';
import { digSpots, pickArtifact, type ArtifactChance, type Cell } from './digging';

/** A `width` x `height` block of cells, row by row. */
const grid = (width: number, height: number, x0 = 0, y0 = 0): Cell[] => {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ x: x0 + x, y: y0 + y });
  return cells;
};
const key = (cell: Cell): string => `${cell.x},${cell.y}`;
const keys = (cells: readonly Cell[]): string[] => cells.map(key);

describe('digSpots', () => {
  const candidates = grid(10, 10);

  it('gives the same cells in the same order every time', () => {
    const first = digSpots('home_farm', 12, candidates, 8);
    expect(digSpots('home_farm', 12, candidates, 8)).toEqual(first);
    expect(digSpots('home_farm', 12, [...candidates], 8)).toEqual(first);
    expect(first).toHaveLength(8);
  });

  it('gives distinct cells, all of them from the candidates', () => {
    const allowed = new Set(keys(candidates));
    for (let day = 1; day <= 60; day += 1) {
      const spots = digSpots('home_farm', day, candidates, 12);
      expect(new Set(keys(spots)).size).toBe(12);
      expect(spots.every((cell) => allowed.has(key(cell)))).toBe(true);
    }
  });

  it('never gives more than there are candidates', () => {
    const few = grid(3, 2);
    const spots = digSpots('home_farm', 1, few, 50);
    expect(spots).toHaveLength(6);
    expect(new Set(keys(spots))).toEqual(new Set(keys(few)));
    expect(digSpots('home_farm', 1, few, 6)).toHaveLength(6);
    expect(digSpots('home_farm', 1, few, 5)).toHaveLength(5);
  });

  it('copes with nothing to choose from or nothing asked for', () => {
    expect(digSpots('home_farm', 1, [], 5)).toEqual([]);
    expect(digSpots('home_farm', 1, candidates, 0)).toEqual([]);
    expect(digSpots('home_farm', 1, candidates, -3)).toEqual([]);
    expect(digSpots('home_farm', 1, candidates, Number.NaN)).toEqual([]);
    expect(digSpots('home_farm', 1, [], 0)).toEqual([]);
  });

  it('rounds a fractional count down', () => {
    expect(digSpots('home_farm', 1, candidates, 4.9)).toHaveLength(4);
  });

  it('gives a different set on a different day', () => {
    const sets = new Set<string>();
    for (let day = 1; day <= 40; day += 1) sets.add(JSON.stringify(digSpots('home_farm', day, candidates, 6)));
    expect(sets.size).toBe(40);
  });

  it('gives a different set on a different map', () => {
    const sets = new Set<string>();
    for (const map of ['home_farm', 'willowbrook', 'mine_1', 'mine_2', 'beach', 'riverbank', 'woods', 'quarry']) {
      sets.add(JSON.stringify(digSpots(map, 7, candidates, 6)));
    }
    expect(sets.size).toBe(8);
  });

  it('does not depend on the order the candidates are listed in', () => {
    const expected = digSpots('home_farm', 5, candidates, 9);
    const reversed = [...candidates].reverse();
    // A fixed scramble (stride 37 is coprime with 100), so the test needs no randomness.
    const scrambled = candidates.map((_, i) => candidates[(i * 37) % candidates.length] as Cell);
    expect(digSpots('home_farm', 5, reversed, 9)).toEqual(expected);
    expect(digSpots('home_farm', 5, scrambled, 9)).toEqual(expected);
  });

  it('does not change the candidates it is given', () => {
    const input = [...grid(4, 4)].reverse();
    const before = JSON.stringify(input);
    digSpots('home_farm', 3, input, 5);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('treats a cell listed twice as one cell', () => {
    const doubled = [...grid(2, 2), ...grid(2, 2)];
    const spots = digSpots('home_farm', 1, doubled, 10);
    expect(spots).toHaveLength(4);
    expect(new Set(keys(spots)).size).toBe(4);
  });

  it('works with negative and offset coordinates', () => {
    const spots = digSpots('home_farm', 2, grid(5, 5, -2, -2), 25);
    expect(new Set(keys(spots))).toEqual(new Set(keys(grid(5, 5, -2, -2))));
  });

  it('chooses every candidate about equally often over many days', () => {
    const cells = grid(5, 4); // 20 cells, 5 chosen a day: each is chosen with probability 1/4
    const days = 4000;
    const chosen = new Map<string, number>();
    const first = new Map<string, number>();
    for (let day = 1; day <= days; day += 1) {
      const spots = digSpots('home_farm', day, cells, 5);
      for (const cell of spots) chosen.set(key(cell), (chosen.get(key(cell)) ?? 0) + 1);
      const head = spots[0];
      if (head !== undefined) first.set(key(head), (first.get(key(head)) ?? 0) + 1);
    }
    expect(chosen.size).toBe(20);
    for (const total of chosen.values()) {
      expect(total).toBeGreaterThan((days / 4) * 0.88);
      expect(total).toBeLessThan((days / 4) * 1.12);
    }
    // The order is fair too: the first cell given is not biased towards the top-left.
    expect(first.size).toBe(20);
    for (const total of first.values()) {
      expect(total).toBeGreaterThan((days / 20) * 0.6);
      expect(total).toBeLessThan((days / 20) * 1.4);
    }
  });
});

describe('pickArtifact', () => {
  const table: ArtifactChance[] = [
    { item: 'arrowhead', weight: 1 },
    { item: 'pottery', weight: 3 },
    { item: 'fossil', weight: 6 },
  ];

  it('depends only on the table, the cell, the day and the map', () => {
    const first = pickArtifact(table, 'home_farm', 4, 9, 12);
    expect(pickArtifact(table, 'home_farm', 4, 9, 12)).toBe(first);
    expect(pickArtifact([...table], 'home_farm', 4, 9, 12)).toBe(first);
    // Asking about other cells or days in between changes nothing.
    pickArtifact(table, 'home_farm', 5, 9, 12);
    pickArtifact(table, 'home_farm', 4, 9, 13);
    expect(pickArtifact(table, 'home_farm', 4, 9, 12)).toBe(first);
  });

  it('only gives items from the table', () => {
    const allowed = new Set(table.map((entry) => entry.item));
    for (const cell of grid(20, 20)) expect(allowed.has(pickArtifact(table, 'home_farm', cell.x, cell.y, 3) as string)).toBe(true);
  });

  it('follows the weights over many cells', () => {
    const counts = new Map<string, number>();
    const cells = grid(100, 100);
    for (const cell of cells) {
      const item = pickArtifact(table, 'home_farm', cell.x, cell.y, 17) as string;
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    const share = (item: string): number => (counts.get(item) ?? 0) / cells.length;
    expect(Math.abs(share('arrowhead') - 0.1)).toBeLessThan(0.02);
    expect(Math.abs(share('pottery') - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(share('fossil') - 0.6)).toBeLessThan(0.02);
  });

  it('follows the weights for one cell over many days', () => {
    const counts = new Map<string, number>();
    const days = 10000;
    for (let day = 1; day <= days; day += 1) {
      const item = pickArtifact(table, 'home_farm', 3, 3, day) as string;
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    expect(Math.abs((counts.get('arrowhead') ?? 0) / days - 0.1)).toBeLessThan(0.02);
    expect(Math.abs((counts.get('pottery') ?? 0) / days - 0.3)).toBeLessThan(0.02);
    expect(Math.abs((counts.get('fossil') ?? 0) / days - 0.6)).toBeLessThan(0.02);
  });

  it('gives different finds on different days and maps', () => {
    const picks = (day: number, map: string): string => grid(8, 8).map((c) => pickArtifact(table, map, c.x, c.y, day)).join(',');
    expect(picks(1, 'home_farm')).not.toBe(picks(2, 'home_farm'));
    expect(picks(1, 'home_farm')).not.toBe(picks(1, 'mine_1'));
  });

  it('never picks a zero or negative weight', () => {
    const odd: ArtifactChance[] = [
      { item: 'nothing', weight: 0 },
      { item: 'real', weight: 5 },
      { item: 'negative', weight: -4 },
      { item: 'nan', weight: Number.NaN },
      { item: 'infinite', weight: Number.POSITIVE_INFINITY },
    ];
    for (const cell of grid(30, 30)) expect(pickArtifact(odd, 'home_farm', cell.x, cell.y, 2)).toBe('real');
  });

  it('keeps the other entries working around a zero weight', () => {
    const withZero: ArtifactChance[] = [
      { item: 'a', weight: 1 },
      { item: 'skipped', weight: 0 },
      { item: 'b', weight: 1 },
    ];
    const seen = new Set<string | undefined>();
    for (const cell of grid(20, 20)) seen.add(pickArtifact(withZero, 'home_farm', cell.x, cell.y, 1));
    expect(seen).toEqual(new Set(['a', 'b']));
  });

  it('gives the only item of a one-entry table', () => {
    for (const day of [1, 2, 3, 99]) expect(pickArtifact([{ item: 'solo', weight: 0.001 }], 'home_farm', 1, 1, day)).toBe('solo');
  });

  it('gives nothing for an empty table or one with no positive weight', () => {
    expect(pickArtifact([], 'home_farm', 1, 1, 1)).toBeUndefined();
    expect(pickArtifact([{ item: 'a', weight: 0 }], 'home_farm', 1, 1, 1)).toBeUndefined();
    expect(
      pickArtifact(
        [
          { item: 'a', weight: 0 },
          { item: 'b', weight: -1 },
        ],
        'home_farm',
        1,
        1,
        1,
      ),
    ).toBeUndefined();
  });
});

describe('digSpots and pickArtifact together', () => {
  it('give a stable day: the same spots with the same finds, however often it is asked', () => {
    const table: ArtifactChance[] = [
      { item: 'arrowhead', weight: 1 },
      { item: 'fossil', weight: 1 },
    ];
    const today = (): string[] =>
      digSpots('home_farm', 9, grid(10, 10), 6).map((cell) => `${key(cell)}=${pickArtifact(table, 'home_farm', cell.x, cell.y, 9) ?? '-'}`);
    expect(today()).toEqual(today());
    expect(today()).toHaveLength(6);
  });
});
