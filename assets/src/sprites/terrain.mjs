// Terrain tiles: seamless grass, and autotiled overlays (dirt path, water) that blend into the grass.
//
// Overlay tiles are drawn on top of a grass base. A tile's shape depends on which of its 8 neighbours
// are the same terrain (see `canonicalMask`). Where the terrain ends the tile is transparent and the
// grass shows through, so any shape of path or pond can be painted with one set of frames.
//
// Frame names:
//   terrain/grass_v{variant}
//   terrain/dirt_m{mask}_v{variant}
//   terrain/water_m{mask}_v{variant}_f{frame}
import { Img } from '../canvas.mjs';
import { PAL } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';

export const TILE = 16;

// Neighbour bits. A bit is set when that neighbour is the same terrain.
export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/**
 * Diagonal neighbours only matter when both edges next to them are set; everything else collapses to
 * the 47 distinct shapes a tile can really take. MUST match `canonicalMask` in src/engine/world/autotile.ts
 * (a test checks this for all 256 inputs).
 */
export function canonicalMask(mask) {
  let m = mask & (N | E | S | W);
  if (mask & NE && mask & N && mask & E) m |= NE;
  if (mask & SE && mask & S && mask & E) m |= SE;
  if (mask & SW && mask & S && mask & W) m |= SW;
  if (mask & NW && mask & N && mask & W) m |= NW;
  return m;
}

export const CANONICAL_MASKS = [...new Set(Array.from({ length: 256 }, (_, m) => canonicalMask(m)))].sort(
  (a, b) => a - b,
);

/**
 * Distance (in pixels) from a pixel to the nearest edge of the terrain shape, negative when the pixel
 * lies outside the shape (the rounded outer corners). Infinite deep inside.
 * @param {number} mask canonical mask  @param {number} x @param {number} y  @param {number} round corner radius
 */
export function shapeDistance(mask, x, y, round) {
  const px = x + 0.5;
  const py = y + 0.5;
  let d = Infinity;
  if (!(mask & N)) d = Math.min(d, py);
  if (!(mask & S)) d = Math.min(d, TILE - py);
  if (!(mask & W)) d = Math.min(d, px);
  if (!(mask & E)) d = Math.min(d, TILE - px);
  // Inner corners: both neighbours are terrain but the diagonal is not.
  if (mask & N && mask & W && !(mask & NW)) d = Math.min(d, Math.hypot(px, py));
  if (mask & N && mask & E && !(mask & NE)) d = Math.min(d, Math.hypot(TILE - px, py));
  if (mask & S && mask & W && !(mask & SW)) d = Math.min(d, Math.hypot(px, TILE - py));
  if (mask & S && mask & E && !(mask & SE)) d = Math.min(d, Math.hypot(TILE - px, TILE - py));
  // Outer corners: neither neighbour is terrain, so round the corner off.
  if (!(mask & N) && !(mask & W) && px < round && py < round) d = Math.min(d, round - Math.hypot(round - px, round - py));
  if (!(mask & N) && !(mask & E) && TILE - px < round && py < round) d = Math.min(d, round - Math.hypot(round - (TILE - px), round - py));
  if (!(mask & S) && !(mask & W) && px < round && TILE - py < round) d = Math.min(d, round - Math.hypot(round - px, round - (TILE - py)));
  if (!(mask & S) && !(mask & E) && TILE - px < round && TILE - py < round) d = Math.min(d, round - Math.hypot(round - (TILE - px), round - (TILE - py)));
  return d;
}

// ------------------------------------------------------------------------------------------ grass

function grassTile(variant) {
  const g = PAL.grass;
  const img = new Img(TILE, TILE);
  img.fill(g[2]);
  const r = rng(1000 + variant * 31);

  // Soft patches: a few 2-3 pixel blobs a shade lighter or darker, so the lawn is not flat.
  for (let i = 0; i < 3; i += 1) {
    const cx = r.int(1, 14);
    const cy = r.int(1, 14);
    const shade = i % 2 === 0 ? g[3] : g[1];
    img.set(cx, cy, shade);
    if (r() < 0.7) img.set(cx + 1, cy, shade);
    if (r() < 0.4) img.set(cx, cy + 1, shade);
  }
  // Fine speckle.
  for (let i = 0; i < 6; i += 1) img.set(r.int(0, 15), r.int(0, 15), r() < 0.5 ? g[3] : g[1]);

  // Blades: a tiny two-pixel stroke with a bright tip.
  const blades = variant < 3 ? 1 : 2 + (variant % 3);
  for (let i = 0; i < blades; i += 1) {
    const bx = r.int(2, 13);
    const by = r.int(3, 14);
    img.set(bx, by, g[1]);
    img.set(bx, by - 1, g[1]);
    img.set(bx + (r() < 0.5 ? -1 : 1), by - 2, g[3]);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ dirt

function dirtTile(mask, variant) {
  const d = PAL.dirt;
  const img = new Img(TILE, TILE);
  const r = rng(2000 + variant * 97);
  // Interior texture is a function of the variant only, so tiles of one variant look alike next to each other.
  const interior = new Img(TILE, TILE);
  interior.fill(d[2]);
  for (let i = 0; i < 9; i += 1) interior.set(r.int(0, 15), r.int(0, 15), r() < 0.55 ? d[1] : d[3]);
  for (let i = 0; i < 2; i += 1) {
    const px = r.int(1, 13);
    const py = r.int(1, 14);
    interior.set(px, py, PAL.stone[3]);
    interior.set(px + 1, py, PAL.stone[2]);
    interior.set(px, py + 1, PAL.stone[1]);
  }

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const dist = shapeDistance(mask, x, y, 5);
      if (dist < 0) continue;
      img.set(x, y, dist < 1 ? d[1] : interior.colorAt(x, y));
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ water

const WATER_FRAMES = 4;

function waterTile(mask, variant, frame) {
  const w = PAL.water;
  const img = new Img(TILE, TILE);
  const seed = 3000 + variant * 131 + mask;
  const r = rng(seed);

  // Ripple dashes keep their row and slide along it as the frame advances. They wrap inside the tile.
  const ripples = Array.from({ length: 4 }, () => ({
    x: r.int(0, 15),
    y: r.int(1, 14),
    len: r.int(3, 5),
    light: r() < 0.6,
  }));
  const sparkleRng = rng(seed * 7 + frame * 977);
  const sparkles = Array.from({ length: 1 }, () => ({ x: sparkleRng.int(1, 14), y: sparkleRng.int(1, 14) }));

  const interior = new Img(TILE, TILE);
  interior.fill(w[2]);
  for (const ripple of ripples) {
    const start = (ripple.x + frame * 2) % TILE;
    for (let i = 0; i < ripple.len; i += 1) {
      interior.set((start + i) % TILE, ripple.y, ripple.light ? w[3] : w[1]);
    }
  }
  for (const sparkle of sparkles) interior.set(sparkle.x, sparkle.y, PAL.white[1]);

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const dist = shapeDistance(mask, x, y, 6);
      if (dist < 0) continue;
      if (dist < 1) img.set(x, y, PAL.dirt[1]); // wet earth rim
      else if (dist < 2.6) img.set(x, y, dist < 1.8 ? PAL.sand[2] : PAL.sand[3]); // sandy bank
      else if (dist < 3.6) img.set(x, y, hash2(x, y, seed + frame * 31) < 0.2 ? PAL.white[1] : w[3]); // shimmering foam
      else if (dist < 4.6) img.set(x, y, w[1]); // deep edge shadow
      else img.set(x, y, interior.colorAt(x, y));
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ build

export const GRASS_VARIANTS = 8;
export const DIRT_VARIANTS = 3;
export const WATER_VARIANTS = 2;

/** @param {Map<string, Img>} frames */
export function buildTerrain(frames) {
  for (let v = 0; v < GRASS_VARIANTS; v += 1) frames.set(`terrain/grass_v${v}`, grassTile(v));
  for (const mask of CANONICAL_MASKS) {
    for (let v = 0; v < DIRT_VARIANTS; v += 1) frames.set(`terrain/dirt_m${mask}_v${v}`, dirtTile(mask, v));
    for (let v = 0; v < WATER_VARIANTS; v += 1) {
      for (let f = 0; f < WATER_FRAMES; f += 1) {
        frames.set(`terrain/water_m${mask}_v${v}_f${f}`, waterTile(mask, v, f));
      }
    }
  }
}

export const TERRAIN_META = {
  grassVariants: GRASS_VARIANTS,
  dirtVariants: DIRT_VARIANTS,
  waterVariants: WATER_VARIANTS,
  waterFrames: WATER_FRAMES,
};
