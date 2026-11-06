import { CONTENT } from '../data/content';
import { InputState } from './input/actions';
import { isChoosing } from './interaction';
import type { Direction } from './math/coords';
import { Game, type GameEvents } from './game';
import type { GameSaveState } from './persistence/saveFormat';
import type { ShopDef } from './economy/types';
import type { Content, MapDef } from './world/types';
import { World } from './world/world';

/** Test helpers: tiny worlds built from the real terrain and object definitions. */

/** Builds a map from ASCII terrain and props. Rows must all be the same length. */
export function makeMap(terrain: readonly string[], props: readonly string[] = [], overrides: Partial<MapDef> = {}): MapDef {
  const width = terrain[0]?.length ?? 0;
  const blank = '.'.repeat(width);
  return {
    id: 'test.map',
    regionId: 'test',
    name: 'Test Map',
    width,
    height: terrain.length,
    terrain,
    props: terrain.map((_, y) => props[y] ?? blank),
    propLegend: { T: 'oak', f: 'fence', W: 'well', H: 'farmhouse', '=': 'bridge', M: 'mailbox' },
    scatter: [],
    spawn: { x: 1, y: 1, facing: 'down' },
    ...overrides,
  };
}

/** A shop with nobody behind the counter, so it can stand on a map that has no villagers. */
function unstaffed(shop: ShopDef): ShopDef {
  const { keeper: _keeper, ...rest } = shop;
  return rest;
}

/**
 * The shipped items, crops, shops and animals around one test map. There are no villagers or quests: those belong
 * to the real maps (see `farmGameAt` for a game that has them), and every shop is unstaffed.
 */
export function makeContent(map: MapDef): Content {
  return {
    terrains: CONTENT.terrains,
    objects: CONTENT.objects,
    items: CONTENT.items,
    crops: CONTENT.crops,
    shops: CONTENT.shops.map(unstaffed),
    npcs: [],
    animals: CONTENT.animals,
    quests: [],
    nodes: CONTENT.nodes,
    fish: [],
    recipes: [],
    buildings: [],
    festivals: [],
    requests: { givers: [], offers: [] },
    creatures: [],
    regions: [{ id: 'test', name: 'Test Region', description: '', biome: 'meadow', unlock: { kind: 'always' }, startMap: map.id }],
    maps: [map],
    startMap: map.id,
    newGame: CONTENT.newGame,
  };
}

export const makeWorld = (map: MapDef): World => new World(makeContent(map));

/** A game on an open 20x20 meadow, the player in the middle. */
export function makeOpenGame(saved?: GameSaveState): Game {
  const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
  const map = makeMap(rows, [], { spawn: { x: 10, y: 10, facing: 'down' } });
  return new Game(makeWorld(map), new InputState(), saved);
}

/** Runs the game for `seconds` of real time at a given frame rate. */
export function run(game: Game, seconds: number, fps = 60): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i += 1) game.frame(1 / fps);
}

/** A game on the real Home Farm with the player standing in a given cell, facing a direction. `patch` edits the save first. */
export function farmGameAt(tile: { x: number; y: number }, facing: Direction, patch: Partial<GameSaveState> = {}): Game {
  const world = new World(CONTENT);
  const base = new Game(world, new InputState()).toSaveState();
  const saved: GameSaveState = { ...base, player: { x: tile.x * 16 + 8, y: tile.y * 16 + 14, facing }, ...patch };
  return new Game(world, new InputState(), saved);
}

/** Presses a key for a moment, and gives the game time to react. */
export function tap(game: Game, code: string, seconds = 0.05): void {
  game.input.press(code);
  run(game, seconds);
  game.input.release(code);
  run(game, 0.02);
}

/** Collects the events of one kind, for assertions. */
export function listen<K extends keyof GameEvents>(game: Game, event: K): GameEvents[K][] {
  const seen: GameEvents[K][] = [];
  game.events.on(event, (payload) => seen.push(payload));
  return seen;
}

/** Taps the interact key through a message until there is something to choose, or it closes. */
export function readThrough(game: Game): void {
  for (let i = 0; i < 10 && game.dialog !== undefined && !isChoosing(game.dialog); i += 1) tap(game, 'KeyE');
}

/** Picks the option of the open dialog whose id starts with `prefix`, the way a click would. */
export function pick(game: Game, prefix: string): void {
  const index = game.dialog?.options.findIndex((o) => o.id.startsWith(prefix)) ?? -1;
  if (index < 0) throw new Error(`No option "${prefix}" in ${JSON.stringify(game.dialog?.options.map((o) => o.id))}`);
  game.chooseOption(index);
}
