import type { Direction } from '../math/coords';

/** The ids and ways in and out of the old mine. The mine is generated (see generator.ts); the forest above it is authored data. */

export const MINE_FLOORS = 10;
export const MINE_REGION = 'whispering_wood';

/** Where floor 1's up ladder leads: out of the cave mouth in the forest. The cell is outside the forest's mine entrance exit. */
export const MINE_SURFACE: { readonly map: string; readonly x: number; readonly y: number; readonly facing: Direction } = {
  map: 'willowbrook.whispering_wood',
  x: 30,
  y: 14,
  facing: 'down',
};

export const mineFloorId = (floor: number): string => `mine.floor_${floor}`;

/** The floor number an id names, if it is a mine floor within range. */
export function parseMineFloor(id: string): number | undefined {
  const match = /^mine\.floor_([1-9]\d?)$/.exec(id);
  if (match === null) return undefined;
  const floor = Number(match[1]);
  return floor >= 1 && floor <= MINE_FLOORS ? floor : undefined;
}
