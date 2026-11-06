import { TILE_SIZE, worldToTile, type Direction } from '../math/coords';
import { findPath, type Cell, type PathGrid } from '../path/astar';
import { newRecord, type NpcRecord } from './friendship';
import type { NpcDef, ScheduleEntry } from './types';

/**
 * What kind of day it is, for the schedules: rain keeps some people in, the weekday decides who is in the valley, and a festival
 * calls everyone it names to its map while it is open.
 */
export interface DayContext {
  readonly rainy: boolean;
  /** 0 is Monday, 6 is Sunday. */
  readonly weekday: number;
  readonly festival?: {
    readonly map: string;
    readonly from: number;
    readonly to: number;
    readonly places: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly facing?: Direction }>;
  };
}

const PLAIN_DAY: DayContext = { rainy: false, weekday: 0 };

const applies = (entry: ScheduleEntry, day: DayContext): boolean =>
  (entry.when === undefined || (entry.when === 'rain') === day.rainy) && (entry.days === undefined || entry.days.includes(day.weekday));

/** How fast villagers walk, in pixels per second. Slower than the farmer: they are in no hurry. */
export const NPC_SPEED = 36;

/** A way off a map: stepping on it takes you to another. The world's `ExitDef` fits this. */
export interface ExitLike {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly to: { readonly map: string; readonly x: number; readonly y: number; readonly facing: Direction };
}

/** What the villagers need to know about the maps. */
export interface MapAccess {
  grid(mapId: string): PathGrid;
  exits(mapId: string): readonly ExitLike[];
}

/** Where a villager is right now. Not saved: it is worked out from the schedule and the time. */
export interface NpcState {
  readonly id: string;
  map: string;
  /** Feet position, world pixels. */
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  /** Distance walked, for the walk animation. */
  stride: number;
  path: Cell[];
  goal: Cell | undefined;
}

/**
 * The entry of a schedule in force at a time: the latest one that has started and that applies today (the first, before any has).
 * A festival that is open and names the villager overrides the schedule (`index` is -1 then).
 */
export function activeEntry(def: NpcDef, minutes: number, day: DayContext = PLAIN_DAY): { entry: ScheduleEntry; index: number } {
  const festival = day.festival;
  const place = festival?.places.get(def.id);
  if (festival !== undefined && place !== undefined && minutes >= festival.from && minutes < festival.to) {
    return { entry: { from: festival.from, map: festival.map, x: place.x, y: place.y, ...(place.facing === undefined ? {} : { facing: place.facing }) }, index: -1 };
  }
  let index = 0;
  def.schedule.forEach((entry, i) => {
    if (entry.from <= minutes && applies(entry, day)) index = i;
  });
  return { entry: def.schedule[index] as ScheduleEntry, index };
}

const centreX = (cell: number): number => cell * TILE_SIZE + TILE_SIZE / 2;
const feetY = (cell: number): number => cell * TILE_SIZE + TILE_SIZE - 2;

export const cellOf = (state: Pick<NpcState, 'x' | 'y'>): Cell => ({ x: worldToTile(state.x), y: worldToTile(state.y - 3) });

const inside = (exit: ExitLike, cell: Cell): boolean => cell.x >= exit.x && cell.x < exit.x + exit.w && cell.y >= exit.y && cell.y < exit.y + exit.h;

/**
 * The villagers: where each one is, what they remember about the player, and how they move through their day.
 *
 * Villagers are only really simulated on the map the player is on. On any other map they are simply placed where
 * their schedule says they are, which costs nothing and can never go wrong. When the player arrives, or a night
 * passes, they are placed again.
 */
export class Villagers {
  readonly states = new Map<string, NpcState>();
  readonly records = new Map<string, NpcRecord>();
  private readonly defs = new Map<string, NpcDef>();
  private day: DayContext = PLAIN_DAY;

  constructor(
    defs: readonly NpcDef[],
    private readonly maps: MapAccess,
    saved: Readonly<Record<string, NpcRecord>> = {},
    minutes = 360,
    day: DayContext = PLAIN_DAY,
  ) {
    this.day = day;
    for (const def of defs) {
      this.defs.set(def.id, def);
      const record = newRecord();
      const old = saved[def.id];
      if (old !== undefined) Object.assign(record, { ...old, rewards: [...old.rewards], seen: [...old.seen] });
      this.records.set(def.id, record);
      const { entry } = activeEntry(def, minutes, this.day);
      this.states.set(def.id, { id: def.id, map: entry.map, x: centreX(entry.x), y: feetY(entry.y), facing: entry.facing ?? 'down', moving: false, stride: 0, path: [], goal: undefined });
    }
  }

  /** Tells the villagers what kind of day it is (the weather, the weekday, a festival). Takes effect at the next `update` or `placeAll`. */
  setDay(day: DayContext): void {
    this.day = day;
  }

  def(id: string): NpcDef | undefined {
    return this.defs.get(id);
  }

  all(): IterableIterator<NpcDef> {
    return this.defs.values();
  }

  record(id: string): NpcRecord {
    let record = this.records.get(id);
    if (record === undefined) {
      record = newRecord();
      this.records.set(id, record);
    }
    return record;
  }

  /** The villagers on a map right now. */
  onMap(mapId: string): NpcState[] {
    return [...this.states.values()].filter((s) => s.map === mapId);
  }

  /** Puts everyone where their schedule says they are at `minutes`. Used at the start of a day and on loading. */
  placeAll(minutes: number): void {
    for (const def of this.defs.values()) {
      const state = this.states.get(def.id) as NpcState;
      const { entry } = activeEntry(def, minutes, this.day);
      this.teleport(state, entry);
    }
  }

  /** Moves everyone on with the clock. Only villagers on the player's map are walked; the rest are placed. */
  update(dt: number, minutes: number, playerMap: string): void {
    for (const def of this.defs.values()) {
      const state = this.states.get(def.id) as NpcState;
      const { entry } = activeEntry(def, minutes, this.day);
      this.advance(state, entry, dt, playerMap);
    }
  }

  /** The villager minding a shop right now, if one is standing at their post on that map. */
  servingShop(shopId: string, mapId: string, minutes: number): NpcState | undefined {
    for (const def of this.defs.values()) {
      const state = this.states.get(def.id) as NpcState;
      const { entry } = activeEntry(def, minutes, this.day);
      if (entry.serves !== shopId || state.map !== mapId || state.moving) continue;
      const cell = cellOf(state);
      if (cell.x === entry.x && cell.y === entry.y) return state;
    }
    return undefined;
  }

  /**
   * When a shop next opens: later today, or on the next day within a week that someone is due to mind it (`inDays` 0 is later today,
   * 1 tomorrow, and `weekday` is that day's, 0 for Monday). Today the weather is known; for a later day only the weekday is, so
   * an opening that depends on the weather is `certain: false`. Undefined if nobody minds it in the week ahead.
   */
  nextOpening(shopId: string, minutes: number): { at: number; inDays: number; weekday: number; certain: boolean } | undefined {
    const serving = [...this.defs.values()].flatMap((def) => def.schedule.filter((entry) => entry.serves === shopId));
    for (let inDays = 0; inDays <= 7; inDays += 1) {
      const weekday = (this.day.weekday + inDays) % 7;
      const due = serving
        .filter((entry) => (inDays === 0 ? applies(entry, this.day) && entry.from > minutes : entry.days === undefined || entry.days.includes(weekday)))
        .sort((a, b) => a.from - b.from);
      const first = due[0];
      if (first !== undefined) return { at: first.from, inDays, weekday, certain: inDays === 0 || first.when === undefined };
    }
    return undefined;
  }

  toSave(): Record<string, NpcRecord> {
    const out: Record<string, NpcRecord> = {};
    for (const [id, record] of this.records) out[id] = { ...record, rewards: [...record.rewards], seen: [...record.seen] };
    return out;
  }

  // ------------------------------------------------------------------------------------------ movement

  private advance(state: NpcState, entry: ScheduleEntry, dt: number, playerMap: string): void {
    if (state.map !== entry.map) {
      const exit = this.nextExit(state.map, entry.map);
      if (exit === undefined) {
        this.teleport(state, entry); // a gap in the data must never strand someone
        return;
      }
      if (state.map !== playerMap) {
        this.transfer(state, exit); // nobody is watching: they simply arrive
        return;
      }
      const door = this.exitCell(state.map, exit);
      if (door === undefined || this.walkTo(state, door, dt)) this.transfer(state, exit);
      return;
    }

    if (state.map !== playerMap) {
      this.teleport(state, entry);
      return;
    }
    if (this.walkTo(state, { x: entry.x, y: entry.y }, dt) && entry.facing !== undefined) state.facing = entry.facing;
  }

  /** Walks towards a cell. Returns true once there. */
  private walkTo(state: NpcState, goal: Cell, dt: number): boolean {
    const here = cellOf(state);
    if (state.path.length === 0 && here.x === goal.x && here.y === goal.y) {
      state.moving = false;
      state.goal = undefined;
      return true;
    }
    if (state.goal?.x !== goal.x || state.goal?.y !== goal.y) {
      const path = findPath(this.maps.grid(state.map), here, goal);
      if (path === undefined) {
        state.x = centreX(goal.x);
        state.y = feetY(goal.y);
        state.path = [];
        state.goal = undefined;
        state.moving = false;
        return true; // no way there: put them there rather than leave them stuck
      }
      state.goal = goal;
      state.path = path;
    }

    let budget = NPC_SPEED * dt;
    while (budget > 0 && state.path.length > 0) {
      const next = state.path[0] as Cell;
      const tx = centreX(next.x);
      const ty = feetY(next.y);
      const dx = tx - state.x;
      const dy = ty - state.y;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(dx) > Math.abs(dy)) state.facing = dx > 0 ? 'right' : 'left';
      else if (distance > 0) state.facing = dy > 0 ? 'down' : 'up';
      if (distance <= budget) {
        state.x = tx;
        state.y = ty;
        state.stride += distance;
        budget -= distance;
        state.path.shift();
      } else {
        state.x += (dx / distance) * budget;
        state.y += (dy / distance) * budget;
        state.stride += budget;
        budget = 0;
      }
    }
    state.moving = state.path.length > 0;
    if (!state.moving) state.goal = undefined;
    return !state.moving;
  }

  private teleport(state: NpcState, entry: ScheduleEntry): void {
    state.map = entry.map;
    state.x = centreX(entry.x);
    state.y = feetY(entry.y);
    state.facing = entry.facing ?? state.facing;
    state.path = [];
    state.goal = undefined;
    state.moving = false;
  }

  private transfer(state: NpcState, exit: ExitLike): void {
    state.map = exit.to.map;
    state.x = centreX(exit.to.x);
    state.y = feetY(exit.to.y);
    state.facing = exit.to.facing;
    state.path = [];
    state.goal = undefined;
    state.moving = false;
  }

  /** The first exit to take from one map on the shortest way to another. */
  private nextExit(from: string, to: string): ExitLike | undefined {
    const first = new Map<string, ExitLike>();
    const seen = new Set<string>([from]);
    let frontier = [from];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const map of frontier) {
        for (const exit of this.maps.exits(map)) {
          if (seen.has(exit.to.map)) continue;
          seen.add(exit.to.map);
          first.set(exit.to.map, map === from ? exit : (first.get(map) as ExitLike));
          if (exit.to.map === to) return first.get(to);
          next.push(exit.to.map);
        }
      }
      frontier = next;
    }
    return undefined;
  }

  private exitCell(mapId: string, exit: ExitLike): Cell | undefined {
    const grid = this.maps.grid(mapId);
    for (let y = exit.y; y < exit.y + exit.h; y += 1) for (let x = exit.x; x < exit.x + exit.w; x += 1) if (grid.walkable(x, y)) return { x, y };
    return undefined;
  }

  /** Whether a cell is inside any exit of a map (for the game to detect the player leaving). */
  static exitAt(exits: readonly ExitLike[], cell: Cell): ExitLike | undefined {
    return exits.find((exit) => inside(exit, cell));
  }
}
