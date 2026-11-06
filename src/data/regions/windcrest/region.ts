import type { RegionDef } from '../../../engine/world/types';

/**
 * Windcrest Heights: the windswept highland north of the farm, and the old ruin on it. The way up is a trail from the farm's north
 * edge, quiet until Ines at the museum has set the player digging: the unlock is the "Buried Things" quest, so the hoe is in
 * hand and the player already knows what a dig spot looks like before the ruin starts to matter.
 */
export const WINDCREST_REGION: RegionDef = {
  id: 'windcrest',
  name: 'Windcrest Heights',
  description: 'Open highland, standing stones and cairns, a cold little tarn, and the broken walls of somewhere that was lived in long ago.',
  biome: 'meadow',
  unlock: {
    kind: 'conditions',
    all: [{ kind: 'quest', id: 'buried_things', status: 'done' }],
    message: 'The trail north climbs into open highland, but you have no reason to go up yet. Ask Ines at the museum about old ruins, and dig things up with the hoe.',
  },
  startMap: 'windcrest.meadow',
};
