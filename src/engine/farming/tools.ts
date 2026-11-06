import type { ItemLookup, ItemStack } from '../items/types';
import type { Season } from '../time/calendar';
import type { GameMap } from '../world/gameMap';
import type { ObjectDef } from '../world/types';
import type { CropLookup, MapFarm } from './farm';

/** How much water the can holds. */
export const CAN_CAPACITY = 24;

export type UseEffect = 'till' | 'water' | 'plant' | 'refill' | 'mine' | 'cast' | 'dig' | 'place' | 'fertilize' | 'befriend';

export type UseFailure =
  | 'not-usable'
  | 'not-tillable'
  | 'already-tilled'
  | 'needs-soil'
  | 'occupied'
  | 'wrong-season'
  | 'no-water'
  | 'already-watered'
  | 'nothing-to-water'
  | 'can-full'
  | 'nothing-to-mine'
  | 'nowhere-to-fish'
  | 'no-decorating'
  | 'no-room'
  | 'already-fertilized'
  | 'no-field'
  | 'needs-rain';

export type UseOutcome =
  | { readonly ok: true; readonly effect: UseEffect }
  | { readonly ok: false; readonly reason: UseFailure; readonly detail?: string };

export interface UseContext {
  readonly map: GameMap;
  readonly farm: MapFarm;
  readonly items: ItemLookup;
  readonly crops: CropLookup;
  readonly season: Season;
  readonly canWater: number;
  /** Looks an object up by id (to place furniture). */
  readonly objects?: (id: string) => ObjectDef | undefined;
  /** Is somebody standing in this cell (the player's own feet, or a villager)? Furniture is never put down on someone. */
  readonly occupied?: (x: number, y: number) => boolean;
  /** The creature standing in this cell, if any, and whether it would take this item from a hand. A creature has to have been seen, and not yet be a friend, to be befriended. */
  readonly creatureAt?: (x: number, y: number) => { readonly seen: boolean; readonly friend: boolean; readonly accepts: (itemId: string) => boolean } | undefined;
}

/**
 * Works out what using an item on a cell would do, without doing it. The game calls it twice: every step to show
 * the green or red cursor, and when the player swings. Keeping the rules in one pure function keeps the two in step.
 */
export function planUse(ctx: UseContext, stack: ItemStack | null, x: number, y: number): UseOutcome {
  if (stack === null) return { ok: false, reason: 'not-usable' };
  const def = ctx.items(stack.id);
  if (def === undefined) return { ok: false, reason: 'not-usable' };
  const { map, farm } = ctx;

  // A creature that has been seen and likes what is in the hand takes it: that comes before anything the item would do to the ground.
  const creature = ctx.creatureAt?.(x, y);
  if (creature !== undefined && creature.seen && !creature.friend && creature.accepts(stack.id)) return { ok: true, effect: 'befriend' };

  if (def.fertilizes === true) {
    const soil = farm.soilAt(x, y);
    if (soil === undefined) return { ok: false, reason: 'needs-soil' };
    return soil.fertilized ? { ok: false, reason: 'already-fertilized' } : { ok: true, effect: 'fertilize' };
  }

  if (def.tool === 'hoe') {
    // A dig spot comes first: the hoe uncovers what is buried there before it works the ground.
    if (map.nodeAt(x, y)?.def.tool === 'hoe') return { ok: true, effect: 'dig' };
    if (farm.isTilled(x, y)) return { ok: false, reason: 'already-tilled' };
    if (!map.isTillable(x, y) || !map.isWalkable(x, y)) return { ok: false, reason: 'not-tillable' };
    return { ok: true, effect: 'till' };
  }

  if (def.tool === 'watering_can') {
    if (map.isWaterSource(x, y)) return ctx.canWater >= CAN_CAPACITY ? { ok: false, reason: 'can-full' } : { ok: true, effect: 'refill' };
    const soil = farm.soilAt(x, y);
    if (soil === undefined) return { ok: false, reason: 'nothing-to-water' };
    if (soil.watered) return { ok: false, reason: 'already-watered' };
    if (ctx.canWater <= 0) return { ok: false, reason: 'no-water' };
    return { ok: true, effect: 'water' };
  }

  if (def.tool === 'pickaxe') {
    return map.nodeAt(x, y)?.def.tool !== 'pickaxe' ? { ok: false, reason: 'nothing-to-mine' } : { ok: true, effect: 'mine' };
  }

  if (def.kind === 'furniture' && def.places !== undefined) {
    const object = ctx.objects?.(def.places);
    if (object === undefined) return { ok: false, reason: 'not-usable' };
    if (object.sprinkles !== undefined) {
      // A sprinkler stands in the field, on bare ground inside a tillable area.
      if (!map.isTillable(x, y) || farm.isTilled(x, y)) return { ok: false, reason: 'no-field' };
    } else if (!map.decorate) return { ok: false, reason: 'no-decorating' };
    const onSomeone = object.footprint.some((c) => c.mode === 'solid' && ctx.occupied?.(x + c.dx, y + c.dy) === true);
    return !onSomeone && map.canPlace(object, x, y) ? { ok: true, effect: 'place' } : { ok: false, reason: 'no-room' };
  }

  if (def.tool === 'fishing_rod') {
    return map.fishingWater(x, y) === undefined ? { ok: false, reason: 'nowhere-to-fish' } : { ok: true, effect: 'cast' };
  }

  if (def.kind === 'seed' && def.plants !== undefined) {
    const crop = ctx.crops(def.plants);
    if (crop === undefined) return { ok: false, reason: 'not-usable' };
    if (!farm.isTilled(x, y)) return { ok: false, reason: 'needs-soil' };
    if (farm.cropAt(x, y) !== undefined) return { ok: false, reason: 'occupied' };
    if (!map.sheltered && !crop.seasons.includes(ctx.season)) return { ok: false, reason: 'wrong-season', detail: crop.name };
    if (crop.needsRain === true && map.sheltered) return { ok: false, reason: 'needs-rain', detail: crop.name };
    return { ok: true, effect: 'plant' };
  }

  return { ok: false, reason: 'not-usable' };
}

/** A short line for the player when something cannot be done. */
export function failureMessage(outcome: Extract<UseOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case 'not-usable':
      return 'You cannot use that here.';
    case 'not-tillable':
      return 'The ground here is too hard to work.';
    case 'already-tilled':
      return 'This soil is already worked.';
    case 'needs-soil':
      return 'Seeds need tilled soil.';
    case 'occupied':
      return 'Something is already growing here.';
    case 'wrong-season':
      return `${outcome.detail ?? 'That'} will not grow in this season.`;
    case 'no-water':
      return 'The watering can is empty. Refill it at the pond or the well.';
    case 'already-watered':
      return 'It has had enough water today.';
    case 'nothing-to-water':
      return 'Nothing to water here.';
    case 'can-full':
      return 'The can is already full.';
    case 'nothing-to-mine':
      return 'There is nothing to break here.';
    case 'nowhere-to-fish':
      return 'You cannot fish here. Look for open water.';
    case 'no-decorating':
      return 'Furniture goes inside the farmhouse.';
    case 'no-room':
      return 'There is no room for that here.';
    case 'already-fertilized':
      return 'This soil is already rich.';
    case 'needs-rain':
      return `${outcome.detail ?? 'That'} only grows where the rain can reach it: plant it in the open.`;
    case 'no-field':
      return 'A sprinkler goes in the field, on bare ground you have not tilled.';
  }
}
