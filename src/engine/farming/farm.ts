import { hash2 } from '../core/random';
import type { ItemStack, Quality } from '../items/types';
import type { Season } from '../time/calendar';
import { ripeStage, type CropDef, type CropSave, type FarmSave, type SoilSave } from './types';

export type CropLookup = (id: string) => CropDef | undefined;

export interface SoilCell {
  readonly x: number;
  readonly y: number;
  watered: boolean;
  /** Enriched with fertilizer: better harvests, until the crop growing in it is gone. */
  fertilized: boolean;
}

export interface CropInstance {
  readonly x: number;
  readonly y: number;
  readonly crop: string;
  stage: number;
  daysInStage: number;
  readonly planted: number;
}

/**
 * The worked soil and growing crops of one map. It holds state and the simple rules that keep it consistent
 * (a crop only grows in tilled soil); the rules of *using* tools and seeds live in `planUse`.
 * `version` goes up on every change, so the renderer redraws only when something happened.
 */
export class MapFarm {
  readonly soil = new Map<number, SoilCell>();
  readonly crops = new Map<number, CropInstance>();
  version = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  private key(x: number, y: number): number {
    return y * this.width + x;
  }

  private inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isTilled(x: number, y: number): boolean {
    return this.soil.has(this.key(x, y));
  }

  soilAt(x: number, y: number): SoilCell | undefined {
    return this.soil.get(this.key(x, y));
  }

  cropAt(x: number, y: number): CropInstance | undefined {
    return this.crops.get(this.key(x, y));
  }

  till(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || this.isTilled(x, y)) return false;
    this.soil.set(this.key(x, y), { x, y, watered: false, fertilized: false });
    this.version += 1;
    return true;
  }

  /** Enriches tilled soil. False if there is no soil or it is already enriched. */
  fertilize(x: number, y: number): boolean {
    const cell = this.soilAt(x, y);
    if (cell === undefined || cell.fertilized) return false;
    cell.fertilized = true;
    this.version += 1;
    return true;
  }

  /** A sprinkler's reach: waters every tilled cell within `radius` cells of (x, y) (the cell itself too). Returns how many were dry before. */
  waterAround(x: number, y: number, radius: number): number {
    let watered = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (this.inBounds(x + dx, y + dy) && this.water(x + dx, y + dy)) watered += 1;
      }
    }
    return watered;
  }

  /** Waters tilled soil. Returns false if there is no soil, or it is already wet. */
  water(x: number, y: number): boolean {
    const cell = this.soilAt(x, y);
    if (cell === undefined || cell.watered) return false;
    cell.watered = true;
    this.version += 1;
    return true;
  }

  /** Plants a crop in tilled, empty soil. */
  plant(x: number, y: number, crop: string, day: number): boolean {
    if (!this.isTilled(x, y) || this.crops.has(this.key(x, y))) return false;
    this.crops.set(this.key(x, y), { x, y, crop, stage: 0, daysInStage: 0, planted: day });
    this.version += 1;
    return true;
  }

  /** Takes a crop out of the ground (picked for the last time, or withered). The fertilizer was for that crop, so it goes with it. */
  removeCrop(x: number, y: number): void {
    if (!this.crops.delete(this.key(x, y))) return;
    const soil = this.soilAt(x, y);
    if (soil !== undefined) soil.fertilized = false;
    this.version += 1;
  }

  /** Rain: every tilled cell is wet. */
  waterAll(): void {
    for (const cell of this.soil.values()) cell.watered = true;
    this.touch();
  }

  /** Every morning the soil is dry again. */
  dryAll(): void {
    let changed = false;
    for (const cell of this.soil.values()) {
      if (cell.watered) {
        cell.watered = false;
        changed = true;
      }
    }
    if (changed) this.version += 1;
  }

  /** Marks something as changed from outside (a crop's stage moved on). */
  touch(): void {
    this.version += 1;
  }

  toSave(): FarmSave {
    return {
      soil: [...this.soil.values()].map((c): SoilSave => ({ x: c.x, y: c.y, watered: c.watered, ...(c.fertilized ? { fertilized: true } : {}) })),
      crops: [...this.crops.values()].map((c): CropSave => ({ ...c })),
    };
  }

  /** Rebuilds a farm from a save. Anything that no longer makes sense (off the map, an unknown crop) is dropped. */
  static fromSave(width: number, height: number, save: FarmSave | undefined, crops: CropLookup): MapFarm {
    const farm = new MapFarm(width, height);
    for (const cell of save?.soil ?? []) if (farm.inBounds(cell.x, cell.y)) farm.soil.set(farm.key(cell.x, cell.y), { x: cell.x, y: cell.y, watered: cell.watered === true, fertilized: cell.fertilized === true });
    for (const crop of save?.crops ?? []) {
      const def = crops(crop.crop);
      if (def === undefined || !farm.inBounds(crop.x, crop.y) || !farm.isTilled(crop.x, crop.y)) continue;
      const stage = Math.min(Math.max(0, Math.floor(crop.stage)), ripeStage(def));
      const days = Math.max(0, Math.floor(crop.daysInStage));
      farm.crops.set(farm.key(crop.x, crop.y), { x: crop.x, y: crop.y, crop: crop.crop, stage, daysInStage: stage >= ripeStage(def) ? 0 : Math.min(days, (def.stageDays[stage] ?? 1) - 1), planted: crop.planted });
    }
    return farm;
  }
}

export const isRipe = (def: CropDef, crop: CropInstance): boolean => crop.stage >= ripeStage(def);

export interface GrowthReport {
  /** Crops that grew a day. */
  readonly grown: number;
  /** Crops that withered because their season ended. */
  readonly withered: number;
  /** Crops that are ripe now (including ones that were already). */
  readonly ripe: number;
}

/**
 * A night passes. Watered crops grow a day; crops whose season has ended wither; the soil dries out.
 * Growth is counted in watered days, never in real time, so it is the same on any machine and easy to test.
 */
/** `sheltered` farms (a greenhouse) ignore the seasons: nothing withers when one ends. */
/** `rained` says whether it rained (or stormed) in the night: crops that need rain grow only then. */
export function advanceFarm(farm: MapFarm, lookup: CropLookup, newSeason: Season, sheltered = false, rained = false): GrowthReport {
  let grown = 0;
  let withered = 0;
  let ripe = 0;
  for (const [key, crop] of [...farm.crops]) {
    const def = lookup(crop.crop);
    if (def === undefined || (!sheltered && !def.seasons.includes(newSeason))) {
      farm.removeCrop(crop.x, crop.y); // and the fertilizer that was for it
      withered += 1;
      continue;
    }
    if (!isRipe(def, crop) && farm.soil.get(key)?.watered === true && (def.needsRain !== true || (rained && !sheltered))) {
      crop.daysInStage += 1;
      grown += 1;
      if (crop.daysInStage >= (def.stageDays[crop.stage] ?? 1)) {
        crop.stage += 1;
        crop.daysInStage = 0;
      }
    }
    if (isRipe(def, crop)) ripe += 1;
  }
  farm.dryAll();
  farm.touch();
  return { grown, withered, ripe };
}

/** Chance of a good harvest (before luck) and of an excellent one. */
export const GOOD_CHANCE = 0.1;
export const EXCELLENT_CHANCE = 0.02;
/** What fertilized soil adds to the luck of a harvest: a good one four times in ten instead of one in ten. */
export const FERTILIZER_LUCK = 0.3;

/** Quality of a harvest. Decided by where and when, not by a random number generator, so it never needs saving. */
export function rollQuality(x: number, y: number, day: number, luck = 0): Quality {
  const roll = hash2(x, y, day * 7 + 13);
  if (roll < EXCELLENT_CHANCE + luck / 4) return 2;
  if (roll < GOOD_CHANCE + luck) return 1;
  return 0;
}

/** What picking a ripe crop would give. Does not change anything. */
export function harvestStack(def: CropDef, crop: CropInstance, day: number, fertilized = false): ItemStack {
  return { id: def.harvest, count: 1, quality: rollQuality(crop.x, crop.y, day, fertilized ? FERTILIZER_LUCK : 0) };
}

/** Picks a ripe crop: a plant that regrows goes back to an earlier stage, any other leaves bare soil. */
export function completeHarvest(farm: MapFarm, def: CropDef, crop: CropInstance): void {
  if (def.regrowStage !== undefined) {
    crop.stage = def.regrowStage;
    crop.daysInStage = 0;
    farm.touch();
  } else {
    farm.removeCrop(crop.x, crop.y);
  }
}
