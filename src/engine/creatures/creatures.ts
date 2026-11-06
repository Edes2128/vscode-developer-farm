/**
 * Rare creatures: which day each one is about, where it stands, and whether the player sees it. Nothing is stored. A creature's
 * home and its cell are pure functions of the day and the map (like dig spots), so a reload puts every creature back where it
 * was. Whether it is out *right now* (season, weather, hour) is a separate question, so the hour can come and go without the
 * creature ever moving. Pure functions of their arguments: no `Math.random`, no clock.
 */
import { createRng, hash2 } from '../core/random';
import type { Season } from '../time/calendar';
import type { Weather } from '../weather/types';
import type { CreatureDef, CreaturePlacement } from './types';

/** How close the player must be, in cells (straight-line, centre to centre, inclusive), to see a creature. */
export const SEE_RANGE = 3;

const UINT32 = 4294967296;
/** `hash2` takes two coordinates and a seed: the day goes in beside one of these fixed numbers, the creature in the seed slot. */
const HOME_SALT = 0xc4ea;
const PLACE_SALT = 0x91ac;

/** The first morning of the game: a day below 1 or not a number counts as this one (same rule as the weather). */
const FIRST_DAY = 1;

const normalDay = (day: number): number => (Number.isFinite(day) && day >= FIRST_DAY ? Math.floor(day) : FIRST_DAY);

/** FNV-1a over the text's UTF-16 units: a small stable hash, so an id can seed the dice. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 0 to 1; NaN means 0 (never). Infinity is just "more than 1" and so 1. */
const clampChance = (chance: number): number => (Number.isNaN(chance) ? 0 : Math.min(1, Math.max(0, chance)));

/**
 * `hash2` alone is a thin mix, so its result seeds a generator and the draws come from that: the second round of mixing is
 * what scatters neighbouring days, and a day's draws come out in a fixed order (first "is it about", then "where").
 */
const rngFor = (salt: number, day: number, key: string): (() => number) => createRng(Math.floor(hash2(day, salt, hashString(key)) * UINT32));

/**
 * Is the creature out at this moment? The season and the weather must be ones it likes, and the hour must be inside its
 * window: `from` counts, `to` does not (a creature about from 360 to 600 is seen at 599 and gone at 600). The window does not
 * wrap past midnight; a creature with `from >= to` is never out.
 */
export function isAbout(def: CreatureDef, ctx: { readonly season: Season; readonly weather: Weather; readonly minutes: number }): boolean {
  return def.seasons.includes(ctx.season) && def.weather.includes(ctx.weather) && def.from <= ctx.minutes && ctx.minutes < def.to;
}

/**
 * Which of the creature's maps it is on today, or undefined when it is not about at all today. Decided by the creature and the
 * day alone: `chance` is the fraction of days it comes (0 never, 1 always), and on those days each of its maps is as likely as
 * any other. Weather and hour play no part here ({@link isAbout} answers for those): a creature can be "home" on a rainy day
 * and simply not be seen. A day below 1 or not a number counts as day 1.
 */
export function homeOn(def: CreatureDef, day: number): string | undefined {
  if (def.maps.length === 0) return undefined;
  const rng = rngFor(HOME_SALT, normalDay(day), def.id);
  // Both draws are always taken, in this order, so "is it about" and "which map" never depend on each other's outcome.
  const about = rng() < clampChance(def.chance);
  const pick = rng();
  if (!about) return undefined;
  return def.maps[Math.min(def.maps.length - 1, Math.floor(pick * def.maps.length))];
}

export interface PlaceCreaturesInput {
  readonly day: number;
  readonly map: string;
  readonly defs: readonly CreatureDef[];
  /** The cells a creature may stand on, in whatever order the caller has them: a creature picks by index into this list. */
  readonly candidates: readonly { readonly x: number; readonly y: number }[];
  readonly season: Season;
  readonly weather: Weather;
  readonly minutes: number;
}

/**
 * The creatures on this map right now, one placement each, in `defs` order. A creature is placed when this is its home today
 * and it is about at this hour; where it stands depends only on the creature, the day, the map and the candidate list, never on
 * the minutes or the weather, so it stands still while it is about and simply appears and vanishes with the hour.
 *
 * Two creatures never share a cell: when a creature's first cell is taken it walks forward through the candidate list (and
 * wraps round) to the next free one. The taking is settled among every creature whose home today is this map, whether or not
 * it is out yet, so a creature never slides to another cell because a neighbour's hour began or ended. That also means the
 * answer depends on the order of `defs` (earlier ones choose first), which is fixed data. A creature with no free cell, or no
 * candidates at all, is left out.
 */
export function placeCreatures(input: PlaceCreaturesInput): CreaturePlacement[] {
  const { candidates, map } = input;
  if (candidates.length === 0) return [];

  const day = normalDay(input.day);
  const taken = new Set<string>();
  const placed: CreaturePlacement[] = [];

  for (const def of input.defs) {
    if (homeOn(def, day) !== map) continue;

    const start = Math.min(candidates.length - 1, Math.floor(rngFor(PLACE_SALT, day, `${map}\n${def.id}`)() * candidates.length));
    let cell: { readonly x: number; readonly y: number } | undefined;
    for (let step = 0; step < candidates.length; step += 1) {
      const next = candidates[(start + step) % candidates.length];
      // A candidate listed twice is one cell: it is free or taken as a whole.
      if (next !== undefined && !taken.has(`${next.x},${next.y}`)) {
        cell = next;
        break;
      }
    }
    if (cell === undefined) continue;
    taken.add(`${cell.x},${cell.y}`);

    if (isAbout(def, input)) placed.push({ creature: def.id, map, x: cell.x, y: cell.y });
  }
  return placed;
}

/**
 * Does the player see the creature? Cells, not pixels: the player must be within `SEE_RANGE` cells (straight-line between cell
 * centres, so 3 along a row is in and 3 along a diagonal is out) and must not be running, because running always scares it
 * off. Compared as squared distances so a whole number of cells is exact, never a hair over. NaN or infinite positions see nothing.
 */
export function canSee(player: { readonly x: number; readonly y: number }, creature: { readonly x: number; readonly y: number }, running: boolean): boolean {
  if (running) return false;
  const dx = player.x - creature.x;
  const dy = player.y - creature.y;
  return dx * dx + dy * dy <= SEE_RANGE * SEE_RANGE;
}

/** Will it take this from a hand? */
export const acceptsGift = (def: CreatureDef, itemId: string): boolean => def.likes.includes(itemId);
