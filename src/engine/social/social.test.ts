import { describe, expect, it } from 'vitest';
import type { PathGrid } from '../path/astar';
import { allHold, holds, type Facts } from './conditions';
import { BIRTHDAY_MULTIPLIER, CHAT_POINTS, chat, giftAllowance, gift, GIFTS_PER_WEEK, heartsOf, MAX_FRIENDSHIP, newRecord, reactionTo, REACTION_POINTS } from './friendship';
import type { NpcDef } from './types';
import { AWAY } from './types';
import { activeEntry, cellOf, NPC_SPEED, Villagers, type ExitLike, type MapAccess } from './villagers';

const base = (over: Partial<NpcDef> = {}): NpcDef => ({
  id: 'ann',
  name: 'Ann',
  role: 'Tester',
  about: '',
  sprite: 'ann',
  home: 'a',
  birthday: { season: 'summer', day: 3 },
  schedule: [{ from: 360, map: 'a', x: 1, y: 1 }],
  tastes: { loves: ['pumpkin'], likes: ['radish'], dislikes: ['tomato'], hates: ['sunflower'] },
  greetings: [],
  chats: [],
  reactions: { loved: [], liked: [], neutral: [], disliked: [], hated: [] },
  birthdayThanks: [],
  rewards: [],
  quests: [],
  ...over,
});

const facts = (over: Partial<Facts> = {}): Facts => ({
  day: 1,
  minutes: 600,
  flags: new Set(),
  hearts: () => 0,
  questStatus: () => 'none',
  met: () => false,
  npc: () => base(),
  ...over,
});

describe('conditions', () => {
  it('compares hearts, season, time and flags', () => {
    expect(holds({ kind: 'friendship', atLeast: 2 }, facts({ hearts: () => 2 }), 'ann')).toBe(true);
    expect(holds({ kind: 'friendship', atLeast: 3 }, facts({ hearts: () => 2 }), 'ann')).toBe(false);
    expect(holds({ kind: 'friendship', atLeast: 1, npc: 'bob' }, facts({ hearts: (n) => (n === 'bob' ? 1 : 0) }), 'ann')).toBe(true);
    expect(holds({ kind: 'season', is: ['spring'] }, facts({ day: 5 }), 'ann')).toBe(true);
    expect(holds({ kind: 'season', is: ['spring'] }, facts({ day: 30 }), 'ann')).toBe(false);
    expect(holds({ kind: 'time', from: 540, to: 1020 }, facts({ minutes: 540 }), 'ann')).toBe(true);
    expect(holds({ kind: 'time', from: 540, to: 1020 }, facts({ minutes: 1020 }), 'ann')).toBe(false);
    expect(holds({ kind: 'flag', name: 'x' }, facts({ flags: new Set(['x']) }), 'ann')).toBe(true);
    expect(holds({ kind: 'flag', name: 'x', value: false }, facts(), 'ann')).toBe(true);
  });

  it('knows quests, first meetings and birthdays, and can negate', () => {
    expect(holds({ kind: 'quest', id: 'q', status: 'active' }, facts({ questStatus: () => 'active' }), 'ann')).toBe(true);
    expect(holds({ kind: 'firstMeeting' }, facts(), 'ann')).toBe(true);
    expect(holds({ kind: 'firstMeeting' }, facts({ met: () => true }), 'ann')).toBe(false);
    expect(holds({ kind: 'birthday' }, facts({ day: 28 + 3 }), 'ann')).toBe(true); // Summer 3
    expect(holds({ kind: 'birthday' }, facts({ day: 4 }), 'ann')).toBe(false);
    expect(holds({ kind: 'not', condition: { kind: 'firstMeeting' } }, facts({ met: () => true }), 'ann')).toBe(true);
    expect(allHold(undefined, facts(), 'ann')).toBe(true);
    expect(allHold([{ kind: 'firstMeeting' }, { kind: 'flag', name: 'nope' }], facts(), 'ann')).toBe(false);
  });
});

describe('friendship', () => {
  it('turns points into hearts, capped at ten', () => {
    expect([heartsOf(0), heartsOf(99), heartsOf(100), heartsOf(MAX_FRIENDSHIP), heartsOf(99999)]).toEqual([0, 0, 1, 10, 10]);
  });

  it('rewards only the first chat of a day', () => {
    const record = newRecord();
    expect(chat(record, 3)).toBe(CHAT_POINTS);
    expect(chat(record, 3)).toBe(0);
    expect(chat(record, 4)).toBe(CHAT_POINTS);
    expect(record.friendship).toBe(CHAT_POINTS * 2);
    expect(record.met).toBe(true);
  });

  it('reacts to gifts by taste', () => {
    const tastes = base().tastes;
    expect(['pumpkin', 'radish', 'beet', 'tomato', 'sunflower'].map((i) => reactionTo(tastes, i))).toEqual(['loved', 'liked', 'neutral', 'disliked', 'hated']);
  });

  it('adds and takes away friendship, never below zero or above the cap', () => {
    const npc = base();
    const record = newRecord();
    expect(gift(record, npc, 'pumpkin', 2)).toMatchObject({ reaction: 'loved', gained: REACTION_POINTS.loved });
    const poor = newRecord();
    expect(gift(poor, npc, 'sunflower', 2).gained).toBe(0); // nothing to lose yet
    expect(poor.friendship).toBe(0);
    const rich = newRecord();
    rich.friendship = MAX_FRIENDSHIP - 10;
    expect(gift(rich, npc, 'pumpkin', 2).gained).toBe(10);
  });

  it('multiplies kindness on a birthday, but not unkindness', () => {
    const npc = base();
    const day = 28 + 3; // Summer 3
    expect(gift(newRecord(), npc, 'pumpkin', day)).toMatchObject({ gained: REACTION_POINTS.loved * BIRTHDAY_MULTIPLIER, birthday: true });
    const record = newRecord();
    record.friendship = 500;
    expect(gift(record, npc, 'sunflower', day).gained).toBe(REACTION_POINTS.hated);
  });

  it('allows one gift a day and a couple a week', () => {
    const record = newRecord();
    expect(giftAllowance(record, 1)).toBe('ok');
    gift(record, base(), 'radish', 1);
    expect(giftAllowance(record, 1)).toBe('today');
    expect(giftAllowance(record, 2)).toBe('ok');
    gift(record, base(), 'radish', 2);
    expect(record.giftsThisWeek).toBe(GIFTS_PER_WEEK);
    expect(giftAllowance(record, 3)).toBe('week');
    expect(giftAllowance(record, 8)).toBe('ok'); // a new week
  });
});

// ---------------------------------------------------------------- villagers

const open = (rows: readonly string[]): PathGrid => ({ width: rows[0]?.length ?? 0, height: rows.length, walkable: (x, y) => rows[y]?.[x] === '.' });

function world(): MapAccess {
  // Map a is a corridor with a wall; its east end leads to map b.
  const grids: Record<string, PathGrid> = {
    a: open(['..........', '.####.....', '..........']),
    b: open(['......', '......']),
  };
  const exits: Record<string, ExitLike[]> = {
    a: [{ x: 9, y: 0, w: 1, h: 3, to: { map: 'b', x: 1, y: 0, facing: 'right' } }],
    b: [{ x: 0, y: 0, w: 1, h: 2, to: { map: 'a', x: 8, y: 0, facing: 'left' } }],
  };
  return { grid: (id) => grids[id] as PathGrid, exits: (id) => exits[id] ?? [] };
}

const advance = (v: Villagers, seconds: number, minutes: number, playerMap: string): void => {
  for (let i = 0; i < seconds * 60; i += 1) v.update(1 / 60, minutes, playerMap);
};

describe('schedules', () => {
  const day = base({
    schedule: [
      { from: 360, map: 'a', x: 0, y: 0 },
      { from: 600, map: 'a', x: 8, y: 2, facing: 'up' },
      { from: 900, map: 'b', x: 4, y: 1, facing: 'left' },
    ],
  });

  it('is at the first entry before any has started and at the latest one that has', () => {
    expect(activeEntry(day, 100).index).toBe(0);
    expect(activeEntry(day, 599).index).toBe(0);
    expect(activeEntry(day, 600).index).toBe(1);
    expect(activeEntry(day, 5000).index).toBe(2);
  });
});

describe('Villagers', () => {
  const walker = base({
    schedule: [
      { from: 360, map: 'a', x: 0, y: 0 },
      { from: 600, map: 'a', x: 8, y: 2, facing: 'up' },
      { from: 900, map: 'b', x: 4, y: 1, facing: 'left' },
    ],
  });

  it('starts the day at the first entry', () => {
    const v = new Villagers([walker], world(), {}, 400);
    expect(cellOf(v.states.get('ann')!)).toEqual({ x: 0, y: 0 });
    expect(v.onMap('a')).toHaveLength(1);
    expect(v.onMap('b')).toHaveLength(0);
  });

  it('walks to the next place when its time comes, round the wall, at a walking pace', () => {
    const v = new Villagers([walker], world(), {}, 400);
    advance(v, 1, 600, 'a');
    const state = v.states.get('ann')!;
    expect(state.moving).toBe(true);
    const moved = Math.hypot(state.x - 8, state.y - 14);
    expect(moved).toBeGreaterThan(NPC_SPEED * 0.8);
    expect(moved).toBeLessThan(NPC_SPEED * 1.2 + 4);
    // 8 + 2 cells of walking, with a wall to go round
    advance(v, 20, 600, 'a');
    expect(state.moving).toBe(false);
    expect(cellOf(state)).toEqual({ x: 8, y: 2 });
    expect(state.facing).toBe('up');
  });

  it('never walks through a wall', () => {
    const v = new Villagers([walker], world(), {}, 400);
    const grid = world().grid('a');
    for (let i = 0; i < 20 * 60; i += 1) {
      v.update(1 / 60, 600, 'a');
      const cell = cellOf(v.states.get('ann')!);
      expect(grid.walkable(cell.x, cell.y), `${cell.x},${cell.y}`).toBe(true);
    }
  });

  it('walks off the map and appears on the next, when the player is watching', () => {
    const v = new Villagers([walker], world(), {}, 700);
    const state = v.states.get('ann')!;
    advance(v, 0.2, 900, 'a');
    expect(state.map).toBe('a');
    advance(v, 12, 900, 'a'); // walks to the exit
    expect(state.map).toBe('b');
    advance(v, 12, 900, 'b'); // and on to its place
    expect(cellOf(state)).toEqual({ x: 4, y: 1 });
    expect(state.facing).toBe('left');
  });

  it('simply arrives when nobody is watching', () => {
    const v = new Villagers([walker], world(), {}, 700);
    advance(v, 0.05, 900, 'somewhere else');
    advance(v, 0.05, 900, 'somewhere else');
    const state = v.states.get('ann')!;
    expect(state.map).toBe('b');
    expect(cellOf(state)).toEqual({ x: 4, y: 1 });
  });

  it('can be placed anywhere in the day at once', () => {
    const v = new Villagers([walker], world(), {}, 400);
    v.placeAll(950);
    expect(v.states.get('ann')).toMatchObject({ map: 'b', moving: false });
    expect(cellOf(v.states.get('ann')!)).toEqual({ x: 4, y: 1 });
    v.placeAll(361);
    expect(v.states.get('ann')?.map).toBe('a');
  });

  it('puts someone where they belong rather than leave them stuck when there is no way', () => {
    const stranded = base({ schedule: [{ from: 360, map: 'a', x: 0, y: 0 }, { from: 600, map: 'zz', x: 1, y: 1 }] });
    const v = new Villagers([stranded], world(), {}, 400);
    advance(v, 0.1, 700, 'a');
    expect(v.states.get('ann')?.map).toBe('zz');
  });

  it('knows who is minding a shop, and when it opens', () => {
    const keeper = base({
      schedule: [
        { from: 360, map: 'b', x: 2, y: 1 },
        { from: 540, map: 'a', x: 8, y: 2, serves: 'stall' },
        { from: 1020, map: 'b', x: 2, y: 1 },
      ],
    });
    const v = new Villagers([keeper], world(), {}, 600);
    expect(v.servingShop('stall', 'a', 600)?.id).toBe('ann');
    expect(v.servingShop('stall', 'b', 600)).toBeUndefined();
    expect(v.servingShop('stall', 'a', 1100)).toBeUndefined(); // gone home
    v.placeAll(400);
    expect(v.servingShop('stall', 'a', 400)).toBeUndefined();
    expect(v.nextOpening('stall', 400)).toEqual({ at: 540, inDays: 0, weekday: 0, certain: true });
    expect(v.nextOpening('stall', 1100)).toEqual({ at: 540, inDays: 1, weekday: 1, certain: true });
    expect(v.nextOpening('nothing', 400)).toBeUndefined();
  });

  it('keeps and restores what villagers remember', () => {
    const v = new Villagers([base()], world());
    v.record('ann').friendship = 340;
    v.record('ann').rewards.push(1);
    const copy = new Villagers([base()], world(), v.toSave());
    expect(copy.record('ann')).toMatchObject({ friendship: 340, rewards: [1] });
    // a stranger in the save is ignored, a villager missing from it starts fresh
    const other = new Villagers([base({ id: 'bob' })], world(), v.toSave());
    expect(other.record('bob').friendship).toBe(0);
  });
});

describe('days that are not all alike', () => {
  const day = (rainy: boolean, weekday = 0, festival?: Parameters<Villagers['setDay']>[0]['festival']) => ({ rainy, weekday, ...(festival === undefined ? {} : { festival }) });
  const npc = (schedule: NpcDef['schedule']): NpcDef => base({ schedule });

  it('picks the entry for the weather: rain keeps someone in, and a fine day sends them out', () => {
    const def = npc([
      { from: 360, map: 'home', x: 1, y: 1 },
      { from: 480, map: 'out', x: 2, y: 2, when: 'dry' },
      { from: 480, map: 'home', x: 3, y: 3, when: 'rain' },
    ]);
    expect(activeEntry(def, 500, day(false)).entry.map).toBe('out');
    expect(activeEntry(def, 500, day(true)).entry.map).toBe('home');
    expect(activeEntry(def, 500, day(true)).entry.x).toBe(3);
    expect(activeEntry(def, 400, day(true)).entry.map).toBe('home'); // before the split, the same either way
  });

  it('picks the entry for the weekday, and can send someone away for the day', () => {
    const def = npc([
      { from: 360, map: AWAY, x: 0, y: 0 },
      { from: 540, map: 'green', x: 5, y: 5, days: [6] },
    ]);
    expect(activeEntry(def, 600, day(false, 6)).entry.map).toBe('green');
    expect(activeEntry(def, 600, day(false, 2)).entry.map).toBe(AWAY);
  });

  it('calls a villager to the festival while it is open, and not before or after', () => {
    const def = npc([{ from: 360, map: 'home', x: 1, y: 1 }]);
    const festival = { map: 'green', from: 540, to: 1020, places: new Map([[def.id, { x: 9, y: 9, facing: 'down' as const }]]) };
    expect(activeEntry(def, 500, day(false, 0, festival)).entry.map).toBe('home');
    const during = activeEntry(def, 600, day(false, 0, festival));
    expect(during.entry).toMatchObject({ map: 'green', x: 9, y: 9, facing: 'down' });
    expect(during.index).toBe(-1);
    expect(activeEntry(def, 1020, day(false, 0, festival)).entry.map).toBe('home');
  });

  it('puts someone who is away on no map at all, and walks them back in', () => {
    const def = npc([
      { from: 360, map: AWAY, x: 0, y: 0 },
      { from: 540, map: 'green', x: 5, y: 5, days: [6] },
    ]);
    const v = new Villagers([def], world(), {}, 400, day(false, 2));
    expect(v.onMap('green')).toHaveLength(0);
    expect(v.states.get(def.id)?.map).toBe(AWAY);
    v.setDay(day(false, 6));
    v.placeAll(600);
    expect(v.onMap('green')).toHaveLength(1);
    v.setDay(day(false, 3));
    v.placeAll(600);
    expect(v.onMap('green')).toHaveLength(0);
  });

  it('says when a stall opens, and when it will not open at all today', () => {
    const def = npc([
      { from: 360, map: 'home', x: 1, y: 1 },
      { from: 540, map: 'green', x: 5, y: 5, serves: 'stall', when: 'dry' },
    ]);
    const v = new Villagers([def], world(), {}, 400, day(false));
    expect(v.nextOpening('stall', 400)).toEqual({ at: 540, inDays: 0, weekday: 0, certain: true });
    // In the rain nobody minds it today, and whether tomorrow will do depends on the weather: only perhaps.
    v.setDay(day(true));
    expect(v.nextOpening('stall', 400)).toEqual({ at: 540, inDays: 1, weekday: 1, certain: false });
  });

  it('names the weekday when a stall opens only on some days, and never promises a day it is not open', () => {
    const def = npc([
      { from: 360, map: 'home', x: 1, y: 1 },
      { from: 480, map: 'green', x: 5, y: 5, serves: 'cart', days: [6] },
    ]);
    const v = new Villagers([def], world(), {}, 400, day(false, 2)); // a Wednesday morning
    expect(v.nextOpening('cart', 400)).toEqual({ at: 480, inDays: 4, weekday: 6, certain: true });
    v.setDay(day(false, 6)); // Sunday: still to open today, and after it has closed it is a week away
    expect(v.nextOpening('cart', 400)).toEqual({ at: 480, inDays: 0, weekday: 6, certain: true });
    expect(v.nextOpening('cart', 1100)).toEqual({ at: 480, inDays: 7, weekday: 6, certain: true });
    expect(v.nextOpening('nothing', 400)).toBeUndefined();
    // A shop nobody minds in the next week gives no promise at all.
    const never = npc([{ from: 360, map: 'home', x: 1, y: 1 }, { from: 480, map: 'green', x: 5, y: 5, serves: 'cart', days: [] }]);
    expect(new Villagers([never], world(), {}, 400, day(false)).nextOpening('cart', 400)).toBeUndefined();
  });
});
