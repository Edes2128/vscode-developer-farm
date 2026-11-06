/**
 * Rivals for contests (a fishing contest, a harvest fair). A contest compares the player's score with rivals who are drawn
 * from the contest and the day alone, so the same day always has the same rivals: replaying or reloading cannot reroll them.
 * Pure functions: no `Math.random`, no clock.
 */
import { createRng, hash2 } from '../core/random';

const UINT32 = 4294967296;
/** `hash2` takes two coordinates and a seed; the day goes in beside this fixed number, the contest's name in the seed slot. */
const RIVAL_SALT = 0x71a1;

/** FNV-1a over the id's UTF-16 units: a small stable hash, so a contest's name can seed the dice. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * `count` rival scores for a contest on a day: whole numbers between `min` and `max` inclusive, sorted high to low. They are
 * drawn from the contest id and the day, so another contest or another day gives other rivals and the same ones always give
 * the same rivals. (`count`, `min` and `max` only decide how many are kept and where they land: asking for more rivals
 * keeps the same first draws.) Anything that cannot be a score gives none: a `count` below 1 or not a number, a bound that is
 * not finite, or a range with no whole number in it. `min` and `max` given the wrong way round are swapped.
 */
export function rivalScores(contestId: string, day: number, count: number, min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  // `count >= 1` is false for NaN too, which asks for nothing.
  const wanted = count >= 1 ? Math.floor(count) : 0;
  if (wanted === 0 || low > high) return [];

  // `hash2` alone is a thin mix of a day, so its result seeds a generator that draws every rival from there on.
  const rng = createRng(Math.floor(hash2(day, RIVAL_SALT, hashString(contestId)) * UINT32));
  const span = high - low + 1;
  const scores: number[] = [];
  for (let i = 0; i < wanted; i += 1) scores.push(low + Math.floor(rng() * span));
  return scores.sort((a, b) => b - a);
}

/**
 * The player's place: 1 if they beat every rival, 2 if exactly one rival is strictly better, and so on up to
 * `rivals.length + 1`. A tie with a rival goes to the player. A score that is not a number (nothing handed in) places last.
 */
export function rankOf(score: number, rivals: readonly number[]): number {
  if (Number.isNaN(score)) return rivals.length + 1;
  let better = 0;
  for (const rival of rivals) if (rival > score) better += 1;
  return better + 1;
}

/**
 * Picks the row of a prize table for a rank: rows say "rank 1", "rank 2" and so on, and the row for a place is the one with
 * the greatest `rank` that is not past it. So the LAST row also covers every worse place, and a place the table starts after
 * (a table beginning at rank 2, asked about rank 1) has no row. Undefined too for an empty table and for a rank below 1 or
 * not a number. The table is expected in increasing rank order but is not relied on for it; of two rows with the same
 * rank the first listed wins.
 */
export function prizeFor<T extends { readonly rank: number }>(table: readonly T[], rank: number): T | undefined {
  if (!(rank >= 1)) return undefined;
  let best: T | undefined;
  for (const row of table) {
    if (row.rank <= rank && (best === undefined || row.rank > best.rank)) best = row;
  }
  return best;
}
