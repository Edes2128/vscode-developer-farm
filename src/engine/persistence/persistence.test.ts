import { describe, expect, it, vi } from 'vitest';
import { SaveManager } from './saveManager';
import { checksum, decodeSave, encodeSave, sanitizeGameState, SAVE_VERSION, type GameSaveState } from './saveFormat';
import { migrateState } from './migrations';
import { DEFAULT_PREFERENCES, PreferencesStore, sanitizePreferences } from './preferences';
import { isValidStorageKey, MemoryBackend, type StorageBackend } from './storage';
import { WriteQueue } from './writeQueue';

const emptySlots = (): (GameSaveState['inventory']['slots'][number])[] => Array.from({ length: 12 }, () => null);

const state = (x = 100): GameSaveState => ({
  mapId: 'willowbrook.home_farm',
  player: { x, y: 50, facing: 'left' },
  playTimeMs: 12_345,
  time: { day: 3, minutes: 600 },
  money: 275,
  inventory: { slots: [{ id: 'hoe', count: 1, quality: 0 }, { id: 'radish', count: 4, quality: 1 }, ...emptySlots().slice(2)], selected: 1, canWater: 10 },
  bin: [{ id: 'radish', count: 2, quality: 0 }],
  farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: true }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 1, daysInStage: 1, planted: 2 }] } },
  npcs: { willa: { friendship: 140, met: true, talkedDay: 2, giftedDay: 0, giftWeek: 0, giftsThisWeek: 0, rewards: [2], seen: ['willa.first'] } },
  ranches: { 'willowbrook.home_farm': { animals: [{ id: 'a1', kind: 'chicken', name: 'Clover', friendship: 60, pettedDay: 2, fedDay: 2 }], feed: 3, basket: [{ id: 'egg', count: 2, quality: 0 }] } },
  quests: [{ id: 'welcome_to_the_green', status: 'active', progress: [0] }],
  flags: ['visited:willowbrook.home_farm'],
  collection: { carp: 2, copper_ore: 7 },
  mine: { deepest: 3 },
  placed: { 'willowbrook.farmhouse': [{ def: 'chair', x: 4, y: 5 }] },
  buildings: { built: ['greenhouse'], pending: [{ site: 'greenhouse_site', readyDay: 12 }] },
  museum: { donated: ['carp', 'coal'], claimed: [3] },
  spent: { day: 3, cells: { 'mine.floor_2': [1004, 2007] }, fished: { 'willowbrook.home_farm:river': 4 } },
  festival: { day: 3, score: 2, found: [9004, 12007], entered: false, talked: ['willa'], claimed: false },
  board: { day: 3, done: ['req:3:0'] },
  bestiary: { seen: ['heron', 'owl'], friends: ['owl'] },
});
const at = (iso: string) => () => new Date(iso);

describe('save format', () => {
  it('round-trips a save', () => {
    const text = encodeSave(state(), new Date('2026-11-06T10:00:00Z'));
    const result = decodeSave(text);
    expect(result).toMatchObject({ ok: true, version: SAVE_VERSION, migrated: false, savedAt: '2026-11-06T10:00:00.000Z' });
    expect(result.ok && result.state).toEqual(state());
  });

  it('rejects text that is not JSON, not ours, or cut short', () => {
    expect(decodeSave('')).toMatchObject({ ok: false, reason: 'not-json' });
    expect(decodeSave('{"hello":1}')).toMatchObject({ ok: false, reason: 'wrong-format' });
    expect(decodeSave('[1,2]')).toMatchObject({ ok: false, reason: 'wrong-format' });
    const text = encodeSave(state(), new Date());
    expect(decodeSave(text.slice(0, text.length - 7))).toMatchObject({ ok: false, reason: 'not-json' });
  });

  it('notices a save whose contents changed since it was written', () => {
    const edited = encodeSave(state(), new Date()).replace('"x":100', '"x":101');
    expect(decodeSave(edited)).toMatchObject({ ok: false, reason: 'checksum-mismatch' });
  });

  it('refuses a save from a newer version rather than guessing', () => {
    const raw = JSON.parse(encodeSave(state(), new Date())) as Record<string, unknown>;
    raw['version'] = SAVE_VERSION + 1;
    expect(decodeSave(JSON.stringify(raw))).toMatchObject({ ok: false, reason: 'newer-version', version: SAVE_VERSION + 1 });
  });

  it('rejects states with bad values instead of half loading them', () => {
    for (const bad of [
      { ...state(), mapId: '' },
      { ...state(), playTimeMs: -1 },
      { ...state(), playTimeMs: Number.NaN },
      { ...state(), player: { x: Number.POSITIVE_INFINITY, y: 0, facing: 'up' } },
      { ...state(), player: { x: 1, y: 1, facing: 'sideways' } },
      null,
      'text',
    ]) {
      expect(sanitizeGameState(bad)).toBeUndefined();
    }
    const body = { ...state(), player: { x: 1, y: 1, facing: 'sideways' } };
    const envelope = JSON.stringify({ format: 'developer-farm-save', version: 1, savedAt: '', checksum: checksum(JSON.stringify(body)), state: body });
    expect(decodeSave(envelope)).toMatchObject({ ok: false, reason: 'invalid-state' });
  });

  it('upgrades an old save through every migration, in order', () => {
    const migrations = {
      1: (s: unknown) => ({ ...(s as object), step1: true }),
      2: (s: unknown) => ({ ...(s as object), step2: true }),
    };
    expect(migrateState({}, 1, 3, migrations)).toEqual({ step1: true, step2: true });
    expect(() => migrateState({}, 1, 4, migrations)).toThrow(/No migration from save version 3/);
  });

  /** A save as an older version of the game wrote it. */
  const envelopeOf = (version: number, body: unknown): string =>
    JSON.stringify({ format: 'developer-farm-save', version, savedAt: '2026-01-01T00:00:00.000Z', checksum: checksum(JSON.stringify(body)), state: body });

  const v1State = { mapId: 'willowbrook.home_farm', player: { x: 216, y: 238, facing: 'up' }, playTimeMs: 90_000 };

  it('upgrades a real version-1 save: where the player was is kept, and the new parts get sensible starting values', () => {
    const result = decodeSave(envelopeOf(1, v1State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 1 });
    if (!result.ok) return;
    expect(result.state.player).toEqual({ x: 216, y: 238, facing: 'up' });
    expect(result.state.playTimeMs).toBe(90_000);
    expect(result.state.time).toEqual({ day: 1, minutes: 360 });
    expect(result.state.money).toBe(150);
    expect(result.state.inventory.slots.filter((s) => s !== null).map((s) => `${s?.id}x${s?.count}`)).toEqual(['hoex1', 'watering_canx1', 'radish_seedsx5', 'strawberry_seedsx3']);
    expect(result.state.inventory.canWater).toBe(24);
    expect(result.state.bin).toEqual([]);
    expect(result.state.farms).toEqual({});
  });

  /** A save exactly as Phase 2 (version 2) wrote it: a farm in progress, and nothing about villagers, hens or quests. */
  const v2State = {
    mapId: 'willowbrook.home_farm',
    player: { x: 108, y: 238, facing: 'down' },
    playTimeMs: 1_234_567,
    time: { day: 9, minutes: 845 },
    money: 410,
    inventory: {
      slots: [{ id: 'hoe', count: 1, quality: 0 }, { id: 'watering_can', count: 1, quality: 0 }, { id: 'radish', count: 3, quality: 1 }, null, null, null, null, null, null, null, null, null],
      selected: 2,
      canWater: 17,
    },
    bin: [{ id: 'radish', count: 2, quality: 0 }],
    farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: true }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 2, daysInStage: 1, planted: 5 }] } },
  };

  it('upgrades a real version-2 save: the farm is exactly as it was, and no one has met the player yet', () => {
    const result = decodeSave(envelopeOf(2, v2State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 2 });
    if (!result.ok) return;
    const { npcs, ranches, quests, flags, collection, mine, placed, buildings, museum, spent, festival, board, bestiary, ...kept } = result.state;
    expect(kept).toEqual(v2State);
    expect(npcs).toEqual({});
    expect(ranches).toEqual({});
    expect(quests).toEqual([]);
    expect(flags).toEqual([]);
    expect(collection).toEqual({});
    expect(mine).toEqual({ deepest: 0 });
    expect(placed).toEqual({});
    expect(buildings).toEqual({ built: [], pending: [] });
    expect(museum).toEqual({ donated: [], claimed: [] });
    expect(spent).toEqual({ day: 0, cells: {}, fished: {} });
  });

  /** A save exactly as Phase 3 (version 3) wrote it: a farm with a coop, a quest and a friend, and nothing found yet. */
  const v3State = {
    ...v2State,
    npcs: { willa: { friendship: 60, met: true, talkedDay: 8, giftedDay: 0, giftWeek: -1, giftsThisWeek: 0, rewards: [], seen: ['willa.story'] } },
    ranches: { 'willowbrook.home_farm': { animals: [{ id: 'a1', kind: 'chicken', name: 'Clover', friendship: 30, pettedDay: 8, fedDay: 8 }], feed: 2, basket: [] } },
    quests: [{ id: 'welcome_to_the_green', status: 'done', progress: [1] }],
    flags: ['visited:willowbrook.home_farm', 'visited:willowbrook.village_green'],
  };

  it('upgrades a real version-3 save: the coop and the friend are kept, and nothing has been found, built or given', () => {
    const result = decodeSave(envelopeOf(3, v3State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 3 });
    if (!result.ok) return;
    const { collection, mine, placed, buildings, museum, spent, festival, board, bestiary, ...kept } = result.state;
    expect(kept).toEqual(v3State);
    expect(collection).toEqual({});
    expect(mine).toEqual({ deepest: 0 });
    expect(placed).toEqual({});
    expect(buildings).toEqual({ built: [], pending: [] });
    expect(museum).toEqual({ donated: [], claimed: [] });
    expect(spent).toEqual({ day: 0, cells: {}, fished: {} });
  });

  const NO_FESTIVAL = { day: 0, score: 0, found: [], entered: false, talked: [], claimed: false };

  /** A save exactly as Phase 4 (version 4) wrote it: a farm, a coop, a quest, some fish caught, the mine visited. */
  const v4State = {
    ...v2State,
    npcs: { willa: { friendship: 140, met: true, talkedDay: 8, giftedDay: 0, giftWeek: -1, giftsThisWeek: 0, rewards: [0], seen: [] } },
    ranches: {},
    quests: [{ id: 'gone_fishing', status: 'done', progress: [3] }],
    flags: ['visited:willowbrook.home_farm', 'visited:willowbrook.whispering_wood'],
    collection: { carp: 2, copper_ore: 5 },
    mine: { deepest: 2 },
  };

  it('upgrades a real version-4 save: everything is kept, and no furniture, building or museum gift exists yet', () => {
    const result = decodeSave(envelopeOf(4, v4State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 4 });
    if (!result.ok) return;
    const { placed, buildings, museum, spent, festival, board, bestiary, ...kept } = result.state;
    expect(kept).toEqual(v4State);
    expect(festival).toEqual(NO_FESTIVAL);
    expect(board).toEqual({ day: 0, done: [] });
    expect(spent).toEqual({ day: 0, cells: {}, fished: {} });
    expect(placed).toEqual({});
    expect(buildings).toEqual({ built: [], pending: [] });
    expect(museum).toEqual({ donated: [], claimed: [] });
  });

  /** A save exactly as Phase 5 (version 5) wrote it: furniture placed, a greenhouse pending, a museum gift, today's spending. */
  const v5State = {
    ...v4State,
    placed: { 'willowbrook.farmhouse': [{ def: 'chair', x: 4, y: 5 }] },
    buildings: { built: [], pending: [{ site: 'greenhouse_site', readyDay: 12 }] },
    museum: { donated: ['carp'], claimed: [] },
    spent: { day: 9, cells: { 'mine.floor_2': [1004] }, fished: { 'willowbrook.riverbank:river': 3 } },
  };

  it('upgrades a real version-5 save: everything is kept, and there is no festival score or handed-in request yet', () => {
    const result = decodeSave(envelopeOf(5, v5State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 5 });
    if (!result.ok) return;
    const { festival, board, bestiary, ...kept } = result.state;
    expect(kept).toEqual(v5State);
    expect(bestiary).toEqual({ seen: [], friends: [] });
    expect(festival).toEqual(NO_FESTIVAL);
    expect(board).toEqual({ day: 0, done: [] });
  });

  /** A save exactly as Phase 6 (version 6) wrote it: today's festival score and a handed-in request. */
  const v6State = {
    ...v5State,
    museum: { donated: ['carp', 'coal', 'quartz'], claimed: [3] },
    festival: { day: 13, score: 4, found: [9004, 12007], entered: false, talked: [], claimed: false },
    board: { day: 13, done: ['req:13:0'] },
  };

  it('upgrades a real version-6 save: everything is kept, and no rare creature has been met yet', () => {
    const result = decodeSave(envelopeOf(6, v6State));
    expect(result).toMatchObject({ ok: true, migrated: true, version: 6 });
    if (!result.ok) return;
    const { bestiary, ...kept } = result.state;
    expect(kept).toEqual(v6State);
    expect(bestiary).toEqual({ seen: [], friends: [] });
  });

  it('keeps fertilized soil through a save, and reads an old save without the mark as plain soil', () => {
    const plain = decodeSave(envelopeOf(7, { ...state(), farms: { m: { soil: [{ x: 1, y: 1, watered: false }], crops: [] } } }));
    expect(plain.ok && plain.state.farms['m']?.soil[0]).toEqual({ x: 1, y: 1, watered: false });
    const rich = decodeSave(encodeSave({ ...state(), farms: { m: { soil: [{ x: 1, y: 1, watered: true, fertilized: true }], crops: [] } } }, new Date()));
    expect(rich.ok && rich.state.farms['m']?.soil[0]).toEqual({ x: 1, y: 1, watered: true, fertilized: true });
    expect(sanitizeGameState({ ...state(), farms: { m: { soil: [{ x: 1, y: 1, watered: true, fertilized: 'yes' }], crops: [] } } })).toBeUndefined();
  });

  it('upgrades the museum rewards of a version-5 save from positions to the counts that earned them', () => {
    const body = { ...v5State, museum: { donated: ['carp', 'coal', 'quartz', 'trout', 'perch', 'minnow', 'stone', 'fossil', 'old_coin'], claimed: [0, 2, 1] } };
    const result = decodeSave(envelopeOf(5, body));
    expect(result.ok && result.state.museum).toEqual({ donated: body.museum.donated, claimed: [3, 9, 6] });
    // A position that never was a reward is dropped rather than carried over.
    const junk = decodeSave(envelopeOf(5, { ...v5State, museum: { donated: [], claimed: [1, 40, 'x'] } }));
    expect(junk.ok && junk.state.museum.claimed).toEqual([6]);
  });

  it('upgrades a version-1 save all the way to the current version', () => {
    const result = decodeSave(envelopeOf(1, v1State));
    expect(result.ok && result.state).toMatchObject({ npcs: {}, ranches: {}, quests: [], flags: [] });
  });

  it('keeps the villagers, hens, quests and flags of a current save when it is written and read back', () => {
    const result = decodeSave(encodeSave(state(), new Date()));
    expect(result.ok && result.state).toEqual(state());
    expect(result.ok && Object.keys(result.state.npcs)).toEqual(['willa']);
  });

  it('writes a migrated save back in the current version', () => {
    const result = decodeSave(envelopeOf(1, v1State));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const again = decodeSave(encodeSave(result.state, new Date()));
    expect(again).toMatchObject({ ok: true, migrated: false, version: SAVE_VERSION });
  });

  it('runs injected migrations in order', () => {
    const migrations = { 1: (s: unknown) => ({ ...(s as object), step: 'one' }), 2: (s: unknown) => ({ ...(s as object), step: 'two' }) };
    expect(migrateState({ a: 1 }, 1, 3, migrations)).toEqual({ a: 1, step: 'two' });
  });

  it('rejects a version-1 save whose old contents are damaged', () => {
    expect(decodeSave(envelopeOf(1, { mapId: '', player: v1State.player, playTimeMs: 1 }))).toMatchObject({ ok: false, reason: 'invalid-state' });
  });

  it('reports a migration that throws without crashing', () => {
    const result = decodeSave(envelopeOf(1, v1State), { 1: () => { throw new Error('boom'); } });
    expect(result).toMatchObject({ ok: false, reason: 'migration-failed', detail: 'boom' });
  });

  it('rejects a v2 state with impossible values instead of loading it', () => {
    const good = state();
    for (const bad of [
      { ...good, money: -5 },
      { ...good, money: 1.5 },
      { ...good, time: { day: 0, minutes: 400 } },
      { ...good, time: { day: 2, minutes: 5000 } },
      { ...good, inventory: { ...good.inventory, slots: [{ id: 'hoe', count: 0, quality: 0 }] } },
      { ...good, inventory: { ...good.inventory, slots: [{ id: 'hoe', count: 1, quality: 7 }] } },
      { ...good, inventory: { ...good.inventory, selected: 99 } },
      { ...good, bin: [{ id: 'radish', count: 1, quality: 'great' }] },
      { ...good, farms: { m: { soil: [{ x: -1, y: 0, watered: false }], crops: [] } } },
      { ...good, farms: { m: { soil: [], crops: [{ x: 1, y: 1, crop: 'radish', stage: -1, daysInStage: 0, planted: 1 }] } } },
      { ...good, farms: { m: { soil: 'lots', crops: [] } } },
    ]) {
      expect(sanitizeGameState(bad)).toBeUndefined();
    }
    expect(sanitizeGameState(good)).toBeDefined();
  });

  it('rejects a v3 state with impossible villagers, hens, quests or flags instead of loading it', () => {
    const good = state();
    const willa = good.npcs['willa']!;
    const ranch = good.ranches['willowbrook.home_farm']!;
    for (const bad of [
      { ...good, npcs: { willa: { ...willa, friendship: -1 } } },
      { ...good, npcs: { willa: { ...willa, friendship: 1001 } } },
      { ...good, npcs: { willa: { ...willa, friendship: 1.5 } } },
      { ...good, npcs: { willa: { ...willa, met: 'yes' } } },
      { ...good, npcs: { willa: { ...willa, rewards: [-1] } } },
      { ...good, npcs: { willa: { ...willa, seen: [''] } } },
      { ...good, npcs: [] },
      { ...good, ranches: { m: { ...ranch, feed: -3 } } },
      { ...good, ranches: { m: { ...ranch, animals: [{ ...ranch.animals[0], name: '' }] } } },
      { ...good, ranches: { m: { ...ranch, animals: [{ ...ranch.animals[0], friendship: 5000 }] } } },
      { ...good, ranches: { m: { ...ranch, basket: [{ id: 'egg', count: 0, quality: 0 }] } } },
      { ...good, quests: [{ id: 'q', status: 'finished', progress: [] }] },
      { ...good, quests: [{ id: 'q', status: 'active', progress: [-2] }] },
      { ...good, quests: 'none' },
      { ...good, flags: [7] },
      { ...good, flags: Array.from({ length: 5000 }, (_, i) => `f${i}`) },
      { ...good, placed: { m: [{ def: '', x: 1, y: 1 }] } },
      { ...good, placed: { m: [{ def: 'chair', x: -1, y: 1 }] } },
      { ...good, placed: { m: [{ def: 'chair', x: 1, y: 1.5 }] } },
      { ...good, placed: { m: Array.from({ length: 300 }, () => ({ def: 'chair', x: 1, y: 1 })) } },
      { ...good, placed: [] },
      { ...good, buildings: { built: [3], pending: [] } },
      { ...good, buildings: { built: [], pending: [{ site: 's', readyDay: 0 }] } },
      { ...good, buildings: 'none' },
      { ...good, museum: { donated: [7], claimed: [] } },
      { ...good, museum: { donated: [], claimed: [-1] } },
      { ...good, museum: { donated: [], claimed: [0] } },
      { ...good, museum: { donated: [], claimed: [5000] } },
      { ...good, museum: { claimed: [] } },
      { ...good, spent: { day: -1, cells: {}, fished: {} } },
      { ...good, spent: { day: 1, cells: { m: [-4] }, fished: {} } },
      { ...good, spent: { day: 1, cells: { m: 'all' }, fished: {} } },
      { ...good, spent: { day: 1, cells: {}, fished: { w: 99999 } } },
      { ...good, spent: 'none' },
      { ...good, mine: { deepest: 11 } },
      { ...good, festival: 'none' },
      { ...good, festival: { ...NO_FESTIVAL, score: -1 } },
      { ...good, festival: { ...NO_FESTIVAL, found: [-3] } },
      { ...good, festival: { ...NO_FESTIVAL, found: Array.from({ length: 65 }, (_, i) => i) } },
      { ...good, festival: { ...NO_FESTIVAL, entered: 'yes' } },
      { ...good, festival: { ...NO_FESTIVAL, talked: [''] } },
      { ...good, festival: { day: 1 } },
      { ...good, board: { day: -1, done: [] } },
      { ...good, board: { day: 1, done: [4] } },
      { ...good, board: { day: 1, done: Array.from({ length: 17 }, (_, i) => `r${i}`) } },
      { ...good, board: [] },
      { ...good, bestiary: 'none' },
      { ...good, bestiary: { seen: [] } },
      { ...good, bestiary: { seen: [3], friends: [] } },
      { ...good, bestiary: { seen: [], friends: [''] } },
      { ...good, bestiary: { seen: Array.from({ length: 65 }, (_, i) => `c${i}`), friends: [] } },
    ]) {
      expect(sanitizeGameState(bad)).toBeUndefined();
    }
    expect(sanitizeGameState(good)).toBeDefined();
  });
});

describe('SaveManager', () => {
  const make = (backend: StorageBackend = new MemoryBackend()) => {
    const errors: string[] = [];
    const manager = new SaveManager(backend, { now: at('2026-11-06T10:00:00Z'), onError: (m) => errors.push(m) });
    return { manager, backend, errors };
  };

  it('starts a new game when nothing is saved', async () => {
    expect(await make().manager.load()).toEqual({ kind: 'empty' });
  });

  it('saves and loads', async () => {
    const { manager } = make();
    await manager.saveNow(state(77));
    const loaded = await manager.load();
    expect(loaded).toMatchObject({ kind: 'loaded', source: 'primary', migrated: false });
    expect(loaded.kind === 'loaded' && loaded.state).toEqual(state(77));
    expect(manager.lastSavedAt).toEqual(new Date('2026-11-06T10:00:00Z'));
  });

  it('keeps the previous good save as a backup', async () => {
    const { manager, backend } = make();
    await manager.saveNow(state(1));
    await manager.saveNow(state(2));
    const backup = decodeSave((await backend.read('slot-1.backup')) ?? '');
    expect(backup.ok && backup.state.player.x).toBe(1);
  });

  it('falls back to the backup when the save is damaged, and keeps the damaged file', async () => {
    const { manager, backend } = make();
    await manager.saveNow(state(1));
    await manager.saveNow(state(2));
    const damaged = ((await backend.read('slot-1')) ?? '').slice(0, 40);
    await backend.write('slot-1', damaged);
    const loaded = await manager.load();
    expect(loaded).toMatchObject({ kind: 'loaded', source: 'backup' });
    expect(loaded.kind === 'loaded' && loaded.state.player.x).toBe(1);
    const archives = [...(backend as MemoryBackend).entries.keys()].filter((k) => k.includes('damaged'));
    expect(archives).toHaveLength(1);
    expect(await backend.read(archives[0] as string)).toBe(damaged);
  });

  it('starts fresh but archives the data when neither the save nor the backup can be read', async () => {
    const { manager, backend } = make();
    await backend.write('slot-1', 'garbage');
    await backend.write('slot-1.backup', 'more garbage');
    const loaded = await manager.load();
    expect(loaded).toMatchObject({ kind: 'unreadable', reason: 'not-json' });
    expect(loaded.kind === 'unreadable' && loaded.archivedAs).toBeDefined();
  });

  it('never copies a damaged save over a good backup', async () => {
    const { manager, backend } = make();
    await manager.saveNow(state(1));
    await manager.saveNow(state(2)); // backup is now save 1
    await backend.write('slot-1', 'corrupted');
    await manager.saveNow(state(3));
    const backup = decodeSave((await backend.read('slot-1.backup')) ?? '');
    expect(backup.ok && backup.state.player.x).toBe(1);
  });

  it('leaves a save from a newer version alone and stops saving over it', async () => {
    const { manager, backend } = make();
    const future = JSON.stringify({ format: 'developer-farm-save', version: SAVE_VERSION + 1, state: {} });
    await backend.write('slot-1', future);
    expect(await manager.load()).toEqual({ kind: 'newer-version', version: SAVE_VERSION + 1 });
    expect(manager.isLocked).toBe(true);
    await manager.saveNow(state());
    expect(await backend.read('slot-1')).toBe(future);
  });

  it('coalesces a burst of saves into few writes, and the last one wins', async () => {
    const backend = new MemoryBackend();
    const write = vi.spyOn(backend, 'write');
    const { manager } = make(backend);
    for (let i = 1; i <= 50; i += 1) manager.save(state(i));
    await manager.flush();
    expect(write.mock.calls.filter(([key]) => key === 'slot-1').length).toBeLessThanOrEqual(2);
    const loaded = await manager.load();
    expect(loaded.kind === 'loaded' && loaded.state.player.x).toBe(50);
  });

  it('reports a failing disk and recovers when it works again', async () => {
    class Flaky extends MemoryBackend {
      failing = true;
      override async write(key: string, text: string): Promise<void> {
        if (this.failing) throw new Error('disk full');
        await super.write(key, text);
      }
    }
    const backend = new Flaky();
    const { manager, errors } = make(backend);
    manager.save(state(1));
    await manager.flush();
    expect(errors.some((e) => e.includes('Saving failed'))).toBe(true);
    backend.failing = false;
    await manager.saveNow(state(2));
    const loaded = await manager.load();
    expect(loaded.kind === 'loaded' && loaded.state.player.x).toBe(2);
  });

  it('survives a backend that cannot even read', async () => {
    const backend: StorageBackend = { read: () => Promise.reject(new Error('nope')), write: () => Promise.resolve(), remove: () => Promise.resolve() };
    const { manager, errors } = make(backend);
    expect(await manager.load()).toEqual({ kind: 'empty' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('WriteQueue', () => {
  it('never runs two writes at once', async () => {
    let running = 0;
    let peak = 0;
    const queue = new WriteQueue<number>(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
    }, () => undefined);
    for (let i = 0; i < 10; i += 1) {
      queue.schedule(i);
      await new Promise((r) => setTimeout(r, 1));
    }
    await queue.flush();
    expect(peak).toBe(1);
  });

  it('survives a write that throws before its first await', async () => {
    const errors: unknown[] = [];
    const queue = new WriteQueue<number>(() => { throw new Error('sync'); }, (e) => errors.push(e));
    queue.schedule(1);
    await queue.flush();
    expect(errors).toHaveLength(1);
  });
});

describe('storage keys and preferences', () => {
  it('accepts safe keys only', () => {
    for (const ok of ['slot-1', 'slot-1.backup', 'preferences', 'a']) expect(isValidStorageKey(ok)).toBe(true);
    for (const bad of ['', '../x', 'a/b', 'A', '.hidden', 'x'.repeat(65), 'a b', 'a\\b']) expect(isValidStorageKey(bad)).toBe(false);
  });

  it('reads preferences leniently', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences({ zoom: 4, hudVisible: false, extra: 1 })).toEqual({ ...DEFAULT_PREFERENCES, zoom: 4, hudVisible: false });
    expect(sanitizePreferences({ zoom: 99, hudVisible: 'yes' })).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences({ zoom: 2.5 }).zoom).toBe('auto');
  });

  it('reads the sound and accessibility choices leniently too: junk falls back, numbers are clamped', () => {
    const read = sanitizePreferences({ audio: { master: 2, sfx: -1, ambient: 'loud', muted: 'yes' }, textSize: 'huge', highContrast: 'yes', motion: 'sometimes' });
    expect(read.audio).toEqual({ ...DEFAULT_PREFERENCES.audio, master: 1, sfx: 0, muted: false });
    expect(read.textSize).toBe('normal');
    expect(read.highContrast).toBe(false);
    expect(read.motion).toBe('system');
    expect(sanitizePreferences({ textSize: 'large', highContrast: true, motion: 'reduced', audio: { muted: true } })).toMatchObject({ textSize: 'large', highContrast: true, motion: 'reduced', audio: { muted: true } });
    expect(sanitizePreferences({ motion: 'full' }).motion).toBe('full');
  });

  it('stores preferences and survives a corrupt file', async () => {
    const backend = new MemoryBackend();
    const store = new PreferencesStore(backend);
    store.update({ zoom: 5, hintsDismissed: true, audio: { ...DEFAULT_PREFERENCES.audio, master: 0.25, muted: true }, textSize: 'large' });
    await store.flush();
    const reloaded = new PreferencesStore(backend);
    expect(await reloaded.load()).toEqual({ ...DEFAULT_PREFERENCES, zoom: 5, hintsDismissed: true, audio: { ...DEFAULT_PREFERENCES.audio, master: 0.25, muted: true }, textSize: 'large' });
    await backend.write('preferences', '{not json');
    expect(await new PreferencesStore(backend).load()).toEqual(DEFAULT_PREFERENCES);
  });
});
