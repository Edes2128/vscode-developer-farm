import type { Direction } from '../engine/math/coords';
import { CANONICAL_MASKS } from '../engine/world/autotile';

/**
 * Atlas frame names the renderer uses besides terrain and object frames. Pure strings, so the content
 * tests can check the atlas without loading a graphics library. Names match assets/src/sprites/*.mjs.
 */

export const playerFrame = (facing: Direction, moving: boolean, walkFrame: number): string =>
  `char/player/${facing}_${moving ? 'walk' : 'idle'}_${moving ? walkFrame : 0}`;

export const SHADOW_PLAYER_FRAME = 'fx/shadow_player';
export const SHADOW_SMALL_FRAME = 'fx/shadow_small';
export const INTERACT_ARROW_FRAME = 'fx/interact_arrow';
export const SMOKE_FRAMES: readonly string[] = ['fx/smoke_0', 'fx/smoke_1', 'fx/smoke_2', 'fx/smoke_3'];

/** The fishing line, float, bite mark, ripples and timing bar. */
export const FISHING_FRAMES: readonly string[] = [
  'fx/bobber_0',
  'fx/bobber_1',
  'fx/bite_mark',
  'fx/ripple_0',
  'fx/ripple_1',
  'fx/ripple_2',
  'fx/fish_bar',
  'fx/fish_zone',
  'fx/fish_marker',
];

export const CURSOR_FRAME_OK = 'fx/cursor_ok';
export const CURSOR_FRAME_NO = 'fx/cursor_no';
export const COIN_FRAME = 'icon/coin';
/** A painted egg lying on the grass at the Egg Hunt. */
export const TOKEN_FRAME = 'item/festival_egg';
/** The HUD's weather icons. */
export const WEATHER_FRAMES: readonly string[] = ['sun', 'cloud', 'rain', 'storm', 'snow'].map((w) => `icon/weather_${w}`);
export const DROP_FRAME = 'icon/water_drop';

export type SoilState = 'dry' | 'wet';

/** Tilled soil, shaped by its 8 neighbours (the same 47 masks as terrain). */
export const soilFrame = (state: SoilState, mask: number): string => `soil/${state}_m${mask}`;

/** The tool drawn in the farmer's hands while they swing it. */
export const toolFrame = (tool: 'hoe' | 'watering_can' | 'pickaxe' | 'fishing_rod'): string => `tool/${tool}`;

/** Every frame the renderer needs that content definitions do not already name. */
export function rendererFrames(): string[] {
  const frames = [SHADOW_PLAYER_FRAME, SHADOW_SMALL_FRAME, INTERACT_ARROW_FRAME, CURSOR_FRAME_OK, CURSOR_FRAME_NO, COIN_FRAME, DROP_FRAME, TOKEN_FRAME, ...WEATHER_FRAMES, toolFrame('hoe'), toolFrame('watering_can'), toolFrame('pickaxe'), toolFrame('fishing_rod'), ...SMOKE_FRAMES, ...FISHING_FRAMES];
  for (const mask of CANONICAL_MASKS) frames.push(soilFrame('dry', mask), soilFrame('wet', mask));
  for (const facing of ['up', 'down', 'left', 'right'] as const) {
    frames.push(playerFrame(facing, false, 0));
    for (let f = 0; f < 4; f += 1) frames.push(playerFrame(facing, true, f));
  }
  return frames;
}
