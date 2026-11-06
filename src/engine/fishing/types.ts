import type { Season } from '../time/calendar';

/** A fish that can be caught. Data lives in src/data/fish.ts. */
export interface FishDef {
  readonly id: string;
  readonly name: string;
  /** The `ItemDef.id` of what ends up in the pockets. */
  readonly item: string;
  /** The kinds of water it lives in (`FishingZone.water`): "river", "pond", "wood_pond". */
  readonly waters: readonly string[];
  readonly seasons: readonly Season[];
  /** Hours it bites, in minutes on the game clock (6:00 am is 360; after midnight the clock runs on past 1440). */
  readonly from: number;
  readonly to: number;
  /** 1 (easy) to 5 (hard): how fast the marker moves and how narrow the sweet spot is. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  /** How likely it is, relative to the other fish that could bite. */
  readonly weight: number;
}

/** A stretch of water a map allows fishing in. Part of `MapDef`. */
export interface FishingZone {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Which fish live here: matches `FishDef.waters`. */
  readonly water: string;
  /** How many bites the water gives in a day before the fish have had enough (default 6). */
  readonly stock?: number;
}
