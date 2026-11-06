/**
 * Autotiling: choosing the right edge/corner image for a tile from its neighbours.
 *
 * Terrain uses an 8-neighbour bitmask (47 distinct shapes); fences use a 4-neighbour mask (16 shapes).
 * The art generator (assets/src/sprites/terrain.mjs) mirrors these constants: a test checks they agree.
 */

// Terrain neighbour bits. A bit is set when that neighbour is the same terrain.
export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/**
 * A diagonal neighbour only matters when both edges beside it are also set; every other mask collapses
 * to the 47 shapes that really exist.
 */
export function canonicalMask(mask: number): number {
  let m = mask & (N | E | S | W);
  if (mask & NE && mask & N && mask & E) m |= NE;
  if (mask & SE && mask & S && mask & E) m |= SE;
  if (mask & SW && mask & S && mask & W) m |= SW;
  if (mask & NW && mask & N && mask & W) m |= NW;
  return m;
}

/** Every distinct canonical mask, ascending. The art atlas holds one tile for each. */
export const CANONICAL_MASKS: readonly number[] = [
  ...new Set(Array.from({ length: 256 }, (_, mask) => canonicalMask(mask))),
].sort((a, b) => a - b);

/**
 * The neighbour mask for a cell. `same(x, y)` says whether a neighbouring cell counts as the same
 * terrain. Cells outside the map count as the same, so shapes run off the map edge without a rim.
 */
export function terrainMask(
  tx: number,
  ty: number,
  width: number,
  height: number,
  same: (x: number, y: number) => boolean,
): number {
  const test = (x: number, y: number): boolean => x < 0 || y < 0 || x >= width || y >= height || same(x, y);
  let mask = 0;
  if (test(tx, ty - 1)) mask |= N;
  if (test(tx + 1, ty - 1)) mask |= NE;
  if (test(tx + 1, ty)) mask |= E;
  if (test(tx + 1, ty + 1)) mask |= SE;
  if (test(tx, ty + 1)) mask |= S;
  if (test(tx - 1, ty + 1)) mask |= SW;
  if (test(tx - 1, ty)) mask |= W;
  if (test(tx - 1, ty - 1)) mask |= NW;
  return canonicalMask(mask);
}

// Fence (4-neighbour) bits.
export const FENCE_N = 1;
export const FENCE_E = 2;
export const FENCE_S = 4;
export const FENCE_W = 8;

export function connectMask(
  tx: number,
  ty: number,
  connected: (x: number, y: number) => boolean,
): number {
  let mask = 0;
  if (connected(tx, ty - 1)) mask |= FENCE_N;
  if (connected(tx + 1, ty)) mask |= FENCE_E;
  if (connected(tx, ty + 1)) mask |= FENCE_S;
  if (connected(tx - 1, ty)) mask |= FENCE_W;
  return mask;
}
