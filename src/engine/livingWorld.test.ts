import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { festivalDays, festivalOn } from './festivals/festivals';
import { prizeFor, rankOf, rivalScores } from './festivals/rankings';
import { Game } from './game';
import { InputState } from './input/actions';
import { decodeSave, encodeSave } from './persistence/saveFormat';
import { createPlayerAt } from './player/player';
import { paymentFor } from './requests/requests';
import { newRecord } from './social/friendship';
import { farmGameAt, pick, readThrough, run, tap } from './testing';
import { seasonOf } from './time/calendar';
import { watersFields, weatherOn } from './weather/weather';
import { World } from './world/world';

/**
 * Phase 6, played through the real maps and data: weather that is the same for everyone on a given day, rain that waters the
 * fields, festivals with something to do, the notice board, and the merchant who comes on Sundays.
 */

const FARM = 'willowbrook.home_farm';
const GREEN = 'willowbrook.village_green';
const RIVER = 'willowbrook.riverbank';
const GREENHOUSE = 'willowbrook.greenhouse';
type Facing = 'up' | 'down' | 'left' | 'right';

const CLEAR = festivalDays(CONTENT.festivals);
const stack = (id: string, count: number, quality: 0 | 1 | 2 = 0) => ({ id, count, quality });
const pockets = (...stacks: ReturnType<typeof stack>[]) => ({
  slots: [...stacks, ...Array.from({ length: 12 - stacks.length }, () => null)],
  selected: 0,
  canWater: 24,
});
const at = (mapId: string, x: number, y: number, facing: Facing, time: { day: number; minutes: number }, patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: x * 16 + 8, y: y * 16 + 14, facing }, time, ...patch });
const known = (changes: Partial<ReturnType<typeof newRecord>> = {}) => ({ ...newRecord(), met: true, ...changes });
const reopen = (game: Game): Game => {
  const saved = decodeSave(encodeSave(game.toSaveState(), new Date()));
  if (!saved.ok) throw new Error('the save did not decode');
  return new Game(new World(CONTENT), new InputState(), saved.state);
};
const firstDay = (test: (day: number) => boolean, from = 2): number => {
  for (let day = from; day < 400; day += 1) if (test(day)) return day;
  throw new Error('no such day');
};
const rainy = (day: number): boolean => watersFields(weatherOn(day, CLEAR));
const TEN = 10 * 60;
const festival = (id: string) => CONTENT.festivals.find((f) => f.id === id)!;
const dayOf = (id: string): number => {
  const f = festival(id);
  return ['spring', 'summer', 'autumn', 'winter'].indexOf(f.season) * 28 + f.day;
};

/** A cell on the bank of the river, a cell to stand on, and the way to face. */
function bank(mapId: string, water: string): { x: number; y: number; facing: Facing } {
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

/** Talks to whoever stands in front of the player and opens the festival dialog. */
function openFestival(game: Game): void {
  run(game, 0.1);
  tap(game, 'KeyE');
  readThrough(game);
  pick(game, 'npc:festival');
  readThrough(game);
}

describe('weather', () => {
  it('is decided by the day alone: the same on every look, after a reload, and never rain on a festival day', () => {
    const day = firstDay(rainy);
    const game = farmGameAt({ x: 10, y: 10 }, 'down', { time: { day, minutes: TEN } });
    expect(game.weather).toBe(weatherOn(day, CLEAR));
    expect(game.weather).toBe(game.weather);
    expect(reopen(game).weather).toBe(game.weather);
    for (const f of CONTENT.festivals) expect(watersFields(weatherOn(dayOf(f.id), CLEAR)), f.id).toBe(false);
  });

  it('tells you tomorrow today, and the forecast comes true', () => {
    const day = firstDay(rainy, 3);
    const game = farmGameAt({ x: 10, y: 10 }, 'down', { time: { day: day - 1, minutes: TEN } });
    expect(game.forecast).toBe(weatherOn(day, CLEAR));
    game.endDay('slept');
    expect(game.summary?.weather).toBe(weatherOn(day, CLEAR));
    expect(game.summary?.forecast).toBe(weatherOn(day + 1, CLEAR));
    expect(game.weather).toBe(weatherOn(day, CLEAR));
  });

  const soil = (watered: boolean) => ({ [FARM]: { soil: [{ x: 8, y: 26, watered }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 0, daysInStage: 0, planted: 1 }] } });

  it('waters every outdoor field overnight when it rains, and leaves them dry when it does not', () => {
    const wet = firstDay(rainy, 3);
    const dry = firstDay((d) => !rainy(d), 3);
    const rain = farmGameAt({ x: 10, y: 10 }, 'down', { time: { day: wet - 1, minutes: TEN }, farms: soil(false) });
    rain.endDay('slept');
    expect(rain.toSaveState().farms[FARM]?.soil[0]?.watered).toBe(true);
    const sun = farmGameAt({ x: 10, y: 10 }, 'down', { time: { day: dry - 1, minutes: TEN }, farms: soil(false) });
    sun.endDay('slept');
    expect(sun.toSaveState().farms[FARM]?.soil[0]?.watered).toBe(false);
  });

  it('never rains on a glasshouse', () => {
    const wet = firstDay(rainy, 3);
    const game = farmGameAt({ x: 10, y: 10 }, 'down', {
      time: { day: wet - 1, minutes: TEN },
      buildings: { built: ['greenhouse'], pending: [] },
      farms: { [GREENHOUSE]: { soil: [{ x: 4, y: 4, watered: false }], crops: [] }, ...soil(false) },
    });
    game.endDay('slept');
    expect(game.toSaveState().farms[FARM]?.soil[0]?.watered).toBe(true);
    expect(game.toSaveState().farms[GREENHOUSE]?.soil.every((s) => !s.watered)).toBe(true);
  });
});

describe('days of the week and weather in the villagers\' schedules', () => {
  it('has the merchant on the green on Sundays from eight until six, and not otherwise', () => {
    const sunday = 7; // spring 7 is the first Sunday
    const here = (day: number, minutes: number) => farmGameAt({ x: 10, y: 10 }, 'down', { mapId: GREEN, time: { day, minutes } }).villagers.states.get('rowan')!;
    expect(here(sunday, TEN).map).toBe(GREEN);
    expect(here(sunday, 7 * 60).map).toBe('away');
    expect(here(sunday, 19 * 60).map).toBe('away');
    expect(here(sunday + 1, TEN).map).toBe('away');
    expect(here(sunday + 7, TEN).map).toBe(GREEN);
  });

  it('keeps Rowan out of the valley on a day he is away, so you cannot talk to him', () => {
    const game = at(GREEN, 27, 20, 'up', { day: 8, minutes: TEN });
    run(game, 0.2);
    expect(game.villagers.onMap(GREEN).some((s) => s.id === 'rowan')).toBe(false);
  });
});

describe('rainy days', () => {
  const where = (id: string, day: number, minutes: number): string =>
    farmGameAt({ x: 10, y: 10 }, 'down', { mapId: GREEN, time: { day, minutes } }).villagers.states.get(id)!.map;
  const wet = firstDay(rainy, 3);
  const dry = firstDay((d) => !rainy(d), 3);

  it('keeps Tobias in his cottage all day, and puts him out on the green when it is dry', () => {
    for (const minutes of [7 * 60, 10 * 60, 12 * 60, 15 * 60, 19 * 60]) expect(where('tobias', wet, minutes), `rain at ${minutes}`).toBe('willowbrook.tobias_cottage');
    expect(where('tobias', dry, 10 * 60)).toBe(GREEN);
    expect(where('tobias', dry, 15 * 60)).toBe(GREEN);
  });

  it('has Bram work in the general store in the rain, and by the plaza otherwise', () => {
    expect(where('bram', wet, 10 * 60)).toBe('willowbrook.general_store');
    expect(where('bram', wet, 16 * 60)).toBe('willowbrook.general_store');
    expect(where('bram', dry, 10 * 60)).toBe(GREEN);
  });

  it('leaves the shopkeepers at their posts, so a stall is never shut by the weather alone', () => {
    for (const npc of CONTENT.npcs) {
      for (const entry of npc.schedule) if (entry.when === 'rain') expect(entry.serves, `${npc.id} at ${entry.from}`).toBeUndefined();
    }
  });
});

describe('the merchant\'s cart', () => {
  const market = (patch: Parameters<typeof farmGameAt>[2] = {}, day = 7): Game => at(GREEN, 27, 20, 'up', { day, minutes: TEN }, patch);

  it('is a stall you can browse while Rowan stands behind it', () => {
    const game = market();
    run(game, 0.2);
    expect(game.prompt).toMatchObject({ verb: 'Browse' });
    tap(game, 'KeyE');
    readThrough(game);
    // The keeper greets you first, as Willa does at her stall; then you ask to buy or sell.
    expect(game.dialog?.title).toBe('Rowan Ash');
    pick(game, 'npc:shop:rowan');
    expect(game.dialog?.title).toBe("Rowan's cart");
    expect(game.dialog?.options.map((o) => o.id).filter((id) => id.startsWith('buy:'))).toHaveLength(5);
  });

  it('sells every seed in every season, which is what makes a glasshouse worth building', () => {
    const winter = 84 + 7; // winter 7 is a Sunday too
    expect(seasonOf(winter)).toBe('winter');
    const game = market({ money: 500 }, winter);
    run(game, 0.2);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:shop:rowan');
    pick(game, 'buy:4'); // pumpkin seeds
    expect(game.inventory.count('pumpkin_seeds')).toBe(2);
    expect(game.money).toBe(500 - 140);
  });

  it('is shut, with a word about it, when Rowan is away', () => {
    const game = market({}, 9);
    run(game, 0.2);
    tap(game, 'KeyE');
    expect(game.dialog?.title).toBe("Rowan's cart");
    expect(game.dialog?.lines.join(' ')).toContain('away from the stall');
    expect(game.dialog?.lines.join(' ')).toContain('Back on Sunday at 8:00 am');
    expect(game.dialog?.options).toHaveLength(0);
  });
});

describe('the notice board', () => {
  const board = (day = 3, patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 6, 14, 'up', { day, minutes: TEN }, patch);

  it('shows three requests a day, the same ones all day and after a reload, and fresh ones tomorrow', () => {
    const game = board();
    const today = game.requestsToday().map((r) => r.request.id);
    expect(today).toHaveLength(3);
    expect(reopen(game).requestsToday().map((r) => r.request.id)).toEqual(today);
    expect(board(4).requestsToday().map((r) => r.request.id)).not.toEqual(today);
  });

  it('is read at the board: each request says who asks, for what and how much it pays', () => {
    const game = board();
    run(game, 0.2);
    expect(game.prompt).toMatchObject({ verb: 'Read', name: 'Notice board' });
    tap(game, 'KeyE');
    readThrough(game);
    expect(game.dialog?.options.filter((o) => o.id.startsWith('board:give:'))).toHaveLength(3);
    // Nothing in the pockets: nothing can be handed in.
    expect(game.dialog?.options.filter((o) => o.id.startsWith('board:give:')).every((o) => !o.enabled)).toBe(true);
  });

  it('takes what was asked for, pays it with a friend\'s bonus, and the giver is warmer for it; once only', () => {
    const probe = board();
    const { request } = probe.requestsToday()[0]!;
    const friendship = 200; // two hearts
    const game = board(3, { inventory: pockets(stack(request.item, request.count + 2)), money: 100, npcs: { [request.giver]: known({ friendship }) } });
    run(game, 0.2);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, `board:give:${request.id}`);
    expect(game.inventory.count(request.item)).toBe(2);
    expect(game.money).toBe(100 + paymentFor(request, 2));
    expect(game.villagers.record(request.giver).friendship).toBe(friendship + 15);
    expect(game.dialog?.options.find((o) => o.id === `board:give:${request.id}`)?.enabled).toBe(false);
    expect(game.dialog?.options.find((o) => o.id === `board:give:${request.id}`)?.label).toContain('done');
    expect(game.fulfilRequest(request.id)).toMatchObject({ ok: false });
    expect(game.money).toBe(100 + paymentFor(request, 2));
  });

  it('remembers what was handed in through a reload, and forgets it the next morning', () => {
    const probe = board();
    const { request } = probe.requestsToday()[0]!;
    const game = board(3, { inventory: pockets(stack(request.item, request.count)) });
    expect(game.fulfilRequest(request.id)).toMatchObject({ ok: true });
    const again = reopen(game);
    expect(again.requestsToday().find((r) => r.request.id === request.id)?.done).toBe(true);
    again.endDay('slept');
    expect(again.requestsToday().every((r) => !r.done)).toBe(true);
  });

  it('refuses a request when the pockets hold too little, and says how many more are needed', () => {
    const probe = board();
    const { request } = probe.requestsToday()[0]!;
    const game = board(3, { inventory: pockets(stack(request.item, request.count - 1)) });
    const result = game.fulfilRequest(request.id);
    expect(result).toEqual({ ok: false, note: 'You need 1 more.' });
    expect(game.inventory.count(request.item)).toBe(request.count - 1);
  });
});

describe('the Egg Hunt', () => {
  const day = dayOf('egg_hunt');
  const host = festival('egg_hunt').host;
  const hunt = (minutes = TEN, patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 3, 14, 'right', { day, minutes }, patch);

  it('is a clear day, open from nine until five, and the villagers gather for it', () => {
    expect(festivalOn(CONTENT.festivals, day)?.id).toBe('egg_hunt');
    expect(watersFields(weatherOn(day, CLEAR))).toBe(false);
    const open = hunt();
    expect(open.festivalNow()?.id).toBe('egg_hunt');
    const place = festival('egg_hunt').places.find((p) => p.npc === host)!;
    expect(open.villagers.states.get(host)).toMatchObject({ map: GREEN, x: place.x * 16 + 8 });
    const early = hunt(8 * 60);
    expect(early.festivalNow()).toBeUndefined();
    expect(early.huntEggs).toHaveLength(0);
    expect(hunt(17 * 60 + 1).festivalNow()).toBeUndefined();
  });

  it('hides the eight eggs where the player can walk, the same ones all day and after a reload', () => {
    const game = hunt();
    const eggs = game.huntEggs;
    expect(eggs).toHaveLength(8);
    expect(new Set(eggs.map((e) => `${e.x},${e.y}`)).size).toBe(8);
    for (const egg of eggs) {
      expect(game.map.isWalkable(egg.x, egg.y)).toBe(true);
      expect(game.map.interactableAt(egg.x, egg.y)).toBeUndefined();
    }
    expect(reopen(game).huntEggs).toEqual(eggs);
  });

  it('picks an egg up when the player steps on it; it stays picked up through a reload', () => {
    const game = hunt();
    const [first, ...rest] = game.huntEggs;
    game.player.x = first!.x * 16 + 8;
    game.player.y = first!.y * 16 + 14;
    run(game, 0.1);
    expect(game.huntEggs).toHaveLength(7);
    expect(game.festivalStatus()?.score).toBe(1);
    const again = reopen(game);
    expect(again.festivalStatus()?.score).toBe(1);
    expect(again.huntEggs).toEqual(rest);
  });

  it('gives the prize for the rank, once, to a player who found them all', () => {
    const game = at(GREEN, festival('egg_hunt').places.find((p) => p.npc === host)!.x, festival('egg_hunt').places.find((p) => p.npc === host)!.y + 1, 'up', { day, minutes: TEN }, {
      money: 0,
      festival: { day, score: 8, found: [], entered: false, talked: [], claimed: false },
    });
    openFestival(game);
    expect(game.dialog?.title).toBe('The Egg Hunt');
    expect(game.dialog?.options.find((o) => o.id === 'festival:claim')?.enabled).toBe(true);
    pick(game, 'festival:claim');
    const first = festival('egg_hunt').prizes[0]!;
    expect(game.money).toBe(first.money);
    expect(game.inventory.count('chicken_feed')).toBe(10);
    expect(game.dialog?.lines.join(' ')).toContain('first');
    expect(game.toSaveState().festival.claimed).toBe(true);
    expect(game.claimFestival()).toMatchObject({ ok: false });
    expect(game.money).toBe(first.money);
  });

  const owed = { day, score: 8, found: [] as number[], entered: false, talked: [] as string[], claimed: false };

  it('still owes a prize after the hunt has closed: the host can be asked anywhere until bedtime', () => {
    const closed = at(GREEN, 19, 17, 'up', { day, minutes: 17 * 60 + 5 }, { money: 0, festival: owed, npcs: { willa: known() } }); // Willa is back by the fountain
    expect(closed.festivalNow()).toBeUndefined();
    expect(closed.festivalClaimable()?.id).toBe('egg_hunt');
    run(closed, 0.1);
    tap(closed, 'KeyE');
    readThrough(closed);
    pick(closed, 'npc:festival');
    readThrough(closed);
    expect(closed.dialog?.options.some((o) => o.id.startsWith('festival:enter'))).toBe(false); // nothing to enter after it closed
    pick(closed, 'festival:claim');
    expect(closed.money).toBe(festival('egg_hunt').prizes[0]!.money);
    // But nothing can be found any more.
    expect(closed.huntEggs).toHaveLength(0);
  });

  it('brings an unclaimed prize round in the night: the money always, the items if they fit, and says so in the morning', () => {
    const game = hunt(TEN, { money: 0, festival: owed });
    game.endDay('slept');
    expect(game.money).toBe(festival('egg_hunt').prizes[0]!.money);
    expect(game.inventory.count('chicken_feed')).toBe(10);
    expect(game.summary?.festivalPrize).toContain('The Egg Hunt');
    expect(game.summary?.festivalPrize).toContain('brought round in the night');
    const full = Array.from({ length: 12 }, (_, i) => stack(i % 2 === 0 ? 'stone' : 'coal', 1));
    const crowded = hunt(TEN, { money: 0, festival: owed, inventory: { slots: full, selected: 0, canWater: 24 } });
    crowded.endDay('slept');
    expect(crowded.money).toBe(festival('egg_hunt').prizes[0]!.money);
    expect(crowded.inventory.count('chicken_feed')).toBe(0);
    expect(crowded.summary?.festivalPrize).not.toContain('Chicken feed');
    // Nothing earned, nothing sent; and a prize already taken is not sent twice.
    const idle = hunt(TEN, { money: 0 });
    idle.endDay('slept');
    expect(idle.summary?.festivalPrize).toBeUndefined();
    const taken = hunt(TEN, { money: 0, festival: { ...owed, claimed: true } });
    taken.endDay('slept');
    expect(taken.money).toBe(0);
    expect(taken.summary?.festivalPrize).toBeUndefined();
  });

  it('never places an egg under someone who stands there all day', () => {
    const places = festival('egg_hunt').places.map((p) => `${p.x},${p.y}`);
    for (let year = 0; year < 40; year += 1) {
      const game = at(GREEN, 3, 14, 'right', { day: year * 112 + 13, minutes: TEN });
      for (const egg of game.huntEggs) expect(places, `year ${year}`).not.toContain(`${egg.x},${egg.y}`);
      expect(game.huntEggs).toHaveLength(8);
    }
  });

  it('gives nothing to someone who has not taken part, and says so', () => {
    const game = hunt();
    expect(game.claimFestival()).toEqual({ ok: false, note: 'Take part first.' });
    expect(game.money).toBe(0 + game.money);
    expect(game.festivalStatus()?.canClaim).toBe(false);
  });

  it('keeps the prize until the pockets have room: nothing is lost to a full bag', () => {
    const full = Array.from({ length: 12 }, (_, i) => stack(i % 2 === 0 ? 'stone' : 'coal', 1));
    const game = hunt(TEN, { inventory: { slots: full, selected: 0, canWater: 24 }, money: 0, festival: { day, score: 8, found: [], entered: false, talked: [], claimed: false } });
    const result = game.claimFestival();
    expect(result).toMatchObject({ ok: false });
    expect(game.toSaveState().festival.claimed).toBe(false);
    expect(game.money).toBe(0);
  });

  it('forgets how you did the next day', () => {
    const game = hunt(TEN, { festival: { day, score: 5, found: [1004], entered: false, talked: [], claimed: true } });
    game.endDay('slept');
    expect(game.festivalToday).toBeUndefined();
    expect(game.toSaveState().festival).toMatchObject({ score: 0, found: [], claimed: false, entered: false });
    expect(game.festivalStatus()).toBeUndefined();
  });
});

describe('the Fishing Contest', () => {
  const day = dayOf('fishing_contest');

  it('is held at the river from nine until five and counts the fish landed there', () => {
    const game = at(RIVER, 8, 13, 'down', { day, minutes: TEN }, { inventory: pockets(stack('fishing_rod', 1)) });
    expect(game.festivalNow()?.id).toBe('fishing_contest');
    expect(game.festivalStatus()?.score).toBe(0);
    expect(game.festivalStatus()?.line).toContain('0 fish');
    // The place to be is the river, so it is the river's host who runs it.
    expect(game.villagers.states.get('june')).toMatchObject({ map: RIVER });
  });

  /** Casts, waits for the bite, hooks it, and reels it in. */
  function landOne(game: Game): void {
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    for (let i = 0; i < 600 && game.fishing?.phase === 'waiting'; i += 1) game.frame(1 / 60);
    expect(game.fishing?.phase).toBe('bite');
    game.input.press('Space');
    game.frame(1 / 60);
    game.input.release('Space');
    for (let i = 0; i < 1200 && game.fishing?.phase === 'reeling'; i += 1) {
      const session = game.fishing!;
      if (Math.abs(session.marker - (session.zone.from + session.zone.to) / 2) < 0.02) {
        game.input.press('Space');
        game.frame(1 / 60);
        game.input.release('Space');
        break;
      }
      game.frame(1 / 60);
    }
    expect(game.fishing).toBeUndefined();
  }

  it('counts a fish that is really caught there, and one caught anywhere else does not count', () => {
    const spot = bank(RIVER, 'river');
    const game = at(RIVER, spot.x, spot.y, spot.facing, { day, minutes: TEN }, { inventory: pockets(stack('fishing_rod', 1)) });
    landOne(game);
    expect(game.festivalStatus()?.score).toBe(1);
    expect(game.festivalStatus()?.line).toContain('1 fish');
    const farm = bank(FARM, 'river');
    const elsewhere = at(FARM, farm.x, farm.y, farm.facing, { day, minutes: TEN }, { inventory: pockets(stack('fishing_rod', 1)) });
    landOne(elsewhere);
    expect(elsewhere.festivalStatus()?.score).toBe(0);
  });

  it('adds the fish that were caught, and pays by how many compared with the rivals', () => {
    const game = at(RIVER, 8, 13, 'down', { day, minutes: TEN }, { festival: { day, score: 6, found: [], entered: false, talked: [], claimed: false }, money: 0 });
    const result = game.claimFestival();
    expect(result).toMatchObject({ ok: true, rank: 1 });
    expect(game.money).toBeGreaterThan(0);
  });
});

describe('fishing in the rain', () => {
  const used = (day: number) => ({ day, cells: {}, fished: { [`${FARM}:river`]: 6 } });
  const cast = (day: number): { game: Game; hints: string[] } => {
    const spot = bank(FARM, 'river');
    const game = at(FARM, spot.x, spot.y, spot.facing, { day, minutes: TEN }, { inventory: pockets(stack('fishing_rod', 1)), spent: used(day) });
    const hints: string[] = [];
    game.events.on('hint', (h) => hints.push(h.text));
    run(game, 0.1);
    tap(game, 'Space');
    run(game, 0.7);
    return { game, hints };
  };

  it('has the fish stop biting after the day\'s usual six, but bite a couple more times in the rain', () => {
    const dry = cast(firstDay((d) => !rainy(d) && seasonOf(d) === 'spring', 3));
    expect(dry.game.fishing).toBeUndefined();
    expect(dry.hints.at(-1)).toContain('have had enough');
    const wet = cast(firstDay((d) => rainy(d) && seasonOf(d) === 'spring', 3));
    expect(wet.game.fishing?.phase).toBe('waiting');
  });
});

describe('the Harvest Fair', () => {
  const day = dayOf('harvest_fair');
  const fair = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 22, 14, 'up', { day, minutes: TEN }, patch);

  it('loses nothing if the entry is made just before closing: the prize can still be asked for after six', () => {
    const game = fair({ money: 0, inventory: pockets(stack('pumpkin', 1, 2)) });
    game.clock.minutes = 17 * 60 + 59;
    expect(game.enterFair('pumpkin')).toMatchObject({ ok: true });
    game.clock.minutes = 18 * 60 + 1;
    expect(game.festivalNow()).toBeUndefined();
    expect(game.enterFair('radish')).toEqual({ ok: false, note: 'There is no fair to enter.' });
    expect(game.claimFestival()).toMatchObject({ ok: true });
    expect(game.money).toBeGreaterThan(0);
  });

  it('tells the player to select something first when nothing suitable is in hand', () => {
    const judge = festival('harvest_fair').places.find((p) => p.npc === festival('harvest_fair').host)!;
    const game = at(GREEN, judge.x, judge.y + 1, 'up', { day, minutes: TEN }, { inventory: { slots: Array.from({ length: 12 }, () => null), selected: 0, canWater: 24 } });
    openFestival(game);
    expect(game.dialog?.options.find((o) => o.id === 'festival:enter')).toMatchObject({ enabled: false });
  });

  it('takes your best one of the thing you offer, and only once', () => {
    const game = fair({ inventory: pockets(stack('pumpkin', 1, 0), stack('pumpkin', 1, 2), stack('radish', 2)) });
    expect(game.festivalNow()?.id).toBe('harvest_fair');
    const result = game.enterFair('pumpkin');
    expect(result).toMatchObject({ ok: true });
    expect(game.inventory.count('pumpkin')).toBe(1);
    // The one that went in was the better one.
    expect(game.inventory.slots.find((s) => s?.id === 'pumpkin')?.quality).toBe(0);
    expect(result.ok && result.score).toBe(game.fairScore('pumpkin', 2));
    expect(game.enterFair('radish')).toEqual({ ok: false, note: 'You have already entered something.' });
    expect(game.inventory.count('radish')).toBe(2);
  });

  it('scores a better crop higher, and a dish higher than a raw crop', () => {
    const game = fair();
    expect(game.fairScore('pumpkin', 2)).toBeGreaterThan(game.fairScore('pumpkin', 0));
    expect(game.fairScore('pumpkin_pie', 0)).toBeGreaterThan(game.fairScore('pumpkin', 0));
  });

  it('refuses something that is not in the pockets, or not worth entering', () => {
    const game = fair({ inventory: pockets(stack('hoe', 1)) });
    expect(game.enterFair('pumpkin')).toMatchObject({ ok: false });
    expect(game.enterFair('hoe')).toMatchObject({ ok: false });
    expect(game.toSaveState().festival.entered).toBe(false);
  });

  it('is entered through the judge: choose to enter, then ask how you did', () => {
    const judge = festival('harvest_fair').places.find((p) => p.npc === festival('harvest_fair').host)!;
    const game = at(GREEN, judge.x, judge.y + 1, 'up', { day, minutes: TEN }, { inventory: pockets(stack('pumpkin_pie', 1, 2)), money: 0 });
    openFestival(game);
    expect(game.dialog?.options.find((o) => o.id.startsWith('festival:enter:'))?.enabled).toBe(true);
    pick(game, 'festival:enter:');
    expect(game.inventory.count('pumpkin_pie')).toBe(0);
    // Nothing is left to enter, and the judge has the entry.
    expect(game.dialog?.options.some((o) => o.id.startsWith('festival:enter:'))).toBe(false);
    expect(game.dialog?.lines.join(' ')).toContain('Your entry is in');
    pick(game, 'festival:claim');
    expect(game.money).toBeGreaterThan(0);
  });
});

describe('Lantern Night', () => {
  const day = dayOf('lantern_night');
  const night = (patch: Parameters<typeof farmGameAt>[2] = {}): Game => at(GREEN, 21, 14, 'left', { day, minutes: 19 * 60 }, patch);

  it('gathers everyone on the green from six until ten', () => {
    const game = night();
    expect(game.festivalNow()?.id).toBe('lantern_night');
    for (const place of festival('lantern_night').places) expect(game.villagers.states.get(place.npc)).toMatchObject({ map: GREEN });
    expect(night({ time: { day, minutes: 17 * 60 } }).festivalNow()).toBeUndefined();
  });

  it('counts each villager you speak to once, and speaking warms them twice as much as on an ordinary evening', () => {
    const game = night({ npcs: { willa: known(), tobias: known() } });
    run(game, 0.1);
    tap(game, 'KeyE'); // Willa, at 20,14, stands in front of the player (21,14)
    readThrough(game);
    pick(game, 'npc:chat:willa');
    expect(game.festivalStatus()?.score).toBe(1);
    // An ordinary evening's chat, for comparison, gives the usual points; tonight gives twenty more.
    const ordinary = at(GREEN, 19, 17, 'up', { day: 110, minutes: 19 * 60 }, { npcs: { willa: known() } }); // Willa's evening by the fountain
    run(ordinary, 0.1);
    tap(ordinary, 'KeyE');
    readThrough(ordinary);
    pick(ordinary, 'npc:chat:willa');
    expect(game.villagers.record('willa').friendship).toBe(ordinary.villagers.record('willa').friendship + 20);
    // A second chat the same day is nothing new.
    game.setDialog(undefined);
    expect(game.festivalChat('willa')).toBe(0);
    expect(game.festivalStatus()?.score).toBe(1);
  });

  const lanterns = (game: Game) => [...game.map.extras.values()].filter((o) => o.def.id === 'festival_lantern');

  it('lines the plaza with lanterns while it is on: not before, not saved as furniture, not to be picked up, and gone when it ends', () => {
    expect(lanterns(night({ time: { day, minutes: 17 * 60 } }))).toHaveLength(0);
    const game = night();
    run(game, 0.1);
    expect(lanterns(game)).toHaveLength(6);
    expect(game.toSaveState().placed[GREEN] ?? []).toEqual([]);
    expect(game.placedCount()).toBe(0);
    // Facing one: it can be looked at, never picked up.
    const first = lanterns(game)[0]!;
    game.player = createPlayerAt(first.x, first.y + 1, 'up');
    run(game, 0.1);
    expect(game.prompt).toMatchObject({ verb: 'Look', name: 'Lantern' });
    const before = JSON.stringify(game.inventory.slots);
    tap(game, 'KeyE');
    readThrough(game);
    expect(JSON.stringify(game.inventory.slots)).toBe(before);
    expect(lanterns(game)).toHaveLength(6);
    // The night ends: the lanterns come down.
    const late = night({ time: { day, minutes: 21 * 60 + 59 } });
    run(late, 0.1);
    expect(lanterns(late)).toHaveLength(6);
    for (let i = 0; i < 400 && late.festivalNow() !== undefined; i += 1) run(late, 0.5);
    expect(late.festivalNow()).toBeUndefined();
    expect(lanterns(late)).toHaveLength(0);
  });

  it('puts the lanterns up again when the player comes back to the green', () => {
    const game = night();
    run(game, 0.1);
    expect(lanterns(game)).toHaveLength(6);
    const again = reopen(game);
    run(again, 0.1);
    expect(lanterns(again)).toHaveLength(6);
  });

  it('owes the extra warmth for a word tonight even when the day\'s ordinary chat with them was already used', () => {
    const game = night({ npcs: { willa: known({ talkedDay: day }) } });
    const before = game.villagers.record('willa').friendship;
    run(game, 0.1);
    tap(game, 'KeyE');
    readThrough(game);
    pick(game, 'npc:chat:willa');
    expect(game.villagers.record('willa').friendship).toBe(before + 20);
    expect(game.festivalStatus()?.score).toBe(1);
  });

  it('waits to hang a lantern on a cell where someone is standing, and hangs it once they move', () => {
    const game = at(GREEN, 20, 13, 'up', { day, minutes: 18 * 60 });
    run(game, 0.1);
    expect(lanterns(game)).toHaveLength(5);
    expect(game.map.extraAt(20, 13)).toBeUndefined();
    game.player = createPlayerAt(20, 11, 'down');
    run(game, 0.1);
    expect(lanterns(game)).toHaveLength(6);
    expect(game.map.extraAt(20, 13)?.def.id).toBe('festival_lantern');
  });

  it('pays for speaking to everyone', () => {
    const game = night({ money: 0, festival: { day, score: 6, found: [], entered: false, talked: festival('lantern_night').places.map((p) => p.npc), claimed: false } });
    expect(game.festivalStatus()?.line).toContain('6 of 6');
    expect(game.claimFestival()).toMatchObject({ ok: true, rank: 1 });
    expect(game.money).toBeGreaterThan(0);
  });
});

describe('festival rewards and the save', () => {
  it('ranks by comparison with rivals who are the same on the same day', () => {
    expect(rivalScores('egg_hunt', 13, 3, 2, 6)).toEqual(rivalScores('egg_hunt', 13, 3, 2, 6));
    expect(rivalScores('egg_hunt', 13, 3, 2, 6)).not.toEqual(rivalScores('egg_hunt', 14, 3, 2, 6));
    const prizes = festival('egg_hunt').prizes;
    expect(prizeFor(prizes, rankOf(99, rivalScores('egg_hunt', 13, 3, 2, 6)))?.rank).toBe(1);
    expect(prizeFor(prizes, rankOf(0, rivalScores('egg_hunt', 13, 3, 2, 6)))?.rank).toBe(4);
  });

  it('writes today\'s festival progress and the board into the save, and reads them back', () => {
    const day = dayOf('egg_hunt');
    const game = at(GREEN, 3, 14, 'right', { day, minutes: TEN });
    const egg = game.huntEggs[0]!;
    game.player.x = egg.x * 16 + 8;
    game.player.y = egg.y * 16 + 14;
    run(game, 0.1);
    const request = game.requestsToday()[0]!.request;
    game.inventory.add(stack(request.item, request.count));
    expect(game.fulfilRequest(request.id)).toMatchObject({ ok: true });
    const saved = game.toSaveState();
    expect(saved.festival).toMatchObject({ day, score: 1, claimed: false });
    expect(saved.festival.found).toEqual([egg.y * 1000 + egg.x]);
    expect(saved.board).toEqual({ day, done: [request.id] });
    const back = reopen(game);
    expect(back.festivalStatus()?.score).toBe(1);
    expect(back.requestsToday().find((r) => r.request.id === request.id)?.done).toBe(true);
  });

  it('does not carry yesterday\'s progress into today', () => {
    const game = farmGameAt({ x: 10, y: 10 }, 'down', {
      time: { day: 20, minutes: TEN },
      festival: { day: 13, score: 8, found: [9004], entered: true, talked: ['willa'], claimed: true },
      board: { day: 13, done: ['req:13:0'] },
    });
    expect(game.festivalProgress.score).toBe(0);
    expect(game.requestsToday().every((r) => !r.done)).toBe(true);
  });
});
