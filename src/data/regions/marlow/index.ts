import type { MapDef } from '../../../engine/world/types';
import { MARLOW_FEN } from './fen';
import { MARLOW_LODGE } from './lodge';
import { MARLOW_SHALLOWS } from './shallows';

export { MARLOW_REGION } from './region';
export { MARLOW_FEN, MARLOW_LODGE, MARLOW_SHALLOWS };

/** Marlow Marsh's maps, in the order they are met: the shallows, the fen beyond them and Fern's lodge on the shallows. */
export const MARLOW_MAPS: readonly MapDef[] = [MARLOW_SHALLOWS, MARLOW_FEN, MARLOW_LODGE];
