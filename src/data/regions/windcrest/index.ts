import type { MapDef } from '../../../engine/world/types';
import { WINDCREST_MEADOW } from './meadow';
import { WINDCREST_RUIN } from './ruin';

export { WINDCREST_REGION } from './region';
export { WINDCREST_MEADOW, WINDCREST_RUIN };

/** Windcrest Heights' maps, in the order they are met: the meadow, then the ruin above it. */
export const WINDCREST_MAPS: readonly MapDef[] = [WINDCREST_MEADOW, WINDCREST_RUIN];
