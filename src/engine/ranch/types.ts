import type { ItemStack } from '../items/types';

/** A kind of farm animal. Data (src/data/animals.ts). */
export interface AnimalDef {
  readonly id: string;
  readonly name: string;
  /** The item it lays or gives each morning, if it was fed the night before. */
  readonly product: string;
  /** The item that feeds it. */
  readonly feed: string;
  readonly price: number;
  /** Names given to new animals, in turn. */
  readonly names: readonly string[];
  /** Atlas stem: `animal/<sprite>_<idle|walk_0|walk_1|peck_0|peck_1>`, drawn facing right. */
  readonly sprite: string;
}

/** An animal, as saved. */
export interface AnimalSave {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly friendship: number;
  /** The last day it was petted and the last day it was fed. */
  readonly pettedDay: number;
  readonly fedDay: number;
}

/** A coop's animals, trough and egg basket, as saved. */
export interface RanchSave {
  readonly animals: readonly AnimalSave[];
  readonly feed: number;
  readonly basket: readonly ItemStack[];
}

/** Where a map keeps animals. Part of `MapDef`. */
export interface RanchConfig {
  /** The cells the animals wander in. */
  readonly yard: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** How many animals the coop holds. */
  readonly capacity: number;
  /** How much feed the trough holds. */
  readonly troughCapacity: number;
}
