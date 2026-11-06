import type { AnimalDef } from '../engine/ranch/types';

/**
 * Farm animals. A hen that finds feed in the trough overnight leaves an egg in the coop's basket. Frames are
 * `<sprite>_<idle|walk_0|walk_1|peck_0|peck_1>`.
 */
export const ANIMALS: readonly AnimalDef[] = [
  {
    id: 'chicken',
    name: 'Chicken',
    product: 'egg',
    feed: 'chicken_feed',
    price: 250,
    names: ['Clover', 'Biscuit', 'Pepper', 'Maple', 'Dumpling', 'Nugget'],
    sprite: 'animal/chicken',
  },
];
