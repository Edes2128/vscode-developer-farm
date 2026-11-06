/**
 * The old mine's generated floors.
 *
 * Every floor is a pure function of its number: the same floor always comes out the same, on every machine and every
 * run. A floor is built in two stages.
 *
 *   1. The **layout** (`layoutOf`): the cave itself and the two ladders. It is memoised and needs nothing from any other
 *      floor, so a floor can ask its neighbours where their ladders are (to know where an exit arrives) without
 *      generating their rocks.
 *   2. The **nodes** (`placeNodes`): rocks and ore, placed greedily on top of the layout. Nodes are solid while they stand,
 *      so a node is only accepted if the cave stays whole around it.
 *
 * Rules the rest of the game relies on:
 *   - a ladder is a walkable 1x1 exit, so nobody can pass *through* one: the cave stays connected with both ladder cells
 *     treated as walls;
 *   - an arrival cell is next to its ladder, walkable and outside every exit (the exits are the ladder cells), so a
 *     player who arrives is not carried straight back;
 *   - with every node in place, every floor cell that is not a node or a ladder can still be reached from the up
 *     ladder's arrival cell, and every node has a free orthogonal neighbour to swing from.
 */
import { createRng, hash2 } from '../core/random';
import type { Direction } from '../math/coords';
import { DIRECTION_VECTORS, DIRECTIONS } from '../math/coords';
import type { NodeSpawn } from '../nodes/types';
import type { ExitDef, MapDef, MapObjectPlacement } from '../world/types';
import { MINE_FLOORS, MINE_REGION, MINE_SURFACE, mineFloorId } from './surface';

export const MINE_WIDTH = 40;
export const MINE_HEIGHT = 30;

/** All node ids the generator may place (NodeDef ids defined in src/data/nodes.ts). */
export const MINE_NODE_IDS = ['stone', 'copper', 'iron', 'coal', 'quartz', 'amethyst'] as const;
export type MineNodeId = (typeof MINE_NODE_IDS)[number];

const FLOOR_GLYPH = ',';
const WALL_GLYPH = '%';

// ------------------------------------------------------------------------------------------ tuning

/** Walls to start with, as a share of the interior. Deeper floors start with more, which leaves narrower, twistier passages. */
const wallChance = (floor: number): number => 0.43 + 0.006 * (floor - 1);
/** Smoothing passes. Fewer passes leave a rougher, more winding cave, so the deep floors get fewer. */
const smoothingPasses = (floor: number): number => (floor <= 4 ? 5 : floor <= 8 ? 4 : 3);

/** A floor must be open on at least this share of its cells and at most that share (the outer ring counts as wall). */
const MIN_OPEN_SHARE = 0.38;
const MAX_OPEN_SHARE = 0.58;
/** No open square wider than this: it would read as a hall, not a cave. */
const MAX_OPEN_SQUARE = 8;
/** The two ladders are at least this far apart (Chebyshev), so a floor has to be crossed. */
const MIN_LADDER_GAP = 12;
/** Nodes keep this far (Chebyshev) from both ladders and both arrival cells. */
const NODE_CLEARANCE = 4;
/** A layout needs at least this many cells where a node may stand, or it is thrown away. */
const MIN_NODE_CELLS = 120;
const MIN_NODES = 14;
const MAX_NODES = 28;
const MAX_ATTEMPTS = 200;

/** What share of a floor's rocks each kind makes up (relative weights), by the deepest floor of each tier. */
type Mix = Readonly<Partial<Record<MineNodeId, number>>>;
const MIXES: readonly { readonly upToFloor: number; readonly mix: Mix }[] = [
  { upToFloor: 2, mix: { stone: 78, copper: 22 } },
  { upToFloor: 4, mix: { stone: 52, copper: 26, coal: 22 } },
  { upToFloor: 6, mix: { stone: 34, copper: 20, coal: 20, iron: 26 } },
  { upToFloor: 8, mix: { stone: 24, copper: 12, coal: 20, iron: 24, quartz: 20 } },
  // Amethyst is not part of the mix: it is rare, and placed by `amethystCount`.
  { upToFloor: MINE_FLOORS, mix: { stone: 8, copper: 8, coal: 26, iron: 28, quartz: 30 } },
];
/** Amethyst only grows from this floor down. */
const FIRST_AMETHYST_FLOOR = 9;

// ------------------------------------------------------------------------------------------ public

/** The cell and facing a player appears at when stepping onto floor `floor` from above (next to its up ladder). Floor 1 is entered from the forest. */
export function mineFloorEntry(floor: number): { x: number; y: number; facing: Direction } {
  return { ...layoutOf(floor).up.arrival };
}

/** The cell and facing a player appears at when climbing UP from floor `floor + 1` onto floor `floor` (next to its down ladder). */
export function mineFloorExitFromBelow(floor: number): { x: number; y: number; facing: Direction } {
  const down = layoutOf(floor).down;
  if (down === undefined) throw new RangeError(`Mine floor ${floor} has no down ladder, so nobody climbs up onto it from below`);
  return { ...down.arrival };
}

/** Deterministic: the same floor number always gives deeply-equal output. `floor` is 1..MINE_FLOORS, otherwise this throws. */
export function generateMineFloor(floor: number): MapDef {
  const layout = layoutOf(floor);
  const { up, down } = layout;

  const terrain: string[] = [];
  for (let y = 0; y < MINE_HEIGHT; y += 1) {
    let row = '';
    for (let x = 0; x < MINE_WIDTH; x += 1) row += layout.open[cellAt(x, y)] === 1 ? FLOOR_GLYPH : WALL_GLYPH;
    terrain.push(row);
  }

  // Up ladder: out to the forest from floor 1, otherwise to the floor above, arriving beside that floor's down ladder.
  const upTarget = floor === 1 ? { ...MINE_SURFACE } : { map: mineFloorId(floor - 1), ...mineFloorExitFromBelow(floor - 1) };
  const objects: MapObjectPlacement[] = [{ def: 'ladder_up', x: up.x, y: up.y }];
  const exits: ExitDef[] = [{ x: up.x, y: up.y, w: 1, h: 1, to: upTarget }];
  if (down !== undefined) {
    objects.push({ def: 'ladder_down', x: down.x, y: down.y });
    exits.push({ x: down.x, y: down.y, w: 1, h: 1, to: { map: mineFloorId(floor + 1), ...mineFloorEntry(floor + 1) } });
  }

  return {
    id: mineFloorId(floor),
    regionId: MINE_REGION,
    name: `The Old Mine, floor ${floor}`,
    width: MINE_WIDTH,
    height: MINE_HEIGHT,
    terrain,
    props: Array.from({ length: MINE_HEIGHT }, () => '.'.repeat(MINE_WIDTH)),
    propLegend: {},
    objects,
    scatter: [],
    spawn: { ...up.arrival },
    exits,
    ambient: 'cave',
    nodes: placeNodes(floor, layout),
  };
}

// ------------------------------------------------------------------------------------------ grid basics

interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Where a player appears next to a ladder, and which way they face (away from the ladder's wall). */
interface Arrival extends Cell {
  readonly facing: Direction;
}

interface Ladder extends Cell {
  readonly arrival: Arrival;
}

/** The cave and its ladders. `open[y * MINE_WIDTH + x]` is 1 on floor cells and 0 on wall. Never mutated after it is built. */
interface Layout {
  readonly open: Uint8Array;
  readonly up: Ladder;
  /** Absent on the last floor. */
  readonly down: Ladder | undefined;
}

/** Orthogonal steps. */
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const OPPOSITE: Readonly<Record<Direction, Direction>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const cellAt = (x: number, y: number): number => y * MINE_WIDTH + x;
const cellsTotal = MINE_WIDTH * MINE_HEIGHT;
const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function assertFloor(floor: number): void {
  if (!Number.isInteger(floor) || floor < 1 || floor > MINE_FLOORS) {
    throw new RangeError(`Mine floor must be a whole number from 1 to ${MINE_FLOORS}, got ${floor}`);
  }
}

/** A stream of seeds that differs by floor, by attempt (a floor is rebuilt with the next attempt if it does not pass) and by purpose. */
const seedFor = (floor: number, attempt: number, stream: number): number =>
  Math.floor(hash2(floor, attempt, 0x6d1e + stream) * 4294967296);

/** Fisher-Yates on a copy, with the given random stream. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

// ------------------------------------------------------------------------------------------ the cave

/**
 * Cellular automata: scatter walls, then let every cell take the majority of its neighbours a few times. That grows
 * rounded chambers and winding passages out of noise. Then it is cleaned up: cut-off pockets are filled and diagonal
 * pinches are opened, so the cave is one region with no checkerboard noise.
 */
function carveCave(rng: () => number, floor: number): Uint8Array {
  let open: Uint8Array = new Uint8Array(cellsTotal);
  const chance = wallChance(floor);
  for (let y = 1; y < MINE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MINE_WIDTH - 1; x += 1) open[cellAt(x, y)] = rng() >= chance ? 1 : 0;
  }
  for (let pass = 0; pass < smoothingPasses(floor); pass += 1) open = smooth(open);
  keepLargestRegion(open);
  openPinches(open);
  return open;
}

/** One automaton step. The outer ring stays wall. A wall holds with 4 wall neighbours of 8, a floor falls with 5. */
function smooth(open: Uint8Array): Uint8Array {
  const next = new Uint8Array(cellsTotal);
  for (let y = 1; y < MINE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MINE_WIDTH - 1; x += 1) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx !== 0 || dy !== 0) && open[cellAt(x + dx, y + dy)] === 0) walls += 1;
        }
      }
      const wasWall = open[cellAt(x, y)] === 0;
      next[cellAt(x, y)] = (wasWall ? walls >= 4 : walls >= 5) ? 0 : 1;
    }
  }
  return next;
}

/** Fills every 4-connected region of floor except the biggest back in with wall. */
function keepLargestRegion(open: Uint8Array): void {
  const seen = new Uint8Array(cellsTotal);
  let best: number[] = [];
  for (let start = 0; start < cellsTotal; start += 1) {
    if (open[start] === 0 || seen[start] === 1) continue;
    const region = [start];
    seen[start] = 1;
    for (let head = 0; head < region.length; head += 1) {
      const cell = region[head] as number;
      const x = cell % MINE_WIDTH;
      const y = Math.floor(cell / MINE_WIDTH);
      for (const [dx, dy] of NEIGHBOURS) {
        const next = cellAt(x + dx, y + dy);
        if (open[next] === 1 && seen[next] === 0) {
          seen[next] = 1;
          region.push(next);
        }
      }
    }
    if (region.length > best.length) best = region;
  }
  const keep = new Set(best);
  for (let cell = 0; cell < cellsTotal; cell += 1) if (open[cell] === 1 && !keep.has(cell)) open[cell] = 0;
}

/**
 * A 2x2 block with floor on one diagonal and wall on the other pinches the cave to a single corner, which looks like
 * checkerboard noise (and is not walkable). Opening one of the two wall cells widens it. Opening never disconnects, and
 * a pinch can only be among interior cells, so the outer ring is safe.
 */
function openPinches(open: Uint8Array): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < MINE_HEIGHT - 2; y += 1) {
      for (let x = 1; x < MINE_WIDTH - 2; x += 1) {
        const topLeft = open[cellAt(x, y)] === 1;
        const topRight = open[cellAt(x + 1, y)] === 1;
        const bottomLeft = open[cellAt(x, y + 1)] === 1;
        const bottomRight = open[cellAt(x + 1, y + 1)] === 1;
        if (topLeft && bottomRight && !topRight && !bottomLeft) {
          open[cellAt(x + 1, y)] = 1;
          changed = true;
        } else if (topRight && bottomLeft && !topLeft && !bottomRight) {
          open[cellAt(x, y)] = 1;
          changed = true;
        }
      }
    }
  }
}

/** Side of the biggest square of floor cells. A big one is an empty hall, which a cave should not have. */
function largestOpenSquare(open: Uint8Array): number {
  const side = new Uint8Array(cellsTotal);
  let best = 0;
  for (let y = 1; y < MINE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MINE_WIDTH - 1; x += 1) {
      if (open[cellAt(x, y)] === 0) continue;
      const here = 1 + Math.min(side[cellAt(x - 1, y)] as number, side[cellAt(x, y - 1)] as number, side[cellAt(x - 1, y - 1)] as number);
      side[cellAt(x, y)] = here;
      if (here > best) best = here;
    }
  }
  return best;
}

function looksLikeACave(open: Uint8Array): boolean {
  let floorCells = 0;
  for (let cell = 0; cell < cellsTotal; cell += 1) floorCells += open[cell] as number;
  const share = floorCells / cellsTotal;
  return share >= MIN_OPEN_SHARE && share <= MAX_OPEN_SHARE && largestOpenSquare(open) <= MAX_OPEN_SQUARE;
}

// ------------------------------------------------------------------------------------------ walking

/** Steps (4-neighbour) from `start` to every floor cell that is not blocked; -1 where it cannot be reached. */
function walkingDistances(open: Uint8Array, blocked: Uint8Array, start: Cell): Int16Array {
  const distance = new Int16Array(cellsTotal).fill(-1);
  const first = cellAt(start.x, start.y);
  if (open[first] === 0 || blocked[first] === 1) return distance;
  const queue = [first];
  distance[first] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head] as number;
    const x = cell % MINE_WIDTH;
    const y = Math.floor(cell / MINE_WIDTH);
    for (const [dx, dy] of NEIGHBOURS) {
      const next = cellAt(x + dx, y + dy);
      if (open[next] === 1 && blocked[next] === 0 && distance[next] === -1) {
        distance[next] = (distance[cell] as number) + 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

/** Can every floor cell that is not blocked be reached from `start`? */
function staysConnected(open: Uint8Array, blocked: Uint8Array, start: Cell): boolean {
  const distance = walkingDistances(open, blocked, start);
  for (let cell = 0; cell < cellsTotal; cell += 1) {
    if (open[cell] === 1 && blocked[cell] === 0 && distance[cell] === -1) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------------------ ladders

/** A floor cell against a wall, with the cell on its open side to arrive on. The ladder stands against the wall. */
interface LadderSite extends Ladder {
  /** The wall is to the north: the ladder leans against the back wall and the player arrives south of it, facing south. */
  readonly againstNorthWall: boolean;
}

function ladderSites(open: Uint8Array): LadderSite[] {
  const sites: LadderSite[] = [];
  for (let y = 1; y < MINE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MINE_WIDTH - 1; x += 1) {
      if (open[cellAt(x, y)] === 0) continue;
      for (const towardsWall of DIRECTIONS) {
        const vector = DIRECTION_VECTORS[towardsWall];
        const arrivalX = x - vector.x;
        const arrivalY = y - vector.y;
        if (open[cellAt(x + vector.x, y + vector.y)] === 1 || open[cellAt(arrivalX, arrivalY)] === 0) continue;
        sites.push({ x, y, arrival: { x: arrivalX, y: arrivalY, facing: OPPOSITE[towardsWall] }, againstNorthWall: towardsWall === 'up' });
      }
    }
  }
  return sites;
}

/**
 * The first site, trying `tiers` in order (each shuffled), where the ladder blocks nothing: with its cell (and
 * `alreadyBlocked`) treated as wall, the whole cave stays connected.
 */
function chooseLadder(open: Uint8Array, tiers: readonly (readonly LadderSite[])[], alreadyBlocked: readonly Cell[], rng: () => number): LadderSite | undefined {
  for (const tier of tiers) {
    for (const site of shuffled(tier, rng)) {
      const blocked = new Uint8Array(cellsTotal);
      for (const cell of [...alreadyBlocked, site]) blocked[cellAt(cell.x, cell.y)] = 1;
      if (staysConnected(open, blocked, site.arrival)) return site;
    }
  }
  return undefined;
}

/** Places the up ladder, and the down ladder far from it. Undefined when this cave has no room for them. */
function placeLadders(open: Uint8Array, rng: () => number, withDown: boolean): { up: Ladder; down: Ladder | undefined } | undefined {
  const sites = ladderSites(open);
  const up = chooseLadder(open, [sites.filter((site) => site.againstNorthWall), sites], [], rng);
  if (up === undefined) return undefined;
  if (!withDown) return { up: toLadder(up), down: undefined };

  // The down ladder: far enough away that the floor has to be crossed, and by preference at the far end of the cave.
  const upBlocked = new Uint8Array(cellsTotal);
  upBlocked[cellAt(up.x, up.y)] = 1;
  const distance = walkingDistances(open, upBlocked, up.arrival);
  const apart = sites
    .filter((site) => chebyshev(site, up) >= MIN_LADDER_GAP && (distance[cellAt(site.arrival.x, site.arrival.y)] as number) >= 0)
    .sort((a, b) => walkDistanceOf(distance, b) - walkDistanceOf(distance, a) || a.y - b.y || a.x - b.x);
  const farthest = apart.slice(0, Math.max(1, Math.ceil(apart.length / 4)));
  const down = chooseLadder(open, [farthest.filter((site) => site.againstNorthWall), farthest, apart], [up], rng);
  if (down === undefined) return undefined;
  return { up: toLadder(up), down: toLadder(down) };
}

const walkDistanceOf = (distance: Int16Array, site: Cell): number => distance[cellAt(site.x, site.y)] as number;

const toLadder = (site: LadderSite): Ladder => ({ x: site.x, y: site.y, arrival: site.arrival });

// ------------------------------------------------------------------------------------------ layout

const layouts = new Map<number, Layout>();

/** The cave and ladders of a floor. Memoised; depends on the floor number alone. */
function layoutOf(floor: number): Layout {
  assertFloor(floor);
  const known = layouts.get(floor);
  if (known !== undefined) return known;
  const layout = buildLayout(floor);
  layouts.set(floor, layout);
  return layout;
}

/** Carves caves with successive seeds until one passes every check. The attempt number is part of the seed, so this is deterministic. */
function buildLayout(floor: number): Layout {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const rng = createRng(seedFor(floor, attempt, 0));
    const open = carveCave(rng, floor);
    if (!looksLikeACave(open)) continue;
    const ladders = placeLadders(open, rng, floor < MINE_FLOORS);
    if (ladders === undefined) continue;
    const layout: Layout = { open, ...ladders };
    if (nodeCells(layout).length >= MIN_NODE_CELLS) return layout;
  }
  throw new Error(`Mine floor ${floor}: no usable cave found in ${MAX_ATTEMPTS} attempts`);
}

// ------------------------------------------------------------------------------------------ nodes

/** Cells that a node may stand on: floor, and clear of the ladders and arrival cells. */
function nodeCells(layout: Layout): Cell[] {
  const special: Cell[] = [layout.up, layout.up.arrival];
  if (layout.down !== undefined) special.push(layout.down, layout.down.arrival);
  const cells: Cell[] = [];
  for (let y = 1; y < MINE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MINE_WIDTH - 1; x += 1) {
      if (layout.open[cellAt(x, y)] === 1 && special.every((other) => chebyshev({ x, y }, other) >= NODE_CLEARANCE)) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Rocks and ore for a floor: how many, where and of what kind are all decided by the floor number.
 *
 * Positions come first and do not depend on the kind. They are taken greedily from a shuffled list; a node is kept only
 * if, with it (and every node before it) solid, the cave still holds together and every node still has a free
 * neighbouring cell to be hit from.
 */
function placeNodes(floor: number, layout: Layout): NodeSpawn[] {
  const rng = createRng(seedFor(floor, 0, 1));
  const wanted = MIN_NODES + Math.floor(rng() * (MAX_NODES - MIN_NODES + 1));

  const blocked = new Uint8Array(cellsTotal);
  blocked[cellAt(layout.up.x, layout.up.y)] = 1; // ladders are exits: nobody walks through them
  if (layout.down !== undefined) blocked[cellAt(layout.down.x, layout.down.y)] = 1;

  const placed: Cell[] = [];
  for (const cell of shuffled(nodeCells(layout), rng)) {
    if (placed.length >= wanted) break;
    blocked[cellAt(cell.x, cell.y)] = 1;
    const candidate = [...placed, cell];
    if (staysConnected(layout.open, blocked, layout.up.arrival) && candidate.every((node) => hasFreeNeighbour(layout.open, blocked, node))) {
      placed.push(cell);
    } else {
      blocked[cellAt(cell.x, cell.y)] = 0;
    }
  }
  if (placed.length < MIN_NODES) throw new Error(`Mine floor ${floor}: room for only ${placed.length} nodes`);

  placed.sort((a, b) => a.y - b.y || a.x - b.x);
  const kinds = shuffled(nodeKinds(floor, placed.length, rng), rng);
  return placed.map((cell, i) => ({ x: cell.x, y: cell.y, def: kinds[i] as MineNodeId }));
}

/** Is a floor cell next to `node` that nothing stands on? (Together with an unbroken cave, that means it can be reached.) */
function hasFreeNeighbour(open: Uint8Array, blocked: Uint8Array, node: Cell): boolean {
  return NEIGHBOURS.some(([dx, dy]) => {
    const next = cellAt(node.x + dx, node.y + dy);
    return open[next] === 1 && blocked[next] === 0;
  });
}

/** Rare amethyst in the deepest floors: floor 9 has at most one, floor 10 one or two. */
function amethystCount(floor: number, rng: () => number): number {
  if (floor < FIRST_AMETHYST_FLOOR) return 0;
  return floor === FIRST_AMETHYST_FLOOR ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
}

/** The kind of every node on a floor, as exact counts from the depth's mix (so a tier's promises always hold), in a fixed order. */
function nodeKinds(floor: number, total: number, rng: () => number): MineNodeId[] {
  const amethyst = amethystCount(floor, rng);
  const mix = (MIXES.find((tier) => floor <= tier.upToFloor) as (typeof MIXES)[number]).mix;
  const kinds: MineNodeId[] = Array.from({ length: amethyst }, () => 'amethyst');
  return [...kinds, ...quotas(total - amethyst, mix)];
}

/** Splits `total` by weight into whole numbers that add up to `total` (largest remainder), and lists the kinds that many times. */
function quotas(total: number, mix: Mix): MineNodeId[] {
  const weighted = MINE_NODE_IDS.flatMap((id) => (mix[id] === undefined ? [] : [{ id, weight: mix[id] as number }]));
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const shares = weighted.map((entry) => {
    const exact = (total * entry.weight) / weightSum;
    return { id: entry.id, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = total - shares.reduce((sum, share) => sum + share.count, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (left <= 0) break;
    share.count += 1;
    left -= 1;
  }
  return shares.flatMap((share) => Array.from({ length: share.count }, () => share.id));
}
