import { hashIndex } from '../core/random';
import type { TerrainDef } from './types';

/**
 * Atlas frame names for terrain. These are the naming convention shared with the art pipeline
 * (assets/src/sprites/terrain.mjs); see "Asset pipeline" in GAME_DESIGN.md.
 */

/** A seamless base tile, one of `variants` chosen by cell. */
export const baseFrame = (def: TerrainDef, tx: number, ty: number): string =>
  `terrain/${def.frames}_v${hashIndex(tx, ty, def.variants, 11)}`;

/** An autotile for a neighbour mask. `animFrame` is ignored for still terrain. */
export function autotileFrame(def: TerrainDef, mask: number, tx: number, ty: number, animFrame: number): string {
  const variant = hashIndex(tx, ty, def.variants, 23);
  return def.animationFrames > 1
    ? `terrain/${def.frames}_m${mask}_v${variant}_f${animFrame}`
    : `terrain/${def.frames}_m${mask}_v${variant}`;
}

/** Every frame name a terrain can ask for, for validation against the atlas. */
export function allTerrainFrames(def: TerrainDef, masks: readonly number[]): string[] {
  const out: string[] = [];
  if (def.render === 'base') {
    for (let v = 0; v < def.variants; v += 1) out.push(`terrain/${def.frames}_v${v}`);
    return out;
  }
  for (const mask of masks) {
    for (let v = 0; v < def.variants; v += 1) {
      if (def.animationFrames > 1) {
        for (let f = 0; f < def.animationFrames; f += 1) out.push(`terrain/${def.frames}_m${mask}_v${v}_f${f}`);
      } else {
        out.push(`terrain/${def.frames}_m${mask}_v${v}`);
      }
    }
  }
  return out;
}

/** A person's picture: `char/<stem>/<direction>_<idle|walk>_<frame>`. */
export const characterFrame = (stem: string, facing: string, moving: boolean, walkFrame: number): string =>
  `char/${stem}/${facing}_${moving ? 'walk' : 'idle'}_${moving ? walkFrame : 0}`;

/** Every picture a person needs. */
export function allCharacterFrames(stem: string): string[] {
  const frames: string[] = [];
  for (const facing of ['up', 'down', 'left', 'right']) {
    frames.push(characterFrame(stem, facing, false, 0));
    for (let f = 0; f < 4; f += 1) frames.push(characterFrame(stem, facing, true, f));
  }
  return frames;
}

export type AnimalPose = 'idle' | 'walk_0' | 'walk_1' | 'peck_0' | 'peck_1';

export const ANIMAL_POSES: readonly AnimalPose[] = ['idle', 'walk_0', 'walk_1', 'peck_0', 'peck_1'];

/** An animal's picture: `<stem>_<pose>`, drawn facing right. */
export const animalFrame = (stem: string, pose: AnimalPose): string => `${stem}_${pose}`;
