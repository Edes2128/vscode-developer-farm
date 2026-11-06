/**
 * What can bite, and which fish it is. Pure functions over data: the caller (the game) supplies the water, season and
 * clock, and a roll from its own seeded generator, so the same cast always gives the same fish.
 */
import type { Season } from '../time/calendar';
import type { FishDef } from './types';

/**
 * The fish that could bite in this kind of water, in this season, at this time. `minutes` is on the game clock (360 is
 * 6:00 am, and after midnight the clock keeps counting past 1440), the same clock `FishDef.from`/`to` are written in, so a
 * fish that bites "8 pm to 2 am" is simply 1200 to 1560 and needs no wrap-around. `from` is inclusive, `to` exclusive.
 */
export function biting(fish: readonly FishDef[], water: string, season: Season, minutes: number): FishDef[] {
  return fish.filter((f) => f.waters.includes(water) && f.seasons.includes(season) && minutes >= f.from && minutes < f.to);
}

/**
 * A weighted pick: each fish owns a slice of [0, 1) as wide as its share of the total weight, in list order, and `roll`
 * says which slice. Fish with a zero, negative or non-finite weight own no slice and are never chosen. Undefined when
 * nothing can be chosen (an empty list, or no positive weight). A `roll` outside [0, 1) is clamped into it, so a bad roll
 * still gives a fish instead of falling off the end.
 */
export function pickFish(candidates: readonly FishDef[], roll: number): FishDef | undefined {
  const weightOf = (f: FishDef): number => (Number.isFinite(f.weight) && f.weight > 0 ? f.weight : 0);
  let total = 0;
  for (const f of candidates) total += weightOf(f);
  if (total <= 0) return undefined;

  // `!(roll > 0)` also catches NaN. The upper clamp keeps the target strictly below the total.
  const clamped = !(roll > 0) ? 0 : Math.min(roll, 1 - Number.EPSILON / 2);
  const target = clamped * total;
  let seen = 0;
  let last: FishDef | undefined;
  for (const f of candidates) {
    const weight = weightOf(f);
    if (weight === 0) continue;
    seen += weight;
    last = f;
    if (target < seen) return f;
  }
  // Floating-point rounding can leave `target` a hair above the running sum: the last real fish takes the remainder.
  return last;
}
