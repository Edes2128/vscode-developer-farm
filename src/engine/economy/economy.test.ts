import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import { Inventory, INVENTORY_SLOTS, makeStack } from '../inventory/inventory';
import type { ItemDef } from '../items/types';
import { ShippingBin } from './bin';
import { canBuy, offerLabel, offersFor, purchase, quoteSale, sellMultiplier, type ShopHooks } from './shop';

const items = new Map<string, ItemDef>(CONTENT.items.map((item) => [item.id, item]));
const lookup = (id: string): ItemDef | undefined => items.get(id);
const stall = CONTENT.shops[0]!;
const hooks = (over: Partial<ShopHooks> = {}): ShopHooks => ({
  items: lookup,
  animalName: (kind) => (kind === 'chicken' ? 'Chicken' : undefined),
  animalRoom: () => true,
  addAnimal: () => true,
  ...over,
});

describe('ShippingBin', () => {
  it('adds up what is in it, quality included', () => {
    const bin = new ShippingBin();
    bin.add(makeStack('radish', 3));
    bin.add(makeStack('radish', 2, 1));
    bin.add(makeStack('pumpkin', 1, 2));
    expect(bin.total(lookup)).toBe(3 * 40 + 2 * 50 + Math.floor((lookup('pumpkin')?.sellPrice ?? 0) * 1.5)); // an excellent pumpkin sells for half as much again
  });

  it('merges matching stacks and describes each line for the morning report', () => {
    const bin = new ShippingBin();
    bin.add(makeStack('radish', 3));
    bin.add(makeStack('radish', 4));
    expect(bin.items).toHaveLength(1);
    expect(bin.describe(lookup)).toEqual([{ name: 'Radish', count: 7, quality: 0, total: 280 }]);
  });

  it('empties out, and ignores items the game no longer knows when loading', () => {
    const bin = new ShippingBin([makeStack('radish', 1), makeStack('removed', 5)], lookup);
    expect(bin.items).toHaveLength(1);
    bin.clear();
    expect(bin.items).toHaveLength(0);
    expect(bin.total(lookup)).toBe(0);
  });
});

describe('the seed stall', () => {
  it('sells different things in different seasons', () => {
    const spring = offersFor(stall, 'spring').map((o) => o.item);
    const summer = offersFor(stall, 'summer').map((o) => o.item);
    expect(spring).toEqual(['radish_seeds', 'strawberry_seeds', 'chicken_feed', undefined]);
    expect(summer).toEqual(['tomato_seeds', 'sunflower_seeds', 'chicken_feed', undefined]);
    // feed and chickens are for sale all year round
    expect(offersFor(stall, 'winter').map((o) => o.item ?? o.animal)).toEqual(['chicken_feed', 'chicken']);
  });

  it('only sells seeds for crops that can grow in the season they are sold in', () => {
    for (const offer of stall.offers.filter((o) => o.item !== undefined && lookup(o.item)?.kind === 'seed')) {
      const crop = CONTENT.crops.find((c) => c.seed === offer.item);
      expect(crop, offer.item).toBeDefined();
      for (const season of offer.seasons ?? []) expect(crop?.seasons, `${offer.item} in ${season}`).toContain(season);
    }
  });

  it('makes every crop profitable: what it sells for beats what its seed costs', () => {
    for (const offer of stall.offers.filter((o) => o.item !== undefined && lookup(o.item)?.kind === 'seed')) {
      const crop = CONTENT.crops.find((c) => c.seed === offer.item)!;
      const unitCost = offer.price / offer.quantity;
      expect(lookup(crop.harvest)!.sellPrice).toBeGreaterThan(unitCost);
    }
  });

  it('buys: takes the money and hands over the seeds', () => {
    const inventory = new Inventory(lookup);
    const offer = offersFor(stall, 'spring')[0]!;
    const result = purchase(offer, 200, inventory, hooks());
    expect(result).toMatchObject({ ok: true, money: 150 });
    expect(inventory.count('radish_seeds')).toBe(5);
    expect(result.note).toContain('Radish seeds');
  });

  it('refuses when you cannot pay, changing nothing', () => {
    const inventory = new Inventory(lookup);
    const offer = offersFor(stall, 'spring')[0]!;
    const result = purchase(offer, 20, inventory, hooks());
    expect(result).toMatchObject({ ok: false });
    expect(result.note).toContain('30 more gold');
    expect(inventory.count('radish_seeds')).toBe(0);
    expect(canBuy(offer, 20, inventory, hooks())).toBe('poor');
  });

  it('refuses when there is no room, changing nothing', () => {
    const inventory = new Inventory(lookup);
    for (let i = 0; i < INVENTORY_SLOTS; i += 1) inventory.add(makeStack('radish', 99, 0));
    const offer = offersFor(stall, 'spring')[0]!;
    expect(canBuy(offer, 999, inventory, hooks())).toBe('full');
    expect(purchase(offer, 999, inventory, hooks())).toMatchObject({ ok: false, note: 'Your pockets are full.' });
  });

  it('labels offers with name, quantity and price', () => {
    expect(offerLabel(offersFor(stall, 'spring')[0]!, hooks())).toBe('Radish seeds ×5 · 50g');
  });
});

describe('selling to a shopkeeper', () => {
  const radish = lookup('radish')!;
  const stack = makeStack('radish', 5);

  it('pays a price that changes from day to day, differently for each item, but the same for the same day', () => {
    expect(sellMultiplier(stall, 7, 'radish')).toBe(sellMultiplier(stall, 7, 'radish'));
    const days = Array.from({ length: 28 }, (_, i) => sellMultiplier(stall, i + 1, 'radish'));
    expect(new Set(days.map((m) => m.toFixed(3))).size).toBeGreaterThan(20);
    expect(days.some((m, i) => m !== sellMultiplier(stall, i + 1, 'pumpkin'))).toBe(true);
    for (const m of days) {
      expect(m).toBeGreaterThanOrEqual(1 - stall.buys!.variance - 1e-9);
      expect(m).toBeLessThanOrEqual(1 + stall.buys!.variance + 1e-9);
    }
  });

  it('quotes the whole stack with quality, and says how it compares with the usual price', () => {
    const quote = quoteSale(stall, stack, radish, 4)!;
    expect(quote.total).toBe(Math.floor(40 * sellMultiplier(stall, 4, 'radish')) * 5);
    expect(quote.percent).toBe(Math.round((sellMultiplier(stall, 4, 'radish') - 1) * 100));
    const good = quoteSale(stall, makeStack('radish', 1, 2), radish, 4)!;
    expect(good.total).toBe(Math.floor(60 * sellMultiplier(stall, 4, 'radish')));
  });

  it('buys produce only: not tools, seeds or feed, and nothing from a shop that does not buy', () => {
    expect(quoteSale(stall, makeStack('hoe', 1), lookup('hoe'), 1)).toBeUndefined();
    expect(quoteSale(stall, makeStack('radish_seeds', 5), lookup('radish_seeds'), 1)).toBeUndefined();
    expect(quoteSale(stall, makeStack('chicken_feed', 5), lookup('chicken_feed'), 1)).toBeUndefined();
    const { buys: _buys, ...noBuying } = stall;
    expect(quoteSale(noBuying, stack, radish, 1)).toBeUndefined();
    expect(quoteSale(stall, null, radish, 1)).toBeUndefined();
  });

  it('never pays more than the variance allows over the shipping bin price (so the bin stays worth using)', () => {
    for (let day = 1; day <= 112; day += 1) for (const crop of CONTENT.crops) {
      const def = lookup(crop.harvest)!;
      expect(quoteSale(stall, makeStack(def.id, 1), def, day)!.total).toBeLessThanOrEqual(Math.ceil(def.sellPrice * (1 + stall.buys!.variance)));
    }
  });
});

describe('buying an animal', () => {
  const offer = CONTENT.shops[0]!.offers.find((o) => o.animal !== undefined)!;

  it('puts it in the coop and takes the money', () => {
    const added: string[] = [];
    const result = purchase(offer, 300, new Inventory(lookup), hooks({ addAnimal: (k) => (added.push(k), true) }));
    expect(result).toMatchObject({ ok: true, money: 300 - offer.price });
    expect(added).toEqual(['chicken']);
  });

  it('refuses when the coop is full or the money short, changing nothing', () => {
    const added: string[] = [];
    expect(purchase(offer, 300, new Inventory(lookup), hooks({ animalRoom: () => false, addAnimal: (k) => (added.push(k), true) }))).toMatchObject({ ok: false, note: 'The coop is full.' });
    expect(purchase(offer, 5, new Inventory(lookup), hooks())).toMatchObject({ ok: false });
    expect(added).toEqual([]);
  });

  it('labels it by name and price', () => {
    expect(offerLabel(offer, hooks())).toBe(`Chicken · ${offer.price}g`);
  });
});
