import type { RegionDef } from '../../../engine/world/types';

export const WILLOWBROOK: RegionDef = {
  id: 'willowbrook',
  name: 'Willowbrook Valley',
  description: 'A peaceful countryside valley of meadows, a winding river and quiet woods. Your farm begins here.',
  biome: 'meadow',
  unlock: { kind: 'always' },
  startMap: 'willowbrook.home_farm',
};
