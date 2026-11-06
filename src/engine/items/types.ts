/**
 * Items: everything the player can carry. Definitions are data (src/data/items.ts); what the player actually
 * holds is a list of `ItemStack`s.
 */

/** How well a crop turned out. Better quality sells for more. */
export type Quality = 0 | 1 | 2;

export const QUALITY_NAMES: readonly string[] = ['Normal', 'Good', 'Excellent'];

/** What a sale is multiplied by. */
export const QUALITY_PRICE_MULTIPLIER: readonly number[] = [1, 1.25, 1.5];

export const isQuality = (value: unknown): value is Quality => value === 0 || value === 1 || value === 2;

export type ToolKind = 'hoe' | 'watering_can' | 'pickaxe' | 'fishing_rod';

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * `crop` is anything grown or gathered on the farm to sell or give (an egg counts); `fish` is a catch; `mineral` is ore, coal
   * or a gem from the mine; `artifact` is something dug up; `dish` is cooked food and `material` something made at the workbench
   * (a metal bar); `furniture` is placed in a room; `supply` is something used up (feed). Everything but tools, seeds, supplies and
   * furniture is "goods": it can be shipped, sold to a shop that buys, and given as a gift.
   */
  readonly kind: 'tool' | 'seed' | 'crop' | 'fish' | 'mineral' | 'artifact' | 'dish' | 'material' | 'furniture' | 'supply';
  /** Atlas frame of its 16 x 16 icon. */
  readonly icon: string;
  /** How many fit in one slot. Tools are 1. */
  readonly maxStack: number;
  /** What it sells for in the shipping bin. 0 means it cannot be sold. */
  readonly sellPrice: number;
  readonly tool?: ToolKind;
  /** For seeds: the crop that grows from it (`CropDef.id`). */
  readonly plants?: string;
  /** For furniture: the object (`ObjectDef.id`) that is placed when it is used, and that gives this item back when picked up. */
  readonly places?: string;
  /** For a supply: using it on tilled soil enriches it, so the crop that grows there is more likely to be good (used up when that crop is gone). */
  readonly fertilizes?: boolean;
}

export interface ItemStack {
  readonly id: string;
  readonly count: number;
  readonly quality: Quality;
}

/** Goods are what a player collects to sell or give away: crops, fish and minerals. */
export const isGoods = (def: Pick<ItemDef, 'kind'>): boolean =>
  def.kind === 'crop' || def.kind === 'fish' || def.kind === 'mineral' || def.kind === 'artifact' || def.kind === 'dish' || def.kind === 'material';

export type ItemLookup = (id: string) => ItemDef | undefined;

/** What one item of a stack sells for, quality included. */
export function unitPrice(def: ItemDef, quality: Quality): number {
  return Math.floor(def.sellPrice * (QUALITY_PRICE_MULTIPLIER[quality] ?? 1));
}
