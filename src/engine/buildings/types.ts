import type { ExitDef } from '../world/types';

/** A place on a map where a building can be put up. Part of `MapDef`. */
export interface BuildSite {
  readonly id: string;
  /** `BuildingDef.id` */
  readonly building: string;
  /** The anchor cell (bottom-left) of the building's object, where it stands once built (and its scaffolding before). */
  readonly x: number;
  readonly y: number;
}

/** What it costs, and how long the carpenter takes. */
export interface BuildCost {
  readonly money: number;
  readonly items: readonly { readonly id: string; readonly count: number }[];
  /** Whole days from the order: it stands on the morning after this many nights. */
  readonly days: number;
}

/** A building the carpenter can put up on a site. Data lives in src/data/buildings.ts. */
export interface BuildingDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The `ObjectDef` that stands when it is finished, and the one that stands while it is being built. */
  readonly object: string;
  readonly scaffolding: string;
  readonly cost: BuildCost;
  /** The way in, once built: an exit on the map that holds the site, to the building's inside. */
  readonly door: ExitDef;
}

/** What the carpenter has been asked to build, and what is finished, as saved. */
export interface BuildingsSave {
  readonly built: readonly string[];
  readonly pending: readonly { readonly site: string; readonly readyDay: number }[];
}
