import type { Season } from '../time/calendar';

/** One thing for sale: an item, or an animal for the coop (exactly one of `item` and `animal`). */
export interface ShopOffer {
  readonly item?: string;
  readonly animal?: string;
  /** How many come in one purchase (always 1 for an animal). */
  readonly quantity: number;
  readonly price: number;
  /** If set, only for sale in these seasons. */
  readonly seasons?: readonly Season[];
  /** A one-off (a tool): not for sale again while the player already holds one. */
  readonly once?: boolean;
}

/** A shop's goods. */
export interface ShopDef {
  readonly id: string;
  readonly name: string;
  /** The villager who minds it. The shop is open only while they are standing at their post. */
  readonly keeper?: string;
  readonly offers: readonly ShopOffer[];
  /** If set, the keeper also buys produce on the spot, at a price that changes from day to day by up to this fraction. */
  readonly buys?: { readonly variance: number };
}
