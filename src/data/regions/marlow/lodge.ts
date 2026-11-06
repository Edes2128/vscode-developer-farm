import type { MapDef } from '../../../engine/world/types';

/**
 * Fern's lodge: the one-room home of the marsh's naturalist, entered by the lodge door on the shallows (22,24) and left by the door in
 * its bottom wall. 12 x 9 cells, a steady lamp light (`ambient: 'indoor'`). Like the village cottages the walls are solid plaster
 * squares and the back wall is two rows tall so the bookshelves can stand against it.
 *
 *   terrain   _ wooden floor   # wall
 *   props     B bed  S bookshelf (two cells wide)  O stove  p plant  t table (two cells wide)  c chair  R rug  x crate  b barrel
 *
 * Where things are: two bookshelves and the stove along the back wall, the bed in the north-east corner, the table and its two chairs
 * in the north-west, a rug in the middle of the floor, crates and barrels along the east wall and a plant in each of the lower corners.
 * Fern stands at (6,4) facing down, with the cell in front of her (6,5) free, on the rug; you arrive at (5,7) just inside the door.
 */
const LEGEND = {
  B: 'bed',
  S: 'bookshelf',
  O: 'stove',
  p: 'pot_plant',
  t: 'table',
  c: 'chair',
  R: 'rug',
  x: 'crate',
  b: 'barrel',
} as const;

export const MARLOW_LODGE: MapDef = {
  id: 'marlow.lodge',
  regionId: 'marlow',
  name: "Fern's lodge",
  ambient: 'indoor',
  width: 12,
  height: 9,
  terrain: [
    '############', // 00
    '############', // 01
    '#__________#', // 02
    '#__________#', // 03
    '#__________#', // 04
    '#__________#', // 05
    '#__________#', // 06
    '#__________#', // 07
    '#####_######', // 08  the door
  ],
  props: [
    '............', // 00
    '............', // 01
    '.S.S..Op....', // 02
    '.........B..', // 03
    '.ct.c.......', // 04
    '..........x.', // 05
    '.....R...xb.', // 06
    '.p........p.', // 07
    '............', // 08
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 5, y: 7, facing: 'up' },
  // The door leads back to the doorstep of the lodge on the shallows, the cell just below its door.
  exits: [{ x: 5, y: 8, w: 1, h: 1, to: { map: 'marlow.shallows', x: 22, y: 25, facing: 'down' } }],
};
