/**
 * Digging for artifacts: where the dig spots are on a given day, and what is buried in each. Nothing is stored. The same map
 * on the same day always has the same spots with the same finds (so reloading cannot reroll them), and the next day is a
 * fresh draw. Pure functions of their arguments: no `Math.random`, no clock.
 */
import { createRng, hash2 } from '../core/random';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface ArtifactChance {
  /** `ItemDef.id` */
  readonly item: string;
  /** Relative, not a percentage: 3 is three times as likely as 1. */
  readonly weight: number;
}

const UINT32 = 4294967296;
/** `hash2` takes a cell and a seed; the day goes in as the first coordinate beside this fixed number. */
const DAY_SALT = 0x5eed;

/** FNV-1a over the id's UTF-16 units: a small stable hash, so a map's name can seed the dice. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** One number for this map on this day: a different map or a different day gives a different seed. */
function daySeed(mapId: string, day: number): number {
  return Math.floor(hash2(day, DAY_SALT, hashString(mapId)) * UINT32);
}

/**
 * `count` distinct cells chosen from `candidates` for this map on this day, in a fixed order. The candidates are put in
 * a canonical order (row by row, repeats dropped) before choosing, so the list may come in any order and still give the
 * same answer, and it is never changed. Never more than there are candidates.
 */
export function digSpots(mapId: string, day: number, candidates: readonly Cell[], count: number): Cell[] {
  const pool = [...candidates].sort((a, b) => a.y - b.y || a.x - b.x).filter((cell, i, sorted) => {
    const before = sorted[i - 1];
    return before === undefined || before.x !== cell.x || before.y !== cell.y;
  });
  // `count > 0` is false for NaN too, which asks for nothing.
  const wanted = count > 0 ? Math.min(Math.floor(count), pool.length) : 0;

  // A partial Fisher-Yates shuffle: each step swaps a random cell from the unchosen rest into place, so every cell is as
  // likely as any other to be chosen, and nothing is chosen twice.
  const rng = createRng(daySeed(mapId, day));
  for (let i = 0; i < wanted; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const picked = pool[j];
    const here = pool[i];
    if (picked === undefined || here === undefined) continue;
    pool[i] = picked;
    pool[j] = here;
  }
  return pool.slice(0, wanted).map((cell) => ({ x: cell.x, y: cell.y }));
}

/**
 * What is buried at a cell on a day: a weighted pick that depends only on the table, the cell, the day and the map. Each
 * artifact owns a slice of [0, 1) as wide as its share of the total weight, in table order. Zero, negative and non-finite
 * weights own no slice and are never picked. Undefined when nothing can be picked (an empty table, or no positive weight).
 */
export function pickArtifact(table: readonly ArtifactChance[], mapId: string, x: number, y: number, day: number): string | undefined {
  const weightOf = (entry: ArtifactChance): number => (Number.isFinite(entry.weight) && entry.weight > 0 ? entry.weight : 0);
  let total = 0;
  for (const entry of table) total += weightOf(entry);
  if (total <= 0) return undefined;

  // `hash2` alone is a thin mix of a cell, so its result seeds a generator for a second round of mixing.
  const roll = createRng(Math.floor(hash2(x, y, daySeed(mapId, day)) * UINT32))();
  const target = roll * total;
  let seen = 0;
  let last: string | undefined;
  for (const entry of table) {
    const weight = weightOf(entry);
    if (weight === 0) continue;
    seen += weight;
    last = entry.item;
    if (target < seen) return entry.item;
  }
  // Rounding can leave `target` a hair above the running sum: the last real entry takes the remainder.
  return last;
}
