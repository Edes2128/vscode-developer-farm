import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import { makeContent, makeMap } from '../testing';
import { ContentIndex } from './content';
import { GameMap } from './gameMap';

/** Objects placed after a map was built (furniture, buildings), and dig spots. */

const grass = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

function room(extra: Parameters<typeof makeMap>[2] = {}): { map: GameMap; index: ContentIndex } {
  const def = makeMap(grass(8, 6), ['....T...', '........', '........', '........', '........', '........'], { spawn: { x: 0, y: 5, facing: 'up' }, ...extra });
  const index = new ContentIndex(makeContent(def));
  return { map: GameMap.build(def, index), index };
}

const object = (index: ContentIndex, id: string) => index.objectById.get(id)!;

describe('placing objects on a built map', () => {
  it('puts a one-cell object on open ground: the cell becomes solid, and it can be found again', () => {
    const { map, index } = room();
    const barrel = object(index, 'barrel');
    expect(map.canPlace(barrel, 2, 3)).toBe(true);
    const placed = map.addObject(barrel, 2, 3)!;
    expect(placed).toBeDefined();
    expect(map.isWalkable(2, 3)).toBe(false);
    expect(map.extraAt(2, 3)).toBe(placed);
    expect(map.extras.size).toBe(1);
    expect(placed.spriteX).toBe(32);
    expect(placed.sortY).toBe(64);
    expect(map.objectsVersion).toBe(1);
  });

  it('refuses a cell that is taken, off the map, a way out, the spawn, or covered by something else', () => {
    const { map, index } = room({ exits: [{ x: 7, y: 5, w: 1, h: 1, to: { map: 'test.map', x: 1, y: 1, facing: 'down' } }] });
    const barrel = object(index, 'barrel');
    expect(map.canPlace(barrel, 4, 0)).toBe(false); // the oak
    expect(map.canPlace(barrel, -1, 2)).toBe(false);
    expect(map.canPlace(barrel, 8, 2)).toBe(false);
    expect(map.canPlace(barrel, 7, 5)).toBe(false); // the exit
    expect(map.canPlace(barrel, 0, 5)).toBe(false); // the spawn
    map.addObject(barrel, 3, 3);
    expect(map.canPlace(barrel, 3, 3)).toBe(false); // already placed
    expect(map.addObject(barrel, 3, 3)).toBeUndefined();
    expect(map.extras.size).toBe(1);
  });

  it('refuses when any cell of a bigger footprint is blocked, and places it whole otherwise', () => {
    const { map, index } = room();
    const table = object(index, 'table'); // two cells wide
    map.addObject(object(index, 'barrel'), 3, 2);
    expect(map.canPlace(table, 2, 2)).toBe(false); // its right cell would sit on the barrel
    expect(map.canPlace(table, 6, 2)).toBe(true);
    expect(map.canPlace(table, 7, 2)).toBe(false); // would hang off the map
    map.addObject(table, 5, 2);
    expect(map.isWalkable(5, 2)).toBe(false);
    expect(map.isWalkable(6, 2)).toBe(false);
  });

  it('takes an object away and frees every cell it held', () => {
    const { map, index } = room();
    const table = object(index, 'table');
    const placed = map.addObject(table, 2, 2)!;
    expect(map.removeObject(placed.uid)).toBe(placed);
    expect(map.isWalkable(2, 2)).toBe(true);
    expect(map.isWalkable(3, 2)).toBe(true);
    expect(map.extraAt(2, 2)).toBeUndefined();
    expect(map.extras.size).toBe(0);
    expect(map.removeObject(placed.uid)).toBeUndefined();
    expect(map.canPlace(table, 2, 2)).toBe(true);
    expect(map.objectsVersion).toBe(2);
  });

  it('gives a placed object its prompt, and takes it away with the object', () => {
    const { map, index } = room();
    const shelf = object(index, 'bookshelf');
    const placed = map.addObject(shelf, 3, 3)!;
    expect(map.interactableAt(3, 3)?.objectUid).toBe(placed.uid);
    expect(map.solidObjectAt(3, 3)).toBe(placed);
    map.removeObject(placed.uid);
    expect(map.interactableAt(3, 3)).toBeUndefined();
    expect(map.solidObjectAt(3, 3)).toBeUndefined();
  });

  it('does not touch the cells of the open parts of a footprint (a walkable doorway stays walkable)', () => {
    const { map, index } = room();
    const mouth = object(index, 'cave_mouth'); // rock, an open way in, rock
    const placed = map.addObject(mouth, 2, 3)!;
    expect(map.isWalkable(2, 3)).toBe(false);
    expect(map.isWalkable(3, 3)).toBe(true);
    expect(map.isWalkable(4, 3)).toBe(false);
    map.removeObject(placed.uid);
    expect(map.isWalkable(2, 3)).toBe(true);
  });
});

describe('exits added later', () => {
  it('opens a way once, however many times it is added', () => {
    const { map } = room();
    const exit = { x: 2, y: 2, w: 1, h: 1, to: { map: 'test.map', x: 5, y: 5, facing: 'down' as const } };
    expect(map.exits).toHaveLength(0);
    map.addExit(exit);
    map.addExit(exit);
    expect(map.exits).toHaveLength(1);
  });

  it('keeps a spot for an exit free of furniture', () => {
    const { map, index } = room();
    map.addExit({ x: 2, y: 2, w: 1, h: 1, to: { map: 'test.map', x: 5, y: 5, facing: 'down' } });
    expect(map.canPlace(object(index, 'barrel'), 2, 2)).toBe(false);
  });
});

describe('dig spots', () => {
  const spot = CONTENT.nodes[0]!;
  const mark = { ...spot, id: 'dig_spot', tool: 'hoe' as const, solid: false, hits: 1 };

  it('lays them out for the day, lets the player walk over them, and replaces them tomorrow', () => {
    const { map } = room();
    map.setDigSpots([{ x: 1, y: 1 }, { x: 2, y: 2 }], mark, 3);
    expect(map.nodes.size).toBe(2);
    expect(map.digDay).toBe(3);
    expect(map.isWalkable(1, 1)).toBe(true); // a mark on the ground, not a wall
    map.setDigSpots([{ x: 5, y: 4 }], mark, 4);
    expect(map.nodeAt(1, 1)).toBeUndefined();
    expect(map.nodeAt(5, 4)).toBeDefined();
    expect(map.digDay).toBe(4);
  });

  it('keeps rocks when the spots change, and does not put a spot on a cell that has a node', () => {
    const def = makeMap(grass(6, 4), [], { spawn: { x: 0, y: 3, facing: 'up' }, nodes: [{ x: 2, y: 1, def: 'stone' }] });
    const index = new ContentIndex(makeContent(def));
    const map = GameMap.build(def, index);
    map.setDigSpots([{ x: 2, y: 1 }, { x: 3, y: 1 }], mark, 1);
    expect(map.nodeAt(2, 1)?.def.id).toBe('stone'); // the rock stayed
    expect(map.nodeAt(3, 1)?.def.id).toBe('dig_spot');
    map.hitNode(3, 1);
    expect(map.nodeAt(3, 1)).toBeUndefined();
    expect(map.isWalkable(3, 1)).toBe(true);
  });
});
