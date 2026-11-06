import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { DEFAULT_FISH_STOCK, Game } from './game';
import { InputState } from './input/actions';
import { biting } from './fishing/rules';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import { generateMineFloor, mineFloorExitFromBelow } from './mine/generator';
import { MINE_SURFACE, mineFloorId } from './mine/surface';
import { createPlayerAt } from './player/player';
import { farmGameAt, listen, pick, readThrough, run, tap } from './testing';
import { World } from './world/world';

/**
 * Phase 4, played through the real maps and data: the insides of buildings, the general store, the way into the wood,
 * fishing and the old mine, and what they leave in the save.
 */

const FARM = 'willowbrook.home_farm';
const GREEN = 'willowbrook.village_green';
const WILLAS = 'willowbrook.willas_cottage';
const TOBIAS = 'willowbrook.tobias_cottage';
const STORE = 'willowbrook.general_store';
const RIVER = 'willowbrook.riverbank';
const WOOD = 'willowbrook.whispering_wood';
const TEN_AM = { day: 1, minutes: 10 * 60 };

const stack = (id: string, count: number, quality: 0 | 1 | 2 = 0) => ({ id, count, quality });
const pockets = (...stacks: ReturnType<typeof stack>[]) => ({
  slots: [...stacks, ...Array.from({ length: 12 - stacks.length }, () => null)],
  selected: 0,
  canWater: 24,
});
const cellAt = (x: number, y: number, facing: 'up' | 'down' | 'left' | 'right') => ({ x: x * 16 + 8, y: y * 16 + 14, facing });

/** A game on any map, the player standing in a cell. */
const at = (mapId: string, x: number, y: number, facing: 'up' | 'down' | 'left' | 'right', patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: cellAt(x, y, facing), time: TEN_AM, ...patch });

const walk = (game: Game, code: string, seconds: number): void => {
  game.input.press(code);
  run(game, seconds);
  game.input.release(code);
  run(game, 0.05); // a moment with nothing held: the exits open to someone who has just arrived
};

describe('the insides of buildings', () => {
  it('lets the player walk into a door and out again, onto the same step', () => {
    const game = at(GREEN, 8, 11, 'up'); // on the path in front of Tobias's door
    const changes = listen(game, 'mapChanged');
    walk(game, 'KeyW', 1.2);
    expect(game.map.id).toBe(TOBIAS);
    expect(changes).toHaveLength(1);
    expect(game.map.ambient).toBe('indoor');
    run(game, 1); // standing just inside the door: nothing bounces them back out
    expect(game.map.id).toBe(TOBIAS);
    walk(game, 'KeyS', 1.2);
    expect(game.map.id).toBe(GREEN);
    expect(Math.floor(game.player.x / 16)).toBe(8);
    expect(Math.floor((game.player.y - 3) / 16)).toBeGreaterThanOrEqual(10); // out on the path, below the door
  });

  it('has a way in and out of every building, and every door is a walkable cell', () => {
    const world = new World(CONTENT);
    for (const id of [WILLAS, TOBIAS, STORE]) {
      const inside = world.map(id);
      expect(inside.exits, id).toHaveLength(1);
      const door = inside.exits[0]!;
      expect(inside.isWalkable(door.x, door.y), id).toBe(true);
      const outside = world.map(door.to.map);
      const back = outside.exits.find((e) => e.to.map === id);
      expect(back, id).toBeDefined();
      expect(outside.isWalkable(back!.x, back!.y), id).toBe(true);
    }
  });

  it('puts Willa and Tobias to bed indoors, and they walk in through the door in front of the player', () => {
    const game = at(GREEN, 8, 12, 'up', { time: { day: 1, minutes: 20 * 60 + 30 } }); // watching Tobias's door
    expect(game.villagersHere().map((v) => v.id)).toContain('tobias');
    run(game, 60); // an hour and a bit of game time: past nine
    expect(game.clock.minutes).toBeGreaterThan(21 * 60 + 5);
    expect(game.villagers.states.get('tobias')!.map).toBe(TOBIAS);
    expect(game.villagers.states.get('willa')!.map).toBe(WILLAS);
    expect(game.villagersHere().map((v) => v.id)).not.toContain('tobias');
  });

  it('shows the person at home when the player walks in at night', () => {
    const game = at(TOBIAS, 4, 6, 'up', { time: { day: 1, minutes: 22 * 60 } });
    expect(game.villagersHere().map((v) => v.id)).toEqual(['tobias']);
  });

  it('wakes everyone up outside in the morning', () => {
    const game = at(GREEN, 8, 12, 'up', { time: { day: 1, minutes: 23 * 60 } });
    game.endDay('slept');
    expect(game.villagers.states.get('tobias')!.map).toBe(GREEN);
    expect(game.villagers.states.get('willa')!.map).toBe(GREEN);
    expect(game.villagers.states.get('hollis')!.map).toBe(STORE);
  });
});

describe("Hollis's general store", () => {
  const atCounter = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(STORE, 5, 5, 'up', { npcs: { hollis: { friendship: 0, met: true, talkedDay: 0, giftedDay: 0, giftWeek: -1, giftsThisWeek: 0, rewards: [], seen: [] } }, ...patch });

  it('has Hollis behind the counter from nine, speaking for it', () => {
    const game = atCounter();
    run(game, 0.1);
    expect(game.villagers.servingShop('general_store', STORE, game.clock.minutes)).toBeDefined();
    expect(game.prompt).toMatchObject({ verb: 'Browse' });
    tap(game, 'KeyE');
    readThrough(game);
    expect(game.dialog?.speaker?.id).toBe('hollis');
    expect(game.dialog?.options.map((o) => o.id)).toContain('npc:shop:hollis');
  });

  it('sells a rod and a pickaxe once each, and then says you have them', () => {
    const game = atCounter({ money: 300 });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:shop');
    expect(game.dialog?.options.map((o) => o.label).slice(0, 2)).toEqual(['Fishing rod · 60g', 'Pickaxe · 90g']);
    pick(game, 'buy:0');
    expect(game.inventory.count('fishing_rod')).toBe(1);
    expect(game.money).toBe(240);
    expect(game.dialog?.options[0]).toMatchObject({ label: 'Fishing rod · yours already', enabled: false });
    pick(game, 'buy:1');
    expect(game.inventory.count('pickaxe')).toBe(1);
    expect(game.money).toBe(150);
  });

  it('buys fish and minerals at a price that varies, and nothing it does not buy', () => {
    const game = atCounter({ inventory: pockets(stack('trout', 2), stack('copper_ore', 3)) });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:shop');
    const sell = game.dialog!.options.find((o) => o.id === 'sell:selected');
    expect(sell?.label).toMatch(/^Sell 2 Trout · \d+g/);
    const before = game.money;
    pick(game, 'sell:selected');
    expect(game.inventory.count('trout')).toBe(0);
    const trout = CONTENT.items.find((i) => i.id === 'trout')!.sellPrice;
    expect(game.money).toBeGreaterThanOrEqual(before + Math.floor(trout * 0.9) * 2);
    expect(game.money).toBeLessThanOrEqual(before + Math.floor(trout * 1.1) * 2);
  });

  it('is shut before nine and after five, and the counter says so', () => {
    const early = at(STORE, 5, 5, 'up', { time: { day: 1, minutes: 7 * 60 } });
    run(early, 0.1);
    tap(early, 'KeyE');
    expect(early.dialog?.speaker).toBeUndefined();
    expect(early.dialog?.lines.join(' ')).toContain('Hollis Reed is away');
    expect(early.dialog?.lines.join(' ')).toContain('9:00 am');
  });
});

describe('the way into the wood', () => {
  const north = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 22, 3, 'up', patch);

  it('is closed until Hollis has been helped: the player is turned back with a reason', () => {
    const game = north();
    const hints = listen(game, 'hint');
    walk(game, 'KeyW', 2);
    expect(game.map.id).toBe(GREEN);
    expect(hints.some((h) => h.text.includes('Brambles'))).toBe(true);
    expect(hints.filter((h) => h.text.includes('Brambles')).length).toBeLessThan(3); // said now and then, not every step
    expect(Math.floor((game.player.y - 3) / 16)).toBeGreaterThanOrEqual(1);
  });

  it('opens once the quest is done, and the way back is always open', () => {
    const game = north({ quests: [{ id: 'gone_fishing', status: 'done', progress: [3] }] });
    walk(game, 'KeyW', 2);
    expect(game.map.id).toBe(WOOD);
    expect(game.map.ambient).toBe('outdoor');
    walk(game, 'KeyS', 3);
    expect(game.map.id).toBe(GREEN);
  });

  it('is only closed to a way into the locked region, never inside it or between open maps', () => {
    const game = at(GREEN, 4, 27, 'down'); // the trail to the river is open to everyone
    walk(game, 'KeyS', 2);
    expect(game.map.id).toBe(RIVER);
  });

  it('does not carry a player who keeps a key held straight back out of the way they came in', () => {
    const game = at(WOOD, 30, 15, 'up', { quests: [{ id: 'gone_fishing', status: 'done', progress: [3] }] });
    game.input.press('KeyW');
    run(game, 3); // W never let go: through the cave mouth, onto the ladder side, and no further
    expect(game.map.id).toBe(mineFloorId(1));
    game.input.release('KeyW');
    run(game, 0.05);
    walk(game, 'KeyW', 1); // let go and press again: now the ladder takes them
    expect(game.map.id).toBe(WOOD);
  });

  it('opens the mine from the forest, onto floor 1', () => {
    const game = at(WOOD, 30, 15, 'up', { quests: [{ id: 'gone_fishing', status: 'done', progress: [3] }] });
    walk(game, 'KeyW', 1.5);
    expect(game.map.id).toBe(mineFloorId(1));
    expect(game.mineDeepest).toBe(1);
  });
});

describe('fishing', () => {
  /** A cell on the bank of a kind of water, a cell to stand on, and the way to face. */
  function bank(mapId: string, water: string): { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' } {
    const map = new World(CONTENT).map(mapId);
    const reachable = map.reachableFrom(map.spawn.x, map.spawn.y);
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!map.isWalkable(x, y) || reachable[y * map.width + x] !== 1) continue;
        for (const [facing, dx, dy] of dirs) if (map.fishingWater(x + dx, y + dy) === water && map.terrainAt(x, y)?.waterSource !== true) return { x, y, facing };
      }
    }
    throw new Error(`no bank for ${water} on ${mapId}`);
  }

  const withRod = (mapId: string, water: string, patch: Parameters<typeof farmGameAt>[2] = {}): Game => {
    const spot = bank(mapId, water);
    return at(mapId, spot.x, spot.y, spot.facing, { inventory: pockets(stack('fishing_rod', 1)), ...patch });
  };

  /** Casts, waits for the bite, and hooks it. */
  function castAndHook(game: Game): void {
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    expect(game.fishing?.phase).toBe('waiting');
    for (let i = 0; i < 600 && game.fishing?.phase === 'waiting'; i += 1) game.frame(1 / 60);
    expect(game.fishing?.phase).toBe('bite');
    game.input.press('Space');
    game.frame(1 / 60);
    game.input.release('Space');
    expect(game.fishing?.phase).toBe('reeling');
  }

  /** Presses use on a step where the marker is in the middle of the sweet spot. */
  function reelIn(game: Game): void {
    for (let i = 0; i < 1200 && game.fishing?.phase === 'reeling'; i += 1) {
      const session = game.fishing!;
      const mid = (session.zone.from + session.zone.to) / 2;
      if (Math.abs(session.marker - mid) < 0.02) {
        game.input.press('Space');
        game.frame(1 / 60);
        game.input.release('Space');
        return;
      }
      game.frame(1 / 60);
    }
  }

  it('finds a place to fish on the farm river, the farm pond and the riverbank, and in the wood', () => {
    expect(bank(FARM, 'river')).toBeDefined();
    expect(bank(FARM, 'pond')).toBeDefined();
    expect(bank(RIVER, 'river')).toBeDefined();
    expect(bank(WOOD, 'wood_pond')).toBeDefined();
  });

  it('casts, waits, hooks and lands a fish: it goes in the pockets and the collection, and counts for the quest', () => {
    const game = withRod(FARM, 'river', { quests: [{ id: 'gone_fishing', status: 'active', progress: [0] }] });
    const hints = listen(game, 'hint');
    castAndHook(game);
    reelIn(game);
    expect(game.fishing).toBeUndefined();
    const fish = ['minnow', 'perch'].find((id) => game.inventory.count(id) > 0);
    expect(fish).toBeDefined();
    expect(game.collection[fish!]).toBe(1);
    expect(hints.some((h) => h.text.startsWith('Caught a'))).toBe(true);
    expect(game.quests.progress('gone_fishing')).toEqual([1]);
  });

  it('lets a late or missed press go: the fish escapes and nothing is lost', () => {
    const game = withRod(FARM, 'river');
    const hints = listen(game, 'hint');
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    for (let i = 0; i < 1200 && game.fishing !== undefined; i += 1) game.frame(1 / 60); // never press anything
    expect(game.fishing).toBeUndefined();
    expect(hints.some((h) => h.text.includes('got away'))).toBe(true);
    expect(game.inventory.count('minnow') + game.inventory.count('perch')).toBe(0);
    expect(game.inventory.count('fishing_rod')).toBe(1);
  });

  it('pulls the line in when the player walks away while waiting, but not with a fish on the hook', () => {
    const game = withRod(FARM, 'river');
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    expect(game.fishing?.phase).toBe('waiting');
    walk(game, 'KeyA', 0.1);
    expect(game.fishing).toBeUndefined();

    const hooked = withRod(FARM, 'river');
    castAndHook(hooked);
    walk(hooked, 'KeyA', 0.2);
    expect(hooked.fishing?.phase).toBe('reeling'); // a stray key does not cost the fish
  });

  it('has something that can bite in every kind of water, in every season, at any hour of the day', () => {
    const waters = new Set(CONTENT.maps.flatMap((m) => (m.fishing ?? []).map((z) => z.water)));
    expect([...waters].sort()).toEqual(['pond', 'river', 'wood_pond']);
    for (const water of waters) {
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
        for (let minutes = 6 * 60; minutes < 20 * 60; minutes += 30) expect(biting(CONTENT.fish, water, season, minutes).length, `${water} ${season} ${minutes}`).toBeGreaterThan(0);
      }
    }
  });

  it('lets each water give only a few bites a day: after that the fish have had enough, until tomorrow', () => {
    const spot = bank(FARM, 'river');
    const game = at(FARM, spot.x, spot.y, spot.facing, { inventory: pockets(stack('fishing_rod', 1)) });
    const hints = listen(game, 'hint');
    let bites = 0;
    for (let cast = 0; cast < 12; cast += 1) {
      run(game, 0.1);
      tap(game, 'Space');
      run(game, 0.7);
      if (game.fishing === undefined) break; // "had enough"
      for (let i = 0; i < 1200 && game.fishing !== undefined; i += 1) {
        if (game.fishing.phase === 'bite' && bites === cast) bites += 1;
        game.frame(1 / 60);
      }
    }
    expect(bites).toBe(DEFAULT_FISH_STOCK);
    expect(hints.some((h) => h.text.includes('had enough of you'))).toBe(true);
    game.clock.day += 1; // a new day: the water has fish again
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    expect(game.fishing?.phase).toBe('waiting');
  });

  it('does not let the planks of a bridge or a dock be fished from', () => {
    const farm = new World(CONTENT).map(FARM);
    expect(farm.isWalkable(43, 21)).toBe(true); // the bridge
    expect(farm.fishingWater(43, 21)).toBeUndefined();
    const river = new World(CONTENT).map(RIVER);
    expect(river.fishingWater(7, 12)).toBeUndefined(); // the dock
    expect(river.fishingWater(7, 14)).toBe('river');
  });

  it('will not cast on land or at water that is not a fishing water, and the cursor says so', () => {
    const game = at(FARM, 13, 15, 'down', { inventory: pockets(stack('fishing_rod', 1)) });
    run(game, 0.1);
    expect(game.cursor?.valid).toBe(false);
    const hints = listen(game, 'hint');
    tap(game, 'Space');
    expect(hints.at(-1)?.text).toContain('cannot fish here');
    expect(game.fishing).toBeUndefined();
  });

  it('keeps the catch out of a full pocket: it slips back, and the rod is not lost', () => {
    const slots = Array.from({ length: 12 }, (_, i) => (i === 0 ? stack('fishing_rod', 1) : stack('radish', 99, ((i % 2) + 1) as 1 | 2)));
    const game = withRod(FARM, 'river', { inventory: { slots, selected: 0, canWater: 24 } });
    const hints = listen(game, 'hint');
    castAndHook(game);
    reelIn(game);
    expect(hints.some((h) => h.text.includes('slips back'))).toBe(true);
    expect(game.collection['minnow'] ?? 0).toBe(0);
  });
});

describe('the old mine', () => {
  /** A floor-1 cell beside a node, facing it. */
  function besideNode(floor: number, index = 0): { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right'; node: { x: number; y: number; def: string } } {
    const def = generateMineFloor(floor);
    const entry = new World(CONTENT).map(def.id).reachableFrom(def.spawn.x, def.spawn.y);
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;
    let seen = 0;
    for (const node of def.nodes ?? []) {
      for (const [facing, dx, dy] of dirs) {
        const x = node.x - dx;
        const y = node.y - dy;
        if (entry[y * def.width + x] !== 1) continue;
        if (seen === index) return { x, y, facing, node };
        seen += 1;
        break;
      }
    }
    throw new Error('no node to stand beside');
  }

  const mineAt = (spot: ReturnType<typeof besideNode>, patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
    at(mineFloorId(1), spot.x, spot.y, spot.facing, { inventory: pockets(stack('pickaxe', 1)), ...patch });

  it('starts every floor lit by a dim cave light, with the ladder out next to the arrival', () => {
    const game = at(mineFloorId(1), 5, 5, 'down');
    expect(game.map.ambient).toBe('cave');
    expect(game.map.exits.length).toBeGreaterThanOrEqual(2); // up, and down
    const surface = game.map.exits.find((e) => e.to.map === MINE_SURFACE.map);
    expect(surface).toBeDefined();
  });

  it('breaks a rock in a few swings, and its stone goes to the pockets and the collection', () => {
    const spot = besideNode(1);
    const game = mineAt(spot);
    const kind = game.map.nodeAt(spot.node.x, spot.node.y)!;
    expect(game.map.isWalkable(spot.node.x, spot.node.y)).toBe(false);
    run(game, 0.1);
    expect(game.cursor?.valid).toBe(true);
    const events = listen(game, 'effect');
    for (let i = 0; i < kind.def.hits; i += 1) {
      tap(game, 'Space', 0.05);
      run(game, 0.6);
    }
    expect(game.map.nodeAt(spot.node.x, spot.node.y)).toBeUndefined();
    expect(game.map.isWalkable(spot.node.x, spot.node.y)).toBe(true); // the way is open
    expect(events.filter((e) => e.kind === 'break')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'mine')).toHaveLength(kind.def.hits - 1);
    const dropped = kind.def.drops[0]!.item;
    expect(game.inventory.count(dropped)).toBeGreaterThanOrEqual(1);
    expect(game.collection[dropped]).toBe(game.inventory.count(dropped));
  });

  it('counts what it digs for a quest', () => {
    const copper = (() => {
      for (let i = 0; i < 40; i += 1) {
        try {
          const s = besideNode(1, i);
          if (s.node.def === 'copper' || s.node.def === 'stone') return s;
        } catch {
          break;
        }
      }
      return besideNode(1);
    })();
    const game = mineAt(copper, { quests: [{ id: 'copper_for_the_store', status: 'active', progress: [0] }] });
    const node = game.map.nodeAt(copper.node.x, copper.node.y)!;
    run(game, 0.1);
    for (let i = 0; i < node.def.hits; i += 1) {
      tap(game, 'Space', 0.05);
      run(game, 0.6);
    }
    const ore = game.inventory.count('copper_ore');
    expect(game.quests.progress('copper_for_the_store')).toEqual([Math.min(5, ore)]);
  });

  it('says so when there is nothing to break, and when the pockets are too full to carry what falls', () => {
    const spot = besideNode(1);
    const one = generateMineFloor(1);
    const empty = at(mineFloorId(1), one.spawn.x, one.spawn.y, one.spawn.facing, { inventory: pockets(stack('pickaxe', 1)) }); // the arrival cell: open floor ahead
    const hints = listen(empty, 'hint');
    run(empty, 0.1);
    expect(empty.cursor?.valid).toBe(false);
    tap(empty, 'Space');
    expect(hints.at(-1)?.text).toBe('There is nothing to break here.');

    const slots = Array.from({ length: 12 }, (_, i) => (i === 0 ? stack('pickaxe', 1) : stack('radish', 99, ((i % 2) + 1) as 1 | 2)));
    const full = mineAt(spot, { inventory: { slots, selected: 0, canWater: 24 } });
    const fullHints = listen(full, 'hint');
    const node = full.map.nodeAt(spot.node.x, spot.node.y)!;
    run(full, 0.1);
    for (let i = 0; i < node.def.hits + 1; i += 1) {
      tap(full, 'Space', 0.05);
      run(full, 0.6);
    }
    expect(full.map.nodeAt(spot.node.x, spot.node.y)).toBeDefined(); // it stays until there is room
    expect(fullHints.some((h) => h.text.includes('too full'))).toBe(true);
  });

  it('brings every rock back whole the next morning, and the player wakes at home', () => {
    const spot = besideNode(1);
    const game = mineAt(spot);
    const node = game.map.nodeAt(spot.node.x, spot.node.y)!;
    run(game, 0.1);
    for (let i = 0; i < node.def.hits; i += 1) {
      tap(game, 'Space', 0.05);
      run(game, 0.6);
    }
    expect(game.map.nodeAt(spot.node.x, spot.node.y)).toBeUndefined();
    game.endDay('slept');
    expect(game.map.id).toBe(FARM);
    expect(game.world.map(mineFloorId(1)).nodeAt(spot.node.x, spot.node.y)).toBeDefined();
  });

  it('goes down a ladder to the next floor and climbs back up to the ladder it came down', () => {
    const one = generateMineFloor(1);
    const down = (one.exits ?? []).find((e) => e.to.map === mineFloorId(2))!;
    const next = one.exits!.indexOf(down);
    expect(next).toBeGreaterThanOrEqual(0);
    // Stand on the arrival cell next to the down ladder and walk into it.
    const below = mineFloorExitFromBelow(1);
    const game = at(mineFloorId(1), below.x, below.y, below.facing === 'up' ? 'down' : below.facing === 'down' ? 'up' : below.facing === 'left' ? 'right' : 'left');
    const towards = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;
    walk(game, towards[game.player.facing], 1);
    expect(game.map.id).toBe(mineFloorId(2));
    expect(game.mineDeepest).toBe(2);
    run(game, 1);
    expect(game.map.id).toBe(mineFloorId(2)); // no bounce
  });

  it('keeps every floor as it was left until morning, however far down the player has been', () => {
    const world = new World(CONTENT);
    const one = world.map(mineFloorId(1));
    for (let floor = 2; floor <= 10; floor += 1) world.map(mineFloorId(floor));
    expect(world.map(mineFloorId(1))).toBe(one); // the same running map, with the rocks broken so far
    world.resetGenerated();
    expect(world.map(mineFloorId(1))).not.toBe(one); // a new morning: built whole again
  });

  it('takes the player up and out of floor 1 into the forest, outside the cave mouth', () => {
    const one = generateMineFloor(1);
    const up = (one.exits ?? []).find((e) => e.to.map === MINE_SURFACE.map)!;
    const world = new World(CONTENT);
    const floor = world.map(one.id);
    const arrival = one.spawn;
    expect(floor.isWalkable(arrival.x, arrival.y)).toBe(true);
    const game = at(mineFloorId(1), arrival.x, arrival.y, arrival.facing);
    const toward = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
    game.player = createPlayerAt(arrival.x, arrival.y, back[arrival.facing]);
    walk(game, toward[back[arrival.facing]], 1);
    expect(up).toBeDefined();
    expect(game.map.id).toBe(MINE_SURFACE.map);
    expect(Math.floor(game.player.x / 16)).toBe(MINE_SURFACE.x);
  });

  it('passes out at 2:00 am in the mine and wakes at the farmhouse door', () => {
    const game = at(mineFloorId(3), 5, 5, 'down', { time: { day: 4, minutes: 25 * 60 + 58 } });
    run(game, 10);
    expect(game.map.id).toBe(FARM);
    expect(game.clock.day).toBe(5);
  });
});

describe('what Phase 4 leaves in the save', () => {
  it('keeps the collection and the deepest floor, and a player left in the mine opens there again', () => {
    const world = new World(CONTENT);
    const one = generateMineFloor(1);
    const game = at(mineFloorId(1), one.spawn.x, one.spawn.y, one.spawn.facing, { collection: { carp: 2, copper_ore: 7 }, mine: { deepest: 4 } });
    game.collection['minnow'] = 3;
    const written = game.toSaveState();
    const read = decodeSave(encodeSave(written, new Date()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.state).toEqual(written);
    const restored = new Game(world, new InputState(), read.state);
    expect(restored.map.id).toBe(mineFloorId(1));
    expect(restored.collection).toEqual({ carp: 2, copper_ore: 7, minnow: 3 });
    expect(restored.mineDeepest).toBe(4);
    expect(restored.toSaveState()).toEqual(written);
  });

  it('forgets a saved mine floor that is out of range and starts at the farm instead', () => {
    const base = farmGameAt({ x: 13, y: 13 }, 'up').toSaveState();
    const odd = { ...base, mapId: 'mine.floor_11', player: { x: 40, y: 40, facing: 'up' as const } };
    const game = new Game(new World(CONTENT), new InputState(), odd);
    expect(game.map.id).toBe(FARM);
  });

  it('records the deepest floor as the player goes down, and never lowers it', () => {
    const game = at(mineFloorId(5), 5, 5, 'down', { mine: { deepest: 5 } });
    expect(game.mineDeepest).toBe(5);
    game.endDay('slept');
    expect(game.mineDeepest).toBe(5);
  });
});

describe('what the review of Phase 4 found', () => {
  const findNode = (): { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right'; node: { x: number; y: number; def: string } } => {
    const def = generateMineFloor(1);
    const reach = new World(CONTENT).map(def.id).reachableFrom(def.spawn.x, def.spawn.y);
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;
    for (const node of def.nodes ?? []) {
      if (node.def !== 'copper') continue;
      for (const [facing, dx, dy] of dirs) if (reach[(node.y - dy) * def.width + (node.x - dx)] === 1) return { x: node.x - dx, y: node.y - dy, facing, node };
    }
    throw new Error('no copper on floor 1');
  };

  it('never counts a drop that did not fit: what the hint, the collection and the quest say matches the pockets', () => {
    const spot = findNode();
    // One empty slot only, and no stack of copper or stone to top up: two different drops cannot both fit.
    const slots = [stack('pickaxe', 1), ...Array.from({ length: 10 }, () => stack('radish', 99, 1)), null];
    for (let day = 1; day <= 24; day += 1) {
      const game = at(mineFloorId(1), spot.x, spot.y, spot.facing, { time: { day, minutes: 10 * 60 }, inventory: { slots, selected: 0, canWater: 24 }, quests: [{ id: 'copper_for_the_store', status: 'active', progress: [0] }] });
      const hits = game.map.nodeAt(spot.node.x, spot.node.y)!.def.hits;
      run(game, 0.1);
      for (let i = 0; i < hits; i += 1) {
        tap(game, 'Space', 0.05);
        run(game, 0.6);
      }
      for (const id of ['copper_ore', 'stone']) expect(game.collection[id] ?? 0, `day ${day} ${id}`).toBe(game.inventory.count(id));
      expect(game.quests.progress('copper_for_the_store')[0]).toBe(Math.min(5, game.inventory.count('copper_ore')));
    }
  });

  it('keeps a broken rock broken when the game is closed and opened again the same day, and brings it back the next', () => {
    const spot = findNode();
    const game = at(mineFloorId(1), spot.x, spot.y, spot.facing, { inventory: pockets(stack('pickaxe', 1)) });
    const hits = game.map.nodeAt(spot.node.x, spot.node.y)!.def.hits;
    run(game, 0.1);
    for (let i = 0; i < hits; i += 1) {
      tap(game, 'Space', 0.05);
      run(game, 0.6);
    }
    expect(game.map.nodeAt(spot.node.x, spot.node.y)).toBeUndefined();
    const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const reopened = new Game(new World(CONTENT), new InputState(), saved.state);
    expect(reopened.map.nodeAt(spot.node.x, spot.node.y)).toBeUndefined(); // not brought back by reloading
    expect(reopened.map.isWalkable(spot.node.x, spot.node.y)).toBe(true);
    expect(reopened.map.nodes.size).toBe(game.map.nodes.size);

    const tomorrow = new Game(new World(CONTENT), new InputState(), { ...saved.state, time: { day: saved.state.time.day + 1, minutes: 6 * 60 } });
    expect(tomorrow.map.nodeAt(spot.node.x, spot.node.y)).toBeDefined();
  });

  it('keeps a dug spot dug, and the fish that have been biting, across a reload', () => {
    const game = farmGameAt({ x: 13, y: 15 }, 'down', { inventory: pockets(stack('hoe', 1)) });
    run(game, 0.1);
    const spot = [...game.map.nodes.values()].find((n) => n.def.id === 'dig_spot')!;
    expect(spot).toBeDefined();
    const adjacent = { x: spot.x, y: spot.y - 1 };
    game.player = createPlayerAt(adjacent.x, adjacent.y, 'down');
    run(game, 0.1);
    tap(game, 'Space', 0.05);
    run(game, 0.6);
    expect(game.map.nodeAt(spot.x, spot.y)).toBeUndefined();
    const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
    expect(saved.ok && saved.state.spent.day).toBe(game.clock.day);
    if (!saved.ok) return;
    const reopened = new Game(new World(CONTENT), new InputState(), saved.state);
    expect(reopened.map.nodeAt(spot.x, spot.y)).toBeUndefined();
    expect(reopened.map.nodes.size).toBe(game.map.nodes.size);
  });

  it('survives going to bed with a farm saved for a map the game no longer has', () => {
    const base = farmGameAt({ x: 13, y: 13 }, 'up').toSaveState();
    const odd = { ...base, farms: { ...base.farms, 'ghost.map': { soil: [{ x: 1, y: 1, watered: true }], crops: [] } }, ranches: { ...base.ranches, 'ghost.map': { animals: [], feed: 3, basket: [] } } };
    const game = new Game(new World(CONTENT), new InputState(), odd);
    expect(() => game.endDay('slept')).not.toThrow();
    expect(game.summary).toBeDefined();
    expect(game.toSaveState().farms['ghost.map']).toBeDefined(); // kept, not lost
  });

  it('refuses mine floor ids with leading zeros', async () => {
    const { parseMineFloor } = await import('./mine/surface');
    expect(parseMineFloor('mine.floor_5')).toBe(5);
    expect(parseMineFloor('mine.floor_05')).toBeUndefined();
    expect(parseMineFloor('mine.floor_0')).toBeUndefined();
    expect(parseMineFloor('mine.floor_11')).toBeUndefined();
  });
});
