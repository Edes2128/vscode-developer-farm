import type { Season } from '../time/calendar';
import type { Weather } from '../weather/types';

/**
 * Rare creatures (Phase 7): wild animals that are about only in the weather, season and hour their data names, and only
 * on some days. Where they are is **never saved**: it is a pure function of the day and the map (like dig spots), so a reload
 * puts every creature back exactly where it was. Only what the player has seen and befriended is saved (`BestiarySave`).
 * Data lives in `src/data/creatures.ts`.
 */
export interface CreatureDef {
  readonly id: string;
  readonly name: string;
  /** What the journal's bestiary page says about it. */
  readonly description: string;
  /** Atlas stem: the frames are `creature/<sprite>_0` and `creature/<sprite>_1` (a two-picture idle), 16 x 16. */
  readonly sprite: string;
  /** The maps it can be found on (`MapDef.id`). On any given day it is on at most one of them. */
  readonly maps: readonly string[];
  /** The seasons it is about in. */
  readonly seasons: readonly Season[];
  /** The weather it is about in (any of these). */
  readonly weather: readonly Weather[];
  /** Minutes since midnight: about from (inclusive) to (exclusive). */
  readonly from: number;
  readonly to: number;
  /** The chance, from 0 to 1, that it is about at all on a day that otherwise suits it. */
  readonly chance: number;
  /** Items it will take from a hand (`ItemDef.id`): giving it one of these, once it has been seen, makes it a friend. */
  readonly likes: readonly string[];
  /** What it leaves for a friend, once: an item. */
  readonly keepsake: { readonly item: string; readonly count: number };
}

/** Where a creature is on a map today. */
export interface CreaturePlacement {
  readonly creature: string;
  readonly map: string;
  readonly x: number;
  readonly y: number;
}

/** What the player has seen and befriended, as saved. */
export interface BestiarySave {
  readonly seen: readonly string[];
  readonly friends: readonly string[];
}
