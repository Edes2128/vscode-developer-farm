import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { Game } from './game';
import { InputState } from './input/actions';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import { createPlayerAt } from './player/player';
import { newRecord } from './social/friendship';
import { farmGameAt, listen, pick, readThrough, run, tap } from './testing';
import { validateContent } from './world/validate';
import { World } from './world/world';

/** Things an independent review of Phase 5 found, each pinned down so it cannot come back. */

const FARM = 'willowbrook.home_farm';
const GREEN = 'willowbrook.village_green';
const HOUSE = 'willowbrook.farmhouse';
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
const use = (game: Game): void => {
  tap(game, 'Space', 0.05);
  run(game, 0.6);
};

describe('a rug', () => {
  // The rug is three cells wide and two deep, laid from the cell in front of the player towards the right and up: here (4..6, 3..4).
  const room = (): Game => at(HOUSE, 3, 4, 'right', { inventory: pockets(stack('rug', 2), stack('chair', 1)) });

  it('can be laid on the floor, never blocks anyone, and can be picked up again', () => {
    const game = room();
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: 4, y: 4, valid: true });
    use(game);
    expect(game.inventory.count('rug')).toBe(1);
    expect(game.map.extraAt(4, 4)?.def.id).toBe('rug');
    for (const [x, y] of [[4, 4], [5, 4], [6, 4], [4, 3], [6, 3]] as const) expect(game.map.isWalkable(x, y), `${x},${y}`).toBe(true);
    run(game, 0.1);
    expect(game.prompt).toMatchObject({ verb: 'Pick up', name: 'Rug' });
    tap(game, 'KeyE');
    expect(game.map.extraAt(4, 4)).toBeUndefined();
    expect(game.inventory.count('rug')).toBe(2);
  });

  it('lies under furniture, so a chair can stand on it, and the rug can only be lifted once the chair is gone', () => {
    const game = room();
    run(game, 0.1);
    use(game);
    game.inventory.select(1);
    run(game, 0.1);
    expect(game.cursor?.valid).toBe(true);
    use(game);
    expect(game.map.extraAt(4, 4)?.def.id).toBe('chair');
    expect(game.map.isWalkable(4, 4)).toBe(false);
    tap(game, 'KeyE'); // the chair comes up first
    expect(game.inventory.count('chair')).toBe(1);
    expect(game.map.extraAt(4, 4)?.def.id).toBe('rug');
  });

  it('is not laid over another rug', () => {
    const game = room();
    run(game, 0.1);
    use(game);
    const hints = listen(game, 'hint');
    use(game);
    expect(hints.at(-1)?.text).toBe('There is no room for that here.');
    expect(game.inventory.count('rug')).toBe(1);
  });

  it('is something the validator would notice missing: furniture needs a footprint to be placed at all', () => {
    const objects = CONTENT.objects.map((o) => (o.id === 'rug' ? { ...o, footprint: [] } : o));
    const messages = validateContent({ ...CONTENT, objects }).map((p) => p.message);
    expect(messages.some((m) => m.includes('at least one footprint cell'))).toBe(true);
  });
});

describe('furniture and the body of the player', () => {
  it('is never put down on the cell the player\'s feet are touching', () => {
    // Standing at the left edge of the cell, facing left: the player's box reaches into the cell in front.
    const game = farmGameAt({ x: 0, y: 0 }, 'up', {
      mapId: HOUSE,
      player: { x: 5 * 16 + 2, y: 6 * 16 + 14, facing: 'left' },
      time: TEN_AM,
      inventory: pockets(stack('chair', 1)),
    });
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: 4, y: 6, valid: false });
    const hints = listen(game, 'hint');
    use(game);
    expect(hints.at(-1)?.text).toBe('There is no room for that here.');
    expect(game.inventory.count('chair')).toBe(1);
    expect(game.map.extraAt(4, 6)).toBeUndefined();
  });

  it('is put down once the player has stepped clear', () => {
    const game = at(HOUSE, 5, 6, 'left', { inventory: pockets(stack('chair', 1)) });
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ x: 4, y: 6, valid: true });
  });
});

describe('making yourself at home', () => {
  const room = (): Game => at(HOUSE, 3, 6, 'right', { inventory: pockets(stack('chair', 1)), quests: [{ id: 'make_yourself_at_home', status: 'active', progress: [0] }] });

  it('is not finished by putting the same chair down again and again', () => {
    const game = room();
    run(game, 0.1);
    for (let i = 0; i < 3; i += 1) {
      use(game);
      tap(game, 'KeyE'); // pick it up again
      expect(game.inventory.count('chair')).toBe(1);
    }
    use(game);
    expect(game.quests.progress('make_yourself_at_home')).toEqual([1]);
    expect(game.quests.status('make_yourself_at_home')).toBe('active');
  });

  it('counts the furniture that is out now, whichever order it went down in', () => {
    const game = at(HOUSE, 3, 6, 'right', { inventory: pockets(stack('chair', 3)), quests: [{ id: 'make_yourself_at_home', status: 'active', progress: [0] }] });
    run(game, 0.1);
    for (let i = 0; i < 3; i += 1) {
      game.player = createPlayerAt(3, 6 - i, 'right');
      run(game, 0.1);
      use(game);
    }
    expect(game.placedCount()).toBe(3);
    expect(game.quests.status('make_yourself_at_home')).toBe('ready');
  });
});

describe('quests taken up after the thing is done', () => {
  const askBram = (patch: Parameters<typeof farmGameAt>[2]): Game => {
    const game = at(GREEN, 27, 18, 'up', { npcs: { bram: known({ friendship: 300 }) }, ...patch });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    return game;
  };

  it('counts a greenhouse built before the quest was accepted', () => {
    const game = askBram({ buildings: { built: ['greenhouse'], pending: [] } });
    pick(game, 'npc:offer:bram:glass_and_sunshine');
    readThrough(game);
    pick(game, 'quest:accept:bram:glass_and_sunshine');
    expect(game.quests.status('glass_and_sunshine')).toBe('ready');
  });

  it('counts things already on display at the museum', () => {
    const game = at('willowbrook.museum', 7, 6, 'up', { museum: { donated: ['carp', 'coal', 'quartz'], claimed: [] }, npcs: { ines: known() } });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:offer:ines:first_finds');
    readThrough(game);
    pick(game, 'quest:accept:ines:first_finds');
    expect(game.quests.status('first_finds')).toBe('ready');
  });

  it('counts furniture already put out', () => {
    const chairs = [4, 5, 6].map((y) => ({ def: 'chair', x: 4, y }));
    const game = at('willowbrook.general_store', 5, 5, 'up', { npcs: { hollis: known() }, placed: { [HOUSE]: chairs } });
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:offer:hollis:make_yourself_at_home');
    readThrough(game);
    pick(game, 'quest:accept:hollis:make_yourself_at_home');
    expect(game.placedCount()).toBe(3);
    expect(game.quests.status('make_yourself_at_home')).toBe('ready');
  });
});

describe('dig spots', () => {
  const diggable = (game: Game) => [...game.map.nodes.values()].filter((n) => n.def.tool === 'hoe').map((n) => `${n.x},${n.y}`).sort();

  it('are laid out the same way whether the game was kept running overnight or opened fresh that morning', () => {
    const live = farmGameAt({ x: 13, y: 15 }, 'down', { time: { day: 3, minutes: 10 * 60 } });
    expect(live.map.id).toBe(FARM);
    for (let day = 4; day <= 8; day += 1) {
      live.endDay('slept');
      live.dismissSummary();
      expect(live.clock.day).toBe(day);
      const fresh = farmGameAt({ x: 13, y: 15 }, 'down', { time: { day, minutes: 10 * 60 } });
      expect(diggable(live), `day ${day}`).toEqual(diggable(fresh));
    }
  });

  it('cannot be refreshed by saving and loading: what was dug today stays dug', () => {
    const game = farmGameAt({ x: 13, y: 15 }, 'down', { time: { day: 3, minutes: 10 * 60 }, inventory: pockets(stack('hoe', 1)) });
    for (const spot of [...game.map.nodes.values()].filter((n) => n.def.tool === 'hoe')) {
      game.player = createPlayerAt(spot.x, spot.y - 1, 'down');
      run(game, 0.1);
      use(game);
    }
    expect(diggable(game)).toEqual([]);
    const found = Object.values(game.collection).reduce((a, b) => a + b, 0);
    expect(found).toBeGreaterThanOrEqual(3);
    const again = reopen(game);
    expect(diggable(again)).toEqual([]);
    expect(Object.values(again.collection).reduce((a, b) => a + b, 0)).toBe(found);
  });
});

describe('saved furniture', () => {
  const hackedPlaced = {
    [HOUSE]: [
      { def: 'chair', x: 3, y: 7 },
      { def: 'kitchen', x: 7, y: 6 },
      { def: 'workbench', x: 9, y: 6 },
    ],
    [FARM]: [{ def: 'chair', x: 10, y: 10 }],
  };
  const start = (mapId: string, tx: number, ty: number): Game => {
    const base = farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: tx * 16 + 8, y: ty * 16 + 14, facing: 'right' }, time: TEN_AM }).toSaveState();
    return new Game(new World(CONTENT), new InputState(), { ...base, placed: hackedPlaced });
  };

  it('is only put back as furniture: a kitchen or a bench named in a save is not built from it', () => {
    const game = start(HOUSE, 3, 6);
    expect([...game.map.extras.values()].map((o) => o.def.id)).toEqual(['chair']);
  });

  it('is only put back in a room made for it: the farm is not a place to decorate', () => {
    const game = start(FARM, 13, 15);
    expect(game.map.id).toBe(FARM);
    expect(game.map.extras.size).toBe(0);
  });
});
