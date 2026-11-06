import { describe, expect, it } from 'vitest';
import { generateMineFloor } from '../engine/mine/generator';
import { DEFAULT_FISH_STOCK } from '../engine/game';
import { SEASONS, type Season } from '../engine/time/calendar';
import { SEASON_WEATHER } from '../engine/weather/weather';
import { CONTENT } from './content';

/**
 * The economy as a living table: what a day of farming, fishing or mining is worth, worked out from the data, with guard rails so
 * that a change to one price cannot quietly make one way of earning a living swamp the others. If a rail trips, look at the table
 * (`describe` titles and the numbers in the failure) and change the data, not the rail, unless the rail is what has changed.
 */

const price = (id: string): number => CONTENT.items.find((i) => i.id === id)?.sellPrice ?? 0;
/** A field of forty plants: a good, mid-game farm. */
const FIELD = 40;

/** Gold per plant per day once it is going (a regrowing plant counts its refruiting; anything else, its whole growing time). */
function steadyRate(cropId: string): number {
  const crop = CONTENT.crops.find((c) => c.id === cropId)!;
  const grow = crop.stageDays.reduce((a, b) => a + b, 0);
  const regrow = crop.regrowStage === undefined ? undefined : crop.stageDays.slice(crop.regrowStage).reduce((a, b) => a + b, 0);
  return price(crop.harvest) / (regrow ?? grow);
}

/** What a field of forty earns in a season each day, from the best crop that does not need rain. */
function farmDay(season: Season): number {
  const rates = CONTENT.crops.filter((c) => c.seasons.includes(season) && c.needsRain !== true).map((c) => steadyRate(c.id));
  return rates.length === 0 ? 0 : Math.max(...rates) * FIELD;
}

const rainShare = (season: Season): number => {
  const w = SEASON_WEATHER[season];
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return (w.rain + w.storm) / total;
};

/** What every node of a mine floor is worth if all of it is broken and sold raw. */
function floorValue(floor: number): number {
  let value = 0;
  for (const n of generateMineFloor(floor).nodes ?? []) {
    const node = CONTENT.nodes.find((x) => x.id === n.def)!;
    value += node.drops.reduce((a, d) => a + price(d.item) * ((d.min + d.max) / 2) * d.chance, 0);
  }
  return value;
}

/** What one cast is worth on a kind of water at noon in a season, on average. */
function castValue(water: string, season: Season): number {
  const fish = CONTENT.fish.filter((f) => f.waters.includes(water) && f.seasons.includes(season) && f.from <= 12 * 60 && f.to > 12 * 60);
  const weight = fish.reduce((a, f) => a + f.weight, 0);
  return weight === 0 ? 0 : fish.reduce((a, f) => a + f.weight * price(f.item), 0) / weight;
}

describe('the economy', () => {
  const growing = SEASONS.filter((s) => farmDay(s) > 0);
  const bestFarm = Math.max(...SEASONS.map(farmDay));

  it('pays a field of forty a few hundred gold a day in every season something grows outdoors', () => {
    expect(growing).toEqual(['spring', 'summer', 'autumn']);
    for (const season of growing) {
      expect(farmDay(season), season).toBeGreaterThanOrEqual(300);
      expect(farmDay(season), season).toBeLessThanOrEqual(1000);
    }
  });

  it('gives the rain flower its due without letting it swamp everything: only on rainy nights, and not far above the rest', () => {
    const moon = CONTENT.crops.find((c) => c.id === 'moonbloom')!;
    const days = moon.stageDays.reduce((a, b) => a + b, 0);
    for (const season of moon.seasons) {
      // It grows on rainy nights only: a stage takes as many days as it takes to rain that many times.
      const rate = price(moon.harvest) / (days / rainShare(season));
      // Compared with the best ordinary crop of the whole year: autumn has only the slow ones, which is part of why rain matters then.
      const others = Math.max(...CONTENT.crops.filter((c) => c.needsRain !== true).map((c) => steadyRate(c.id)));
      expect(rate, season).toBeGreaterThan(others * 0.5);
      expect(rate, season).toBeLessThanOrEqual(others * 2.5);
    }
  });

  it('keeps each mine floor to a day\'s farming or twice it, and the whole mine to a dozen days of it', () => {
    let all = 0;
    for (let floor = 1; floor <= 10; floor += 1) {
      const value = floorValue(floor);
      all += value;
      expect(value, `floor ${floor}`).toBeLessThanOrEqual(bestFarm * 2);
      expect(value, `floor ${floor}`).toBeGreaterThan(200);
    }
    expect(all).toBeLessThanOrEqual(bestFarm * 12);
  });

  it('does not let a day at the water beat a day on the farm, however many waters are fished', () => {
    for (const water of ['river', 'pond', 'wood_pond']) {
      for (const season of SEASONS) expect(castValue(water, season) * DEFAULT_FISH_STOCK, `${water} in ${season}`).toBeLessThanOrEqual(bestFarm / 2);
    }
  });

  it('pays for cooking and smelting a little more than the ingredients, never a fortune more', () => {
    for (const recipe of CONTENT.recipes) {
      const output = CONTENT.items.find((i) => i.id === recipe.output.item)!;
      if (output.sellPrice === 0) continue; // furniture and supplies are not sold
      const inputs = recipe.inputs.reduce((sum, i) => sum + price(i.item) * i.count, 0);
      const made = output.sellPrice * recipe.output.count;
      expect(made, recipe.id).toBeGreaterThanOrEqual(inputs * 1.2);
      expect(made, recipe.id).toBeLessThanOrEqual(inputs * 2.5);
    }
  });

  it('prices every seed under what the plant gives back, so a first harvest always pays for the seed', () => {
    for (const crop of CONTENT.crops) {
      const offers = CONTENT.shops.flatMap((s) => s.offers).filter((o) => o.item === crop.seed);
      for (const offer of offers) expect(offer.price / offer.quantity, `${crop.id} at ${offer.price}`).toBeLessThan(price(crop.harvest));
    }
  });

  it('keeps festival prizes to a day or two of farming and any one request to less than a day of it', () => {
    for (const festival of CONTENT.festivals) for (const prize of festival.prizes) expect(prize.money, `${festival.id} rank ${prize.rank}`).toBeLessThanOrEqual(bestFarm * 1.5);
    for (const offer of CONTENT.requests.offers) {
      expect(offer.pay * offer.max, offer.item).toBeLessThanOrEqual(bestFarm);
      // "A little more than the bin pays": a favour is worth doing, but is never a better trade than selling.
      expect(offer.pay, offer.item).toBeLessThanOrEqual(price(offer.item) * 1.5);
    }
  });

  it('costs the greenhouse and the sprinkler about what a few good days earn, not a season', () => {
    const greenhouse = CONTENT.buildings.find((b) => b.id === 'greenhouse')!;
    const materials = greenhouse.cost.items.reduce((sum, i) => sum + price(i.id) * i.count, 0);
    expect(greenhouse.cost.money + materials).toBeLessThanOrEqual(bestFarm * 12);
  });
});
