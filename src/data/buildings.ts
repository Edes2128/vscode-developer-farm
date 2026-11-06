import type { BuildingDef } from '../engine/buildings/types';

/**
 * What the carpenter can build. The greenhouse stands on the farm's building site: its door leads to a glass room where the
 * seasons do not matter. It costs money, stone and copper, takes three nights, and is ready on the morning of the fourth day.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    description: 'A glass house where crops grow all year, whatever the season.',
    object: 'greenhouse',
    scaffolding: 'construction',
    cost: { money: 800, items: [{ id: 'stone', count: 50 }, { id: 'copper_bar', count: 6 }], days: 3 },
    // The site's anchor is (22, 17): the door is the third cell of its bottom row.
    door: { x: 24, y: 17, w: 1, h: 1, to: { map: 'willowbrook.greenhouse', x: 5, y: 7, facing: 'up' } },
  },
];
