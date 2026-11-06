/** Deterministic randomness. The same inputs always give the same world. */

/** mulberry32: a tiny, fast, seedable generator. Returns numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable hash of a cell and a seed into [0, 1). Used for decoration and tile variants. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Picks an index in `[0, count)` from a cell. */
export const hashIndex = (x: number, y: number, count: number, seed = 0): number =>
  Math.min(count - 1, Math.floor(hash2(x, y, seed) * count));
