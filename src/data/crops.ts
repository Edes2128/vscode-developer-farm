import type { CropDef } from '../engine/farming/types';

/**
 * The crops. Each grows through its stages on *watered* days and can be planted only in its seasons;
 * crops in the ground when their season ends wither. Frames are `crop/<id>_<stage>`, one per stage and one for ripe.
 */
export const CROPS: readonly CropDef[] = [
  {
    id: 'radish',
    name: 'Radish',
    seasons: ['spring'],
    seed: 'radish_seeds',
    harvest: 'radish',
    stageDays: [2, 2, 2],
    frames: ['crop/radish_0', 'crop/radish_1', 'crop/radish_2', 'crop/radish_3'],
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    seasons: ['spring'],
    seed: 'strawberry_seeds',
    harvest: 'strawberry',
    stageDays: [2, 2, 2, 2],
    frames: ['crop/strawberry_0', 'crop/strawberry_1', 'crop/strawberry_2', 'crop/strawberry_3', 'crop/strawberry_4'],
    // After picking, it goes back to flowering and fruits again 4 watered days later.
    regrowStage: 2,
  },
  {
    id: 'tomato',
    name: 'Tomato',
    seasons: ['summer'],
    seed: 'tomato_seeds',
    harvest: 'tomato',
    stageDays: [2, 3, 3, 3],
    frames: ['crop/tomato_0', 'crop/tomato_1', 'crop/tomato_2', 'crop/tomato_3', 'crop/tomato_4'],
    regrowStage: 3,
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    seasons: ['summer', 'autumn'],
    seed: 'sunflower_seeds',
    harvest: 'sunflower',
    stageDays: [2, 2, 2, 2],
    frames: ['crop/sunflower_0', 'crop/sunflower_1', 'crop/sunflower_2', 'crop/sunflower_3', 'crop/sunflower_4'],
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    seasons: ['autumn'],
    seed: 'pumpkin_seeds',
    harvest: 'pumpkin',
    stageDays: [2, 3, 3, 5],
    frames: ['crop/pumpkin_0', 'crop/pumpkin_1', 'crop/pumpkin_2', 'crop/pumpkin_3', 'crop/pumpkin_4'],
  },
  {
    id: 'moonbloom',
    name: 'Moonbloom',
    seasons: ['spring', 'summer', 'autumn'],
    seed: 'moonbloom_seeds',
    harvest: 'moonbloom',
    stageDays: [1, 1, 1],
    frames: ['crop/moonbloom_0', 'crop/moonbloom_1', 'crop/moonbloom_2', 'crop/moonbloom_3'],
    needsRain: true,
  },
];
