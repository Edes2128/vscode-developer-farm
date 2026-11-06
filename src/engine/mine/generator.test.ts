import { describe, expect, it, vi } from 'vitest';
import { DIRECTION_VECTORS, isDirection } from '../math/coords';
import type { ExitDef, MapDef } from '../world/types';
import {
  generateMineFloor,
  MINE_HEIGHT,
  MINE_NODE_IDS,
  MINE_WIDTH,
  mineFloorEntry,
  mineFloorExitFromBelow,
} from './generator';
import { MINE_FLOORS, MINE_REGION, MINE_SURFACE, mineFloorId, parseMineFloor } from './surface';

const FLOORS = Array.from({ length: MINE_FLOORS }, (_, i) => i + 1);

// ------------------------------------------------------------------------------------------ helpers (independent of the generator)

interface Cell {
  readonly x: number;
  readonly y: number;
}

const key = (x: number, y: number): string => `${x},${y}`;
const isFloor = (map: MapDef, x: number, y: number): boolean => map.terrain[y]?.[x] === ',';
const insideExit = (exit: ExitDef, x: number, y: number): boolean =>
  x >= exit.x && x < exit.x + exit.w && y >= exit.y && y < exit.y + exit.h;
const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manhattan = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function ladderOf(map: MapDef, def: 'ladder_up' | 'ladder_down'): Cell | undefined {
  const placements = (map.objects ?? []).filter((placement) => placement.def === def);
  expect(placements.length).toBeLessThanOrEqual(1);
  const found = placements[0];
  return found === undefined ? undefined : { x: found.x, y: found.y };
}

function floorCells(map: MapDef): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isFloor(map, x, y)) cells.push({ x, y });
  return cells;
}

/** Floor cells that can be walked to from `start` on 4-neighbour steps, never entering a cell in `solid`. */
function walkable(map: MapDef, start: Cell, solid: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  if (!isFloor(map, start.x, start.y) || solid.has(key(start.x, start.y))) return seen;
  seen.add(key(start.x, start.y));
  const queue: Cell[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head] as Cell;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const id = key(nx, ny);
      if (!isFloor(map, nx, ny) || solid.has(id) || seen.has(id)) continue;
      seen.add(id);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/** Side of the largest square made only of floor cells. */
function largestFloorSquare(map: MapDef): number {
  let best = 0;
  for (let size = 1; size <= Math.min(map.width, map.height); size += 1) {
    for (let y = 0; y + size <= map.height; y += 1) {
      for (let x = 0; x + size <= map.width; x += 1) {
        let all = true;
        for (let dy = 0; dy < size && all; dy += 1) for (let dx = 0; dx < size && all; dx += 1) all = isFloor(map, x + dx, y + dy);
        if (all) best = size;
      }
    }
  }
  return best;
}

/** Counts 2x2 blocks with floor on one diagonal and wall on the other: the checkerboard noise to avoid. */
function pinchCount(map: MapDef): number {
  let pinches = 0;
  for (let y = 0; y + 1 < map.height; y += 1) {
    for (let x = 0; x + 1 < map.width; x += 1) {
      const a = isFloor(map, x, y);
      const b = isFloor(map, x + 1, y);
      const c = isFloor(map, x, y + 1);
      const d = isFloor(map, x + 1, y + 1);
      if ((a && d && !b && !c) || (b && c && !a && !d)) pinches += 1;
    }
  }
  return pinches;
}

function nodeCounts(map: MapDef): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of map.nodes ?? []) counts[node.def] = (counts[node.def] ?? 0) + 1;
  return counts;
}

/** The kinds a floor may hold: the deeper the floor, the more is added. */
function allowedKinds(floor: number): readonly string[] {
  if (floor <= 2) return ['stone', 'copper'];
  if (floor <= 4) return ['stone', 'copper', 'coal'];
  if (floor <= 6) return ['stone', 'copper', 'coal', 'iron'];
  if (floor <= 8) return ['stone', 'copper', 'coal', 'iron', 'quartz'];
  return MINE_NODE_IDS;
}

// ------------------------------------------------------------------------------------------ tests

describe('generateMineFloor: determinism', () => {
  it('gives deeply equal maps for the same floor', () => {
    for (const floor of FLOORS) expect(generateMineFloor(floor)).toEqual(generateMineFloor(floor));
  });

  it('does not depend on which floors were asked for before', async () => {
    const expected = FLOORS.map((floor) => generateMineFloor(floor));
    vi.resetModules();
    const fresh = await import('./generator');
    // A new module instance has no memory: ask in the opposite order, a middle floor first.
    const order = [5, ...FLOORS.filter((floor) => floor !== 5).reverse()];
    const actual = new Map(order.map((floor) => [floor, fresh.generateMineFloor(floor)]));
    for (const floor of FLOORS) expect(actual.get(floor)).toEqual(expected[floor - 1]);
  });

  it('gives every floor its own cave', () => {
    const caves = new Set(FLOORS.map((floor) => generateMineFloor(floor).terrain.join('\n')));
    expect(caves.size).toBe(MINE_FLOORS);
    const nodePlans = new Set(FLOORS.map((floor) => JSON.stringify(generateMineFloor(floor).nodes)));
    expect(nodePlans.size).toBe(MINE_FLOORS);
  });

  it('hands out copies, so a caller cannot change what the next one gets', () => {
    const entry = mineFloorEntry(3);
    entry.x = -1;
    expect(mineFloorEntry(3).x).not.toBe(-1);
    const map = generateMineFloor(3);
    (map.exits as ExitDef[]).length = 0;
    expect(generateMineFloor(3).exits).toHaveLength(2);
  });
});

describe('generateMineFloor: out-of-range floors', () => {
  it.each([0, 11, -1, 1.5, Number.NaN])('throws for floor %s', (floor) => {
    expect(() => generateMineFloor(floor)).toThrow(RangeError);
    expect(() => mineFloorEntry(floor)).toThrow(RangeError);
    expect(() => mineFloorExitFromBelow(floor)).toThrow(RangeError);
  });

  it('has nowhere to climb up from the last floor', () => {
    expect(() => mineFloorExitFromBelow(MINE_FLOORS)).toThrow(RangeError);
  });

  it('names its floors so that the id round-trips', () => {
    for (const floor of FLOORS) {
      expect(generateMineFloor(floor).id).toBe(mineFloorId(floor));
      expect(parseMineFloor(mineFloorId(floor))).toBe(floor);
    }
    expect(parseMineFloor(mineFloorId(0))).toBeUndefined();
    expect(parseMineFloor(mineFloorId(MINE_FLOORS + 1))).toBeUndefined();
  });
});

describe.each(FLOORS)('mine floor %i: the cave', (floor) => {
  const map = generateMineFloor(floor);

  it('is a cave map of the right size', () => {
    expect(map.id).toBe(mineFloorId(floor));
    expect(map.regionId).toBe(MINE_REGION);
    expect(map.name).toBe(`The Old Mine, floor ${floor}`);
    expect([map.width, map.height]).toEqual([MINE_WIDTH, MINE_HEIGHT]);
    expect(map.ambient).toBe('cave');
    expect(map.terrain).toHaveLength(MINE_HEIGHT);
    expect(map.props).toEqual(Array.from({ length: MINE_HEIGHT }, () => '.'.repeat(MINE_WIDTH)));
    expect(map.propLegend).toEqual({});
    expect(map.scatter).toEqual([]);
    expect(map.tillable).toBeUndefined();
    expect(map.ranch).toBeUndefined();
    expect(map.fishing).toBeUndefined();
  });

  it('uses only floor and wall glyphs, with a wall all round', () => {
    for (const row of map.terrain) {
      expect(row).toHaveLength(MINE_WIDTH);
      expect(row).toMatch(/^[,%]+$/);
    }
    expect(map.terrain[0]).toBe('%'.repeat(MINE_WIDTH));
    expect(map.terrain[MINE_HEIGHT - 1]).toBe('%'.repeat(MINE_WIDTH));
    for (const row of map.terrain) {
      expect(row[0]).toBe('%');
      expect(row[MINE_WIDTH - 1]).toBe('%');
    }
  });

  it('is between about a third and three fifths open', () => {
    const share = floorCells(map).length / (MINE_WIDTH * MINE_HEIGHT);
    expect(share).toBeGreaterThanOrEqual(0.35);
    expect(share).toBeLessThanOrEqual(0.6);
  });

  it('has no huge empty hall and no checkerboard noise', () => {
    expect(largestFloorSquare(map)).toBeLessThanOrEqual(10);
    expect(pinchCount(map)).toBe(0);
  });

  it('is one connected region, even with the ladders treated as walls', () => {
    const ladders = new Set<string>();
    for (const placement of map.objects ?? []) ladders.add(key(placement.x, placement.y));
    const reached = walkable(map, map.spawn, ladders);
    expect(reached.size).toBe(floorCells(map).length - ladders.size);
  });
});

describe.each(FLOORS)('mine floor %i: ladders and exits', (floor) => {
  const map = generateMineFloor(floor);
  const last = floor === MINE_FLOORS;
  const up = ladderOf(map, 'ladder_up');
  const down = ladderOf(map, 'ladder_down');

  it('has an up ladder on a floor cell, and a down ladder on every floor but the last', () => {
    expect(up).toBeDefined();
    expect(isFloor(map, (up as Cell).x, (up as Cell).y)).toBe(true);
    expect(map.objects).toHaveLength(last ? 1 : 2);
    if (last) {
      expect(down).toBeUndefined();
    } else {
      expect(down).toBeDefined();
      expect(isFloor(map, (down as Cell).x, (down as Cell).y)).toBe(true);
      expect(chebyshev(up as Cell, down as Cell)).toBeGreaterThanOrEqual(10);
    }
  });

  it('makes each ladder cell a 1x1 exit and nothing else an exit', () => {
    const exits = map.exits ?? [];
    expect(exits).toHaveLength(last ? 1 : 2);
    for (const ladder of [up, down]) {
      if (ladder === undefined) continue;
      const matching = exits.filter((exit) => exit.x === ladder.x && exit.y === ladder.y && exit.w === 1 && exit.h === 1);
      expect(matching).toHaveLength(1);
    }
  });

  it('leads the up ladder to the forest from floor 1 and to the floor above otherwise', () => {
    const exit = (map.exits ?? []).find((candidate) => candidate.x === (up as Cell).x && candidate.y === (up as Cell).y) as ExitDef;
    if (floor === 1) {
      expect(exit.to).toEqual(MINE_SURFACE);
    } else {
      expect(exit.to).toEqual({ map: mineFloorId(floor - 1), ...mineFloorExitFromBelow(floor - 1) });
    }
  });

  it('leads the down ladder to the arrival cell of the floor below', () => {
    if (last) return;
    const exit = (map.exits ?? []).find((candidate) => candidate.x === (down as Cell).x && candidate.y === (down as Cell).y) as ExitDef;
    expect(exit.to).toEqual({ map: mineFloorId(floor + 1), ...mineFloorEntry(floor + 1) });
  });

  it('spawns the player at the entry cell', () => {
    expect(map.spawn).toEqual(mineFloorEntry(floor));
  });

  it('puts every arrival cell on the floor, next to its ladder, facing away from it and outside every exit', () => {
    const arrivals: [Cell | undefined, { x: number; y: number; facing: string } | undefined][] = [
      [up, mineFloorEntry(floor)],
      [down, last ? undefined : mineFloorExitFromBelow(floor)],
    ];
    for (const [ladder, arrival] of arrivals) {
      if (ladder === undefined || arrival === undefined) continue;
      expect(isFloor(map, arrival.x, arrival.y)).toBe(true);
      expect(manhattan(ladder, arrival)).toBe(1);
      expect(isDirection(arrival.facing)).toBe(true);
      const step = DIRECTION_VECTORS[arrival.facing as keyof typeof DIRECTION_VECTORS];
      expect({ x: ladder.x + step.x, y: ladder.y + step.y }).toEqual({ x: arrival.x, y: arrival.y });
      for (const exit of map.exits ?? []) expect(insideExit(exit, arrival.x, arrival.y)).toBe(false);
    }
  });
});

describe('mine floors: exits agree both ways', () => {
  it('has a target arrival cell on the floor of its map, outside that map\'s exits, for every mine exit', () => {
    for (const floor of FLOORS) {
      for (const exit of generateMineFloor(floor).exits ?? []) {
        const targetFloor = parseMineFloor(exit.to.map);
        if (targetFloor === undefined) {
          expect(floor).toBe(1);
          expect(exit.to).toEqual(MINE_SURFACE);
          continue;
        }
        const target = generateMineFloor(targetFloor);
        expect(isFloor(target, exit.to.x, exit.to.y)).toBe(true);
        for (const targetExit of target.exits ?? []) expect(insideExit(targetExit, exit.to.x, exit.to.y)).toBe(false);
      }
    }
  });

  it('lets every floor be climbed down and back up without ending anywhere new', () => {
    for (let floor = 1; floor < MINE_FLOORS; floor += 1) {
      const here = generateMineFloor(floor);
      const below = generateMineFloor(floor + 1);
      const down = ladderOf(here, 'ladder_down') as Cell;
      const downExit = (here.exits ?? []).find((exit) => exit.x === down.x && exit.y === down.y) as ExitDef;
      expect(downExit.to.map).toBe(below.id);
      expect(downExit.to).toEqual({ map: below.id, ...below.spawn });

      // Going back up from the floor below lands beside this floor's down ladder.
      const belowUp = ladderOf(below, 'ladder_up') as Cell;
      const upExit = (below.exits ?? []).find((exit) => exit.x === belowUp.x && exit.y === belowUp.y) as ExitDef;
      expect(upExit.to.map).toBe(here.id);
      expect(manhattan(down, upExit.to)).toBe(1);
      expect({ x: upExit.to.x, y: upExit.to.y, facing: upExit.to.facing }).toEqual(mineFloorExitFromBelow(floor));
    }
  });
});

describe.each(FLOORS)('mine floor %i: nodes', (floor) => {
  const map = generateMineFloor(floor);
  const nodes = map.nodes ?? [];
  const up = ladderOf(map, 'ladder_up') as Cell;
  const down = ladderOf(map, 'ladder_down');
  const specials: Cell[] = [up, mineFloorEntry(floor)];
  if (down !== undefined) specials.push(down, mineFloorExitFromBelow(floor));

  it('has 14 to 28 nodes of known kinds, each on its own floor cell', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(14);
    expect(nodes.length).toBeLessThanOrEqual(28);
    const seen = new Set<string>();
    for (const node of nodes) {
      expect(MINE_NODE_IDS as readonly string[]).toContain(node.def);
      expect(isFloor(map, node.x, node.y)).toBe(true);
      expect(seen.has(key(node.x, node.y))).toBe(false);
      seen.add(key(node.x, node.y));
    }
  });

  it('keeps at least 4 cells from both ladders and both arrival cells', () => {
    for (const node of nodes) for (const special of specials) expect(chebyshev(node, special)).toBeGreaterThanOrEqual(4);
  });

  it('leaves the cave whole with every node (and ladder) solid, and every node within reach', () => {
    const solid = new Set<string>([key(up.x, up.y)]);
    if (down !== undefined) solid.add(key(down.x, down.y));
    for (const node of nodes) solid.add(key(node.x, node.y));

    const start = mineFloorEntry(floor);
    const reached = walkable(map, start, solid);

    // Every floor cell that is neither a node nor a ladder is still reachable from the up ladder's arrival cell...
    const expectedCells = floorCells(map).filter((cell) => !solid.has(key(cell.x, cell.y)));
    expect(reached.size).toBe(expectedCells.length);
    for (const cell of expectedCells) expect(reached.has(key(cell.x, cell.y))).toBe(true);
    // ...in particular the down ladder's arrival cell...
    if (down !== undefined) expect(reached.has(key(mineFloorExitFromBelow(floor).x, mineFloorExitFromBelow(floor).y))).toBe(true);
    // ...and every node can be hit from a neighbouring cell that is reachable.
    for (const node of nodes) {
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => key(node.x + (dx as number), node.y + (dy as number)));
      expect(neighbours.some((id) => reached.has(id))).toBe(true);
    }
  });

  it('holds only what its depth allows, and everything its tier adds', () => {
    const counts = nodeCounts(map);
    const allowed = allowedKinds(floor);
    for (const kind of Object.keys(counts)) expect(allowed).toContain(kind);
    if (floor < 9) {
      expect(counts['stone'] ?? 0).toBeGreaterThan(0);
      expect(counts['copper'] ?? 0).toBeGreaterThan(0);
    }
    if (floor >= 3) expect(counts['coal'] ?? 0).toBeGreaterThan(0);
    if (floor >= 5) expect(counts['iron'] ?? 0).toBeGreaterThan(0);
    if (floor >= 7) expect(counts['quartz'] ?? 0).toBeGreaterThan(0);
    if (floor < 9) expect(counts['amethyst'] ?? 0).toBe(0);
    else expect(counts['amethyst'] ?? 0).toBeLessThanOrEqual(2);
  });
});

describe('mine floors: what grows where', () => {
  it('is mostly stone on the first floors, with some copper', () => {
    for (const floor of [1, 2]) {
      const counts = nodeCounts(generateMineFloor(floor));
      expect(Object.keys(counts).sort()).toEqual(['copper', 'stone']);
      expect(counts['stone'] as number).toBeGreaterThan(counts['copper'] as number);
    }
  });

  it('is richer than stone on the deepest floors, with amethyst now and then', () => {
    let amethyst = 0;
    for (const floor of [9, 10]) {
      const counts = nodeCounts(generateMineFloor(floor));
      const stone = counts['stone'] ?? 0;
      for (const ore of ['iron', 'coal', 'quartz']) expect(counts[ore] ?? 0).toBeGreaterThan(stone);
      amethyst += counts['amethyst'] ?? 0;
    }
    expect(amethyst).toBeGreaterThan(0);
  });

  it('never places amethyst above floor 9 or iron above floor 5', () => {
    for (const floor of FLOORS) {
      const counts = nodeCounts(generateMineFloor(floor));
      if (floor < 9) expect(counts['amethyst']).toBeUndefined();
      if (floor < 5) expect(counts['iron']).toBeUndefined();
      if (floor < 7) expect(counts['quartz']).toBeUndefined();
      if (floor < 3) expect(counts['coal']).toBeUndefined();
    }
  });
});

describe('generateMineFloor: speed', () => {
  it('builds all ten floors from scratch in well under half a second', async () => {
    vi.resetModules();
    const fresh = await import('./generator');
    const started = performance.now();
    for (const floor of FLOORS) fresh.generateMineFloor(floor);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
