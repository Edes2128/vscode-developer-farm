import type { MapDef } from '../../../engine/world/types';

/**
 * The insides of the village's buildings. Each is a small room reached through a door on the Village Green and left through
 * the door in its bottom wall. Walls are solid plaster squares (the back wall is two rows tall so tall furniture can stand
 * against it); the light is a steady lamp light (`ambient: 'indoor'`).
 *
 *   terrain   _ wooden floor   # wall
 *   props     B bed  S bookshelf  p plant  O stove  t table  c chair  R rug  x crate  b barrel  G shelves  K counter
 */

const LEGEND = {
  g: 'rain_barrel',
  P: 'pedestal',
  C: 'case',
  N: 'bed_home',
  k: 'kitchen',
  W: 'workbench',
  B: 'bed',
  S: 'bookshelf',
  p: 'pot_plant',
  O: 'stove',
  t: 'table',
  c: 'chair',
  R: 'rug',
  x: 'crate',
  b: 'barrel',
  G: 'shelf_goods',
  K: 'counter',
} as const;

export const WILLAS_COTTAGE: MapDef = {
  id: 'willowbrook.willas_cottage',
  regionId: 'willowbrook',
  name: "Willa's cottage",
  ambient: 'indoor',
  width: 10,
  height: 8,
  terrain: [
    '##########', // 00
    '##########', // 01
    '#________#', // 02
    '#________#', // 03
    '#________#', // 04
    '#________#', // 05
    '#________#', // 06
    '####_#####', // 07  the door
  ],
  props: [
    '..........', // 00
    '..........', // 01
    '....S..pO.', // 02
    '.B........', // 03
    '.....ct.c.', // 04
    '...R......', // 05
    '..........', // 06
    '..........', // 07
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 4, y: 6, facing: 'up' },
  exits: [{ x: 4, y: 7, w: 1, h: 1, to: { map: 'willowbrook.village_green', x: 30, y: 10, facing: 'down' } }],
};

export const TOBIAS_COTTAGE: MapDef = {
  id: 'willowbrook.tobias_cottage',
  regionId: 'willowbrook',
  name: "Tobias's cottage",
  ambient: 'indoor',
  width: 10,
  height: 8,
  terrain: [
    '##########', // 00
    '##########', // 01
    '#________#', // 02
    '#________#', // 03
    '#________#', // 04
    '#________#', // 05
    '#________#', // 06
    '####_#####', // 07  the door
  ],
  props: [
    '..........', // 00
    '..........', // 01
    '.S.p.O....', // 02
    '.......B..', // 03
    '..ct.c....', // 04
    '........x.', // 05
    '........b.', // 06
    '..........', // 07
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 4, y: 6, facing: 'up' },
  exits: [{ x: 4, y: 7, w: 1, h: 1, to: { map: 'willowbrook.village_green', x: 8, y: 10, facing: 'down' } }],
};

export const GENERAL_STORE: MapDef = {
  id: 'willowbrook.general_store',
  regionId: 'willowbrook',
  name: "Reed's General Store",
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
    '.G.G...G.G..', // 02
    '............', // 03
    '....K.......', // 04
    '.x........x.', // 05
    '.b........b.', // 06
    '....R.....p.', // 07
    '............', // 08
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 5, y: 7, facing: 'up' },
  exits: [{ x: 5, y: 8, w: 1, h: 1, to: { map: 'willowbrook.village_green', x: 22, y: 24, facing: 'down' } }],
};

export const FARMHOUSE: MapDef = {
  id: 'willowbrook.farmhouse',
  regionId: 'willowbrook',
  name: 'Your farmhouse',
  ambient: 'indoor',
  decorate: true,
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
    '....W.pk..O.', // 02
    '.N..........', // 03
    '............', // 04
    '.....ct.c...', // 05
    '......R.....', // 06
    '............', // 07
    '............', // 08
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 5, y: 7, facing: 'up' },
  exits: [{ x: 5, y: 8, w: 1, h: 1, to: { map: 'willowbrook.home_farm', x: 13, y: 13, facing: 'down' } }],
};

export const GREENHOUSE: MapDef = {
  id: 'willowbrook.greenhouse',
  regionId: 'willowbrook',
  name: 'Greenhouse',
  // Glass lets the daylight in: the light follows the sky, but the crops do not mind the season.
  sheltered: true,
  width: 12,
  height: 9,
  terrain: [
    'wwwwwwwwwwww', // 00
    'wwwwwwwwwwww', // 01
    'wggggggggggw', // 02
    'wggggggggggw', // 03
    'wggggggggggw', // 04
    'wggggggggggw', // 05
    'wggggggggggw', // 06
    'wggggggggggw', // 07
    'wwwwwgwwwwww', // 08  the door
  ],
  props: [
    '............', // 00
    '............', // 01
    '.g........g.', // 02
    '............', // 03
    '............', // 04
    '............', // 05
    '............', // 06
    '............', // 07
    '............', // 08
  ],
  propLegend: LEGEND,
  scatter: [],
  tillable: [{ x: 1, y: 3, w: 10, h: 4 }],
  spawn: { x: 5, y: 7, facing: 'up' },
  // The way in is built by the carpenter with the greenhouse itself (see buildings.ts), and this is the way out.
  exits: [{ x: 5, y: 8, w: 1, h: 1, to: { map: 'willowbrook.home_farm', x: 24, y: 18, facing: 'down' } }],
};

export const MUSEUM_INTERIOR: MapDef = {
  id: 'willowbrook.museum',
  regionId: 'willowbrook',
  name: 'Willowbrook Museum',
  ambient: 'indoor',
  width: 14,
  height: 10,
  terrain: [
    '##############', // 00
    '##############', // 01
    '#mmmmmmmmmmmm#', // 02
    '#mmmmmmmmmmmm#', // 03
    '#mmmmmmmmmmmm#', // 04
    '#mmmmmmmmmmmm#', // 05
    '#mmmmmmmmmmmm#', // 06
    '#mmmmmmmmmmmm#', // 07
    '#mmmmmmmmmmmm#', // 08
    '######m#######', // 09  the door
  ],
  props: [
    '..............', // 00
    '..............', // 01
    '.p..........p.', // 02
    '..C.P.C.P.C...', // 03
    '..............', // 04
    '..............', // 05
    '..............', // 06
    '.....R........', // 07
    '..............', // 08
    '..............', // 09
  ],
  propLegend: LEGEND,
  scatter: [],
  spawn: { x: 6, y: 8, facing: 'up' },
  exits: [{ x: 6, y: 9, w: 1, h: 1, to: { map: 'willowbrook.village_green', x: 30, y: 24, facing: 'down' } }],
};
