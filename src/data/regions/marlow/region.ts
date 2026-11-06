import type { RegionDef } from '../../../engine/world/types';

/**
 * Marlow Marsh: the drowned country south of Home Farm, where the river spreads out into reeds, boardwalks and slow water, and a
 * naturalist keeps a lodge on the only firm ground. The way in is the farm's south trail, which turns back anyone who has not yet
 * earned it: the unlock is both "Gone Fishing" (so the player knows the river and has a rod) and "First Finds" (so there is
 * something to show the museum, and the player has already dug and donated), a little further along the story than the forest.
 */
export const MARLOW_REGION: RegionDef = {
  id: 'marlow',
  name: 'Marlow Marsh',
  description: 'Reeds, boardwalks and slow brown water; a lodge on the one patch of dry ground, and a great fen beyond it where the herons stand.',
  biome: 'meadow',
  unlock: {
    kind: 'conditions',
    all: [
      { kind: 'quest', id: 'gone_fishing', status: 'done' },
      { kind: 'quest', id: 'first_finds', status: 'done' },
    ],
    message: 'The south trail sinks into a marsh that nobody here crosses blind. Get to know the river first (Hollis has a quest for that), and have something to show the museum (Ines wants three finds), then try again.',
  },
  startMap: 'marlow.shallows',
};
