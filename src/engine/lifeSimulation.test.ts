import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { InputState } from './input/actions';
import { Game } from './game';
import { createPlayerAt } from './player/player';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import type { RanchSave } from './ranch/types';
import { heartsOf, newRecord, type NpcRecord } from './social/friendship';
import { farmGameAt, listen, pick, readThrough, run, tap } from './testing';
import { World } from './world/world';

/**
 * Phase 3, played through the real maps and data: villagers who walk their day between two maps, friendship and
 * gifts, quests, the hens, the walk to the village, and everything surviving a save.
 */

const FARM = 'willowbrook.home_farm';
const GREEN = 'willowbrook.village_green';
const TEN_AM = { day: 1, minutes: 10 * 60 };

const stack = (id: string, count: number, quality: 0 | 1 | 2 = 0) => ({ id, count, quality });
const pockets = (...stacks: ReturnType<typeof stack>[]) => ({
  slots: [...stacks, ...Array.from({ length: 12 - stacks.length }, () => null)],
  selected: 0,
  canWater: 24,
});
const known = (changes: Partial<NpcRecord> = {}): NpcRecord => ({ ...newRecord(), met: true, ...changes });
const hen = (name: string, extra: Partial<RanchSave['animals'][number]> = {}): RanchSave['animals'][number] => ({
  id: `hen-${name}`,
  kind: 'chicken',
  name,
  friendship: 0,
  pettedDay: 0,
  fedDay: 0,
  ...extra,
});
const coopWith = (animals: RanchSave['animals'][number][], feed = 0): { [FARM]: RanchSave } => ({ [FARM]: { animals, feed, basket: [] } });

/** In front of Willa at her stall, at ten in the morning. */
const atWilla = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => farmGameAt({ x: 22, y: 20 }, 'up', { time: TEN_AM, ...patch });
/** On the green, in front of Tobias on his bench, at ten in the morning. */
const atTobias = (patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId: GREEN, player: { x: 23 * 16 + 8, y: 14 * 16 + 14, facing: 'up' }, time: TEN_AM, ...patch });

const teleport = (game: Game, x: number, y: number, facing: 'up' | 'down' | 'left' | 'right'): void => {
  game.player = createPlayerAt(x, y, facing);
  run(game, 0.05);
};

/** Walks up to whoever is in front, and reads through their greeting until there is a choice. */
const talk = (game: Game): void => {
  run(game, 0.1);
  tap(game, 'KeyE');
  readThrough(game);
};

/** Does something and reads through what the speaker says in answer. */
const say = (game: Game, prefix: string): void => {
  pick(game, prefix);
  readThrough(game);
};

describe('villagers and their day', () => {
  it('start the morning at home on the green, and the farm is empty of people', () => {
    const game = farmGameAt({ x: 13, y: 13 }, 'up');
    expect(game.villagersHere()).toHaveLength(0);
    expect(game.villagers.onMap(GREEN).map((v) => v.id).sort()).toEqual(['bram', 'tobias', 'willa']); // Hollis and Ines are indoors, June is at the river
  });

  it('Willa walks the east road at eight, crosses into the farm and is minding her stall by nine', () => {
    const game = farmGameAt({ x: 13, y: 13 }, 'up'); // 6:00, the player waiting by the house
    run(game, 112); // about 160 game minutes
    expect(game.clock.minutes).toBeGreaterThan(8 * 60 + 30);
    expect(game.villagersHere().map((v) => v.id)).toEqual(['willa']);
    expect(game.villagers.servingShop('seed_stall', FARM, game.clock.minutes)).toBeDefined();
    expect(game.villagers.states.get('tobias')!.map).toBe(GREEN);
  });

  it('keep their day while the player is elsewhere, and come back along the same road in the evening', () => {
    const game = atTobias(); // the player is on the green; Willa is at her stall on the farm
    expect(game.villagersHere().map((v) => v.id).sort()).toEqual(['bram', 'tobias']);
    run(game, 360); // to about half past six in the evening
    expect(game.clock.minutes).toBeGreaterThan(18 * 60);
    const here = game.villagersHere().map((v) => v.id);
    expect(here).toEqual(expect.arrayContaining(['tobias', 'willa', 'hollis'])); // Hollis shut the shop at five and is out in the air
    expect(game.villagers.servingShop('seed_stall', FARM, game.clock.minutes)).toBeUndefined();
  });

  it('stand where the prompt says they are, and turn to face you when you speak', () => {
    const game = atWilla();
    run(game, 0.1);
    expect(game.prompt).toMatchObject({ verb: 'Talk to', name: 'Willa Thorne', x: 22, y: 19 });
    expect(game.villagers.states.get('willa')!.facing).toBe('left'); // watching the road
    tap(game, 'KeyE');
    expect(game.villagers.states.get('willa')!.facing).toBe('down'); // the player is below her, facing up
  });

  it('are solid: the player stops at them and slides along them, and is never held if one arrives on top of them', () => {
    const game = atWilla(); // Willa is in the cell above the player
    game.input.press('KeyW');
    run(game, 1);
    game.input.release('KeyW');
    const willa = game.villagers.states.get('willa')!;
    expect(game.player.y).toBeGreaterThan(willa.y); // never got past her
    expect(game.player.y - willa.y).toBeLessThan(16 + 2);

    // Walking sideways along her side is fine.
    game.input.press('KeyD');
    run(game, 0.6);
    game.input.release('KeyD');
    expect(game.player.x).toBeGreaterThan(22 * 16 + 8 + 8);

    // Someone standing right where a villager is placed can still walk away.
    const trapped = atWilla();
    trapped.player = createPlayerAt(22, 19, 'down'); // inside Willa's cell
    run(trapped, 0.05);
    const before = trapped.player.y;
    trapped.input.press('KeyS');
    run(trapped, 0.5);
    trapped.input.release('KeyS');
    expect(trapped.player.y).toBeGreaterThan(before + 3);
  });

  it('serve the stall when you walk up to the counter: the keeper speaks for it', () => {
    const game = farmGameAt({ x: 20, y: 20 }, 'up', { time: TEN_AM });
    run(game, 0.1);
    expect(game.prompt).toMatchObject({ verb: 'Browse', name: 'Seed stall' });
    tap(game, 'KeyE');
    readThrough(game);
    expect(game.dialog?.speaker?.id).toBe('willa');
  });
});

describe('friendship', () => {
  it('greets a stranger properly, and remembers that you met', () => {
    const game = atWilla();
    expect(game.villagers.record('willa').met).toBe(false);
    talk(game);
    expect(game.dialog?.lines[0]).toContain("You must be the new farmer");
    expect(game.villagers.record('willa').met).toBe(true);
    game.closeDialog();
    talk(game);
    expect(game.dialog?.lines[0]).not.toContain("new farmer");
  });

  it('gives twenty points for the first chat of a day, and nothing for a second', () => {
    const game = atWilla({ npcs: { willa: known() } });
    talk(game);
    say(game, 'npc:chat');
    expect(game.villagers.record('willa').friendship).toBe(20);
    expect(game.dialog).toBeUndefined();
    talk(game);
    say(game, 'npc:chat');
    expect(game.villagers.record('willa').friendship).toBe(20);
    game.clock.day = 2;
    talk(game);
    say(game, 'npc:chat');
    expect(game.villagers.record('willa').friendship).toBe(40);
  });

  it('reacts to gifts by taste: loved, disliked, and a limit of one a day and two a week', () => {
    const game = atWilla({ npcs: { willa: known({ friendship: 100 }) }, inventory: pockets(stack('sunflower', 4), stack('radish', 2)) });
    talk(game);
    say(game, 'npc:gift'); // a sunflower: she loves them
    expect(game.villagers.record('willa').friendship).toBe(180);
    expect(game.inventory.count('sunflower')).toBe(3);

    talk(game);
    const again = game.dialog!.options.find((o) => o.id.startsWith('npc:gift'))!;
    expect(again.enabled).toBe(false);
    expect(again.label).toContain('already today');
    game.closeDialog();

    game.clock.day = 2;
    game.inventory.select(1); // radishes: she dislikes them
    talk(game);
    say(game, 'npc:gift');
    expect(game.villagers.record('willa').friendship).toBe(160);

    game.clock.day = 3; // the same week, and two gifts have been given
    talk(game);
    const enough = game.dialog!.options.find((o) => o.id.startsWith('npc:gift'))!;
    expect(enough.enabled).toBe(false);
    expect(enough.label).toContain('this week');
    game.closeDialog();

    game.clock.day = 8; // a new week
    talk(game);
    expect(game.dialog!.options.find((o) => o.id.startsWith('npc:gift'))?.enabled).toBe(true);
  });

  it('does not accept a tool as a gift', () => {
    const game = atWilla({ npcs: { willa: known() } }); // the hoe is selected
    talk(game);
    expect(game.dialog!.options.some((o) => o.id.startsWith('npc:gift'))).toBe(false);
  });

  it('makes a birthday gift count four times over, and has the villager say so', () => {
    const game = atWilla({ time: { day: 14, minutes: TEN_AM.minutes }, npcs: { willa: known() }, inventory: pockets(stack('sunflower', 2)) });
    talk(game);
    expect(game.dialog?.lines[0]).toContain('birthday');
    pick(game, 'npc:gift');
    expect(game.villagers.record('willa').friendship).toBe(80 * 4);
    expect(game.dialog?.lines.join(' ')).toContain('Oh! You remembered');
  });

  it('hands over a reward when the hearts are earned, once, and only with room for it', () => {
    const game = atTobias({ npcs: { tobias: known({ friendship: 190 }) } });
    talk(game);
    say(game, 'npc:chat'); // 190 + 20 = two hearts
    expect(heartsOf(game.villagers.record('tobias').friendship)).toBe(2);
    expect(game.inventory.count('chicken_feed')).toBe(5);
    expect(game.villagers.record('tobias').rewards).toEqual([0]);
    game.clock.day = 2;
    talk(game);
    say(game, 'npc:chat');
    expect(game.inventory.count('chicken_feed')).toBe(5); // not again

    const full = atTobias({
      npcs: { tobias: known({ friendship: 190 }) },
      inventory: pockets(...Array.from({ length: 12 }, (_, i) => stack(i === 0 ? 'hoe' : i === 1 ? 'watering_can' : 'radish', 1, i < 2 ? 0 : (((i % 2) + 1) as 1 | 2)))),
    });
    talk(full);
    say(full, 'npc:chat');
    expect(full.villagers.record('tobias').rewards).toEqual([]); // kept for when there is room
    expect(full.inventory.count('chicken_feed')).toBe(0);
  });
});

describe('the stall and the hens', () => {
  it('sells a chicken to the coop, and takes the money', () => {
    const game = atWilla({ money: 300, npcs: { willa: known() } });
    talk(game);
    say(game, 'npc:shop');
    pick(game, 'buy:3'); // radish seeds, strawberry seeds, feed, chicken
    expect(game.money).toBe(50);
    expect(game.mainRanch()?.animals).toHaveLength(1);
    expect(game.dialog?.note).toContain('bought a chicken');
  });

  it('will not sell a chicken when the coop is full', () => {
    const game = atWilla({ money: 900, npcs: { willa: known() }, ranches: coopWith([hen('A'), hen('B'), hen('C'), hen('D')]) });
    talk(game);
    say(game, 'npc:shop');
    const chicken = game.dialog!.options[3]!;
    expect(chicken.label).toContain('Chicken');
    expect(chicken.enabled).toBe(false);
    expect(game.mainRanch()?.animals).toHaveLength(4);
    expect(game.money).toBe(900);
  });

  it('lets you pet a hen once a day, for friendship', () => {
    const game = farmGameAt({ x: 30, y: 30 }, 'right', { ranches: coopWith([hen('Clover')]) });
    const clover = game.mainRanch()!.animals[0]!;
    clover.x = 31 * 16 + 8;
    clover.y = 30 * 16 + 14;
    clover.mode = 'idle';
    clover.timer = 999;
    run(game, 0.05);
    expect(game.prompt).toMatchObject({ verb: 'Pet', name: 'Clover' });
    tap(game, 'KeyE');
    expect(clover.friendship).toBe(15);
    tap(game, 'KeyE');
    expect(clover.friendship).toBe(15);
  });

  it('fills the trough, lays an egg for a fed hen overnight, and lets you collect it', () => {
    const game = farmGameAt({ x: 31, y: 32 }, 'up', { ranches: coopWith([hen('Clover')]), inventory: pockets(stack('chicken_feed', 5)) });
    run(game, 0.05);
    expect(game.prompt).toMatchObject({ verb: 'Fill', name: 'Feed trough' });
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'trough:fill');
    expect(game.mainRanch()?.feed).toBe(5);
    expect(game.inventory.count('chicken_feed')).toBe(0);

    const summaries = listen(game, 'daySummary');
    game.endDay('slept');
    expect(summaries[0]).toMatchObject({ eggs: 1 });
    expect(game.mainRanch()?.eggCount()).toBe(1);
    game.dismissSummary();

    teleport(game, 30, 28, 'up');
    expect(game.prompt).toMatchObject({ verb: 'Open', name: 'Chicken coop' });
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'coop:collect');
    expect(game.inventory.count('egg')).toBe(1);
    expect(game.mainRanch()?.eggCount()).toBe(0);
  });

  it('lays nothing for a hungry hen, who minds it a little', () => {
    const game = farmGameAt({ x: 13, y: 13 }, 'up', { ranches: coopWith([hen('Clover', { friendship: 50 })]) });
    game.endDay('slept');
    expect(game.mainRanch()?.eggCount()).toBe(0);
    expect(game.mainRanch()?.animals[0]?.friendship).toBe(45);
  });
});

describe('quests', () => {
  it('offers what can be done now, two at a time, and not what is locked behind another', () => {
    const game = atWilla({ npcs: { willa: known() } });
    talk(game);
    const ids = game.dialog!.options.map((o) => o.id);
    expect(ids).toContain('npc:offer:willa:welcome_to_the_green');
    expect(ids).toContain('npc:offer:willa:a_good_first_crop');
    expect(ids).not.toContain('npc:offer:willa:a_feathered_friend');
  });

  it('runs the walk to the village: accept, walk east off the edge of the farm, report back', () => {
    const game = atWilla({ npcs: { willa: known() } });
    const hints = listen(game, 'hint');
    talk(game);
    say(game, 'npc:offer:willa:welcome_to_the_green');
    pick(game, 'quest:accept:willa:welcome_to_the_green');
    readThrough(game);
    expect(game.quests.status('welcome_to_the_green')).toBe('active');

    // The road east. (The player is put at the last stretch of it: the walk itself is checked below.)
    teleport(game, 58, 21, 'right');
    game.input.press('KeyD');
    run(game, 1.5);
    game.input.release('KeyD');
    run(game, 0.05); // a moment with nothing held: the exit back opens to someone who has just arrived
    expect(game.map.id).toBe(GREEN);
    expect(game.quests.status('welcome_to_the_green')).toBe('ready');
    expect(hints.some((h) => h.text.includes('Quest ready'))).toBe(true);

    game.input.press('KeyA');
    run(game, 3);
    game.input.release('KeyA');
    expect(game.map.id).toBe(FARM);
    teleport(game, 22, 20, 'up');
    talk(game);
    const moneyBefore = game.money;
    say(game, 'npc:report:willa:welcome_to_the_green');
    expect(game.quests.status('welcome_to_the_green')).toBe('done');
    expect(game.money).toBe(moneyBefore + 50);
    expect(game.villagers.record('willa').friendship).toBe(30);
  });

  it('counts radishes only when the bin is paid for, readies the quest overnight, and pays in a hen', () => {
    const game = farmGameAt({ x: 21, y: 13 }, 'up', {
      inventory: pockets(stack('radish', 5)),
      npcs: { willa: known() },
      quests: [{ id: 'a_good_first_crop', status: 'active', progress: [0] }],
    });
    run(game, 0.1);
    tap(game, 'KeyE'); // ship them
    game.closeDialog();
    expect(game.quests.progress('a_good_first_crop')).toEqual([0]);
    const summaries = listen(game, 'daySummary');
    game.endDay('slept');
    expect(game.quests.status('a_good_first_crop')).toBe('ready');
    expect(summaries[0]?.readyQuests).toEqual(['A Good First Crop']);
    game.dismissSummary();

    run(game, 112); // Willa is at her stall by half past eight
    teleport(game, 22, 20, 'up');
    talk(game);
    const moneyBefore = game.money;
    say(game, 'npc:report:willa:a_good_first_crop');
    expect(game.quests.status('a_good_first_crop')).toBe('done');
    expect(game.money).toBe(moneyBefore + 100);
    expect(game.mainRanch()?.animals).toHaveLength(1);
    expect(game.villagers.record('willa').friendship).toBe(50);
    game.closeDialog();

    // The next quest in the chain is now on offer.
    game.clock.day += 1;
    talk(game);
    expect(game.dialog!.options.map((o) => o.id)).toContain('npc:offer:willa:a_feathered_friend');
  });

  it('keeps the quest of feeding and collecting through the nights', () => {
    const game = farmGameAt({ x: 13, y: 13 }, 'up', {
      ranches: coopWith([hen('Clover')], 6),
      quests: [{ id: 'a_feathered_friend', status: 'active', progress: [0, 0] }],
    });
    game.endDay('slept');
    expect(game.quests.progress('a_feathered_friend')).toEqual([1, 0]);
    game.dismissSummary();
    teleport(game, 30, 28, 'up');
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'coop:collect');
    expect(game.quests.progress('a_feathered_friend')).toEqual([1, 1]);
    expect(game.quests.status('a_feathered_friend')).toBe('active');
  });

  it('takes strawberries to Tobias, a few at a time', () => {
    const game = atTobias({ npcs: { tobias: known() }, inventory: pockets(stack('strawberry', 2)) });
    talk(game);
    say(game, 'npc:offer:tobias:sweet_on_strawberries');
    pick(game, 'quest:accept:tobias');
    readThrough(game);
    expect(game.quests.status('sweet_on_strawberries')).toBe('active');

    talk(game);
    say(game, 'npc:deliver:tobias:sweet_on_strawberries');
    expect(game.inventory.count('strawberry')).toBe(0);
    expect(game.quests.progress('sweet_on_strawberries')).toEqual([2]);
    expect(game.quests.status('sweet_on_strawberries')).toBe('active');

    game.inventory.add({ id: 'strawberry', count: 1, quality: 0 });
    talk(game);
    say(game, 'npc:deliver:tobias:sweet_on_strawberries');
    expect(game.quests.status('sweet_on_strawberries')).toBe('ready');
    talk(game);
    const before = game.money;
    say(game, 'npc:report:tobias:sweet_on_strawberries');
    expect(game.money).toBe(before + 120);
    expect(game.flags.has('tobias_has_jam_plans')).toBe(true);
  });
});

describe('walking between maps', () => {
  it('leaves the farm at the east road and arrives on the green facing east, once', () => {
    const game = farmGameAt({ x: 59, y: 21 }, 'right');
    game.setViewport(800, 600, 3);
    const changes = listen(game, 'mapChanged');
    game.input.press('KeyD');
    run(game, 1);
    game.input.release('KeyD');
    expect(game.map.id).toBe(GREEN);
    expect(changes).toHaveLength(1);
    expect(game.flags.has(`visited:${GREEN}`)).toBe(true);
    // The camera is on the new map at once, not sliding across from where the farm was.
    const view = game.camera.bounds();
    expect(game.player.x).toBeGreaterThan(view.x);
    expect(game.player.x).toBeLessThan(view.x + view.w);
    run(game, 1); // standing on the arrival cell, nothing sends the player straight back
    expect(game.map.id).toBe(GREEN);
  });

  it('comes back to the farm road, facing west, and walking on does not bounce it back', () => {
    const game = farmGameAt({ x: 0, y: 0 }, 'left', { mapId: GREEN, player: { x: 3 * 16 + 8, y: 14 * 16 + 14, facing: 'left' } });
    game.input.press('KeyA');
    run(game, 1.5);
    expect(game.map.id).toBe(FARM);
    expect(game.player.x).toBeLessThan(62 * 16);
    run(game, 1.5);
    expect(game.map.id).toBe(FARM);
    game.input.release('KeyA');
  });

  it('closes a message box that was open when the player left', () => {
    const game = farmGameAt({ x: 59, y: 21 }, 'right');
    game.input.press('KeyD');
    run(game, 0.2);
    game.input.release('KeyD');
    expect(game.dialog).toBeUndefined();
  });

  it('sleeps through the night on the green and wakes in the farmhouse door', () => {
    const game = farmGameAt({ x: 0, y: 0 }, 'up', { mapId: GREEN, player: { x: 8 * 16 + 8, y: 20 * 16 + 14, facing: 'up' } });
    game.endDay('exhausted');
    expect(game.map.id).toBe(FARM);
    expect(game.player.x).toBe(13 * 16 + 8);
    expect(game.villagersHere()).toHaveLength(0); // everyone is back on the green for the morning
  });
});

describe('life simulation in the save', () => {
  it('writes and restores friendships, hens, quests, flags and where you stood on the green', () => {
    const world = new World(CONTENT);
    const game = farmGameAt({ x: 0, y: 0 }, 'up', {
      mapId: GREEN,
      player: { x: 23 * 16 + 8, y: 14 * 16 + 14, facing: 'up' },
      time: TEN_AM,
      money: 321,
      npcs: { willa: known({ friendship: 260, rewards: [0], seen: ['willa.story'] }), tobias: known({ friendship: 40, talkedDay: 1 }) },
      ranches: { [FARM]: { animals: [hen('Clover', { friendship: 120, pettedDay: 1 })], feed: 4, basket: [stack('egg', 2, 1)] } },
      quests: [{ id: 'a_feathered_friend', status: 'active', progress: [2, 1] }, { id: 'welcome_to_the_green', status: 'done', progress: [1] }],
    });
    game.flags.add('tobias_has_jam_plans');
    run(game, 1);

    const written = game.toSaveState();
    const read = decodeSave(encodeSave(written, new Date()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.state).toEqual(written);

    const restored = new Game(world, new InputState(), read.state);
    expect(restored.map.id).toBe(GREEN);
    expect(restored.toSaveState()).toEqual(written);
    expect(restored.villagers.record('willa').friendship).toBe(260);
    expect(restored.quests.progress('a_feathered_friend')).toEqual([2, 1]);
    expect(restored.mainRanch()?.animals[0]).toMatchObject({ name: 'Clover', friendship: 120 });
    expect(restored.mainRanch()?.eggCount()).toBe(2);
    expect(restored.flags.has('tobias_has_jam_plans')).toBe(true);
  });

  it('keeps a farm and a coop on a map nobody has built yet', () => {
    const world = new World(CONTENT);
    const game = farmGameAt({ x: 0, y: 0 }, 'up', { mapId: GREEN, player: { x: 8 * 16 + 8, y: 20 * 16 + 14, facing: 'up' }, ranches: coopWith([hen('Clover')], 3), farms: { [FARM]: { soil: [{ x: 8, y: 26, watered: true }], crops: [] } } });
    const written = game.toSaveState();
    expect(written.ranches[FARM]?.animals).toHaveLength(1);
    expect(written.farms[FARM]?.soil).toHaveLength(1);
    expect(new Game(world, new InputState(), written).toSaveState().ranches).toEqual(written.ranches);
  });

  it('forgets quests and villagers the content no longer has, without failing to load', () => {
    const world = new World(CONTENT);
    const base = farmGameAt({ x: 13, y: 13 }, 'up').toSaveState();
    const odd = { ...base, npcs: { ghost: known({ friendship: 500 }) }, quests: [{ id: 'removed_quest', status: 'active' as const, progress: [1] }] };
    const game = new Game(world, new InputState(), odd);
    expect(game.quests.open()).toEqual([]);
    expect(game.villagers.record('willa').friendship).toBe(0);
  });
});
