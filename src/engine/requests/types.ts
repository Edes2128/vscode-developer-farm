import type { Season } from '../time/calendar';

/** One kind of thing villagers might ask for. Data lives in src/data/requests.ts. */
export interface RequestOffer {
  /** `ItemDef.id` */
  readonly item: string;
  readonly min: number;
  readonly max: number;
  /** If set, only asked for in these seasons (things that grow or bite only then). */
  readonly seasons?: readonly Season[];
  /** Gold per piece that the request pays. */
  readonly pay: number;
}

/** Who asks, and what for. */
export interface RequestPool {
  /** Villager ids. */
  readonly givers: readonly string[];
  readonly offers: readonly RequestOffer[];
}

/** One request on the notice board today. */
export interface Request {
  /** Stable for a given day and slot: `req:<day>:<slot>`. */
  readonly id: string;
  /** The villager who asks. */
  readonly giver: string;
  readonly item: string;
  readonly count: number;
  /** What it pays (before any friendship bonus). */
  readonly money: number;
}
