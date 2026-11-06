import { hash2 } from '../core/random';
import type { Inventory } from '../inventory/inventory';
import { isGoods, unitPrice, type ItemDef, type ItemLookup, type ItemStack } from '../items/types';
import type { Season } from '../time/calendar';
import type { ShopDef, ShopOffer } from './types';

/** The offers on sale this season. */
export const offersFor = (shop: ShopDef, season: Season): ShopOffer[] =>
  shop.offers.filter((offer) => offer.seasons === undefined || offer.seasons.includes(season));

/** What a shop needs to know about the rest of the farm to sell things that are not items. */
export interface ShopHooks {
  items: ItemLookup;
  /** The display name of an animal kind. */
  animalName(kind: string): string | undefined;
  /** Is there room in the coop for one more? */
  animalRoom(kind: string): boolean;
  /** Puts a new animal in the coop. Returns false if it could not. */
  addAnimal(kind: string): boolean;
}

export type PurchaseResult =
  | { readonly ok: true; readonly money: number; readonly note: string }
  | { readonly ok: false; readonly note: string };

/** Whether an offer could be bought right now, and why not if it could not. */
export function canBuy(offer: ShopOffer, money: number, inventory: Inventory, hooks: Pick<ShopHooks, 'animalRoom'>): 'ok' | 'poor' | 'full' | 'owned' {
  if (offer.once === true && offer.item !== undefined && inventory.count(offer.item) > 0) return 'owned';
  if (money < offer.price) return 'poor';
  if (offer.animal !== undefined) return hooks.animalRoom(offer.animal) ? 'ok' : 'full';
  return inventory.canAdd({ id: offer.item as string, count: offer.quantity, quality: 0 }) ? 'ok' : 'full';
}

/** Buys one offer. Nothing changes unless the whole purchase works. */
export function purchase(offer: ShopOffer, money: number, inventory: Inventory, hooks: ShopHooks): PurchaseResult {
  const check = canBuy(offer, money, inventory, hooks);
  if (check === 'owned') return { ok: false, note: 'You already have one.' };
  if (check === 'poor') return { ok: false, note: `You need ${offer.price - money} more gold for that.` };

  if (offer.animal !== undefined) {
    const name = hooks.animalName(offer.animal);
    if (name === undefined) return { ok: false, note: 'That is not for sale any more.' };
    if (check === 'full') return { ok: false, note: 'The coop is full.' };
    if (!hooks.addAnimal(offer.animal)) return { ok: false, note: 'The coop is full.' };
    return { ok: true, money: money - offer.price, note: `You bought a ${name.toLowerCase()} for ${offer.price}g. It is waiting in the coop.` };
  }

  const def = offer.item === undefined ? undefined : hooks.items(offer.item);
  if (def === undefined) return { ok: false, note: 'That is not for sale any more.' };
  if (check === 'full') return { ok: false, note: 'Your pockets are full.' };
  inventory.add({ id: def.id, count: offer.quantity, quality: 0 });
  const what = offer.quantity > 1 ? `${offer.quantity} ${def.name}` : def.name;
  return { ok: true, money: money - offer.price, note: `Bought ${what} for ${offer.price}g.` };
}

/** How an offer reads in the menu: "Radish seeds ×5 · 60g". */
export function offerLabel(offer: ShopOffer, hooks: Pick<ShopHooks, 'items' | 'animalName'>, owned = false): string {
  const name = offer.animal !== undefined ? (hooks.animalName(offer.animal) ?? offer.animal) : (hooks.items(offer.item as string)?.name ?? offer.item);
  return owned ? `${name} · yours already` : `${name}${offer.quantity > 1 ? ` ×${offer.quantity}` : ''} · ${offer.price}g`;
}

// ------------------------------------------------------------------------------------------ selling

const itemSeed = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 100_003;
};

/**
 * What a keeper pays today for an item, as a multiple of the usual price. It changes from day to day, differently for
 * every item, by up to `variance` either way. Decided by the day and the item, so it never needs saving.
 */
export function sellMultiplier(shop: ShopDef, day: number, itemId: string): number {
  const variance = shop.buys?.variance ?? 0;
  return 1 - variance + 2 * variance * hash2(day, itemSeed(itemId), 41);
}

export interface SaleQuote {
  /** Gold for the whole stack. */
  readonly total: number;
  /** How today's price compares with the usual, in whole percent (+8, -12). */
  readonly percent: number;
}

/** What the keeper would pay for a stack right now, or undefined if they do not buy that. */
export function quoteSale(shop: ShopDef, stack: ItemStack | null, def: ItemDef | undefined, day: number): SaleQuote | undefined {
  if (shop.buys === undefined || stack === null || def === undefined) return undefined;
  if (!isGoods(def) || def.sellPrice <= 0) return undefined;
  const multiplier = sellMultiplier(shop, day, def.id);
  return { total: Math.floor(unitPrice(def, stack.quality) * multiplier) * stack.count, percent: Math.round((multiplier - 1) * 100) };
}
