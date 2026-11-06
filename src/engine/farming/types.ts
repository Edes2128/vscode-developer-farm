import type { Season } from '../time/calendar';

/**
 * A crop: how it grows, when it can be planted, and what it gives. Definitions are data (src/data/crops.ts).
 *
 * A crop grows in `stageDays.length` stages, each lasting that many *watered* days, and is ripe after the last.
 * `frames` has one picture per stage plus one for ripe, so it is one longer than `stageDays`.
 */
export interface CropDef {
  readonly id: string;
  readonly name: string;
  /** Seasons it can be planted in, and survive. Crops still in the ground when the season turns wither. */
  readonly seasons: readonly Season[];
  /** The seed item that plants it. */
  readonly seed: string;
  /** The item it gives when picked. */
  readonly harvest: string;
  /** How many watered days each growing stage lasts. */
  readonly stageDays: readonly number[];
  /** Atlas frames: one per stage, then ripe. */
  readonly frames: readonly string[];
  /** If set, picking does not end the plant: it goes back to this growing stage and ripens again after the days left in it. */
  readonly regrowStage?: number;
  /** If true it grows only on nights that it rained (or stormed): watering by hand or by sprinkler is not enough, and a glass house never rains. */
  readonly needsRain?: boolean;
}

export const totalGrowDays = (crop: CropDef): number => crop.stageDays.reduce((sum, days) => sum + days, 0);

export const ripeStage = (crop: CropDef): number => crop.stageDays.length;

/** Watered days a regrowing crop needs between one harvest and the next. */
export const regrowDays = (crop: CropDef): number | undefined =>
  crop.regrowStage === undefined ? undefined : crop.stageDays.slice(crop.regrowStage).reduce((sum, days) => sum + days, 0);

/** A tilled cell, as saved. `watered` resets every morning. */
export interface SoilSave {
  readonly x: number;
  readonly y: number;
  readonly watered: boolean;
  /** Enriched with fertilizer. Left out when it is not. */
  readonly fertilized?: boolean;
}

/** A planted crop, as saved. */
export interface CropSave {
  readonly x: number;
  readonly y: number;
  readonly crop: string;
  /** Index into the crop's growing stages; the ripe stage means ready to pick. */
  readonly stage: number;
  /** Watered days already spent in this stage. */
  readonly daysInStage: number;
  /** The day it was planted. */
  readonly planted: number;
}

/** The worked soil and growing crops of one map, as saved. */
export interface FarmSave {
  readonly soil: readonly SoilSave[];
  readonly crops: readonly CropSave[];
}
