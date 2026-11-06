import type { FishDef } from '../engine/fishing/types';

/**
 * Who bites where and when. Waters are the kinds of water named in a map's `fishing` zones: `river`, `pond` (the farm's) and
 * `wood_pond` (the forest's). Hours are minutes on the game clock (6:00 am = 360; after midnight the clock runs on past 1440).
 * Every kind of water has at least one fish that bites all year in the daytime, so a rod is never useless.
 */
const DAY = { from: 6 * 60, to: 20 * 60 };
const ALL_DAY = { from: 6 * 60, to: 26 * 60 };
const NIGHT = { from: 20 * 60, to: 26 * 60 };

export const FISH: readonly FishDef[] = [
  { id: 'minnow', name: 'Minnow', item: 'minnow', waters: ['river', 'pond', 'wood_pond'], seasons: ['spring', 'summer', 'autumn', 'winter'], ...ALL_DAY, difficulty: 1, weight: 10 },
  { id: 'perch', name: 'Perch', item: 'perch', waters: ['river'], seasons: ['spring', 'summer'], ...DAY, difficulty: 2, weight: 6 },
  { id: 'carp', name: 'Carp', item: 'carp', waters: ['pond', 'wood_pond'], seasons: ['spring', 'summer', 'autumn'], ...DAY, difficulty: 2, weight: 6 },
  { id: 'trout', name: 'Trout', item: 'trout', waters: ['river'], seasons: ['autumn', 'winter'], ...DAY, difficulty: 3, weight: 6 },
  { id: 'catfish', name: 'Catfish', item: 'catfish', waters: ['river', 'pond'], seasons: ['spring', 'summer', 'autumn', 'winter'], ...NIGHT, difficulty: 4, weight: 5 },
  { id: 'pike', name: 'Pike', item: 'pike', waters: ['wood_pond'], seasons: ['spring', 'summer', 'autumn', 'winter'], ...ALL_DAY, difficulty: 5, weight: 3 },
];
