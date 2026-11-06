import { INVENTORY_SLOTS } from '../inventory/inventory';
import type { BuildingsSave } from '../buildings/types';
import type { BestiarySave } from '../creatures/types';
import type { FarmSave } from '../farming/types';
import type { MuseumSave } from '../museum/types';
import type { RanchSave } from '../ranch/types';
import type { QuestSave } from '../quests/types';
import type { NpcRecord } from '../social/friendship';
import { CAN_CAPACITY } from '../farming/tools';
import { isQuality, type ItemStack } from '../items/types';
import { isDirection, type Direction } from '../math/coords';
import { MINE_FLOORS } from '../mine/surface';
import { BEDTIME_MINUTE } from '../time/clock';
import { MIGRATIONS, migrateState, type Migrations } from './migrations';

/**
 * What a save contains. Every system adds its own section here, with a migration for older saves.
 * See "Save structure" in GAME_DESIGN.md.
 */
export interface GameSaveState {
  readonly mapId: string;
  readonly player: { readonly x: number; readonly y: number; readonly facing: Direction };
  /** Milliseconds actually spent playing (paused time does not count). */
  readonly playTimeMs: number;
  /** The calendar day (from 1) and the minutes since midnight. */
  readonly time: { readonly day: number; readonly minutes: number };
  readonly money: number;
  readonly inventory: {
    readonly slots: readonly (ItemStack | null)[];
    readonly selected: number;
    /** Water left in the watering can. */
    readonly canWater: number;
  };
  /** What is in the shipping bin, waiting to be paid for in the morning. */
  readonly bin: readonly ItemStack[];
  /** Worked soil and growing crops, by map id. */
  readonly farms: Readonly<Record<string, FarmSave>>;
  /** What each villager remembers: friendship, gifts, rewards given. */
  readonly npcs: Readonly<Record<string, NpcRecord>>;
  /** The coop's animals, trough and basket, by map id. */
  readonly ranches: Readonly<Record<string, RanchSave>>;
  readonly quests: readonly QuestSave[];
  /** Story flags: things that have happened ("visited:willowbrook.village_green"). */
  readonly flags: readonly string[];
  /** How many of each fish and mineral the player has caught or dug up (item id → count), for the collection page. */
  readonly collection: Readonly<Record<string, number>>;
  /** The old mine: the deepest floor reached. */
  readonly mine: { readonly deepest: number };
  /** Furniture the player has put down, by map id (the farmhouse). */
  readonly placed: Readonly<Record<string, readonly PlacedSave[]>>;
  /** What the carpenter has finished and what he is working on. */
  readonly buildings: BuildingsSave;
  /** What is on display in the museum, and which of its rewards have been handed over. */
  readonly museum: MuseumSave;
  /** What has been used up today, so closing the game cannot bring it back: rocks broken and dig spots dug (cells as `y * 1000 + x`), and fish caught per water. */
  readonly spent: { readonly day: number; readonly cells: Readonly<Record<string, readonly number[]>>; readonly fished: Readonly<Record<string, number>> };
  /** Today's festival, if it is one: how the player is doing (valid for that day only). */
  readonly festival: FestivalSave;
  /** The notice board: the requests handed in today. */
  readonly board: { readonly day: number; readonly done: readonly string[] };
  /** The rare creatures the player has seen, and the ones that have become friends. */
  readonly bestiary: BestiarySave;
}

/** How the player is doing at today's festival. */
export interface FestivalSave {
  readonly day: number;
  /** Eggs found, fish caught, the fair entry's score, villagers spoken to, by kind of festival. */
  readonly score: number;
  /** For the hunt: the cells (as `y * 1000 + x`) already found. */
  readonly found: readonly number[];
  /** For the fair: has the entry been given? For the lantern night: who has been spoken to. */
  readonly entered: boolean;
  readonly talked: readonly string[];
  /** Has the prize been handed over? */
  readonly claimed: boolean;
}

/** A piece of furniture on a map: which object, and its anchor cell. */
export interface PlacedSave {
  readonly def: string;
  readonly x: number;
  readonly y: number;
}

export const SAVE_FORMAT = 'developer-farm-save';
/** Bump when `GameSaveState` changes shape, and add a migration from the previous version. */
export const SAVE_VERSION = 7;

/** The file on disk: the game state wrapped with what is needed to read it back safely. */
export interface SaveEnvelope {
  readonly format: typeof SAVE_FORMAT;
  readonly version: number;
  /** ISO timestamp, for the player's information only. */
  readonly savedAt: string;
  /** Hash of the serialised `state`, to notice a file that was cut short or edited by accident. */
  readonly checksum: string;
  readonly state: unknown;
}

/** FNV-1a, 32 bit. Not security: it only has to catch accidents. */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function encodeSave(state: GameSaveState, savedAt: Date): string {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: savedAt.toISOString(),
    checksum: checksum(JSON.stringify(state)),
    state,
  };
  return JSON.stringify(envelope);
}

export type DecodeFailure =
  | 'not-json'
  | 'wrong-format'
  | 'newer-version'
  | 'checksum-mismatch'
  | 'invalid-state'
  | 'migration-failed';

export type DecodeResult =
  | { readonly ok: true; readonly state: GameSaveState; readonly version: number; readonly migrated: boolean; readonly savedAt: string }
  | { readonly ok: false; readonly reason: DecodeFailure; readonly detail?: string; readonly version?: number };

/** Reads a save back. Never throws: a file that cannot be used says why. */
export function decodeSave(text: string, migrations: Migrations = MIGRATIONS, currentVersion = SAVE_VERSION): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isRecord(raw) || raw['format'] !== SAVE_FORMAT || typeof raw['version'] !== 'number' || !Number.isInteger(raw['version'])) {
    return { ok: false, reason: 'wrong-format' };
  }
  const version = raw['version'];
  if (version > currentVersion) return { ok: false, reason: 'newer-version', version };
  if (version < 1) return { ok: false, reason: 'wrong-format' };
  if (typeof raw['checksum'] !== 'string' || raw['checksum'] !== checksum(JSON.stringify(raw['state']))) {
    return { ok: false, reason: 'checksum-mismatch' };
  }

  let state: unknown = raw['state'];
  if (version < currentVersion) {
    try {
      state = migrateState(state, version, currentVersion, migrations);
    } catch (error) {
      return { ok: false, reason: 'migration-failed', detail: (error as Error).message, version };
    }
  }
  const valid = sanitizeGameState(state);
  if (valid === undefined) return { ok: false, reason: 'invalid-state', version };
  return {
    ok: true,
    state: valid,
    version,
    migrated: version < currentVersion,
    savedAt: typeof raw['savedAt'] === 'string' ? raw['savedAt'] : '',
  };
}

/** Hard limits, so a hand-edited or corrupt file cannot ask for absurd amounts of memory. */
const MAX_SOIL = 100_000;
const MAX_CROPS = 100_000;
const MAX_BIN_STACKS = 512;
const MAX_FARMS = 64;
const MAX_COORDINATE = 8192;
const MAX_NPCS = 256;
const MAX_QUESTS = 256;
const MAX_FLAGS = 1024;
const MAX_ANIMALS = 64;
const MAX_COLLECTION = 512;
const MAX_PLACED = 256;

/** Accepts only a well-formed state. Anything else is rejected rather than half-loaded. */
export function sanitizeGameState(value: unknown): GameSaveState | undefined {
  if (!isRecord(value)) return undefined;
  const { mapId, player, playTimeMs, time, money, inventory, bin, farms, npcs, ranches, quests, flags, collection, mine, placed, buildings, museum, spent, festival, board, bestiary } = value;
  if (typeof mapId !== 'string' || mapId.length === 0 || mapId.length > 100) return undefined;
  if (!isRecord(player)) return undefined;
  const { x, y, facing } = player;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isDirection(facing)) return undefined;
  if (!isFiniteNumber(playTimeMs) || playTimeMs < 0) return undefined;

  if (!isRecord(time) || !isWholeNumber(time['day']) || time['day'] < 1 || time['day'] > 1_000_000) return undefined;
  if (!isFiniteNumber(time['minutes']) || time['minutes'] < 0 || time['minutes'] > BEDTIME_MINUTE) return undefined;
  if (!isWholeNumber(money) || money < 0 || money > 1_000_000_000) return undefined;

  if (!isRecord(inventory) || !Array.isArray(inventory['slots']) || inventory['slots'].length > 64) return undefined;
  const slots: (ItemStack | null)[] = [];
  for (const slot of inventory['slots'] as unknown[]) {
    if (slot === null) {
      slots.push(null);
      continue;
    }
    const stack = sanitizeStack(slot);
    if (stack === undefined) return undefined;
    slots.push(stack);
  }
  while (slots.length < INVENTORY_SLOTS) slots.push(null);
  const selected = inventory['selected'];
  const canWater = inventory['canWater'];
  if (!isWholeNumber(selected) || selected < 0 || selected >= Math.max(slots.length, INVENTORY_SLOTS)) return undefined;
  if (!isWholeNumber(canWater) || canWater < 0) return undefined;

  if (!Array.isArray(bin) || bin.length > MAX_BIN_STACKS) return undefined;
  const binStacks: ItemStack[] = [];
  for (const entry of bin as unknown[]) {
    const stack = sanitizeStack(entry);
    if (stack === undefined) return undefined;
    binStacks.push(stack);
  }

  if (!isRecord(farms) || Object.keys(farms).length > MAX_FARMS) return undefined;
  const farmSaves: Record<string, FarmSave> = {};
  for (const [id, farm] of Object.entries(farms)) {
    const clean = sanitizeFarm(farm);
    if (clean === undefined) return undefined;
    farmSaves[id] = clean;
  }

  if (!isRecord(npcs) || Object.keys(npcs).length > MAX_NPCS) return undefined;
  const npcSaves: Record<string, NpcRecord> = {};
  for (const [id, record] of Object.entries(npcs)) {
    const clean = sanitizeNpcRecord(record);
    if (clean === undefined) return undefined;
    npcSaves[id] = clean;
  }

  if (!isRecord(ranches) || Object.keys(ranches).length > MAX_FARMS) return undefined;
  const ranchSaves: Record<string, RanchSave> = {};
  for (const [id, ranch] of Object.entries(ranches)) {
    const clean = sanitizeRanch(ranch);
    if (clean === undefined) return undefined;
    ranchSaves[id] = clean;
  }

  if (!Array.isArray(quests) || quests.length > MAX_QUESTS) return undefined;
  const questSaves: QuestSave[] = [];
  for (const quest of quests as unknown[]) {
    const clean = sanitizeQuest(quest);
    if (clean === undefined) return undefined;
    questSaves.push(clean);
  }

  if (!Array.isArray(flags) || flags.length > MAX_FLAGS || !flags.every((f) => typeof f === 'string' && f.length > 0 && f.length <= 80)) return undefined;

  if (!isRecord(collection) || Object.keys(collection).length > MAX_COLLECTION) return undefined;
  const collected: Record<string, number> = {};
  for (const [id, count] of Object.entries(collection)) {
    if (id.length === 0 || id.length > 64 || !isWholeNumber(count) || count < 1 || count > 1_000_000) return undefined;
    collected[id] = count;
  }
  if (!isRecord(mine) || !isWholeNumber(mine['deepest']) || mine['deepest'] < 0 || mine['deepest'] > MINE_FLOORS) return undefined;

  const placedSaves: Record<string, PlacedSave[]> = {};
  if (!isRecord(placed) || Object.keys(placed).length > MAX_FARMS) return undefined;
  for (const [id, list] of Object.entries(placed)) {
    if (!Array.isArray(list) || list.length > MAX_PLACED) return undefined;
    const clean: PlacedSave[] = [];
    for (const entry of list as unknown[]) {
      if (!isRecord(entry) || typeof entry['def'] !== 'string' || entry['def'].length === 0 || entry['def'].length > 64) return undefined;
      if (!isCoordinate(entry['x']) || !isCoordinate(entry['y'])) return undefined;
      clean.push({ def: entry['def'], x: entry['x'], y: entry['y'] });
    }
    placedSaves[id] = clean;
  }

  if (!isRecord(buildings) || !Array.isArray(buildings['built']) || !Array.isArray(buildings['pending'])) return undefined;
  if (buildings['built'].length > 64 || buildings['pending'].length > 64) return undefined;
  if (!buildings['built'].every((b) => typeof b === 'string' && b.length > 0 && b.length <= 64)) return undefined;
  const pending: BuildingsSave['pending'][number][] = [];
  for (const entry of buildings['pending'] as unknown[]) {
    if (!isRecord(entry) || typeof entry['site'] !== 'string' || entry['site'].length === 0 || entry['site'].length > 64) return undefined;
    if (!isWholeNumber(entry['readyDay']) || entry['readyDay'] < 1 || entry['readyDay'] > 1_000_000) return undefined;
    pending.push({ site: entry['site'], readyDay: entry['readyDay'] });
  }

  if (!isRecord(museum) || !Array.isArray(museum['donated']) || !Array.isArray(museum['claimed'])) return undefined;
  if (museum['donated'].length > 256 || museum['claimed'].length > 64) return undefined;
  if (!museum['donated'].every((d) => typeof d === 'string' && d.length > 0 && d.length <= 64)) return undefined;
  if (!museum['claimed'].every((c) => isWholeNumber(c) && c >= 1 && c < 1000)) return undefined; // the count of things on display that earned the reward

  if (!isRecord(spent) || !isWholeNumber(spent['day']) || spent['day'] < 0 || !isRecord(spent['cells']) || !isRecord(spent['fished'])) return undefined;
  if (Object.keys(spent['cells']).length > MAX_FARMS || Object.keys(spent['fished']).length > MAX_FARMS) return undefined;
  const spentCells: Record<string, number[]> = {};
  for (const [id, list] of Object.entries(spent['cells'])) {
    if (!Array.isArray(list) || list.length > 1024 || !list.every((c) => isWholeNumber(c) && c >= 0 && c < 1_000_000)) return undefined;
    spentCells[id] = list as number[];
  }
  const fishedToday: Record<string, number> = {};
  for (const [id, count] of Object.entries(spent['fished'])) {
    if (!isWholeNumber(count) || count < 0 || count > 1000) return undefined;
    fishedToday[id] = count;
  }

  if (!isRecord(festival) || !isWholeNumber(festival['day']) || festival['day'] < 0 || !isWholeNumber(festival['score']) || festival['score'] < 0 || festival['score'] > 100_000) return undefined;
  if (!Array.isArray(festival['found']) || festival['found'].length > 64 || !festival['found'].every((c) => isWholeNumber(c) && c >= 0 && c < 1_000_000)) return undefined;
  if (typeof festival['entered'] !== 'boolean' || typeof festival['claimed'] !== 'boolean') return undefined;
  if (!Array.isArray(festival['talked']) || festival['talked'].length > 32 || !festival['talked'].every((t) => typeof t === 'string' && t.length > 0 && t.length <= 64)) return undefined;
  if (!isRecord(board) || !isWholeNumber(board['day']) || board['day'] < 0 || !Array.isArray(board['done']) || board['done'].length > 16 || !board['done'].every((d) => typeof d === 'string' && d.length > 0 && d.length <= 64)) return undefined;

  if (!isRecord(bestiary) || !Array.isArray(bestiary['seen']) || !Array.isArray(bestiary['friends'])) return undefined;
  const names = (list: unknown[]): boolean => list.length <= 64 && list.every((n) => typeof n === 'string' && n.length > 0 && n.length <= 64);
  if (!names(bestiary['seen']) || !names(bestiary['friends'])) return undefined;

  return {
    mapId,
    player: { x, y, facing },
    playTimeMs,
    time: { day: time['day'], minutes: time['minutes'] },
    money,
    inventory: { slots, selected, canWater: Math.min(canWater, CAN_CAPACITY) },
    bin: binStacks,
    farms: farmSaves,
    npcs: npcSaves,
    ranches: ranchSaves,
    quests: questSaves,
    flags: flags as string[],
    collection: collected,
    mine: { deepest: mine['deepest'] },
    placed: placedSaves,
    buildings: { built: buildings['built'] as string[], pending },
    museum: { donated: museum['donated'] as string[], claimed: museum['claimed'] as number[] },
    spent: { day: spent['day'], cells: spentCells, fished: fishedToday },
    festival: { day: festival['day'], score: festival['score'], found: festival['found'] as number[], entered: festival['entered'], talked: festival['talked'] as string[], claimed: festival['claimed'] },
    board: { day: board['day'], done: board['done'] as string[] },
    bestiary: { seen: bestiary['seen'] as string[], friends: bestiary['friends'] as string[] },
  };
}

function sanitizeNpcRecord(value: unknown): NpcRecord | undefined {
  if (!isRecord(value)) return undefined;
  const { friendship, met, talkedDay, giftedDay, giftWeek, giftsThisWeek, rewards, seen } = value;
  if (!isWholeNumber(friendship) || friendship < 0 || friendship > 1000 || typeof met !== 'boolean') return undefined;
  if (!isWholeNumber(talkedDay) || talkedDay < 0 || !isWholeNumber(giftedDay) || giftedDay < 0) return undefined;
  if (!isWholeNumber(giftWeek) || giftWeek < -1 || !isWholeNumber(giftsThisWeek) || giftsThisWeek < 0 || giftsThisWeek > 99) return undefined;
  if (!Array.isArray(rewards) || rewards.length > 64 || !rewards.every((r) => isWholeNumber(r) && r >= 0 && r < 64)) return undefined;
  if (!Array.isArray(seen) || seen.length > 512 || !seen.every((r) => typeof r === 'string' && r.length > 0 && r.length <= 80)) return undefined;
  return { friendship, met, talkedDay, giftedDay, giftWeek, giftsThisWeek, rewards: rewards as number[], seen: seen as string[] };
}

function sanitizeRanch(value: unknown): RanchSave | undefined {
  if (!isRecord(value) || !Array.isArray(value['animals']) || !Array.isArray(value['basket'])) return undefined;
  if (value['animals'].length > MAX_ANIMALS || value['basket'].length > 64) return undefined;
  const feed = value['feed'];
  if (!isWholeNumber(feed) || feed < 0 || feed > 9999) return undefined;
  const animals: RanchSave['animals'][number][] = [];
  for (const animal of value['animals'] as unknown[]) {
    if (!isRecord(animal)) return undefined;
    const { id, kind, name, friendship, pettedDay, fedDay } = animal;
    if (typeof id !== 'string' || id.length === 0 || id.length > 64 || typeof kind !== 'string' || kind.length === 0 || kind.length > 64) return undefined;
    if (typeof name !== 'string' || name.length === 0 || name.length > 40) return undefined;
    if (!isWholeNumber(friendship) || friendship < 0 || friendship > 1000 || !isWholeNumber(pettedDay) || pettedDay < 0 || !isWholeNumber(fedDay) || fedDay < 0) return undefined;
    animals.push({ id, kind, name, friendship, pettedDay, fedDay });
  }
  const basket: ItemStack[] = [];
  for (const entry of value['basket'] as unknown[]) {
    const stack = sanitizeStack(entry);
    if (stack === undefined) return undefined;
    basket.push(stack);
  }
  return { animals, feed, basket };
}

function sanitizeQuest(value: unknown): QuestSave | undefined {
  if (!isRecord(value)) return undefined;
  const { id, status, progress } = value;
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return undefined;
  if (status !== 'active' && status !== 'ready' && status !== 'done') return undefined;
  if (!Array.isArray(progress) || progress.length > 16 || !progress.every((p) => isWholeNumber(p) && p >= 0 && p <= 100_000)) return undefined;
  return { id, status, progress: progress as number[] };
}

function sanitizeStack(value: unknown): ItemStack | undefined {
  if (!isRecord(value)) return undefined;
  const { id, count, quality } = value;
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return undefined;
  if (!isWholeNumber(count) || count < 1 || count > 100_000) return undefined;
  if (!isQuality(quality)) return undefined;
  return { id, count, quality };
}

function sanitizeFarm(value: unknown): FarmSave | undefined {
  if (!isRecord(value) || !Array.isArray(value['soil']) || !Array.isArray(value['crops'])) return undefined;
  if (value['soil'].length > MAX_SOIL || value['crops'].length > MAX_CROPS) return undefined;
  const soil: FarmSave['soil'][number][] = [];
  for (const cell of value['soil'] as unknown[]) {
    if (!isRecord(cell) || !isCoordinate(cell['x']) || !isCoordinate(cell['y']) || typeof cell['watered'] !== 'boolean') return undefined;
    if (cell['fertilized'] !== undefined && typeof cell['fertilized'] !== 'boolean') return undefined;
    soil.push({ x: cell['x'], y: cell['y'], watered: cell['watered'], ...(cell['fertilized'] === true ? { fertilized: true } : {}) });
  }
  const crops: FarmSave['crops'][number][] = [];
  for (const crop of value['crops'] as unknown[]) {
    if (!isRecord(crop) || !isCoordinate(crop['x']) || !isCoordinate(crop['y'])) return undefined;
    if (typeof crop['crop'] !== 'string' || crop['crop'].length === 0 || crop['crop'].length > 64) return undefined;
    if (!isWholeNumber(crop['stage']) || crop['stage'] < 0 || crop['stage'] > 64) return undefined;
    if (!isWholeNumber(crop['daysInStage']) || crop['daysInStage'] < 0 || crop['daysInStage'] > 10_000) return undefined;
    if (!isWholeNumber(crop['planted']) || crop['planted'] < 0) return undefined;
    crops.push({ x: crop['x'], y: crop['y'], crop: crop['crop'], stage: crop['stage'], daysInStage: crop['daysInStage'], planted: crop['planted'] });
  }
  return { soil, crops };
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isWholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isCoordinate = (value: unknown): value is number => isWholeNumber(value) && value >= 0 && value < MAX_COORDINATE;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
