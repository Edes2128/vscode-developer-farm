import type { Direction } from '../math/coords';
import type { Season } from '../time/calendar';
import type { CellRect } from '../world/types';

export type FestivalActivity =
  /** Painted eggs are hidden on the map for the day: find them. */
  | { readonly kind: 'hunt'; readonly tokens: number }
  /** Whoever catches the most fish that day (at the festival's map) wins. */
  | { readonly kind: 'fishing-contest' }
  /** Hand the judge your best crop or dish. */
  | { readonly kind: 'harvest-fair'; /** An entry scores its sale price (quality included) divided by this, rounded. */ readonly priceStep: number }
  /** An evening of lanterns: talking to villagers counts for more. */
  | { readonly kind: 'lantern-night'; /** Friendship points that a first word with each villager is worth on top of the usual. */ readonly bonus: number };

/** What a festival pays by how well the player did (rank 1 is best); the last row is for everyone else who took part. */
export interface FestivalPrize {
  readonly rank: number;
  readonly money: number;
  readonly items?: readonly { readonly id: string; readonly count: number }[];
  readonly message: string;
}

/** A festival on the calendar. Data lives in src/data/festivals.ts. */
export interface FestivalDef {
  readonly id: string;
  readonly name: string;
  readonly season: Season;
  /** Day of the season, 1 to 28. */
  readonly day: number;
  /** The map it is held on. */
  readonly map: string;
  /** Minutes on the game clock: open from, closed at. */
  readonly from: number;
  readonly to: number;
  /** The villager who runs it. */
  readonly host: string;
  /** Where villagers stand while it is on (cells on the festival's map); anyone not listed follows their usual day. */
  readonly places: readonly { readonly npc: string; readonly x: number; readonly y: number; readonly facing?: Direction }[];
  /** For a hunt: the areas (cells) the painted eggs may be hidden in. */
  readonly huntAreas?: readonly CellRect[];
  /** Things put up on the festival's map while it is open (lanterns), and taken down when it closes. Never saved: the clock decides. */
  readonly decorations?: readonly { readonly object: string; readonly x: number; readonly y: number }[];
  readonly intro: readonly string[];
  /** The rivals the player is ranked against: how many, and the lowest and highest score each can have (drawn from the festival and the day). */
  readonly rivals: { readonly count: number; readonly min: number; readonly max: number };
  readonly activity: FestivalActivity;
  readonly prizes: readonly FestivalPrize[];
}
