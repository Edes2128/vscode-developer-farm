import type { NodeDef } from '../engine/nodes/types';

/**
 * What the pickaxe breaks. Frames are `node/<id>` (16 x 16). Drops are decided by a hash of the cell and the floor, so the
 * same rock gives the same stones every time. The mine generator places these ids by depth (src/engine/mine/generator.ts).
 */
export const NODES: readonly NodeDef[] = [
  { id: 'stone', name: 'Rock', frame: 'node/stone', tool: 'pickaxe', hits: 2, drops: [{ item: 'stone', min: 1, max: 3, chance: 1 }] },
  {
    id: 'copper',
    name: 'Copper vein',
    frame: 'node/copper',
    tool: 'pickaxe',
    hits: 3,
    drops: [
      { item: 'copper_ore', min: 1, max: 2, chance: 1 },
      { item: 'stone', min: 1, max: 1, chance: 0.5 },
    ],
  },
  {
    id: 'iron',
    name: 'Iron vein',
    frame: 'node/iron',
    tool: 'pickaxe',
    hits: 4,
    drops: [
      { item: 'iron_ore', min: 1, max: 2, chance: 1 },
      { item: 'stone', min: 1, max: 1, chance: 0.4 },
    ],
  },
  {
    id: 'coal',
    name: 'Coal seam',
    frame: 'node/coal',
    tool: 'pickaxe',
    hits: 3,
    drops: [{ item: 'coal', min: 1, max: 3, chance: 1 }],
  },
  {
    id: 'quartz',
    name: 'Quartz crystal',
    frame: 'node/quartz',
    tool: 'pickaxe',
    hits: 4,
    drops: [{ item: 'quartz', min: 1, max: 1, chance: 1 }],
  },
  {
    id: 'amethyst',
    name: 'Amethyst crystal',
    frame: 'node/amethyst',
    tool: 'pickaxe',
    hits: 5,
    drops: [
      { item: 'amethyst', min: 1, max: 1, chance: 1 },
      { item: 'quartz', min: 1, max: 1, chance: 0.3 },
    ],
  },
  // A mark on the ground that the hoe uncovers. What is buried there comes from the map's dig table, not from here.
  { id: 'dig_spot', name: 'Dig spot', frame: 'node/dig_spot', tool: 'hoe', solid: false, hits: 1, drops: [] },
];
