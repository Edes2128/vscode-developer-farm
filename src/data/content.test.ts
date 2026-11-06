import { describe, expect, it } from 'vitest';
import manifest from '../assets/generated/world.json';
import { rendererFrames } from '../rendering/frameNames';
import { CANONICAL_MASKS } from '../engine/world/autotile';
import { allTerrainFrames } from '../engine/world/frames';
import { makeContent, makeMap } from '../engine/testing';
import { validateContent } from '../engine/world/validate';
import { World } from '../engine/world/world';
import { CONTENT } from './content';

const atlas = new Set(Object.keys(manifest.frames));

describe('shipped content', () => {
  it('is valid: references resolve, maps are well formed, and everything can be reached', () => {
    expect(validateContent(CONTENT, atlas)).toEqual([]);
  });

  it('has every frame the renderer needs in the atlas', () => {
    expect(rendererFrames().filter((frame) => !atlas.has(frame))).toEqual([]);
  });

  it('uses frame names the atlas contains for every terrain', () => {
    for (const terrain of CONTENT.terrains) {
      const missing = allTerrainFrames(terrain, CANONICAL_MASKS).filter((frame) => !atlas.has(frame));
      expect(missing, terrain.id).toEqual([]);
    }
  });

  it('keeps every frame inside the atlas sheet', () => {
    for (const [name, f] of Object.entries(manifest.frames)) {
      expect(f.x >= 0 && f.y >= 0 && f.x + f.w <= manifest.size.w && f.y + f.h <= manifest.size.h, name).toBe(true);
    }
  });

  it('puts grass first, because every cell sits on it', () => {
    expect(CONTENT.terrains[0]?.id).toBe('grass');
  });
});

describe('Home Farm', () => {
  const world = new World(CONTENT);
  const map = world.map('willowbrook.home_farm');

  it('starts the player in front of the farmhouse door, on open ground', () => {
    expect(map.isWalkable(map.spawn.x, map.spawn.y)).toBe(true);
    expect(map.spawn.facing).toBe('up');
  });

  it('has a farmhouse you walk into through its door', () => {
    expect(map.interactableAt(13, 12)).toBeUndefined(); // nothing to read: the door is a way in
    expect(map.isWalkable(12, 12)).toBe(false); // the wall is solid
    expect(map.isWalkable(13, 12)).toBe(true); // the door cell is open
    expect(map.exits.find((e) => e.x === 13 && e.y === 12)?.to).toMatchObject({ map: 'willowbrook.farmhouse' });
  });

  it('lets you walk across the river on the bridge, and nowhere else', () => {
    // Water is solid...
    expect(map.terrainAt(43, 20)?.id).toBe('water');
    expect(map.isWalkable(43, 20)).toBe(false);
    // ...except where the bridge lies on it.
    for (const x of [42, 43, 44]) {
      expect(map.terrainAt(x, 21)?.id).toBe('water');
      expect(map.isWalkable(x, 21)).toBe(true);
    }
    const reachable = map.reachableFrom(map.spawn.x, map.spawn.y);
    expect(reachable[21 * map.width + 50]).toBe(1); // the far bank is reachable
    expect(map.isWalkable(39, 31)).toBe(false); // the pond is not
  });

  it('opens the north trail to Windcrest Heights and the south trail to Marlow Marsh, and keeps the east road to the village', () => {
    const reachable = map.reachableFrom(map.spawn.x, map.spawn.y);
    const at = (x: number, y: number): number => reachable[y * map.width + x] as number;
    expect(at(30, 4)).toBe(1); // the north trail...
    expect(at(30, 0)).toBe(1); // ...runs all the way to the edge of the map, where it leaves
    expect(at(22, 43)).toBe(1);
    expect(at(22, 47)).toBe(1); // and so does the south one
    expect(at(59, 21)).toBe(1);
    expect(at(62, 21)).toBe(1); // the east road runs to the edge of the map...
    expect(map.exits.find((e) => e.x === 62)).toMatchObject({ y: 21, to: { map: 'willowbrook.village_green' } }); // ...where it leaves
    expect(map.exits.find((e) => e.y === 0)).toMatchObject({ x: 30, to: { map: 'windcrest.meadow' } });
    expect(map.exits.find((e) => e.y === 47)).toMatchObject({ x: 22, to: { map: 'marlow.shallows' } });
  });

  it('joins fences into corners and runs', () => {
    expect(map.objects.find((o) => o.def.id === 'fence' && o.x === 6 && o.y === 24)?.frame).toBe('object/fence_m6'); // east + south
    expect(map.objects.find((o) => o.def.id === 'fence' && o.x === 8 && o.y === 24)?.frame).toBe('object/fence_m10'); // east + west
  });

  it('builds identically every time', () => {
    const again = World.prototype.map.call(new World(CONTENT), 'willowbrook.home_farm');
    expect(again.objects.map((o) => `${o.def.id}@${o.x},${o.y}:${o.frame}:${o.spriteX},${o.spriteY}`)).toEqual(
      map.objects.map((o) => `${o.def.id}@${o.x},${o.y}:${o.frame}:${o.spriteX},${o.spriteY}`),
    );
  });

  it('only sprinkles decals over grass, never under a building or on the path', () => {
    const decals = map.objects.filter((o) => o.def.layer === 'ground');
    expect(decals.length).toBeGreaterThan(50);
    for (const decal of decals) {
      expect(map.terrainAt(decal.x, decal.y)?.id).toBe('grass');
      expect(map.collision.isSolid(decal.x, decal.y)).toBe(false);
    }
  });

  it('orders objects far to near for depth sorting', () => {
    const keys = map.objects.map((o) => o.sortY);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });
});

describe('content validation', () => {
  const grass = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));
  const problems = (map: ReturnType<typeof makeMap>, frames?: Set<string>) => validateContent(makeContent(map), frames).map((p) => p.message);

  it('accepts a plain meadow', () => {
    expect(problems(makeMap(grass(6, 6)))).toEqual([]);
  });

  it('rejects rows of the wrong length', () => {
    const map = makeMap(grass(6, 6));
    const bad = { ...map, terrain: map.terrain.map((row, y) => (y === 2 ? row.slice(1) : row)) };
    expect(problems(bad).some((m) => m.includes('row 2'))).toBe(true);
  });

  it('rejects unknown terrain glyphs and unknown prop glyphs', () => {
    expect(problems(makeMap(['..x.', '....'])).some((m) => m.includes('"x"'))).toBe(true);
    expect(problems(makeMap(grass(4, 2), ['..Z.', '....'])).some((m) => m.includes('"Z"'))).toBe(true);
  });

  it('rejects a spawn in the water', () => {
    const map = makeMap(['....', '.~..', '....'], [], { spawn: { x: 1, y: 1, facing: 'down' } });
    expect(problems(map).some((m) => m.includes('not walkable'))).toBe(true);
  });

  it('rejects something you can interact with but cannot reach', () => {
    // A well on a grass island ringed by water.
    const terrain = ['.......', '.~~~~~.', '.~...~.', '.~...~.', '.~~~~~.', '.......'];
    const props = ['.......', '.......', '.......', '..W....', '.......', '.......'];
    const map = makeMap(terrain, props, { spawn: { x: 0, y: 0, facing: 'down' } });
    expect(problems(map).some((m) => m.includes('cannot be reached'))).toBe(true);
  });

  it('rejects two solid objects on one cell and objects standing in water', () => {
    expect(problems(makeMap(grass(5, 3), ['.TT..'], { objects: [{ def: 'oak', x: 1, y: 0 }] })).some((m) => m.includes('overlap'))).toBe(true);
    expect(problems(makeMap(['.~...', '.....'], ['.T...', '.....'])).some((m) => m.includes('stands on water'))).toBe(true);
  });

  it('rejects a footprint that hangs off the map', () => {
    expect(problems(makeMap(grass(4, 4), ['....', '....', '....', '...H'])).some((m) => m.includes('outside the map'))).toBe(true);
  });

  it('reports frames missing from the atlas', () => {
    const messages = problems(makeMap(grass(3, 3)), new Set(['terrain/grass_v0']));
    expect(messages.some((m) => m.includes('object/oak_a'))).toBe(true);
  });

  it('rejects a region whose start map is missing', () => {
    const content = makeContent(makeMap(grass(3, 3)));
    const broken = { ...content, regions: [{ ...content.regions[0]!, startMap: 'nowhere' }] };
    expect(validateContent(broken).some((p) => p.message.includes('start map'))).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const content = makeContent(makeMap(grass(3, 3)));
    const broken = { ...content, objects: [...content.objects, content.objects[0]!] };
    expect(validateContent(broken)[0]?.message).toContain('Duplicate');
  });
});

describe('farming content', () => {
  const base = makeContent(makeMap(['....', '....'], [], { spawn: { x: 0, y: 0, facing: 'down' } }));
  const messages = (content: typeof base, frames?: Set<string>) => validateContent(content, frames).map((p) => `${p.where}: ${p.message}`);

  it('accepts the shipped items, crops and shops', () => {
    expect(messages(base)).toEqual([]);
  });

  it('has art for every crop stage and every item icon', () => {
    for (const crop of CONTENT.crops) for (const frame of crop.frames) expect(atlas.has(frame), frame).toBe(true);
    for (const item of CONTENT.items) expect(atlas.has(item.icon), item.icon).toBe(true);
  });

  it('rejects a crop with the wrong number of stage pictures', () => {
    const crops = CONTENT.crops.map((c) => (c.id === 'radish' ? { ...c, frames: c.frames.slice(1) } : c));
    expect(messages({ ...base, crops }).some((m) => m.includes('crop radish') && m.includes('frames'))).toBe(true);
  });

  it('rejects a seed that does not plant the crop that claims it', () => {
    const items = CONTENT.items.map((i) => (i.id === 'radish_seeds' ? { ...i, plants: 'tomato' } : i));
    expect(messages({ ...base, items }).some((m) => m.includes('does not plant this crop') || m.includes('does not name this seed'))).toBe(true);
  });

  it('rejects a crop that regrows into a stage it does not have, and one with no seasons', () => {
    const crops = CONTENT.crops.map((c) => (c.id === 'strawberry' ? { ...c, regrowStage: 9 } : c.id === 'radish' ? { ...c, seasons: [] } : c));
    const found = messages({ ...base, crops });
    expect(found.some((m) => m.includes('regrowStage'))).toBe(true);
    expect(found.some((m) => m.includes('valid seasons'))).toBe(true);
  });

  it('rejects a shop that sells something that does not exist, or at no price', () => {
    const shops = [{ id: 'seed_stall', name: 'x', offers: [{ item: 'nothing', quantity: 1, price: 5 }, { item: 'radish_seeds', quantity: 1, price: 0 }] }];
    const found = messages({ ...base, shops });
    expect(found.some((m) => m.includes('unknown item'))).toBe(true);
    expect(found.some((m) => m.includes('positive price'))).toBe(true);
  });

  it('rejects a stall object that opens a shop that is not there', () => {
    expect(messages({ ...base, shops: [] }).some((m) => m.includes('unknown shop'))).toBe(true);
  });

  it('rejects a new-game kit that cannot fit in the pockets or names unknown items', () => {
    const items = Array.from({ length: 13 }, () => ({ id: 'hoe', count: 1 }));
    expect(messages({ ...base, newGame: { money: 0, items } }).some((m) => m.includes('slots'))).toBe(true);
    expect(messages({ ...base, newGame: { money: 0, items: [{ id: 'ghost', count: 1 }] } }).some((m) => m.includes('unknown item'))).toBe(true);
  });

  it('rejects a farm with soil nobody can reach, or with no water to refill the can from', () => {
    const field = makeMap(['.....', '.....', '.....'], [], { tillable: [{ x: 1, y: 0, w: 3, h: 2 }], spawn: { x: 0, y: 2, facing: 'up' } });
    expect(validateContent(makeContent(field)).some((p) => p.message.includes('no water'))).toBe(true);
    const walled = makeMap(['.....', '.~~~.', '.~.~.', '.~~~.'], [], { tillable: [{ x: 2, y: 2, w: 1, h: 1 }], spawn: { x: 0, y: 0, facing: 'down' } });
    expect(validateContent(makeContent(walled)).some((p) => p.message.includes('no soil'))).toBe(true);
  });

  it('rejects a tillable area that does not fit on the map', () => {
    const map = makeMap(['...', '...'], [], { tillable: [{ x: 2, y: 0, w: 5, h: 1 }], spawn: { x: 0, y: 0, facing: 'down' } });
    expect(validateContent(makeContent(map)).some((p) => p.message.includes('does not fit'))).toBe(true);
  });
});

describe('Home Farm as a farm', () => {
  const world = new World(CONTENT);
  const map = world.map('willowbrook.home_farm');
  const reachable = map.reachableFrom(map.spawn.x, map.spawn.y);

  it('has a field big enough to be worth farming, all of it reachable', () => {
    let cells = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!map.isTillable(x, y)) continue;
        expect(map.terrainAt(x, y)?.id, `${x},${y}`).toBe('grass');
        expect(map.isWalkable(x, y), `${x},${y}`).toBe(true);
        expect(reachable[y * map.width + x], `${x},${y}`).toBe(1);
        cells += 1;
      }
    }
    expect(cells).toBeGreaterThanOrEqual(150);
  });

  it('keeps the field clear of scattered flowers and rocks', () => {
    for (const object of map.objects) if (object.def.layer === 'ground') expect(map.isTillable(object.x, object.y)).toBe(false);
  });

  it('gives the farmer the well, the pond and the river to refill the can from', () => {
    expect(map.isWaterSource(18, 14)).toBe(true); // the well
    expect(map.isWaterSource(39, 31)).toBe(true); // the pond
    expect(map.isWaterSource(43, 20)).toBe(true); // the river
    expect(map.isWaterSource(10, 27)).toBe(false);
  });

  it('puts the shipping bin and the seed stall where the player can walk up to them', () => {
    expect(map.interactableAt(21, 12)?.objectId).toBe('shipping_bin');
    expect(map.interactableAt(20, 19)?.objectId).toBe('seed_stall');
  });

  it('lets the player earn the seed money back: a spring crop grows within the season', () => {
    for (const crop of CONTENT.crops.filter((c) => c.seasons.includes('spring'))) {
      expect(crop.stageDays.reduce((a, b) => a + b, 0)).toBeLessThan(28);
    }
  });
});

describe('Phase 4 content', () => {
  const messages = (content: typeof CONTENT) => validateContent(content).map((p) => `${p.where}: ${p.message}`);
  const mapOf = (id: string) => CONTENT.maps.find((m) => m.id === id)!;
  const swap = (id: string, change: Partial<(typeof CONTENT.maps)[number]>) => ({ ...CONTENT, maps: CONTENT.maps.map((m) => (m.id === id ? { ...m, ...change } : m)) });

  it('has a shipped world that validates, mine floors included', () => {
    expect(messages(CONTENT)).toEqual([]);
  });

  it('has a wooden floor and a wall for every interior, and every building has a door both ways', () => {
    for (const id of ['willowbrook.willas_cottage', 'willowbrook.tobias_cottage', 'willowbrook.general_store']) {
      const map = mapOf(id);
      expect(map.ambient).toBe('indoor');
      expect(map.terrain.join('')).toContain('_');
      expect(map.terrain.join('')).toContain('#');
    }
  });

  it('keeps the region that starts the game open, and locks the wood and the two regions beyond the farm', () => {
    expect(CONTENT.regions.filter((r) => r.unlock.kind !== 'always').map((r) => r.id).sort()).toEqual(['marlow', 'whispering_wood', 'windcrest']);
    expect(messages({ ...CONTENT, regions: CONTENT.regions.map((r) => (r.id === 'willowbrook' ? { ...r, unlock: { kind: 'conditions' as const, all: [{ kind: 'flag' as const, name: 'x' }], message: 'no' } } : r)) }).some((m) => m.includes('cannot be locked'))).toBe(true);
  });

  it('rejects an unlock that cannot be earned without going in, or one with nothing to say', () => {
    const quests = CONTENT.quests.map((q) => (q.id === 'gone_fishing' ? { ...q, objectives: [{ kind: 'mine' as const, item: 'stone', count: 1 }] } : q));
    expect(messages({ ...CONTENT, quests }).some((m) => m.includes('asks the player to mine (inside the region)'))).toBe(true);
    const regions = CONTENT.regions.map((r) => (r.id === 'whispering_wood' ? { ...r, unlock: { kind: 'conditions' as const, all: [{ kind: 'quest' as const, id: 'gone_fishing', status: 'done' as const }], message: '' } } : r));
    expect(messages({ ...CONTENT, regions }).some((m) => m.includes('message that says what to do'))).toBe(true);
  });

  it('rejects broken nodes, fish and fishing zones', () => {
    const nodes = CONTENT.nodes.map((n) => (n.id === 'stone' ? { ...n, drops: [{ item: 'stone', min: 1, max: 2, chance: 0.5 }] } : n));
    expect(messages({ ...CONTENT, nodes }).some((m) => m.includes('one drop that always appears'))).toBe(true);
    const fish = CONTENT.fish.map((f) => (f.id === 'pike' ? { ...f, waters: ['moat'] } : f));
    expect(messages({ ...CONTENT, fish }).some((m) => m.includes('"moat"'))).toBe(true);
    const wrongItem = CONTENT.fish.map((f) => (f.id === 'carp' ? { ...f, item: 'radish' } : f));
    expect(messages({ ...CONTENT, fish: wrongItem }).some((m) => m.includes('not a fish item'))).toBe(true);
    const dry = swap('willowbrook.riverbank', { fishing: [{ x: 0, y: 0, w: 5, h: 5, water: 'river' }] });
    expect(messages(dry).some((m) => m.includes('no water the player can fish from'))).toBe(true);
    const offMap = swap('willowbrook.riverbank', { fishing: [{ x: 30, y: 0, w: 20, h: 5, water: 'river' }] });
    expect(messages(offMap).some((m) => m.includes('does not fit on the map'))).toBe(true);
  });

  it('rejects water with nothing that always bites, and nodes standing in walls', () => {
    const fish = CONTENT.fish.filter((f) => f.id !== 'minnow');
    expect(messages({ ...CONTENT, fish }).some((m) => m.includes('no fish that bites all year'))).toBe(true);
    const wall = swap('willowbrook.willas_cottage', { nodes: [{ x: 0, y: 0, def: 'stone' }] });
    expect(messages(wall).some((m) => m.includes('inside solid terrain'))).toBe(true);
  });

  it('rejects quests that ask for a catch or a dig nobody could make', () => {
    const noRod = { ...CONTENT, shops: CONTENT.shops.map((s) => ({ ...s, offers: s.offers.filter((o) => o.item !== 'fishing_rod') })) };
    expect(messages(noRod).some((m) => m.includes('no shop sells a rod'))).toBe(true);
    const noPick = { ...CONTENT, shops: CONTENT.shops.map((s) => ({ ...s, offers: s.offers.filter((o) => o.item !== 'pickaxe') })) };
    expect(messages(noPick).some((m) => m.includes('no shop sells a pickaxe'))).toBe(true);
    const quests = CONTENT.quests.map((q) => (q.id === 'copper_for_the_store' ? { ...q, objectives: [{ kind: 'mine' as const, item: 'radish', count: 1 }] } : q));
    expect(messages({ ...CONTENT, quests }).some((m) => m.includes('no mine floor has a node for'))).toBe(true);
    const ghost = CONTENT.quests.map((q) => (q.id === 'the_anglers_favour' ? { ...q, objectives: [{ kind: 'catch' as const, count: 1, item: 'unicorn' }] } : q));
    expect(messages({ ...CONTENT, quests: ghost }).some((m) => m.includes('unknown item "unicorn"'))).toBe(true);
  });

  it('points exits only at maps that exist, mine floors included', () => {
    const bad = swap('willowbrook.whispering_wood', { exits: [...(mapOf('willowbrook.whispering_wood').exits ?? []), { x: 22, y: 38, w: 1, h: 1, to: { map: 'mine.floor_11', x: 1, y: 1, facing: 'down' as const } }] });
    expect(messages(bad).some((m) => m.includes('unknown map "mine.floor_11"'))).toBe(true);
  });

  it('marks one-off shop offers only on tools', () => {
    const shops = CONTENT.shops.map((s) => (s.id === 'general_store' ? { ...s, offers: [...s.offers, { item: 'chicken_feed', quantity: 1, price: 5, once: true }] } : s));
    expect(messages({ ...CONTENT, shops }).some((m) => m.includes('one-off but is not a tool'))).toBe(true);
  });

  it('has art for every node, fish, mineral, tool and interior piece it names', () => {
    for (const node of CONTENT.nodes) expect(atlas.has(node.frame), node.frame).toBe(true);
    for (const item of CONTENT.items.filter((i) => ['fish', 'mineral', 'tool'].includes(i.kind))) expect(atlas.has(item.icon), item.icon).toBe(true);
  });
});

describe('Phase 6 content', () => {
  const messages = (content: typeof CONTENT) => validateContent(content).map((p) => `${p.where}: ${p.message}`);
  const has = (content: typeof CONTENT, text: string) => messages(content).some((m) => m.includes(text));
  const festival = (id: string) => CONTENT.festivals.find((f) => f.id === id)!;
  const withFestival = (id: string, change: Partial<(typeof CONTENT.festivals)[number]>) => ({ ...CONTENT, festivals: CONTENT.festivals.map((f) => (f.id === id ? { ...f, ...change } : f)) });
  const withNpc = (id: string, change: Partial<(typeof CONTENT.npcs)[number]>) => ({ ...CONTENT, npcs: CONTENT.npcs.map((n) => (n.id === id ? { ...n, ...change } : n)) });

  it('has four festivals, one a season, none sharing a date', () => {
    expect(CONTENT.festivals.map((f) => f.season).sort()).toEqual(['autumn', 'spring', 'summer', 'winter']);
    expect(new Set(CONTENT.festivals.map((f) => `${f.season}${f.day}`)).size).toBe(4);
  });

  it('rejects a festival with a bad date, hours, host, place or prize table', () => {
    expect(has(withFestival('egg_hunt', { day: 29 }), 'a day from 1 to 28')).toBe(true);
    expect(has(withFestival('egg_hunt', { from: 17 * 60, to: 9 * 60 }), 'open before it closes')).toBe(true);
    expect(has(withFestival('egg_hunt', { host: 'nobody' }), 'is not a villager')).toBe(true);
    expect(has(withFestival('egg_hunt', { map: 'nowhere' }), 'unknown map')).toBe(true);
    expect(has(withFestival('egg_hunt', { places: [...festival('egg_hunt').places, { npc: 'june', x: 18, y: 13 }] }), 'places june twice')).toBe(true);
    expect(has(withFestival('egg_hunt', { places: festival('egg_hunt').places.filter((p) => p.npc !== 'willa') }), 'its host has no place')).toBe(true);
    expect(has(withFestival('egg_hunt', { places: [{ npc: 'willa', x: 0, y: 0 }] }), 'not walkable')).toBe(true);
    expect(has(withFestival('egg_hunt', { prizes: [] }), 'needs prizes')).toBe(true);
    expect(has(withFestival('egg_hunt', { prizes: [{ rank: 2, money: 5, message: 'x' }] }), 'start at rank 1')).toBe(true);
    expect(has(withFestival('egg_hunt', { prizes: [{ rank: 1, money: 5, items: [{ id: 'unicorn', count: 1 }], message: 'x' }] }), 'unknown item "unicorn"')).toBe(true);
    expect(has({ ...CONTENT, festivals: [...CONTENT.festivals, { ...festival('egg_hunt'), id: 'twin' }] }, 'shares its date')).toBe(true);
  });

  it('rejects festival numbers that make no sense, people in doorways, and decorations that wall the green in', () => {
    expect(has(withFestival('egg_hunt', { rivals: { count: 0, min: 1, max: 2 } }), 'rivals need')).toBe(true);
    expect(has(withFestival('egg_hunt', { rivals: { count: 3, min: 6, max: 2 } }), 'rivals need')).toBe(true);
    expect(has(withFestival('harvest_fair', { activity: { kind: 'harvest-fair', priceStep: 0 } }), 'price step')).toBe(true);
    expect(has(withFestival('lantern_night', { activity: { kind: 'lantern-night', bonus: -1 } }), 'friendship bonus')).toBe(true);
    const door = CONTENT.maps.find((m) => m.id === 'willowbrook.village_green')!.exits![0]!;
    expect(has(withFestival('egg_hunt', { places: [{ npc: 'willa', x: door.x, y: door.y }] }), 'in a doorway')).toBe(true);
    // A wall of lanterns across the whole road in from the farm shuts the green in two.
    const wall = Array.from({ length: 30 }, (_, y) => ({ object: 'festival_lantern', x: 6, y }));
    expect(has(withFestival('lantern_night', { decorations: wall }), 'shut off the cell')).toBe(true);
    expect(has(withFestival('lantern_night', { decorations: [{ object: 'unicorn', x: 1, y: 1 }] }), 'unknown object')).toBe(true);
  });

  it('keeps a shopkeeper\'s day free of the weather', () => {
    const willa = CONTENT.npcs.find((n) => n.id === 'willa')!;
    expect(has(withNpc('willa', { schedule: [...willa.schedule, { from: willa.schedule.at(-1)!.from + 1, map: willa.home, x: 30, y: 10, when: 'rain' }] }), 'keeps a shop')).toBe(true);
    expect(has(withNpc('tobias', { schedule: [...CONTENT.npcs.find((n) => n.id === 'tobias')!.schedule] }), 'keeps a shop')).toBe(false);
  });

  it('rejects a hunt with no room to hide the eggs, and a contest with no water', () => {
    expect(has(withFestival('egg_hunt', { activity: { kind: 'hunt', tokens: 8 }, huntAreas: [{ x: 0, y: 0, w: 2, h: 2 }] }), 'open cells for 8 eggs')).toBe(true);
    expect(has(withFestival('egg_hunt', { huntAreas: [] }), 'needs areas')).toBe(true);
    expect(has(withFestival('egg_hunt', { activity: { kind: 'hunt', tokens: 99 } }), 'hides 1 to 40 eggs')).toBe(true);
    expect(has(withFestival('harvest_fair', { huntAreas: [{ x: 3, y: 3, w: 5, h: 5 }] }), 'is not a hunt')).toBe(true);
    expect(has(withFestival('fishing_contest', { map: 'willowbrook.village_green', places: [{ npc: 'june', x: 3, y: 14 }] }), 'needs water to fish in')).toBe(true);
  });

  it('checks the weather and weekday rules of a schedule', () => {
    const june = CONTENT.npcs.find((n) => n.id === 'june')!;
    const first = june.schedule[0]!;
    expect(has(withNpc('june', { schedule: [{ ...first, when: 'rain' }, ...june.schedule.slice(1)] }), 'must apply every day')).toBe(true);
    expect(has(withNpc('june', { schedule: [first, { ...first, from: first.from + 60, days: [7] }] }), 'weekdays from 0')).toBe(true);
    expect(has(withNpc('june', { schedule: [first, { ...first, from: first.from + 60, days: [] }] }), 'weekdays from 0')).toBe(true);
    expect(has(withNpc('june', { schedule: [first, { ...first, from: first.from + 60, when: 'snow' as never }] }), 'invalid weather')).toBe(true);
    // Two entries at one minute are fine only when the second is for certain days or weather.
    expect(has(withNpc('june', { schedule: [first, { ...first }] }), 'in order of time')).toBe(true);
    expect(has(withNpc('june', { schedule: [first, { ...first, when: 'rain' }] }), 'in order of time')).toBe(false);
    expect(has(withNpc('june', { schedule: [{ ...first, map: 'away' }, ...june.schedule.slice(1)] }), 'unknown map')).toBe(false);
    expect(has(withNpc('june', { schedule: [{ ...first, map: 'away', serves: 'nothing' }] }), 'serves')).toBe(true);
  });

  it('lets the merchant be away without a map, and puts him behind his cart only on Sundays', () => {
    const rowan = CONTENT.npcs.find((n) => n.id === 'rowan')!;
    expect(rowan.schedule.filter((e) => e.map === 'away')).toHaveLength(2);
    expect(rowan.schedule.find((e) => e.serves === 'merchant')?.days).toEqual([6]);
    expect(CONTENT.shops.find((s) => s.id === 'merchant')?.offers.every((o) => o.seasons === undefined)).toBe(true);
  });

  it('checks the notice board pool: villagers, items, counts, pay and what each season can supply', () => {
    const pool = CONTENT.requests;
    const bad = (offers: typeof pool.offers, givers = pool.givers) => ({ ...CONTENT, requests: { givers, offers } });
    expect(has(bad(pool.offers, ['nobody']), 'is not a villager')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'unicorn', min: 1, max: 1, pay: 5 }]), 'unknown item')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'hoe', min: 1, max: 1, pay: 60 }]), 'not produce')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'radish', min: 3, max: 1, pay: 55 }]), 'range of pieces')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'radish', min: 1, max: 2, pay: 5000 }]), 'three times that')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'radish', min: 1, max: 2, pay: 1 }]), 'sale price')).toBe(true);
    expect(has(bad([...pool.offers, { item: 'pumpkin', min: 1, max: 1, pay: 200, seasons: ['winter'] }]), 'when nothing gives it')).toBe(true);
    expect(has(bad(pool.offers.filter((o) => o.seasons === undefined || o.seasons.includes('summer') === false).filter((o) => o.item !== 'egg' && o.item !== 'minnow' && o.item !== 'stone' && o.item !== 'copper_ore' && o.item !== 'coal' && o.item !== 'fried_egg' && o.item !== 'radish_salad' && o.item !== 'tomato_soup')), 'kinds of request in')).toBe(true);
  });

  it('asks only for things a notice board can be read on, and shows one on the green', () => {
    expect(CONTENT.objects.find((o) => o.id === 'notice_board')?.interact?.action).toEqual({ kind: 'board' });
    const noBoard = { ...CONTENT, maps: CONTENT.maps.map((m) => ({ ...m, propLegend: Object.fromEntries(Object.entries(m.propLegend ?? {}).map(([glyph, id]) => [glyph, id === 'notice_board' ? 'bench' : id])) })) };
    expect(has(noBoard, 'no map has a notice board')).toBe(true);
  });
});

describe('Phase 7 content', () => {
  const messages = (content: typeof CONTENT) => validateContent(content).map((p) => `${p.where}: ${p.message}`);
  const has = (content: typeof CONTENT, text: string) => messages(content).some((m) => m.includes(text));
  const heron = CONTENT.creatures.find((c) => c.id === 'heron')!;
  const withCreature = (change: Partial<typeof heron>) => ({ ...CONTENT, creatures: CONTENT.creatures.map((c) => (c.id === 'heron' ? { ...c, ...change } : c)) });

  it('has six rare creatures, each on a map that exists, with weather it can really happen in', () => {
    expect(CONTENT.creatures).toHaveLength(6);
    for (const creature of CONTENT.creatures) {
      for (const id of creature.maps) expect(CONTENT.maps.some((m) => m.id === id), `${creature.id} on ${id}`).toBe(true);
    }
  });

  it('rejects a creature that can never be met or befriended', () => {
    expect(has(withCreature({ maps: [] }), 'is found on no map')).toBe(true);
    expect(has(withCreature({ maps: ['nowhere'] }), 'unknown map "nowhere"')).toBe(true);
    expect(has(withCreature({ seasons: ['summer'], weather: ['snow'] }), 'weather that never happens')).toBe(true);
    expect(has(withCreature({ seasons: [] }), 'valid seasons')).toBe(true);
    expect(has(withCreature({ weather: [] }), 'valid weathers')).toBe(true);
    expect(has(withCreature({ from: 600, to: 600 }), 'from before to')).toBe(true);
    expect(has(withCreature({ chance: 0 }), 'a chance above 0')).toBe(true);
    expect(has(withCreature({ likes: [] }), 'can never be befriended')).toBe(true);
    expect(has(withCreature({ likes: ['unicorn'] }), 'likes unknown item')).toBe(true);
    expect(has(withCreature({ likes: ['hoe'] }), 'goods only')).toBe(true);
    expect(has(withCreature({ keepsake: { item: 'unicorn', count: 1 } }), 'unknown keepsake')).toBe(true);
    expect(has(withCreature({ keepsake: { item: 'hare_fur', count: 0 } }), 'whole number of keepsakes')).toBe(true);
    expect(has(withCreature({ name: ' ' }), 'a name and something to say')).toBe(true);
  });

  it('rejects quests that ask for more creatures than there are', () => {
    const quests = CONTENT.quests.map((q) => (q.id === 'field_notes' ? { ...q, objectives: [{ kind: 'see' as const, count: 7 }] } : q));
    expect(has({ ...CONTENT, quests }, 'asks to see 7 creatures')).toBe(true);
    const friends = CONTENT.quests.map((q) => (q.id === 'a_gentle_friend' ? { ...q, objectives: [{ kind: 'befriend' as const, count: 0 }] } : q));
    expect(has({ ...CONTENT, quests: friends }, 'asks to befriend 0')).toBe(true);
  });

  it('rejects a crop that needs rain where it never rains, a sprinkler nobody can place, and fertilizer that is not a supply', () => {
    // Every season has some rain or storm in it, so the shipped moonbloom passes; the rule is still there for a crop planted nowhere it could grow.
    expect(has(CONTENT, 'never rains in the seasons')).toBe(false);
    const objects = CONTENT.objects.map((o) => (o.id === 'sprinkler' ? { ...o, sprinkles: 0 } : o));
    expect(has({ ...CONTENT, objects }, 'waters 1 to 3 cells')).toBe(true);
    const noItem = CONTENT.items.filter((i) => i.id !== 'sprinkler');
    expect(has({ ...CONTENT, items: noItem }, 'no item puts down')).toBe(true);
    const items = CONTENT.items.map((i) => (i.id === 'fertilizer' ? { ...i, kind: 'material' as const } : i));
    expect(has({ ...CONTENT, items }, 'only a supply can fertilize')).toBe(true);
  });

  it('makes Fern the keeper of a shelf that sells moonbloom seeds and fertilizer, and she stands in her lodge all day', () => {
    const fern = CONTENT.npcs.find((n) => n.id === 'fern')!;
    expect(fern.schedule).toHaveLength(1);
    expect(fern.schedule[0]).toMatchObject({ map: 'marlow.lodge', x: 6, y: 4, serves: 'lodge' });
    expect(CONTENT.shops.find((s) => s.id === 'lodge')?.offers.map((o) => o.item)).toEqual(['moonbloom_seeds', 'fertilizer']);
  });

  it('opens Windcrest from the farm, and the unlock needs the dig quest', () => {
    const region = CONTENT.regions.find((r) => r.id === 'windcrest')!;
    expect(region.unlock).toMatchObject({ kind: 'conditions', all: [{ kind: 'quest', id: 'buried_things', status: 'done' }] });
    expect(CONTENT.maps.filter((m) => m.regionId === 'windcrest').map((m) => m.id).sort()).toEqual(['windcrest.meadow', 'windcrest.ruin']);
  });
});

describe('footsteps are data', () => {
  const terrain = (id: string) => CONTENT.terrains.find((t) => t.id === id)!;

  it('says how each kind of floor sounds underfoot, and leaves grass and the like to the default', () => {
    expect(terrain('dirt').footstep).toBe('step_dirt');
    expect(terrain('wood_floor').footstep).toBe('step_wood');
    for (const id of ['cave_floor', 'ruin_floor', 'marble_floor', 'greenhouse_floor']) expect(terrain(id).footstep, id).toBe('step_stone');
    for (const id of ['grass', 'highland_grass', 'marsh_grass']) expect(terrain(id).footstep, id).toBeUndefined();
  });
});
