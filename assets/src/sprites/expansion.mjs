// Phase 7 art, the second region pair: Windcrest Heights (highland grass, birches, a standing stone, ruins, heather) and
// Marlow Marsh (marsh grass, reeds, a boardwalk, the stilted lodge), plus the sprinkler, the moonbloom and six wild creatures.
// The pieces live in four modules; this one registers them all in a fixed order so the atlas stays deterministic.
//
//   expansion_land.mjs       terrain/{highland_grass,marsh_grass,ruin_floor}_v0..3, object/plank, decal/{heather,reeds}_{0,1}
//   expansion_things.mjs     object/{birch_a,birch_b,standing_stone,ruin_wall,ruin_pillar,ruin_arch,cairn,sprinkler}
//   expansion_lodge.mjs      object/lodge
//   expansion_life.mjs       item/*, crop/moonbloom_0..3
//   expansion_creatures.mjs  creature/{heron,kingfisher,moth,hare,owl,stag}_{0,1}
import { buildExpansionCreatures } from './expansion_creatures.mjs';
import { buildExpansionLand } from './expansion_land.mjs';
import { buildExpansionLife } from './expansion_life.mjs';
import { buildExpansionLodge } from './expansion_lodge.mjs';
import { buildExpansionThings } from './expansion_things.mjs';

/** @param {Map<string, import('../canvas.mjs').Img>} frames */
export function buildExpansion(frames) {
  buildExpansionLand(frames);
  buildExpansionThings(frames);
  buildExpansionLodge(frames);
  buildExpansionLife(frames);
  buildExpansionCreatures(frames);
}
