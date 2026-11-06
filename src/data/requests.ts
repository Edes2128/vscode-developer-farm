import type { RequestPool } from '../engine/requests/types';

/**
 * What the villagers might ask for on the notice board. Every offer is something the player can get in the seasons it is asked
 * for (the validator checks it), and pays a little more per piece than the shipping bin would, so a request is worth a detour
 * but never worth more than a good day of farming. Counts are small: a request is an errand, not a quota.
 */
export const REQUEST_POOL: RequestPool = {
  givers: ['willa', 'tobias', 'hollis', 'june', 'bram', 'ines'],
  offers: [
    { item: 'radish', min: 2, max: 5, seasons: ['spring'], pay: 55 },
    { item: 'strawberry', min: 2, max: 4, seasons: ['spring'], pay: 80 },
    { item: 'tomato', min: 2, max: 4, seasons: ['summer'], pay: 75 },
    { item: 'sunflower', min: 1, max: 3, seasons: ['summer', 'autumn'], pay: 110 },
    { item: 'pumpkin', min: 1, max: 2, seasons: ['autumn'], pay: 240 },
    { item: 'egg', min: 2, max: 6, pay: 40 },
    { item: 'minnow', min: 2, max: 5, pay: 26 },
    { item: 'carp', min: 1, max: 2, seasons: ['spring', 'summer', 'autumn'], pay: 72 },
    { item: 'stone', min: 6, max: 15, pay: 11 },
    { item: 'copper_ore', min: 2, max: 5, pay: 36 },
    { item: 'coal', min: 2, max: 4, pay: 29 },
    { item: 'fried_egg', min: 1, max: 3, pay: 70 },
    { item: 'radish_salad', min: 1, max: 2, pay: 150 },
    { item: 'tomato_soup', min: 1, max: 2, pay: 200 },
  ],
};
