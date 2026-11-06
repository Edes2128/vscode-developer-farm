import type { RegionDef } from '../../../engine/world/types';

/**
 * Whispering Wood and the old mine below it. The way in is a trail north of the village green, choked with brambles until
 * Hollis (who knows the woods) has been helped: the unlock is the "Gone Fishing" quest, so the player has a rod, a little
 * money and a reason to be out by the water first.
 */
export const WHISPERING_WOOD_REGION: RegionDef = {
  id: 'whispering_wood',
  name: 'Whispering Wood',
  description: 'Old trees, ferns, a still pond, and a mine in the rock that nobody has worked for years.',
  biome: 'forest',
  unlock: {
    kind: 'conditions',
    all: [{ kind: 'quest', id: 'gone_fishing', status: 'done' }],
    message: 'Brambles choke the trail north. Hollis at the general store knows the woods: perhaps he could use a hand.',
  },
  startMap: 'willowbrook.whispering_wood',
};
