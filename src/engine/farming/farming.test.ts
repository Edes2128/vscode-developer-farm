import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import type { ItemDef } from '../items/types';
import { makeMap, makeWorld } from '../testing';
import { advanceFarm, completeHarvest, EXCELLENT_CHANCE, GOOD_CHANCE, harvestStack, isRipe, MapFarm, rollQuality } from './farm';
import { CAN_CAPACITY, failureMessage, planUse, type UseContext } from './tools';
import { regrowDays, ripeStage, totalGrowDays, type CropDef } from './types';

const crops = new Map<string, CropDef>(CONTENT.crops.map((c) => [c.id, c]));
const cropOf = (id: string): CropDef => crops.get(id) as CropDef;
const lookup = (id: string): CropDef | undefined => crops.get(id);

/** A small meadow with a workable field in the middle and a pond. */
const meadow = () =>
  makeWorld(
    makeMap(
      ['..........', '..........', '..........', '..........', '.......~~.', '.......~~.'],
      [],
      { tillable: [{ x: 1, y: 1, w: 4, h: 3 }], spawn: { x: 0, y: 0, facing: 'down' } },
    ),
  ).map('test.map');

describe('crop data', () => {
  it('describes how long each crop takes', () => {
    expect(totalGrowDays(cropOf('radish'))).toBe(6);
    expect(ripeStage(cropOf('radish'))).toBe(3);
    expect(regrowDays(cropOf('strawberry'))).toBe(4);
    expect(regrowDays(cropOf('radish'))).toBeUndefined();
  });
});

describe('MapFarm', () => {
  it('tills once, waters once, and plants only into empty tilled soil', () => {
    const farm = new MapFarm(10, 10);
    expect(farm.plant(2, 2, 'radish', 1)).toBe(false); // not tilled
    expect(farm.till(2, 2)).toBe(true);
    expect(farm.till(2, 2)).toBe(false);
    expect(farm.water(3, 3)).toBe(false); // nothing there
    expect(farm.water(2, 2)).toBe(true);
    expect(farm.water(2, 2)).toBe(false);
    expect(farm.plant(2, 2, 'radish', 1)).toBe(true);
    expect(farm.plant(2, 2, 'radish', 1)).toBe(false);
  });

  it('refuses cells off the map', () => {
    const farm = new MapFarm(4, 4);
    for (const [x, y] of [[-1, 0], [0, -1], [4, 0], [0, 4], [1.5, 1]]) expect(farm.till(x as number, y as number)).toBe(false);
  });

  it('counts a change every time something happens, and not otherwise', () => {
    const farm = new MapFarm(10, 10);
    const v0 = farm.version;
    farm.till(1, 1);
    expect(farm.version).toBeGreaterThan(v0);
    const v1 = farm.version;
    farm.till(1, 1);
    expect(farm.version).toBe(v1);
  });

  it('dries every cell each morning', () => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.till(2, 2);
    farm.water(1, 1);
    farm.dryAll();
    expect([...farm.soil.values()].every((c) => !c.watered)).toBe(true);
  });
});

describe('growing', () => {
  const planted = (id: string, watered: boolean): { farm: MapFarm; def: CropDef } => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.plant(1, 1, id, 1);
    if (watered) farm.water(1, 1);
    return { farm, def: cropOf(id) };
  };

  it('grows a day for every watered night, and not for a dry one', () => {
    const { farm, def } = planted('radish', true);
    expect(advanceFarm(farm, lookup, 'spring')).toMatchObject({ grown: 1, withered: 0, ripe: 0 });
    expect(farm.cropAt(1, 1)).toMatchObject({ stage: 0, daysInStage: 1 });
    // the soil is dry again now, so a night without watering changes nothing
    expect(advanceFarm(farm, lookup, 'spring')).toMatchObject({ grown: 0 });
    expect(farm.cropAt(1, 1)).toMatchObject({ stage: 0, daysInStage: 1 });
    expect(def.stageDays[0]).toBe(2);
  });

  it('moves on to the next stage when a stage is done, and ripens after the last', () => {
    const { farm, def } = planted('radish', false);
    const stages: number[] = [];
    for (let night = 0; night < totalGrowDays(def); night += 1) {
      farm.water(1, 1);
      advanceFarm(farm, lookup, 'spring');
      stages.push(farm.cropAt(1, 1)?.stage ?? -1);
    }
    expect(stages).toEqual([0, 1, 1, 2, 2, 3]);
    expect(isRipe(def, farm.cropAt(1, 1)!)).toBe(true);
  });

  it('stops growing once ripe, and reports it as ready', () => {
    const { farm, def } = planted('radish', false);
    for (let night = 0; night < 10; night += 1) {
      farm.water(1, 1);
      advanceFarm(farm, lookup, 'spring');
    }
    expect(farm.cropAt(1, 1)).toMatchObject({ stage: ripeStage(def), daysInStage: 0 });
    farm.water(1, 1);
    expect(advanceFarm(farm, lookup, 'spring')).toMatchObject({ grown: 0, ripe: 1 });
  });

  it('withers a crop when its season ends, ripe or not', () => {
    const { farm } = planted('radish', true);
    expect(advanceFarm(farm, lookup, 'summer')).toMatchObject({ withered: 1, grown: 0 });
    expect(farm.cropAt(1, 1)).toBeUndefined();
    expect(farm.isTilled(1, 1)).toBe(true); // the soil stays worked
  });

  it('lets a crop that likes two seasons carry over', () => {
    const { farm } = planted('sunflower', true);
    expect(advanceFarm(farm, lookup, 'summer').withered).toBe(0);
    farm.water(1, 1);
    expect(advanceFarm(farm, lookup, 'autumn').withered).toBe(0);
    expect(advanceFarm(farm, lookup, 'winter').withered).toBe(1);
  });

  it('removes a crop it no longer knows', () => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.plant(1, 1, 'gone', 1);
    expect(advanceFarm(farm, lookup, 'spring').withered).toBe(1);
  });
});

describe('harvesting', () => {
  const ripeFarm = (id: string): { farm: MapFarm; def: CropDef } => {
    const farm = new MapFarm(10, 10);
    const def = cropOf(id);
    farm.till(1, 1);
    farm.plant(1, 1, id, 1);
    for (let night = 0; night < totalGrowDays(def); night += 1) {
      farm.water(1, 1);
      advanceFarm(farm, lookup, def.seasons[0]!);
    }
    return { farm, def };
  };

  it('gives the crop and clears a single-harvest plant', () => {
    const { farm, def } = ripeFarm('radish');
    const crop = farm.cropAt(1, 1)!;
    expect(harvestStack(def, crop, 5)).toMatchObject({ id: 'radish', count: 1 });
    completeHarvest(farm, def, crop);
    expect(farm.cropAt(1, 1)).toBeUndefined();
    expect(farm.isTilled(1, 1)).toBe(true);
  });

  it('sends a regrowing plant back to an earlier stage and ripens it again after the days left in it', () => {
    const { farm, def } = ripeFarm('strawberry');
    completeHarvest(farm, def, farm.cropAt(1, 1)!);
    expect(farm.cropAt(1, 1)).toMatchObject({ stage: def.regrowStage, daysInStage: 0 });
    expect(isRipe(def, farm.cropAt(1, 1)!)).toBe(false);
    let nights = 0;
    while (!isRipe(def, farm.cropAt(1, 1)!) && nights < 20) {
      farm.water(1, 1);
      advanceFarm(farm, lookup, 'spring');
      nights += 1;
    }
    expect(nights).toBe(regrowDays(def));
  });
});

describe('quality', () => {
  it('is decided by place and day, so it never needs saving', () => {
    expect(rollQuality(4, 9, 12)).toBe(rollQuality(4, 9, 12));
  });

  it('gives mostly ordinary harvests with some good ones and a few excellent ones', () => {
    const counts = [0, 0, 0];
    const total = 20000;
    for (let i = 0; i < total; i += 1) {
      const quality = rollQuality(i % 97, Math.floor(i / 97), 1 + (i % 28));
      counts[quality] = (counts[quality] ?? 0) + 1;
    }
    expect(counts[2]! / total).toBeGreaterThan(EXCELLENT_CHANCE * 0.6);
    expect(counts[2]! / total).toBeLessThan(EXCELLENT_CHANCE * 1.6);
    expect(counts[1]! / total).toBeGreaterThan((GOOD_CHANCE - EXCELLENT_CHANCE) * 0.8);
    expect(counts[1]! / total).toBeLessThan((GOOD_CHANCE - EXCELLENT_CHANCE) * 1.25);
    expect(counts[0]).toBeGreaterThan(total * 0.8);
  });

  it('lets later systems add luck', () => {
    let better = 0;
    for (let i = 0; i < 2000; i += 1) if (rollQuality(i, 3, 5, 0.2) > rollQuality(i, 3, 5, 0)) better += 1;
    expect(better).toBeGreaterThan(100);
  });
});

describe('saving a farm', () => {
  it('round-trips soil and crops', () => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.till(2, 1);
    farm.plant(1, 1, 'strawberry', 3);
    farm.water(2, 1);
    const copy = MapFarm.fromSave(10, 10, farm.toSave(), lookup);
    expect(copy.toSave()).toEqual(farm.toSave());
  });

  it('drops what no longer makes sense: unknown crops, cells off the map, crops with no soil', () => {
    const copy = MapFarm.fromSave(
      4,
      4,
      {
        soil: [{ x: 1, y: 1, watered: false }, { x: 9, y: 9, watered: false }],
        crops: [
          { x: 1, y: 1, crop: 'radish', stage: 0, daysInStage: 0, planted: 1 },
          { x: 1, y: 1, crop: 'unknown', stage: 0, daysInStage: 0, planted: 1 },
          { x: 2, y: 2, crop: 'radish', stage: 0, daysInStage: 0, planted: 1 },
        ],
      },
      lookup,
    );
    expect(copy.soil.size).toBe(1);
    expect(copy.crops.size).toBe(1);
  });

  it('clamps a stage or day count that is too big for the crop', () => {
    const copy = MapFarm.fromSave(
      4,
      4,
      { soil: [{ x: 1, y: 1, watered: false }], crops: [{ x: 1, y: 1, crop: 'radish', stage: 40, daysInStage: 99, planted: 1 }] },
      lookup,
    );
    expect(copy.cropAt(1, 1)).toMatchObject({ stage: 3, daysInStage: 0 });
  });
});

describe('using tools and seeds', () => {
  const items = new Map<string, ItemDef>(CONTENT.items.map((i) => [i.id, i]));
  const stack = (id: string) => ({ id, count: 1, quality: 0 as const });

  const context = (overrides: Partial<UseContext> = {}): UseContext => {
    const map = meadow();
    return { map, farm: new MapFarm(map.width, map.height), items: (id) => items.get(id), crops: lookup, season: 'spring', canWater: CAN_CAPACITY, ...overrides };
  };
  const outcome = (ctx: UseContext, id: string, x: number, y: number) => planUse(ctx, stack(id), x, y);

  it('tills only workable ground that is free', () => {
    const ctx = context();
    expect(outcome(ctx, 'hoe', 2, 2)).toEqual({ ok: true, effect: 'till' });
    expect(outcome(ctx, 'hoe', 8, 1)).toMatchObject({ ok: false, reason: 'not-tillable' }); // grass, but outside the field
    expect(outcome(ctx, 'hoe', 7, 4)).toMatchObject({ ok: false, reason: 'not-tillable' }); // water
    ctx.farm.till(2, 2);
    expect(outcome(ctx, 'hoe', 2, 2)).toMatchObject({ ok: false, reason: 'already-tilled' });
  });

  it('plants seeds in tilled, empty, in-season soil only', () => {
    const ctx = context();
    expect(outcome(ctx, 'radish_seeds', 2, 2)).toMatchObject({ ok: false, reason: 'needs-soil' });
    ctx.farm.till(2, 2);
    expect(outcome(ctx, 'radish_seeds', 2, 2)).toEqual({ ok: true, effect: 'plant' });
    expect(outcome(ctx, 'tomato_seeds', 2, 2)).toMatchObject({ ok: false, reason: 'wrong-season', detail: 'Tomato' });
    expect(outcome(context({ season: 'summer', farm: ctx.farm }), 'tomato_seeds', 2, 2)).toEqual({ ok: true, effect: 'plant' });
    ctx.farm.plant(2, 2, 'radish', 1);
    expect(outcome(ctx, 'radish_seeds', 2, 2)).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('waters tilled soil, spending water, and refills from water', () => {
    const ctx = context({ canWater: 3 });
    expect(outcome(ctx, 'watering_can', 2, 2)).toMatchObject({ ok: false, reason: 'nothing-to-water' });
    ctx.farm.till(2, 2);
    expect(outcome(ctx, 'watering_can', 2, 2)).toEqual({ ok: true, effect: 'water' });
    ctx.farm.water(2, 2);
    expect(outcome(ctx, 'watering_can', 2, 2)).toMatchObject({ ok: false, reason: 'already-watered' });
    ctx.farm.till(3, 2);
    expect(outcome({ ...ctx, canWater: 0 }, 'watering_can', 3, 2)).toMatchObject({ ok: false, reason: 'no-water' });
    expect(outcome(ctx, 'watering_can', 7, 4)).toEqual({ ok: true, effect: 'refill' });
    expect(outcome({ ...ctx, canWater: CAN_CAPACITY }, 'watering_can', 7, 4)).toMatchObject({ ok: false, reason: 'can-full' });
  });

  it('does nothing with an empty hand or with produce', () => {
    const ctx = context();
    expect(planUse(ctx, null, 2, 2)).toMatchObject({ ok: false });
    expect(outcome(ctx, 'radish', 2, 2)).toMatchObject({ ok: false, reason: 'not-usable' });
    expect(outcome(ctx, 'unknown_thing', 2, 2)).toMatchObject({ ok: false });
  });

  it('has a plain-language message for every way it can fail', () => {
    for (const reason of ['not-usable', 'not-tillable', 'already-tilled', 'needs-soil', 'occupied', 'wrong-season', 'no-water', 'already-watered', 'nothing-to-water', 'can-full'] as const) {
      expect(failureMessage({ ok: false, reason }).length).toBeGreaterThan(8);
    }
    expect(failureMessage({ ok: false, reason: 'wrong-season', detail: 'Tomato' })).toContain('Tomato');
  });
});
