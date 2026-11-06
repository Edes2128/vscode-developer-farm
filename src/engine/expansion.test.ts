import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { rollQuality, FERTILIZER_LUCK, MapFarm, advanceFarm } from './farming/farm';
import type { CreatureDef } from './creatures/types';
import { Game } from './game';
import { InputState } from './input/actions';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import { createPlayerAt } from './player/player';
import { QuestLog } from './quests/questLog';
import { newRecord } from './social/friendship';
import { farmGameAt, makeContent, makeMap, pick, readThrough, run, tap } from './testing';
import { seasonOf } from './time/calendar';
import { validateContent } from './world/validate';
import { watersFields, weatherOn } from './weather/weather';
import { festivalDays } from './festivals/festivals';
import { World } from './world/world';

/**
 * Phase 7 mechanics: fertilizer, sprinklers, crops that need rain, and the rare creatures, played through the real data
 * where they live on the farm and through a small test world where they need a place of their own.
 */

const FARM = 'willowbrook.home_farm';
const HOUSE = 'willowbrook.farmhouse';
type Facing = 'up' | 'down' | 'left' | 'right';
const CLEAR = festivalDays(CONTENT.festivals);
const stack = (id: string, count: number, quality: 0 | 1 | 2 = 0) => ({ id, count, quality });
const pockets = (...stacks: ReturnType<typeof stack>[]) => ({
  slots: [...stacks, ...Array.from({ length: 12 - stacks.length }, () => null)],
  selected: 0,
  canWater: 24,
});
const at = (mapId: string, x: number, y: number, facing: Facing, patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: x * 16 + 8, y: y * 16 + 14, facing }, time: { day: 3, minutes: 10 * 60 }, ...patch });
const use = (game: Game): void => {
  tap(game, 'Space', 0.05);
  run(game, 0.6);
};
const firstDay = (test: (day: number) => boolean, from = 3): number => {
  for (let day = from; day < 400; day += 1) if (test(day)) return day;
  throw new Error('no such day');
};
const rainy = (day: number): boolean => watersFields(weatherOn(day, CLEAR));
/** A cell of the farm's field (tillable, walkable) with room on every side. */
function fieldCell(): { x: number; y: number } {
  const map = new World(CONTENT).map(FARM);
  for (let y = 14; y < map.height - 2; y += 1) for (let x = 14; x < map.width - 2; x += 1) if ([-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => map.isTillable(x + dx, y + dy) && map.isWalkable(x + dx, y + dy)))) return { x, y };
  throw new Error('no field');
}

describe('fertilizer', () => {
  it('makes a good harvest much likelier, by the same dice for the same cell and day', () => {
    let plain = 0;
    let rich = 0;
    for (let i = 0; i < 400; i += 1) {
      if (rollQuality(i % 20, Math.floor(i / 20), 7) > 0) plain += 1;
      if (rollQuality(i % 20, Math.floor(i / 20), 7, FERTILIZER_LUCK) > 0) rich += 1;
    }
    expect(rich).toBeGreaterThan(plain * 2);
    expect(rollQuality(3, 4, 9, FERTILIZER_LUCK)).toBe(rollQuality(3, 4, 9, FERTILIZER_LUCK)); // never random
  });

  it('is worked into tilled soil with the use key, once, and the pockets lose one', () => {
    const cell = fieldCell();
    const game = at(FARM, cell.x - 1, cell.y, 'right', {
      inventory: pockets(stack('fertilizer', 2)),
      farms: { [FARM]: { soil: [{ x: cell.x, y: cell.y, watered: false }], crops: [] } },
    });
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: cell.x, y: cell.y, valid: true });
    use(game);
    expect(game.farm.soilAt(cell.x, cell.y)?.fertilized).toBe(true);
    expect(game.inventory.count('fertilizer')).toBe(1);
    const hints: string[] = [];
    game.events.on('hint', (h) => hints.push(h.text));
    run(game, 0.1);
    expect(game.cursor?.valid).toBe(false);
    use(game);
    expect(hints.at(-1)).toBe('This soil is already rich.');
    expect(game.inventory.count('fertilizer')).toBe(1);
  });

  it('needs tilled soil, and is saved with the soil', () => {
    const cell = fieldCell();
    const bare = at(FARM, cell.x - 1, cell.y, 'right', { inventory: pockets(stack('fertilizer', 1)) });
    run(bare, 0.1);
    const hints: string[] = [];
    bare.events.on('hint', (h) => hints.push(h.text));
    use(bare);
    expect(hints.at(-1)).toBe('Seeds need tilled soil.');
    expect(bare.inventory.count('fertilizer')).toBe(1);
    const rich = at(FARM, cell.x - 1, cell.y, 'right', { farms: { [FARM]: { soil: [{ x: cell.x, y: cell.y, watered: false, fertilized: true }], crops: [] } } });
    const saved = decodeSave(encodeSave(rich.toSaveState(), new Date()));
    expect(saved.ok && saved.state.farms[FARM]?.soil[0]?.fertilized).toBe(true);
  });

  it('lasts as long as the crop in it, and is gone with it', () => {
    const farm = new MapFarm(10, 10);
    farm.till(2, 2);
    farm.fertilize(2, 2);
    farm.plant(2, 2, 'radish', 1);
    expect(farm.fertilize(2, 2)).toBe(false);
    const radish = CONTENT.crops.find((c) => c.id === 'radish')!;
    const strawberry = CONTENT.crops.find((c) => c.id === 'strawberry')!;
    farm.removeCrop(2, 2);
    expect(farm.soilAt(2, 2)?.fertilized).toBe(false);
    // A plant that regrows keeps its fertilizer through the next fruiting.
    farm.fertilize(2, 2);
    farm.plant(2, 2, 'strawberry', 1);
    expect(radish.regrowStage).toBeUndefined();
    expect(strawberry.regrowStage).toBeDefined();
    expect(farm.soilAt(2, 2)?.fertilized).toBe(true);
  });

  it('is made at the workbench from feed and stone, two at a time', () => {
    const recipe = CONTENT.recipes.find((r) => r.id === 'fertilizer')!;
    expect(recipe.station).toBe('workbench');
    expect(recipe.output).toEqual({ item: 'fertilizer', count: 2 });
  });
});

describe('sprinklers', () => {
  const field = fieldCell();
  const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx !== 0 || dy !== 0).map((dx) => ({ x: field.x + dx, y: field.y + dy })));
  const soil = (cells: { x: number; y: number }[]) => cells.map((c) => ({ x: c.x, y: c.y, watered: false }));
  const dry = firstDay((d) => !rainy(d), 4);

  it('is put down on bare ground in the field and nowhere else', () => {
    const game = at(FARM, field.x - 1, field.y, 'right', { inventory: pockets(stack('sprinkler', 2)) });
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: field.x, y: field.y, valid: true });
    use(game);
    expect(game.map.extraAt(field.x, field.y)?.def.id).toBe('sprinkler');
    expect(game.inventory.count('sprinkler')).toBe(1);
    // Not on tilled soil.
    const tilled = at(FARM, field.x - 1, field.y, 'right', { inventory: pockets(stack('sprinkler', 1)), farms: { [FARM]: { soil: soil([field]), crops: [] } } });
    run(tilled, 0.1);
    const hints: string[] = [];
    tilled.events.on('hint', (h) => hints.push(h.text));
    use(tilled);
    expect(hints.at(-1)).toBe('A sprinkler goes in the field, on bare ground you have not tilled.');
    // Not indoors, where nothing is tilled.
    const indoors = at(HOUSE, 3, 4, 'right', { inventory: pockets(stack('sprinkler', 1)) });
    run(indoors, 0.1);
    expect(indoors.cursor?.valid).toBe(false);
  });

  it('waters the eight cells around it overnight, and not the ones further off', () => {
    const far = { x: field.x + 3, y: field.y };
    const game = at(FARM, field.x - 1, field.y, 'right', {
      time: { day: dry - 1, minutes: 10 * 60 },
      inventory: pockets(stack('sprinkler', 1)),
      farms: { [FARM]: { soil: soil([...around, far]), crops: [] } },
    });
    run(game, 0.1);
    use(game);
    expect(game.map.extraAt(field.x, field.y)?.def.id).toBe('sprinkler');
    game.endDay('slept');
    const watered = (c: { x: number; y: number }) => game.farm.soilAt(c.x, c.y)?.watered;
    expect(around.every(watered)).toBe(true);
    expect(watered(far)).toBe(false);
  });

  it('still waters when the player sleeps somewhere else, and after the game is saved and opened again', () => {
    const game = at(FARM, field.x - 1, field.y, 'right', {
      time: { day: dry - 1, minutes: 10 * 60 },
      inventory: pockets(stack('sprinkler', 1)),
      farms: { [FARM]: { soil: soil(around), crops: [] } },
    });
    run(game, 0.1);
    use(game);
    const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
    expect(saved.ok && saved.state.placed[FARM]).toEqual([{ def: 'sprinkler', x: field.x, y: field.y }]);
    if (!saved.ok) return;
    const again = new Game(new World(CONTENT), new InputState(), { ...saved.state, mapId: HOUSE, player: { x: 4 * 16 + 8, y: 5 * 16 + 14, facing: 'up' } });
    again.endDay('slept');
    expect(around.every((c) => again.toSaveState().farms[FARM]?.soil.find((s) => s.x === c.x && s.y === c.y)?.watered)).toBe(true);
  });

  it('is picked up again like any furniture, and is made at the workbench from two bars', () => {
    const recipe = CONTENT.recipes.find((r) => r.id === 'sprinkler')!;
    expect(recipe.inputs).toEqual([{ item: 'copper_bar', count: 1 }, { item: 'iron_bar', count: 1 }]);
    const game = at(FARM, field.x - 1, field.y, 'right', { inventory: pockets(stack('sprinkler', 1)) });
    run(game, 0.1);
    use(game);
    run(game, 0.1);
    expect(game.prompt).toMatchObject({ verb: 'Pick up', name: 'Sprinkler' });
    tap(game, 'KeyE');
    expect(game.map.extraAt(field.x, field.y)).toBeUndefined();
    expect(game.inventory.count('sprinkler')).toBe(1);
  });
});

describe('moonbloom, the crop that needs rain', () => {
  const cell = fieldCell();
  const farmWith = (watered: boolean) => ({
    [FARM]: {
      soil: [{ x: cell.x, y: cell.y, watered }, { x: cell.x + 1, y: cell.y, watered }],
      crops: [
        { x: cell.x, y: cell.y, crop: 'moonbloom', stage: 0, daysInStage: 0, planted: 1 },
        { x: cell.x + 1, y: cell.y, crop: 'radish', stage: 0, daysInStage: 0, planted: 1 },
      ],
    },
  });
  const stages = (game: Game) => ({ moon: game.farm.cropAt(cell.x, cell.y)?.stage, radish: game.farm.cropAt(cell.x + 1, cell.y)?.daysInStage });

  it('does not grow on a dry night, however well it was watered, while an ordinary crop does', () => {
    const dry = firstDay((d) => !rainy(d), 4);
    const game = at(FARM, 5, 5, 'down', { time: { day: dry - 1, minutes: 10 * 60 }, farms: farmWith(true) });
    game.endDay('slept');
    expect(stages(game)).toEqual({ moon: 0, radish: 1 });
  });

  it('grows a stage on a night it rained, and the rain has watered it for tomorrow', () => {
    const wet = firstDay((d) => rainy(d) && seasonOf(d) !== 'winter', 4);
    const game = at(FARM, 5, 5, 'down', { time: { day: wet - 1, minutes: 10 * 60 }, farms: farmWith(true) });
    game.endDay('slept');
    expect(stages(game)).toEqual({ moon: 1, radish: 1 });
    expect(game.farm.soilAt(cell.x, cell.y)?.watered).toBe(true);
  });

  it('is ripe after three rainy nights, and a seed planted unwatered waits for the rain to water it first', () => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.plant(1, 1, 'moonbloom', 1);
    const moon = CONTENT.crops.find((c) => c.id === 'moonbloom')!;
    const lookup = (id: string) => CONTENT.crops.find((c) => c.id === id);
    farm.water(1, 1);
    advanceFarm(farm, lookup, 'spring', false, false);
    expect(farm.cropAt(1, 1)?.stage).toBe(0);
    for (let night = 0; night < 3; night += 1) {
      farm.water(1, 1);
      advanceFarm(farm, lookup, 'spring', false, true);
    }
    expect(farm.cropAt(1, 1)?.stage).toBe(moon.stageDays.length);
  });

  it('can never grow under glass: a greenhouse is never rained on', () => {
    const farm = new MapFarm(10, 10);
    farm.till(1, 1);
    farm.plant(1, 1, 'moonbloom', 1);
    farm.water(1, 1);
    advanceFarm(farm, (id) => CONTENT.crops.find((c) => c.id === id), 'winter', true, false);
    expect(farm.cropAt(1, 1)?.stage).toBe(0);
  });
});

describe('rare creatures', () => {
  const heron: CreatureDef = {
    id: 'heron',
    name: 'Fen heron',
    description: 'Stands very still.',
    sprite: 'heron',
    maps: ['test.map'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    weather: ['sun', 'cloud', 'rain', 'storm', 'snow'],
    from: 0,
    to: 26 * 60,
    chance: 1,
    likes: ['minnow'],
    keepsake: { item: 'heron_feather', count: 1 },
  };
  const world = (...defs: CreatureDef[]): World => {
    const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
    const map = makeMap(rows, [], { spawn: { x: 1, y: 1, facing: 'down' } });
    return new World({ ...makeContent(map), creatures: defs });
  };
  const play = (patch: Parameters<typeof farmGameAt>[2] = {}, defs: CreatureDef[] = [heron]): Game => {
    const w = world(...defs);
    const base = new Game(w, new InputState()).toSaveState();
    return new Game(w, new InputState(), { ...base, ...patch });
  };
  /** Moves the player to a cell, standing still. */
  const stand = (game: Game, x: number, y: number, facing: Facing = 'right'): void => {
    game.player = createPlayerAt(x, y, facing);
    run(game, 0.1);
  };

  it('stand in the same place all day and after a reload: where they are follows from the day, and nothing about it is saved', () => {
    const game = play();
    const [first] = game.creaturesHere();
    expect(first).toMatchObject({ creature: 'heron', map: 'test.map' });
    expect(game.creaturesHere()).toHaveLength(1);
    run(game, 3);
    expect(game.creaturesHere()[0]).toEqual(first);
    const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const again = new Game(world(heron), new InputState(), saved.state);
    expect(again.creaturesHere()[0]).toEqual(first);
    expect(JSON.stringify(saved.state)).not.toContain('"x":' + String(first!.x * 16)); // no positions in the save
  });

  it('are about only in their hour and weather', () => {
    const night = play({ time: { day: 3, minutes: 10 * 60 } }, [{ ...heron, from: 20 * 60, to: 26 * 60 }]);
    expect(night.creaturesHere()).toHaveLength(0);
    const evening = play({ time: { day: 3, minutes: 21 * 60 } }, [{ ...heron, from: 20 * 60, to: 26 * 60 }]);
    expect(evening.creaturesHere()).toHaveLength(1);
    const storm = play({}, [{ ...heron, weather: ['storm'] }]);
    expect(storm.creaturesHere()).toHaveLength(0);
  });

  it('are seen by walking up to them, but not by running', () => {
    const game = play();
    const heronAt = game.creaturesHere()[0]!;
    const near = { x: Math.min(19, heronAt.x + 2), y: heronAt.y };
    stand(game, heronAt.x < 10 ? 19 : 0, heronAt.y < 10 ? 19 : 0); // the far corner, out of range
    expect(game.bestiary.hasSeen('heron')).toBe(false);
    const hints: string[] = [];
    game.events.on('hint', (h) => hints.push(h.text));
    game.input.press('ShiftLeft'); // running
    game.input.press('KeyA');
    game.player = createPlayerAt(near.x, near.y, 'left');
    run(game, 0.05);
    expect(game.bestiary.hasSeen('heron')).toBe(false);
    game.input.release('KeyA');
    game.input.release('ShiftLeft');
    run(game, 0.2); // standing still, in range: seen
    expect(game.bestiary.hasSeen('heron')).toBe(true);
    expect(hints.some((h) => h.includes('spotted a fen heron'))).toBe(true);
    expect(game.toSaveState().bestiary).toEqual({ seen: ['heron'], friends: [] });
  });

  it('can be watched for what the journal says, and befriended with a gift they like: the gift goes, a keepsake is left, once', () => {
    const game = play({ inventory: pockets(stack('minnow', 2), stack('carp', 1)) });
    const h = game.creaturesHere()[0]!;
    const side = h.x > 0 ? { x: h.x - 1, facing: 'right' as const } : { x: h.x + 1, facing: 'left' as const };
    stand(game, side.x, h.y, side.facing);
    expect(game.bestiary.hasSeen('heron')).toBe(true);
    expect(game.prompt).toMatchObject({ verb: 'Watch', name: 'Fen heron' });
    // What it does not like does nothing to it.
    game.inventory.select(1); // the carp
    run(game, 0.1);
    expect(game.cursor?.valid ?? false).toBe(false);
    use(game);
    expect(game.bestiary.isFriend('heron')).toBe(false);
    expect(game.inventory.count('carp')).toBe(1);
    // A minnow, from the hand.
    game.inventory.select(0);
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: h.x, y: h.y, valid: true });
    use(game);
    expect(game.bestiary.isFriend('heron')).toBe(true);
    expect(game.inventory.count('minnow')).toBe(1);
    expect(game.inventory.count('heron_feather')).toBe(1);
    // A friend takes nothing more, and leaves nothing more.
    run(game, 0.1);
    expect(game.cursor?.valid ?? false).toBe(false);
    use(game);
    expect(game.inventory.count('minnow')).toBe(1);
    expect(game.inventory.count('heron_feather')).toBe(1);
    // It is remembered through a save.
    const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
    expect(saved.ok && saved.state.bestiary).toEqual({ seen: ['heron'], friends: ['heron'] });
  });

  it('are not befriended before they have been seen, and not when there would be no room for what they leave', () => {
    const full = Array.from({ length: 12 }, (_, i) => stack(i === 0 ? 'minnow' : i % 2 === 0 ? 'stone' : 'coal', i === 0 ? 1 : 1));
    const game = play({ inventory: { slots: full, selected: 0, canWater: 24 } });
    const h = game.creaturesHere()[0]!;
    const side = h.x > 0 ? { x: h.x - 1, facing: 'right' as const } : { x: h.x + 1, facing: 'left' as const };
    // Running up to it: in front of it, but never seen.
    game.input.press('ShiftLeft');
    game.input.press('KeyD');
    game.player = createPlayerAt(side.x, h.y, side.facing);
    run(game, 0.05);
    expect(game.bestiary.hasSeen('heron')).toBe(false);
    expect(game.cursor?.valid ?? false).toBe(false);
    game.input.release('KeyD');
    game.input.release('ShiftLeft');
    run(game, 0.2);
    expect(game.bestiary.hasSeen('heron')).toBe(true);
    // The pockets are full of other things: the one minnow goes, but then there is a free slot, so the keepsake fits.
    use(game);
    expect(game.bestiary.isFriend('heron')).toBe(true);
    expect(game.inventory.count('heron_feather')).toBe(1);
    // With no free slot to spare after the gift (two stacks of minnows), it is refused and nothing is lost.
    const crowded = play({ inventory: { slots: Array.from({ length: 12 }, (_, i) => (i === 0 ? stack('minnow', 3) : stack(i % 2 === 0 ? 'stone' : 'coal', 1))), selected: 0, canWater: 24 } });
    const c = crowded.creaturesHere()[0]!;
    const cs = c.x > 0 ? { x: c.x - 1, facing: 'right' as const } : { x: c.x + 1, facing: 'left' as const };
    stand(crowded, cs.x, c.y, cs.facing);
    use(crowded);
    expect(crowded.bestiary.isFriend('heron')).toBe(false);
    expect(crowded.inventory.count('minnow')).toBe(3);
    expect(crowded.inventory.count('heron_feather')).toBe(0);
  });
});

describe('what is hidden behind a tree', () => {
  it('knows which cells lie under the crown of a tall object, so nothing meant to be seen is put there', () => {
    const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
    const props = rows.map((_, y) => (y === 10 ? '.....T..............' : '.'.repeat(20)));
    const map = new World(makeContent(makeMap(rows, props))).map('test.map');
    // An oak's picture reaches three cells up and one to each side of its trunk.
    for (const [x, y] of [[5, 9], [5, 8], [5, 7], [4, 9], [6, 7]] as const) expect(map.isOverhung(x, y), `${x},${y}`).toBe(true);
    for (const [x, y] of [[5, 6], [5, 11], [3, 9], [7, 9], [5, 10]] as const) expect(map.isOverhung(x, y), `${x},${y}`).toBe(false);
  });
});

describe('quests about creatures', () => {
  const quest = {
    id: 'q',
    title: 'Q',
    giver: 'x',
    summary: '',
    offer: ['a'],
    accepted: 'b',
    done: ['c'],
    objectives: [{ kind: 'see' as const, count: 3 }, { kind: 'befriend' as const, count: 1 }],
    rewards: {},
  };

  it('track how many have been seen and befriended as a level, never as a tally of events', () => {
    const log = new QuestLog([quest]);
    log.accept('q');
    log.notify({ kind: 'see', seen: 1 });
    log.notify({ kind: 'see', seen: 1 });
    expect(log.progress('q')).toEqual([1, 0]);
    log.notify({ kind: 'see', seen: 3 });
    log.notify({ kind: 'befriend', friends: 1 });
    expect(log.status('q')).toBe('ready');
  });

  it('count what was done before the quest was taken up', () => {
    const log = new QuestLog([quest]);
    log.accept('q', (objective) => (objective.kind === 'see' ? 3 : objective.kind === 'befriend' ? 1 : 0));
    expect(log.status('q')).toBe('ready');
  });
});

describe('what an independent review of Phase 7 found', () => {
  const GREENHOUSE = 'willowbrook.greenhouse';
  const MEADOW = 'windcrest.meadow';
  const SHALLOWS = 'marlow.shallows';
  const ROCKS = [[37, 4], [36, 6], [39, 7], [40, 4], [42, 8], [41, 6], [37, 8]] as const;

  it('a rain crop does not grow under glass, even on a rainy night, and cannot be planted there', () => {
    const wet = firstDay((d) => rainy(d) && seasonOf(d) !== 'winter', 4);
    const game = at(GREENHOUSE, 5, 4, 'down', {
      time: { day: wet - 1, minutes: 10 * 60 },
      buildings: { built: ['greenhouse'], pending: [] },
      farms: { [GREENHOUSE]: { soil: [{ x: 4, y: 4, watered: true }, { x: 5, y: 4, watered: true }], crops: [{ x: 4, y: 4, crop: 'moonbloom', stage: 0, daysInStage: 0, planted: 1 }, { x: 5, y: 4, crop: 'radish', stage: 0, daysInStage: 0, planted: 1 }] } },
    });
    game.endDay('slept');
    const farm = game.toSaveState().farms[GREENHOUSE]!;
    expect(farm.crops.find((c) => c.crop === 'moonbloom')?.stage).toBe(0);
    expect(farm.crops.find((c) => c.crop === 'radish')?.daysInStage).toBe(1); // an ordinary crop under glass still grows
    const planting = at(GREENHOUSE, 3, 4, 'right', {
      inventory: pockets(stack('moonbloom_seeds', 2)),
      buildings: { built: ['greenhouse'], pending: [] },
      farms: { [GREENHOUSE]: { soil: [{ x: 4, y: 4, watered: false }], crops: [] } },
    });
    run(planting, 0.1);
    const hints: string[] = [];
    planting.events.on('hint', (h) => hints.push(h.text));
    use(planting);
    expect(hints.at(-1)).toBe('Moonbloom only grows where the rain can reach it: plant it in the open.');
    expect(planting.inventory.count('moonbloom_seeds')).toBe(2);
  });

  it('fertilizer goes with a crop that withers at the end of a season', () => {
    const farm = new MapFarm(10, 10);
    farm.till(2, 2);
    farm.fertilize(2, 2);
    farm.plant(2, 2, 'radish', 1);
    advanceFarm(farm, (id) => CONTENT.crops.find((c) => c.id === id), 'summer');
    expect(farm.cropAt(2, 2)).toBeUndefined();
    expect(farm.soilAt(2, 2)?.fertilized).toBe(false);
  });

  it('the rare creatures stand where they stood however many rocks have been broken, and after a reload', () => {
    const day = firstDay((d) => seasonOf(d) === 'winter', 85);
    let found: { x: number; y: number } | undefined;
    let when = day;
    for (let d = day; d < day + 28 && found === undefined; d += 1) {
      const probe = at(MEADOW, 30, 34, 'up', { time: { day: d, minutes: 9 * 60 } });
      const here = probe.creaturesHere()[0];
      if (here !== undefined) {
        found = here;
        when = d;
      }
    }
    expect(found).toBeDefined();
    const whole = at(MEADOW, 30, 34, 'up', { time: { day: when, minutes: 9 * 60 } });
    const spent = { day: when, cells: { [MEADOW]: ROCKS.map(([x, y]) => y * 1000 + x) }, fished: {} };
    const mined = at(MEADOW, 30, 34, 'up', { time: { day: when, minutes: 9 * 60 }, spent });
    expect(mined.map.nodeAt(37, 4)).toBeUndefined(); // the rocks really are gone in this one
    expect(mined.creaturesHere()).toEqual(whole.creaturesHere());
  });

  it('written maps get their rocks back each morning, without closing the game', () => {
    const game = at(MEADOW, 30, 34, 'up', { time: { day: 3, minutes: 10 * 60 } });
    const map = game.map;
    expect(map.nodeAt(37, 4)).toBeDefined();
    map.hitNode(37, 4);
    map.hitNode(37, 4);
    expect(map.nodeAt(37, 4)).toBeUndefined();
    expect(map.isWalkable(37, 4)).toBe(true);
    game.endDay('slept');
    expect(game.world.map(MEADOW).nodeAt(37, 4)).toBeDefined();
    expect(game.world.map(MEADOW).isWalkable(37, 4)).toBe(false);
  });

  it('counts the creatures already seen and befriended when Fern\'s quests are taken up', () => {
    const talk = (patch: Parameters<typeof farmGameAt>[2], id: string): Game => {
      const game = at('marlow.lodge', 6, 5, 'up', { npcs: { fern: { ...newRecord(), met: true } }, bestiary: { seen: ['heron', 'kingfisher', 'owl'], friends: ['heron'] }, ...patch });
      run(game, 0.1);
      tap(game, 'KeyE');
      readThrough(game);
      pick(game, `npc:offer:fern:${id}`);
      readThrough(game);
      pick(game, `quest:accept:fern:${id}`);
      return game;
    };
    expect(talk({}, 'field_notes').quests.status('field_notes')).toBe('ready');
    const next = talk({ quests: [{ id: 'field_notes', status: 'done', progress: [3] }] }, 'a_gentle_friend');
    expect(next.quests.status('a_gentle_friend')).toBe('ready');
  });

  it('tells the journal at once when a creature is first seen', () => {
    const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
    const heron: CreatureDef = { id: 'heron', name: 'Fen heron', description: 'x', sprite: 'heron', maps: ['test.map'], seasons: ['spring', 'summer', 'autumn', 'winter'], weather: ['sun', 'cloud', 'rain', 'storm', 'snow'], from: 0, to: 26 * 60, chance: 1, likes: ['minnow'], keepsake: { item: 'heron_feather', count: 1 } };
    const w = new World({ ...makeContent(makeMap(rows, [], { spawn: { x: 1, y: 1, facing: 'down' } })), creatures: [heron] });
    const game = new Game(w, new InputState());
    let changes = 0;
    game.events.on('statusChanged', () => {
      changes += 1;
    });
    run(game, 0.05);
    const before = changes;
    const h = game.creaturesHere()[0]!;
    game.player = createPlayerAt(Math.min(19, h.x + 1), h.y, 'left');
    run(game, 0.1);
    expect(game.bestiary.hasSeen('heron')).toBe(true);
    expect(changes).toBeGreaterThan(before);
  });

  it('does not count a sprinkler in the field as furniture in the farmhouse', () => {
    const cell = fieldCell();
    const game = at(FARM, cell.x - 1, cell.y, 'right', { inventory: pockets(stack('sprinkler', 3)) });
    run(game, 0.1);
    use(game);
    expect(game.map.extraAt(cell.x, cell.y)?.def.id).toBe('sprinkler');
    expect(game.placedCount()).toBe(0);
  });

  it('never buries anything under a boardwalk plank', () => {
    for (let day = 3; day < 43; day += 1) {
      const game = at(SHALLOWS, 22, 3, 'down', { time: { day, minutes: 10 * 60 } });
      for (const node of game.map.nodes.values()) if (node.def.tool === 'hoe') expect(game.map.isFloorObjectCell(node.x, node.y), `day ${day} at ${node.x},${node.y}`).toBe(false);
    }
  });

  it('knows how far a building\'s roof reaches over the ground behind it, and no further', () => {
    const map = new World(CONTENT).map(SHALLOWS);
    // The lodge's door is the third cell of its bottom row at (22,24): its picture rises four rows above the anchor row 24, to row 20.
    expect(map.isOverhung(22, 20)).toBe(true);
    expect(map.isOverhung(22, 19)).toBe(false);
    expect(map.isOverhung(26, 20)).toBe(false); // beside it
  });

  it('rejects a creature that is only about before anyone is up', () => {
    const heron = CONTENT.creatures.find((c) => c.id === 'heron')!;
    const content = { ...CONTENT, creatures: CONTENT.creatures.map((c) => (c.id === 'heron' ? { ...heron, from: 0, to: 5 * 60 } : c)) };
    expect(validateContent(content).some((p) => p.message.includes('nobody is up before six'))).toBe(true);
  });
});
