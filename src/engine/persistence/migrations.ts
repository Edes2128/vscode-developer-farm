/**
 * Save migrations. `MIGRATIONS[n]` upgrades the state of a version-`n` save to version `n + 1`.
 *
 * To change the save format: bump SAVE_VERSION in saveFormat.ts, add the migration for the old version
 * here, and extend the tests. Old saves are never edited in place: they are read, migrated in memory,
 * and written back in the new version (the previous good file is kept as the backup).
 *
 * A migration must not read the live game content: it describes what a save of that version looked like
 * and what a player of that version would have had, written out literally, so it stays correct forever.
 */
export type Migration = (state: unknown) => unknown;
export type Migrations = Readonly<Record<number, Migration>>;

/** Version 1 saved only where the player was. Version 2 adds the clock, pockets, money, bin and farms. */
const v1ToV2: Migration = (state) => ({
  ...(state as object),
  time: { day: 1, minutes: 360 },
  money: 150,
  inventory: {
    slots: [
      { id: 'hoe', count: 1, quality: 0 },
      { id: 'watering_can', count: 1, quality: 0 },
      { id: 'radish_seeds', count: 5, quality: 0 },
      { id: 'strawberry_seeds', count: 3, quality: 0 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    selected: 0,
    canWater: 24,
  },
  bin: [],
  farms: {},
});

/** Version 3 adds villagers' memories, the coop, quests and story flags. A v2 farm has met no one and taken no quests. */
const v2ToV3: Migration = (state) => ({
  ...(state as object),
  npcs: {},
  ranches: {},
  quests: [],
  flags: [],
});

/** Version 4 adds the collection (fish and minerals found) and how deep the mine has been explored. A v3 farm has found nothing. */
const v3ToV4: Migration = (state) => ({
  ...(state as object),
  collection: {},
  mine: { deepest: 0 },
});

/** Version 5 adds furniture, the carpenter's work and the museum. A v4 farm has put nothing down, built nothing and given the museum nothing. */
const v4ToV5: Migration = (state) => ({
  ...(state as object),
  placed: {},
  buildings: { built: [], pending: [] },
  museum: { donated: [], claimed: [] },
  spent: { day: 0, cells: {}, fished: {} },
});

/** What the museum's six rewards asked for when version 5 was written, in order: a v5 save names a reward by its position. */
const V5_MUSEUM_MILESTONES = [3, 6, 9, 12, 15, 18];

/**
 * Version 6 adds the festival the player is taking part in and the notice board's day (a v5 farm is in no festival and has handed in
 * nothing), and names the museum's paid rewards by the number of displays that earned them instead of by position, so a later
 * change to the list of rewards cannot hand one out twice.
 */
const v5ToV6: Migration = (state) => {
  const old = state as { museum?: { donated?: unknown; claimed?: unknown } };
  const claimed = old.museum?.claimed;
  const museum =
    old.museum !== undefined && typeof old.museum === 'object' && old.museum !== null && Array.isArray(claimed)
      ? { ...old.museum, claimed: claimed.flatMap((index) => (typeof index === 'number' ? (V5_MUSEUM_MILESTONES[index] ?? []) : [])) }
      : old.museum;
  return {
    ...(state as object),
    ...(museum === undefined ? {} : { museum }),
    festival: { day: 0, score: 0, found: [], entered: false, talked: [], claimed: false },
    board: { day: 0, done: [] },
  };
};

/** Version 7 adds the bestiary (rare creatures seen and befriended; soil may also be fertilized, which is simply absent in an old save). A v6 farm has met no creatures. */
const v6ToV7: Migration = (state) => ({
  ...(state as object),
  bestiary: { seen: [], friends: [] },
});

export const MIGRATIONS: Migrations = { 1: v1ToV2, 2: v2ToV3, 3: v3ToV4, 4: v4ToV5, 5: v5ToV6, 6: v6ToV7 };

/** Runs every migration from `from` up to `to`. Throws if one is missing or fails. */
export function migrateState(state: unknown, from: number, to: number, migrations: Migrations): unknown {
  let current = state;
  for (let version = from; version < to; version += 1) {
    const step = migrations[version];
    if (step === undefined) throw new Error(`No migration from save version ${version} to ${version + 1}`);
    current = step(current);
  }
  return current;
}
