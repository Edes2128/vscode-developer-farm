import type { FootprintCell, ObjectDef, TerrainDef } from '../engine/world/types';

/**
 * What the two new regions of Phase 7 (Windcrest Heights and Marlow Marsh) add to the world's vocabulary: their ground and their things.
 * The maps themselves are under `src/data/regions/windcrest` and `src/data/regions/marlow`. Frames follow the naming contract in GAME_DESIGN.md §9.
 */

const solid = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'solid' });
const open = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'open' });
const ONE: readonly FootprintCell[] = [solid(0, 0)];
const TWO_WIDE: readonly FootprintCell[] = [solid(0, 0), solid(1, 0)];
const grid = (width: number, height: number, cell: (dx: number, dy: number) => FootprintCell): FootprintCell[] =>
  Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width)));

const base = (id: string, name: string, glyph: string, variants: number, footstep?: TerrainDef['footstep']): TerrainDef => ({
  id,
  name,
  glyph,
  render: 'base',
  frames: id,
  variants,
  animationFrames: 1,
  animationFps: 0,
  solid: false,
  opaque: true,
  ...(footstep === undefined ? {} : { footstep }),
});

export const EXPANSION_TERRAINS: readonly TerrainDef[] = [
  base('highland_grass', 'Highland grass', ';', 4),
  base('marsh_grass', 'Marsh sedge', ':', 4),
  base('ruin_floor', 'Old flagstones', '+', 4, 'step_stone'),
];

const decal = (id: string, name: string, frames: readonly string[]): ObjectDef => ({ id, name, layer: 'ground', frames, anchor: { x: 0, y: 0 }, footprint: [] });

const sign = (id: string, title: string, lines: readonly string[]): ObjectDef => ({
  id,
  name: title,
  layer: 'standing',
  frames: ['object/signpost_right'],
  anchor: { x: 0, y: 8 },
  footprint: ONE,
  shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  interact: { verb: 'Read', title: 'Sign', lines },
});

export const EXPANSION_OBJECTS: readonly ObjectDef[] = [
  {
    id: 'birch',
    name: 'Birch tree',
    layer: 'standing',
    frames: ['object/birch_a', 'object/birch_b'],
    anchor: { x: 16, y: 40 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_tree', x: -12, y: 6 },
  },
  {
    id: 'standing_stone',
    name: 'Standing stone',
    layer: 'standing',
    frames: ['object/standing_stone'],
    anchor: { x: 0, y: 16 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: { verb: 'Look', title: 'Standing stone', lines: ['A grey stone as tall as two people, leaning a little, as it has for a long time.', 'Someone scratched a spiral into it, and the lichen has been growing over the spiral ever since.'] },
  },
  {
    id: 'ruin_wall',
    name: 'Broken wall',
    layer: 'standing',
    frames: ['object/ruin_wall'],
    anchor: { x: 0, y: 8 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 8 },
  },
  {
    id: 'ruin_pillar',
    name: 'Broken pillar',
    layer: 'standing',
    frames: ['object/ruin_pillar'],
    anchor: { x: 0, y: 24 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  },
  {
    id: 'ruin_arch',
    name: 'Old arch',
    layer: 'standing',
    frames: ['object/ruin_arch'],
    anchor: { x: 0, y: 24 },
    // Stone on either side and the way through between: the middle cell is open.
    footprint: [solid(0, 0), open(1, 0), solid(2, 0)],
    shadow: { frame: 'fx/shadow_house', x: -26, y: 6 },
  },
  {
    id: 'cairn',
    name: 'Cairn',
    layer: 'standing',
    frames: ['object/cairn'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: { verb: 'Look', title: 'Cairn', lines: ['A little stack of stones, each one added by somebody passing.', 'You do not add one. It feels like it would be a different kind of visit.'] },
  },
  // One piece of boardwalk, lying over water or mud: open, so it can be walked on even where the cell below is water.
  { id: 'plank', name: 'Boardwalk', layer: 'floor', frames: ['object/plank'], anchor: { x: 0, y: 0 }, footprint: [open(0, 0)] },
  {
    id: 'lodge',
    name: "Fern's lodge",
    layer: 'standing',
    frames: ['object/lodge'],
    anchor: { x: 0, y: 64 },
    // Six cells across, four deep, like the cottages: the third cell of the bottom row is the open door.
    footprint: grid(6, 4, (dx, dy) => (dx === 2 && dy === 3 ? open(2, 0) : solid(dx, dy - 3))),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
  },
  decal('heather', 'Heather', ['decal/heather_0', 'decal/heather_1']),
  decal('reeds', 'Reeds', ['decal/reeds_0', 'decal/reeds_1']),
  sign('sign_windcrest', 'Windcrest sign', ['WINDCREST HEIGHTS', 'The wind never stops up here. Neither, they say, does the stag.']),
  sign('sign_marlow', 'Marlow sign', ['MARLOW MARSH', 'Keep to the boardwalks. The marsh keeps what it takes.']),
];
