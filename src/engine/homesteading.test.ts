import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { Game } from './game';
import { InputState } from './input/actions';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import { createPlayerAt } from './player/player';
import { newRecord } from './social/friendship';
import { farmGameAt, listen, pick, readThrough, run, tap } from './testing';
import { World } from './world/world';

/**
 * Phase 5, played through the real maps and data: the farmhouse inside (bed, kitchen, workbench), cooking and making things,
 * furniture, the carpenter and the greenhouse, digging, and the museum.
 */

const FARM = 'willowbrook.home_farm';
const GREEN = 'willowbrook.village_green';
const HOUSE = 'willowbrook.farmhouse';
const GREENHOUSE = 'willowbrook.greenhouse';
const MUSEUM = 'willowbrook.museum';
const STORE = 'willowbrook.general_store';
const TEN_AM = { day: 1, minutes: 10 * 60 };
type Facing = 'up' | 'down' | 'left' | 'right';

const stack = (id: string, count: number, quality: 0 | 1 | 2 = 0) => ({ id, count, quality });
const pockets = (...stacks: ReturnType<typeof stack>[]) => ({
  slots: [...stacks, ...Array.from({ length: 12 - stacks.length }, () => null)],
  selected: 0,
  canWater: 24,
});
const at = (mapId: string, x: number, y: number, facing: Facing, patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: x * 16 + 8, y: y * 16 + 14, facing }, time: TEN_AM, ...patch });
const known = (changes: Partial<ReturnType<typeof newRecord>> = {}) => ({ ...newRecord(), met: true, ...changes });
const reopen = (game: Game): Game => {
  const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
  if (!saved.ok) throw new Error('the save did not decode');
  return new Game(new World(CONTENT), new InputState(), saved.state);
};
const walk = (game: Game, code: string, seconds: number): void => {
  game.input.press(code);
  run(game, seconds);
  game.input.release(code);
  run(game, 0.05); // a moment with nothing held: the exits open to someone who has just arrived
};

describe('the farmhouse', () => {
  it('is entered through its door, and the door out leads back to the doorstep', () => {
    const game = farmGameAt({ x: 13, y: 14 }, 'up');
    walk(game, 'KeyW', 1.2);
    expect(game.map.id).toBe(HOUSE);
    expect(game.map.ambient).toBe('indoor');
    walk(game, 'KeyS', 1.5);
    expect(game.map.id).toBe(FARM);
    expect(Math.floor(game.player.x / 16)).toBe(13);
  });

  it('has a bed, a kitchen and a workbench you can reach', () => {
    const bed = at(HOUSE, 3, 3, 'left');
    run(bed, 0.1);
    expect(bed.prompt).toMatchObject({ verb: 'Go to bed', name: 'Your bed' });
    const kitchen = at(HOUSE, 8, 3, 'up');
    run(kitchen, 0.1);
    expect(kitchen.prompt).toMatchObject({ verb: 'Cook', name: 'Kitchen' });
    const bench = at(HOUSE, 4, 3, 'up');
    run(bench, 0.1);
    expect(bench.prompt).toMatchObject({ verb: 'Make', name: 'Workbench' });
  });
});

describe('cooking and making things', () => {
  const kitchen = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(HOUSE, 8, 3, 'up', patch);
  const bench = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(HOUSE, 4, 3, 'up', patch);
  const open = (game: Game): void => {
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
  };

  it('lists the recipes that can be cooked from the start, enabled by what the pockets hold', () => {
    const game = kitchen({ inventory: pockets(stack('egg', 2), stack('tomato', 1)) });
    open(game);
    const options = game.dialog!.options;
    expect(options[0]?.label).toBe('Fried egg · Egg');
    expect(options.find((o) => o.id === 'craft:omelette')?.enabled).toBe(true);
    expect(options.find((o) => o.id === 'craft:radish_salad')?.enabled).toBe(false);
    // Recipes taught by friends are not on the list until they are learned, and the kitchen says so.
    expect(options.some((o) => o.id === 'craft:pumpkin_pie')).toBe(false);
    expect(game.dialog?.lines.join(' ')).toContain('still to learn');
  });

  it('cooks a dish: the ingredients go, the dish arrives, the quest hears of it, and the list updates', () => {
    const game = kitchen({ inventory: pockets(stack('egg', 3)), quests: [{ id: 'a_proper_meal', status: 'active', progress: [0] }] });
    open(game);
    pick(game, 'craft:fried_egg');
    expect(game.inventory.count('egg')).toBe(2);
    expect(game.inventory.count('fried_egg')).toBe(1);
    expect(game.dialog?.note).toBe('Made Fried egg.');
    expect(game.quests.status('a_proper_meal')).toBe('ready');
    pick(game, 'craft:fried_egg');
    pick(game, 'craft:fried_egg');
    expect(game.inventory.count('egg')).toBe(0);
    expect(game.dialog?.options.find((o) => o.id === 'craft:fried_egg')?.enabled).toBe(false);
  });

  it('teaches a recipe when a friend has been made, and not before', () => {
    const ingredients = pockets(stack('pumpkin', 1), stack('egg', 1), stack('strawberry', 1));
    const before = kitchen({ inventory: ingredients });
    open(before);
    expect(before.dialog!.options.some((o) => o.id === 'craft:pumpkin_pie')).toBe(false);
    const friend = kitchen({ inventory: ingredients, npcs: { willa: known({ friendship: 400 }) } });
    open(friend);
    expect(friend.dialog!.options.find((o) => o.id === 'craft:pumpkin_pie')?.enabled).toBe(true);
  });

  it('smelts ore into a bar at the workbench, and a bar into a lantern', () => {
    const game = bench({ inventory: pockets(stack('copper_ore', 3), stack('coal', 1), stack('quartz', 1)) });
    open(game);
    pick(game, 'craft:copper_bar');
    expect(game.inventory.count('copper_bar')).toBe(1);
    expect(game.inventory.count('copper_ore')).toBe(0);
    pick(game, 'craft:lantern');
    expect(game.inventory.count('lantern')).toBe(1);
    expect(game.inventory.count('copper_bar')).toBe(0);
  });

  it('refuses when the pockets cannot hold the result, and lets the ingredients free a slot', () => {
    const filler = (n: number) => Array.from({ length: n }, (_, i) => stack(i % 2 === 0 ? 'radish' : 'tomato', 99, ((i % 2) + 1) as 1 | 2));
    // Copper ore ×3 and coal ×1 fill two slots exactly, and making the bar frees them: it fits.
    const exact = bench({ inventory: { slots: [stack('copper_ore', 3), stack('coal', 1), ...filler(10)], selected: 0, canWater: 24 } });
    open(exact);
    expect(exact.dialog!.options.find((o) => o.id === 'craft:copper_bar')?.enabled).toBe(true);
    pick(exact, 'craft:copper_bar');
    expect(exact.inventory.count('copper_bar')).toBe(1);

    // Four of each: the stacks stay after the craft, no slot is free, and the bar has nowhere to go.
    const tight = bench({ inventory: { slots: [stack('copper_ore', 4), stack('coal', 4), ...filler(10)], selected: 0, canWater: 24 } });
    open(tight);
    expect(tight.dialog!.options.find((o) => o.id === 'craft:copper_bar')?.enabled).toBe(false);
    expect(tight.inventory.count('copper_ore')).toBe(4);
  });
});

describe('furniture', () => {
  const room = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(HOUSE, 3, 6, 'right', { inventory: pockets(stack('chair', 3), stack('rug', 1)), ...patch });

  it('is bought from Hollis, who stocks the chairs, tables and shelves', () => {
    const game = at(STORE, 5, 5, 'up', { money: 500, npcs: { hollis: known() } });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:shop');
    const labels = game.dialog!.options.map((o) => o.label);
    expect(labels).toContain('Chair · 80g');
    expect(labels).toContain('Wardrobe · 300g');
    pick(game, 'buy:3'); // fishing rod, pickaxe, chicken feed, then the chair
    expect(game.inventory.count('chair')).toBe(1);
  });

  it('is put down in front of the player with the use key, in the farmhouse only', () => {
    const game = room();
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: 4, y: 6, valid: true });
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.map.extraAt(4, 6)?.def.id).toBe('chair');
    expect(game.map.isWalkable(4, 6)).toBe(false);
    expect(game.inventory.count('chair')).toBe(2);

    const hints = listen(game, 'hint');
    tap(game, 'Space', 0.05); // the cell in front is taken now
    expect(hints.at(-1)?.text).toBe('There is no room for that here.');

    const outside = farmGameAt({ x: 13, y: 15 }, 'down', { inventory: pockets(stack('chair', 1)) });
    run(outside, 0.1);
    const outsideHints = listen(outside, 'hint');
    expect(outside.cursor?.valid).toBe(false);
    tap(outside, 'Space', 0.05);
    expect(outsideHints.at(-1)?.text).toBe('Furniture goes inside the farmhouse.');
  });

  it('is picked up again with the interact key, back into the pockets', () => {
    const game = room();
    run(game, 0.1);
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.prompt).toMatchObject({ verb: 'Pick up', name: 'Chair' });
    tap(game, 'KeyE');
    expect(game.map.extraAt(4, 6)).toBeUndefined();
    expect(game.map.isWalkable(4, 6)).toBe(true);
    expect(game.inventory.count('chair')).toBe(3);
  });

  it('is not picked up if the pockets are full, and nothing is lost', () => {
    const slots = [stack('chair', 1), ...Array.from({ length: 11 }, (_, i) => stack('radish', 99, ((i % 2) + 1) as 1 | 2))];
    const game = at(HOUSE, 3, 6, 'right', { inventory: { slots, selected: 0, canWater: 24 } });
    run(game, 0.1);
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.inventory.count('chair')).toBe(0);
    game.inventory.add({ id: 'tomato', count: 99, quality: 0 }); // the free slot is taken again
    const hints = listen(game, 'hint');
    tap(game, 'KeyE');
    expect(hints.at(-1)?.text).toBe('Your pockets are full.');
    expect(game.map.extraAt(4, 6)).toBeDefined();
  });

  it('counts for the quest, is saved, and is back where it was when the game opens again', () => {
    const game = room({ quests: [{ id: 'make_yourself_at_home', status: 'active', progress: [0] }] });
    run(game, 0.1);
    for (let i = 0; i < 3; i += 1) {
      game.player = createPlayerAt(3, 6 - i, 'right');
      run(game, 0.1);
      tap(game, 'Space', 0.05);
      run(game, 0.6);
    }
    expect(game.quests.progress('make_yourself_at_home')).toEqual([3]);
    const placed = [...game.map.extras.values()].map((o) => `${o.def.id}@${o.x},${o.y}`).sort();
    expect(placed).toHaveLength(3);
    const written = game.toSaveState();
    expect(written.placed[HOUSE]).toHaveLength(3);
    const again = reopen(game);
    expect([...again.map.extras.values()].map((o) => `${o.def.id}@${o.x},${o.y}`).sort()).toEqual(placed);
    expect(again.toSaveState()).toEqual(written);
  });

  it('keeps the player out of a spot where furniture stands when loading', () => {
    const game = room();
    run(game, 0.1);
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    const written = game.toSaveState();
    const standing = { ...written, player: { x: 4 * 16 + 8, y: 6 * 16 + 14, facing: 'up' as const } }; // inside the chair's cell
    const again = new Game(new World(CONTENT), new InputState(), standing);
    expect(again.map.collision.boxHitsSolid({ x: again.player.x - 5, y: again.player.y - 6, w: 10, h: 6 })).toBe(false);
  });
});

describe('the carpenter and the greenhouse', () => {
  const rich = { money: 2000, inventory: pockets(stack('stone', 60), stack('copper_bar', 7)), npcs: { bram: known() } };
  const atBram = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 27, 18, 'up', { ...rich, ...patch });

  it('offers the greenhouse with its price, and will not take an order the player cannot pay', () => {
    const poor = atBram({ money: 100, inventory: pockets(stack('stone', 5)) });
    run(poor, 0.1);
    tap(poor, 'KeyE');
    readThrough(poor);
    expect(poor.dialog?.speaker?.id).toBe('bram');
    pick(poor, 'npc:build');
    const option = poor.dialog!.options[0]!;
    expect(option.label).toBe('Greenhouse · 800g, 50 Stone, 6 Copper bar');
    expect(option.enabled).toBe(false);
    expect(poor.pending).toEqual([]);
  });

  it('takes the money and materials, puts up scaffolding at the site, and has it finished three mornings later', () => {
    const game = atBram();
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:build');
    pick(game, 'build:greenhouse');
    expect(game.money).toBe(1200);
    expect(game.inventory.count('stone')).toBe(10);
    expect(game.inventory.count('copper_bar')).toBe(1);
    expect(game.buildingStatus('greenhouse')).toBe('ordered');
    expect(game.pending).toHaveLength(1);

    game.closeDialog();
    const summaries = listen(game, 'daySummary');
    for (let night = 1; night <= 2; night += 1) {
      game.endDay('slept'); // the player wakes on the farm: its site shows the scaffolding
      game.dismissSummary();
      expect(game.buildingStatus('greenhouse')).toBe('ordered'); // not yet
      expect([...game.world.map(FARM).extras.values()].map((o) => o.def.id)).toEqual(['construction']);
      expect(game.world.map(FARM).exits.some((e) => e.to.map === GREENHOUSE)).toBe(false);
    }
    game.endDay('slept');
    expect(game.buildingStatus('greenhouse')).toBe('built');
    expect(summaries.at(-1)?.built).toEqual(['Greenhouse']);
    expect([...game.world.map(FARM).extras.values()].map((o) => o.def.id)).toEqual(['greenhouse']);
    expect(game.world.map(FARM).exits.some((e) => e.to.map === GREENHOUSE)).toBe(true);
  });

  it('cannot be ordered twice, and the quest hears when it is built', () => {
    const game = atBram({ quests: [{ id: 'glass_and_sunshine', status: 'active', progress: [0] }] });
    expect(game.orderBuilding('greenhouse')).toMatchObject({ ok: true, readyDay: 4 });
    expect(game.orderBuilding('greenhouse')).toMatchObject({ ok: false });
    expect(game.money).toBe(1200);
    for (let i = 0; i < 3; i += 1) {
      game.endDay('slept');
      game.dismissSummary();
    }
    expect(game.quests.status('glass_and_sunshine')).toBe('ready');
    expect(game.orderBuilding('greenhouse')).toMatchObject({ ok: false });
  });

  it('survives a save at every stage: ordered, finished, and reopened', () => {
    const game = atBram();
    game.orderBuilding('greenhouse');
    const ordered = reopen(game);
    expect(ordered.pending).toHaveLength(1);
    ordered.endDay('slept'); // wakes on the farm, which is laid out on arrival
    ordered.dismissSummary();
    expect([...ordered.world.map(FARM).extras.values()].map((o) => o.def.id)).toEqual(['construction']);
    const midway = reopen(ordered); // closed and opened again while it is being built, standing on the farm
    expect([...midway.world.map(FARM).extras.values()].map((o) => o.def.id)).toEqual(['construction']);
    for (let i = 0; i < 2; i += 1) {
      ordered.endDay('slept');
      ordered.dismissSummary();
    }
    const done = reopen(ordered);
    expect([...done.world.map(FARM).extras.values()].map((o) => o.def.id)).toEqual(['greenhouse']);
    expect(done.world.map(FARM).exits.some((e) => e.to.map === GREENHOUSE)).toBe(true);
    expect(done.toSaveState().buildings).toEqual({ built: ['greenhouse'], pending: [] });
    expect(done.toSaveState().placed[FARM]).toBeUndefined(); // buildings are derived, not saved as furniture
  });

  it('is walked into through its door once built', () => {
    const game = farmGameAt({ x: 24, y: 19 }, 'up', { buildings: { built: ['greenhouse'], pending: [] } });
    walk(game, 'KeyW', 1.5);
    expect(game.map.id).toBe(GREENHOUSE);
    expect(game.map.sheltered).toBe(true);
    walk(game, 'KeyS', 1.5);
    expect(game.map.id).toBe(FARM);
    expect(Math.floor(game.player.x / 16)).toBe(24);
  });

  it('lets crops grow through a change of season under glass, while the same crop outside withers', () => {
    // The last night of autumn: pumpkins are an autumn crop. One is in the greenhouse, one in the open field.
    const inside = at(GREENHOUSE, 5, 7, 'up', { time: { day: 84, minutes: 20 * 60 }, buildings: { built: ['greenhouse'], pending: [] } });
    inside.farm.till(5, 4);
    inside.farm.plant(5, 4, 'pumpkin', 80);
    inside.farm.water(5, 4);
    inside.endDay('slept');
    expect(inside.clock.day).toBe(85); // winter
    const kept = inside.toSaveState().farms[GREENHOUSE]?.crops ?? [];
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ crop: 'pumpkin', daysInStage: 1 }); // it grew a day

    const outside = farmGameAt({ x: 13, y: 20 }, 'down', { time: { day: 84, minutes: 20 * 60 } });
    outside.farm.till(8, 26);
    outside.farm.plant(8, 26, 'pumpkin', 80);
    outside.farm.water(8, 26);
    outside.endDay('slept');
    expect(outside.toSaveState().farms[FARM]?.crops ?? []).toHaveLength(0); // withered with the change of season
  });

  it('lets a seed be planted in winter only under glass', () => {
    const inside = at(GREENHOUSE, 5, 5, 'up', { time: { day: 85, minutes: TEN_AM.minutes }, inventory: pockets(stack('hoe', 1), stack('radish_seeds', 3)), buildings: { built: ['greenhouse'], pending: [] } });
    run(inside, 0.1);
    tap(inside, 'Space', 0.05); // till (5,4)
    run(inside, 0.6);
    inside.inventory.select(1);
    tap(inside, 'Space', 0.05);
    run(inside, 0.6);
    expect(inside.farm.cropAt(5, 4)?.crop).toBe('radish');

    const outside = farmGameAt({ x: 8, y: 25 }, 'down', { time: { day: 85, minutes: TEN_AM.minutes }, inventory: pockets(stack('hoe', 1), stack('radish_seeds', 3)) });
    run(outside, 0.1);
    tap(outside, 'Space', 0.05); // till (8,26)
    run(outside, 0.6);
    outside.inventory.select(1);
    const hints = listen(outside, 'hint');
    tap(outside, 'Space', 0.05);
    expect(hints.at(-1)?.text).toContain('will not grow');
  });
});

describe('digging up what is buried', () => {
  const diggable = (game: Game) => [...game.map.nodes.values()].filter((n) => n.def.id === 'dig_spot');

  it('has a few spots on the farm each day, in different places each day, and none where it cannot be dug', () => {
    const game = farmGameAt({ x: 13, y: 15 }, 'down');
    const today = diggable(game).map((n) => `${n.x},${n.y}`).sort();
    expect(today).toHaveLength(3);
    for (const n of diggable(game)) {
      expect(game.map.isWalkable(n.x, n.y)).toBe(true);
      expect(game.map.isTillable(n.x, n.y)).toBe(false);
    }
    game.endDay('slept');
    expect(diggable(game).map((n) => `${n.x},${n.y}`).sort()).not.toEqual(today);
    expect(diggable(game)).toHaveLength(3);
  });

  it('gives up an artifact to the hoe: it goes in the pockets, the collection and the quest', () => {
    const game = farmGameAt({ x: 13, y: 15 }, 'down', { inventory: pockets(stack('hoe', 1)), quests: [{ id: 'buried_things', status: 'active', progress: [0] }] });
    const spot = diggable(game)[0]!;
    game.player = createPlayerAt(spot.x, spot.y - 1, 'down');
    run(game, 0.1);
    expect(game.cursor?.valid).toBe(true);
    const hints = listen(game, 'hint');
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.map.nodeAt(spot.x, spot.y)).toBeUndefined();
    const found = ['clay_pot', 'arrowhead', 'old_coin', 'glass_bead'].find((id) => game.inventory.count(id) > 0);
    expect(found).toBeDefined();
    expect(game.collection[found!]).toBe(1);
    expect(hints.some((h) => h.text.startsWith('Dug up'))).toBe(true);
    expect(game.quests.progress('buried_things')).toEqual([1]);
  });

  it('never tills a dig spot, and works the ground as usual elsewhere', () => {
    const game = farmGameAt({ x: 13, y: 15 }, 'down', { inventory: pockets(stack('hoe', 1)) });
    const spot = diggable(game)[0]!;
    game.player = createPlayerAt(spot.x, spot.y - 1, 'down');
    run(game, 0.1);
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.farm.isTilled(spot.x, spot.y)).toBe(false);
  });
});

describe('the museum', () => {
  const inside = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(MUSEUM, 3, 4, 'up', { npcs: { ines: known() }, ...patch });
  const open = (game: Game): void => {
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
  };

  it('is a building on the green with a door, a curator and cases', () => {
    const game = at(GREEN, 30, 25, 'up');
    walk(game, 'KeyW', 1.5);
    expect(game.map.id).toBe(MUSEUM);
    expect(game.villagersHere().map((v) => v.id)).toEqual(['ines']);
  });

  it('takes what it wants once each, and politely refuses what it has or does not want', () => {
    const game = inside({ inventory: pockets(stack('carp', 2), stack('radish', 3), stack('quartz', 1)) });
    open(game);
    const labels = game.dialog!.options.map((o) => o.label);
    expect(labels).toContain('Give the Carp');
    expect(labels).toContain('Give the Quartz');
    expect(labels.some((l) => l.includes('Radish'))).toBe(false); // crops are not on its list
    pick(game, 'museum:give:carp');
    expect(game.museum?.has('carp')).toBe(true);
    expect(game.inventory.count('carp')).toBe(1);
    expect(game.dialog!.options.some((o) => o.id === 'museum:give:carp')).toBe(false); // one of each
    expect(game.dialog?.lines[0]).toContain('Willowbrook Museum: 1 of 18 things on display.');
  });

  it('pays a reward at each milestone, once, and says what it paid', () => {
    const game = inside({ inventory: pockets(stack('minnow', 1), stack('perch', 1), stack('carp', 1)) });
    open(game);
    pick(game, 'museum:give:minnow');
    pick(game, 'museum:give:perch');
    const before = game.money;
    pick(game, 'museum:give:carp');
    expect(game.money).toBe(before + 100);
    expect(game.dialog?.lines[0]).toContain('Three pieces');
    expect(game.museum?.toSave().claimed).toEqual([3]);
    game.closeDialog();
    open(game);
    expect(game.money).toBe(before + 100); // not again
  });

  it('holds a reward back when the pockets cannot take all of it, and hands it over when they can', () => {
    // Fourteen things are on display and four rewards taken: the fifteenth earns three iron bars and two quartz, which need two slots.
    const donated = ['minnow', 'perch', 'carp', 'trout', 'catfish', 'pike', 'stone', 'copper_ore', 'iron_ore', 'coal', 'quartz', 'clay_pot', 'arrowhead', 'old_coin'];
    const full = [stack('amethyst', 1), ...Array.from({ length: 11 }, (_, i) => stack(i % 2 === 0 ? 'radish' : 'tomato', 99, ((i % 2) + 1) as 1 | 2))];
    const game = inside({ inventory: { slots: full, selected: 0, canWater: 24 }, museum: { donated, claimed: [3, 6, 9, 12] } });
    open(game);
    pick(game, 'museum:give:amethyst'); // frees one slot: not enough for both rewards
    expect(game.museum?.has('amethyst')).toBe(true);
    expect(game.museum?.toSave().claimed).toEqual([3, 6, 9, 12]);
    expect(game.inventory.count('iron_bar')).toBe(0);
    game.closeDialog();
    for (let i = game.inventory.slots.length - 1; i >= 0; i -= 1) if (game.inventory.slots[i]?.id === 'tomato') game.inventory.take(i, 99);
    open(game); // room now: the curator hands them over
    expect(game.museum?.toSave().claimed).toEqual([3, 6, 9, 12, 15]);
    expect(game.inventory.count('iron_bar')).toBe(3);
    expect(game.inventory.count('quartz')).toBe(2);
  });

  it('counts a donation for the quest, and keeps the collection through a save', () => {
    const game = inside({ inventory: pockets(stack('coal', 1), stack('fossil', 1)), quests: [{ id: 'first_finds', status: 'active', progress: [0] }] });
    open(game);
    pick(game, 'museum:give:coal');
    pick(game, 'museum:give:fossil');
    expect(game.quests.progress('first_finds')).toEqual([2]);
    const again = reopen(game);
    expect(again.museum?.has('coal')).toBe(true);
    expect(again.museum?.has('fossil')).toBe(true);
    expect(again.museum?.count).toBe(2);
    expect(again.toSaveState().museum).toEqual(game.toSaveState().museum);
  });
});
