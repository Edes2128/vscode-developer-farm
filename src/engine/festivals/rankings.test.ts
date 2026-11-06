import { describe, expect, it } from 'vitest';
import { prizeFor, rankOf, rivalScores } from './rankings';

const isSortedHighToLow = (scores: readonly number[]): boolean => scores.every((score, i) => i === 0 || (scores[i - 1] as number) >= score);

/** How many times each value occurs. */
const tally = (scores: readonly number[]): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const score of scores) counts.set(score, (counts.get(score) ?? 0) + 1);
  return counts;
};

describe('rivalScores', () => {
  it('gives the same rivals for the same contest and day every time', () => {
    const first = rivalScores('fishing_contest', 14, 6, 20, 90);
    expect(rivalScores('fishing_contest', 14, 6, 20, 90)).toEqual(first);
    expect(first).toHaveLength(6);
    // Asking about other contests and days in between changes nothing.
    rivalScores('harvest_fair', 14, 6, 20, 90);
    rivalScores('fishing_contest', 15, 6, 20, 90);
    expect(rivalScores('fishing_contest', 14, 6, 20, 90)).toEqual(first);
  });

  it('gives a new list every time, so a caller can change it freely', () => {
    const first = rivalScores('fishing_contest', 14, 4, 0, 100);
    const copy = [...first];
    first.fill(-1);
    expect(rivalScores('fishing_contest', 14, 4, 0, 100)).toEqual(copy);
  });

  it('gives whole numbers within the bounds, sorted high to low', () => {
    const ranges: [number, number][] = [
      [0, 10],
      [20, 90],
      [1, 2],
      [-50, -10],
      [-5, 5],
      [1000, 1000000],
    ];
    for (const contest of ['fishing_contest', 'harvest_fair', 'egg_hunt', '']) {
      for (let day = 1; day <= 60; day += 1) {
        for (const [min, max] of ranges) {
          const scores = rivalScores(contest, day, 7, min, max);
          expect(scores).toHaveLength(7);
          expect(scores.every((score) => Number.isInteger(score) && score >= min && score <= max)).toBe(true);
          expect(isSortedHighToLow(scores)).toBe(true);
        }
      }
    }
  });

  it('gives different rivals on different days', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 60; day += 1) seen.add(rivalScores('fishing_contest', day, 5, 0, 1000).join());
    expect(seen.size).toBe(60);
  });

  it('gives different rivals for different contests', () => {
    const contests = ['fishing_contest', 'harvest_fair', 'spring_fair', 'summer_fishing', 'autumn_fair', 'winter_fishing', 'a', 'b', ''];
    const seen = new Set(contests.map((id) => rivalScores(id, 9, 5, 0, 1000).join()));
    expect(seen.size).toBe(contests.length);
  });

  it('gives no rivals when none are asked for', () => {
    expect(rivalScores('fishing_contest', 1, 0, 0, 10)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, -3, 0, 10)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, 0.9, 0, 10)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, Number.NaN, 0, 10)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, 0, 5, 5)).toEqual([]);
  });

  it('rounds a fractional count down', () => {
    expect(rivalScores('fishing_contest', 1, 3.9, 0, 10)).toHaveLength(3);
    expect(rivalScores('fishing_contest', 1, 1.2, 0, 10)).toHaveLength(1);
  });

  it('gives one rival and many rivals', () => {
    expect(rivalScores('fishing_contest', 1, 1, 0, 10)).toHaveLength(1);
    expect(rivalScores('fishing_contest', 1, 500, 0, 10)).toHaveLength(500);
  });

  it('gives that one score every time when the range is a single number', () => {
    for (let day = 1; day <= 20; day += 1) {
      expect(rivalScores('fishing_contest', day, 4, 7, 7)).toEqual([7, 7, 7, 7]);
      expect(rivalScores('fishing_contest', day, 2, -3, -3)).toEqual([-3, -3]);
      expect(rivalScores('fishing_contest', day, 3, 0, 0)).toEqual([0, 0, 0]);
    }
  });

  it('uses both ends of a narrow range', () => {
    const seen = new Set<number>();
    for (let day = 1; day <= 40; day += 1) for (const score of rivalScores('fishing_contest', day, 4, 5, 6)) seen.add(score);
    expect(seen).toEqual(new Set([5, 6]));
  });

  it('spreads the rivals evenly over the range', () => {
    // 4000 days of 5 rivals over 1 to 10: each value is 10% of the 20 000 draws (spread about 0.2%), so 1.5% is loose.
    const all: number[] = [];
    for (let day = 1; day <= 4000; day += 1) all.push(...rivalScores('fishing_contest', day, 5, 1, 10));
    const counts = tally(all);
    expect(counts.size).toBe(10);
    for (let value = 1; value <= 10; value += 1) expect(Math.abs((counts.get(value) ?? 0) / all.length - 0.1)).toBeLessThan(0.015);
  });

  it('spreads the best rival over the top of the range, not all at the very top', () => {
    // The best of 5 draws from 0 to 99 averages about 83 (5/6 of the range): well short of the maximum most days.
    let total = 0;
    let atTop = 0;
    const days = 2000;
    for (let day = 1; day <= days; day += 1) {
      const best = rivalScores('fishing_contest', day, 5, 0, 99)[0] as number;
      total += best;
      if (best === 99) atTop += 1;
    }
    expect(total / days).toBeGreaterThan(78);
    expect(total / days).toBeLessThan(88);
    expect(atTop / days).toBeLessThan(0.08);
  });

  it('keeps the same first draws when more rivals are asked for', () => {
    for (let day = 1; day <= 30; day += 1) {
      const few = tally(rivalScores('fishing_contest', day, 3, 0, 100));
      const more = tally(rivalScores('fishing_contest', day, 8, 0, 100));
      for (const [value, times] of few) expect(more.get(value) ?? 0).toBeGreaterThanOrEqual(times);
    }
  });

  it('swaps a range given the wrong way round', () => {
    expect(rivalScores('fishing_contest', 5, 6, 90, 20)).toEqual(rivalScores('fishing_contest', 5, 6, 20, 90));
  });

  it('keeps a fractional range inside it, and gives nothing when no whole number fits', () => {
    for (let day = 1; day <= 40; day += 1) {
      const scores = rivalScores('fishing_contest', day, 5, 1.2, 4.8);
      expect(scores.every((score) => Number.isInteger(score) && score >= 1.2 && score <= 4.8)).toBe(true);
    }
    expect(rivalScores('fishing_contest', 1, 4, 2.2, 2.8)).toEqual([]);
  });

  it('gives nothing for a bound that is not a number', () => {
    expect(rivalScores('fishing_contest', 1, 3, Number.NaN, 10)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, 3, 0, Number.NaN)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, 3, 0, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(rivalScores('fishing_contest', 1, 3, Number.NEGATIVE_INFINITY, 0)).toEqual([]);
  });

  it('works for any contest name, however odd', () => {
    for (const id of ['', ' ', 'Ünïcödé', '🎣', 'x'.repeat(500)]) {
      const scores = rivalScores(id, 3, 4, 0, 50);
      expect(scores).toEqual(rivalScores(id, 3, 4, 0, 50));
      expect(scores.every((score) => score >= 0 && score <= 50)).toBe(true);
    }
  });
});

describe('rankOf', () => {
  it('is 1 with no rivals', () => {
    expect(rankOf(0, [])).toBe(1);
    expect(rankOf(-5, [])).toBe(1);
  });

  it('is 1 for a score above every rival', () => {
    expect(rankOf(91, [90, 70, 40])).toBe(1);
    expect(rankOf(Number.MAX_SAFE_INTEGER, [90, 70, 40])).toBe(1);
  });

  it('is count + 1 for a score below every rival', () => {
    expect(rankOf(39, [90, 70, 40])).toBe(4);
    expect(rankOf(-1, [90, 70, 40])).toBe(4);
    expect(rankOf(0, [5])).toBe(2);
  });

  it('counts the rivals strictly better, for a place in the middle', () => {
    const rivals = [90, 70, 40];
    expect(rankOf(80, rivals)).toBe(2);
    expect(rankOf(71, rivals)).toBe(2);
    expect(rankOf(50, rivals)).toBe(3);
    expect(rankOf(41, rivals)).toBe(3);
  });

  it('gives a tie to the player', () => {
    const rivals = [90, 70, 40];
    expect(rankOf(90, rivals)).toBe(1);
    expect(rankOf(70, rivals)).toBe(2);
    expect(rankOf(40, rivals)).toBe(3);
    // Several rivals on the same score: all tied with the player, none better.
    expect(rankOf(70, [90, 70, 70, 70, 10])).toBe(2);
    expect(rankOf(5, [5, 5, 5])).toBe(1);
    expect(rankOf(4, [5, 5, 5])).toBe(4);
  });

  it('does not need the rivals in order, and leaves them alone', () => {
    const rivals = [40, 90, 70];
    expect(rankOf(80, rivals)).toBe(2);
    expect(rankOf(80, [...rivals].reverse())).toBe(2);
    expect(rivals).toEqual([40, 90, 70]);
  });

  it('works with negative and fractional scores', () => {
    expect(rankOf(-2.5, [-1, -2, -3.5])).toBe(3);
    expect(rankOf(-2, [-1, -2, -3.5])).toBe(2);
    expect(rankOf(0.5, [0.25, 0.75])).toBe(2);
  });

  it('puts a score that is not a number last', () => {
    expect(rankOf(Number.NaN, [90, 70, 40])).toBe(4);
    expect(rankOf(Number.NaN, [])).toBe(1);
  });

  it('always lands between 1 and count + 1 against real rivals, and never moves down as the score goes up', () => {
    for (let day = 1; day <= 30; day += 1) {
      const rivals = rivalScores('fishing_contest', day, 6, 10, 60);
      let previous = rivals.length + 1;
      for (let score = 0; score <= 70; score += 1) {
        const rank = rankOf(score, rivals);
        expect(rank).toBeGreaterThanOrEqual(1);
        expect(rank).toBeLessThanOrEqual(rivals.length + 1);
        expect(rank).toBeLessThanOrEqual(previous);
        previous = rank;
      }
      expect(rankOf(61, rivals)).toBe(1);
      expect(rankOf(9, rivals)).toBe(rivals.length + 1);
    }
  });
});

describe('prizeFor', () => {
  const gold = { rank: 1, money: 500, message: 'First!' };
  const silver = { rank: 2, money: 300, message: 'Second.' };
  const bronze = { rank: 3, money: 150, message: 'Third.' };
  const table = [gold, silver, bronze];

  it('picks the row for each rank in the table', () => {
    expect(prizeFor(table, 1)).toBe(gold);
    expect(prizeFor(table, 2)).toBe(silver);
    expect(prizeFor(table, 3)).toBe(bronze);
  });

  it('lets the last row cover every worse rank', () => {
    expect(prizeFor(table, 4)).toBe(bronze);
    expect(prizeFor(table, 10)).toBe(bronze);
    expect(prizeFor(table, 1_000_000)).toBe(bronze);
    expect(prizeFor(table, Number.POSITIVE_INFINITY)).toBe(bronze);
  });

  it('covers every rank with a table of one row', () => {
    const only = { rank: 1, money: 25, message: 'Thanks for coming.' };
    expect(prizeFor([only], 1)).toBe(only);
    expect(prizeFor([only], 2)).toBe(only);
    expect(prizeFor([only], 99)).toBe(only);
  });

  it('gives nothing for a rank below 1 or one that is not a number', () => {
    expect(prizeFor(table, 0)).toBeUndefined();
    expect(prizeFor(table, -1)).toBeUndefined();
    expect(prizeFor(table, 0.5)).toBeUndefined();
    expect(prizeFor(table, Number.NaN)).toBeUndefined();
    expect(prizeFor(table, Number.NEGATIVE_INFINITY)).toBeUndefined();
  });

  it('gives nothing for an empty table', () => {
    expect(prizeFor([], 1)).toBeUndefined();
    expect(prizeFor([], 5)).toBeUndefined();
    expect(prizeFor([], 0)).toBeUndefined();
  });

  it('takes the row with the greatest rank not past the place when the table has gaps', () => {
    const sparse = [gold, bronze];
    expect(prizeFor(sparse, 1)).toBe(gold);
    expect(prizeFor(sparse, 2)).toBe(gold);
    expect(prizeFor(sparse, 3)).toBe(bronze);
    expect(prizeFor(sparse, 7)).toBe(bronze);
  });

  it('gives nothing for a place the table starts after', () => {
    expect(prizeFor([silver, bronze], 1)).toBeUndefined();
    expect(prizeFor([silver, bronze], 2)).toBe(silver);
  });

  it('floors a fractional rank to the row it has reached', () => {
    expect(prizeFor(table, 2.9)).toBe(silver);
    expect(prizeFor(table, 1.5)).toBe(gold);
  });

  it('does not rely on the order of the rows, and leaves the table alone', () => {
    const shuffled = [bronze, gold, silver];
    expect(prizeFor(shuffled, 1)).toBe(gold);
    expect(prizeFor(shuffled, 2)).toBe(silver);
    expect(prizeFor(shuffled, 9)).toBe(bronze);
    expect(shuffled).toEqual([bronze, gold, silver]);
  });

  it('takes the first listed of two rows with the same rank', () => {
    const twin = { rank: 2, money: 1, message: 'Also second.' };
    expect(prizeFor([gold, silver, twin], 2)).toBe(silver);
    expect(prizeFor([gold, silver, twin], 5)).toBe(silver);
  });

  it('keeps the type of the row it returns', () => {
    const withItems = [{ rank: 1, money: 10, items: [{ id: 'trophy', count: 1 }], message: 'Winner' }];
    expect(prizeFor(withItems, 1)?.items?.[0]?.id).toBe('trophy');
  });

  it('works with a player rank from rankOf against real rivals', () => {
    for (let day = 1; day <= 30; day += 1) {
      const rivals = rivalScores('fishing_contest', day, 5, 0, 100);
      for (let score = 0; score <= 100; score += 10) {
        const prize = prizeFor(table, rankOf(score, rivals));
        expect(prize).toBeDefined();
        expect(prize?.rank).toBe(Math.min(rankOf(score, rivals), 3));
      }
    }
  });
});
