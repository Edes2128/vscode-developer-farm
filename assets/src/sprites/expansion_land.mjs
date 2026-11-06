// Phase 7 ground art: the three new terrain families (highland grass, marsh grass, ruin flagstones), the boardwalk plank
// and the new ground decals (heather, reeds).
//
// Frame names (the contract with src/data/terrain and src/data/objects):
//   terrain/highland_grass_v{0-3}   16 x 16  cool, short, wind-flattened grass, a little bluer and paler than terrain/grass_v*
//   terrain/marsh_grass_v{0-3}      16 x 16  dark, wet, yellow-green sedge ground with a few darker puddle flecks
//   terrain/ruin_floor_v{0-3}       16 x 16  weathered flagstones with moss in the joints
//   object/plank                    16 x 16  one piece of boardwalk (floor layer): tiles side to side AND top to bottom
//   decal/heather_{0,1}             16 x 16  purple heather flowers on highland grass
//   decal/reeds_{0,1}               16 x 16  clumps of reeds and cattails
//
// Every base tile is seamless: the base colour is flat, and every mark either wraps round the 16-pixel torus (blades,
// puddles, plank joints) or sits well inside the tile. Flagstone joints and plank joints keep clear of the outermost
// row and column, so two different variants side by side never double a joint into a thick line.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { INK_WARM, lit, shade, wrap } from './draw5.mjs';
import { LEAF, STONE } from './objects.mjs';

// ------------------------------------------------------------------------------------------ palettes

/** Highland grass: the brand sage pulled towards the sky, so it reads cool and a touch paler than the lawn. */
export const HIGH = ramp(mix(BRAND.sageGreen, [146, 196, 214], 0.2), 5, { dark: 0.52, light: 0.34 });
/** Marsh sedge: a dark, wet yellow-green. */
export const MARSH = ramp([112, 136, 62], 5, { dark: 0.58, light: 0.34 });
const MARSH_TIP = [188, 192, 98];
const PUDDLE = [[50, 74, 64], [66, 92, 74]];
const PUDDLE_GLINT = [132, 164, 156];
/** Wet, weathered boardwalk timber: the plank brown dulled towards silver-grey. */
export const WEATHERED = ramp(mix(mix(DERIVED.woodLight, DERIVED.stone, 0.28), DERIVED.wood, 0.18), 5, { dark: 0.52, light: 0.3 });
/** The dark seam between boards: a warm shadow, not the cool one, so wet wood stays brown. */
const SEAM = mix(DERIVED.woodDark, [30, 28, 34], 0.25);
const HEATHER = ramp([156, 90, 178], 5, { dark: 0.5, light: 0.42 });
const HEATHER_PINK = ramp([198, 106, 170], 5, { dark: 0.5, light: 0.4 });
const REED = [[40, 62, 46], [62, 92, 56], [92, 126, 64], [150, 170, 84], [208, 206, 126]];
const CATTAIL = ramp([112, 70, 44], 5, { dark: 0.5, light: 0.35 });

// ------------------------------------------------------------------------------------------ highland grass

function highlandTile(variant) {
  const g = HIGH;
  const img = new Img(16, 16);
  img.fill(g[2]);
  const r = rng(7100 + variant * 37);
  // Soft patches: flat two-pixel dabs, a shade lighter or darker, lying along the wind.
  for (let i = 0; i < 4; i += 1) {
    const cx = r.int(1, 13);
    const cy = r.int(1, 14);
    const shadeC = i % 2 === 0 ? g[3] : g[1];
    img.set(cx, cy, shadeC);
    img.set(cx + 1, cy, shadeC);
    if (r() < 0.35) img.set(cx + 2, cy, shadeC);
  }
  // Fine speckle.
  for (let i = 0; i < 5; i += 1) img.set(r.int(0, 15), r.int(0, 15), r() < 0.5 ? g[3] : g[1]);
  // Wind-flattened blades: a short stroke lying down towards the right, dark at the root, a pale tip.
  const blades = 3 + (variant % 2);
  for (let i = 0; i < blades; i += 1) {
    const bx = r.int(0, 15);
    const by = r.int(2, 15);
    img.set(wrap(bx), by, g[1]);
    img.set(wrap(bx + 1), by, g[1]);
    img.set(wrap(bx + 2), by - 1, g[4]);
    if (r() < 0.5) img.set(wrap(bx + 3), by - 1, g[3]);
  }
  // A pale pebble chip or two, the highland's bones coming through.
  if (variant >= 2) {
    const px = r.int(3, 11);
    const py = r.int(3, 12);
    const chip = ramp(mix(STONE[2], [150, 184, 204], 0.3), 4, { dark: 0.3, light: 0.25 });
    img.set(px, py, chip[3]);
    img.set(px + 1, py, chip[2]);
    img.set(px, py + 1, chip[1]);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ marsh grass

function marshTile(variant) {
  const m = MARSH;
  const img = new Img(16, 16);
  img.fill(m[2]);
  const r = rng(7300 + variant * 41);
  // Mottled wet ground: a few dabs a shade lighter and darker.
  for (let i = 0; i < 4; i += 1) {
    const cx = r.int(1, 13);
    const cy = r.int(1, 14);
    const c = i % 2 === 0 ? m[3] : m[1];
    img.set(cx, cy, c);
    img.set(cx + 1, cy, c);
    if (r() < 0.5) img.set(cx, cy + 1, c);
  }
  for (let i = 0; i < 6; i += 1) img.set(r.int(0, 15), r.int(0, 15), r() < 0.5 ? m[3] : m[1]);
  // Puddle flecks: dark, flat and low, with a wet glint on the lit edge of the larger ones. Not every tile has one.
  const puddles = [1, 2, 1, 0][variant];
  for (let i = 0; i < puddles; i += 1) {
    const px = r.int(1, 11);
    const py = r.int(3, 13);
    const w = r.int(3, 4);
    for (let k = 0; k < w; k += 1) img.set(wrap(px + k), py, PUDDLE[k === 0 || k === w - 1 ? 1 : 0]);
    if (i === 0) {
      img.set(wrap(px + 1), py + 1, PUDDLE[1]);
      img.set(wrap(px + 1), py - 1, PUDDLE_GLINT);
    }
  }
  // Sedge: small upright blades with a yellow tip.
  const tufts = 2 + (variant % 2) + (variant === 3 ? 1 : 0);
  for (let i = 0; i < tufts; i += 1) {
    const bx = r.int(2, 13);
    const by = r.int(5, 14);
    const lean = r() < 0.5 ? -1 : 1;
    img.set(bx, by, m[1]);
    img.set(bx, by - 1, m[1]);
    img.set(bx + lean, by - 2, MARSH_TIP);
    img.set(bx + 2 * lean, by, m[1]);
    img.set(bx + 2 * lean, by - 1, m[3]);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ ruin flagstones

/** Flagstones: the ruin's stone dulled and cooled a step, so the walls and pillars standing on it keep their own value. */
const FLAG = ramp(mix(DERIVED.stone, [92, 100, 108], 0.34), 5, { dark: 0.5, light: 0.26 });
const JOINT = mix(FLAG[0], [28, 34, 30], 0.3);
/** Per variant: where the two horizontal joints run, and the vertical joints of the slab row above/below each. */
const FLAG_LAYOUT = [
  { hy: [3, 11], xs: [[2, 9], [6, 13]] },
  { hy: [4, 10], xs: [[5, 12], [2, 9]] },
  { hy: [2, 9], xs: [[7, 13], [3, 10]] },
  { hy: [5, 12], xs: [[3, 10], [7, 14]] },
];

function flagstoneTile(variant) {
  const { hy, xs } = FLAG_LAYOUT[variant];
  const img = new Img(16, 16);
  const r = rng(7500 + variant * 53);
  // Which slab a pixel belongs to: the row is the band between the two horizontal joints; the slab is between joints.
  const rowOf = (y) => (y > hy[0] && y < hy[1] ? 0 : 1);
  const slabStart = (row, x) => {
    // The joint at or before x and the one after it (the last slab of a row wraps round to the first joint).
    const [a, b] = [...xs[row]].sort((p, q) => p - q);
    if (x < a) return { before: b - 16, after: a };
    if (x < b) return { before: a, after: b };
    return { before: b, after: a + 16 };
  };
  const rowTop = (row) => (row === 0 ? hy[0] : hy[1]);
  const rowBottom = (row) => (row === 0 ? hy[1] : hy[0] + 16);
  const slabTone = new Map();
  const toneOf = (row, before) => {
    const key = `${row}:${before}`;
    if (!slabTone.has(key)) slabTone.set(key, r.pick([2, 2, 3, 2, 1]));
    return slabTone.get(key);
  };

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const row = rowOf(y);
      const yy = row === 1 && y <= hy[0] ? y + 16 : y;
      const { before, after } = slabStart(row, x);
      const xx = x < before ? x + 16 : x;
      const onJointY = yy === rowBottom(row) || yy === rowTop(row);
      const onJointX = xx === after || xx === before;
      let c;
      if (onJointY || onJointX) {
        c = JOINT;
      } else {
        const base = toneOf(row, before);
        c = FLAG[base];
        // Lit along the top and left of each slab, shaded along the bottom and right.
        if (yy === rowTop(row) + 1 || xx === before + 1) c = FLAG[Math.min(4, base + 1)];
        else if (yy === rowBottom(row) - 1 || xx === after - 1) c = FLAG[Math.max(0, base - 1)];
        const n = hash2(x, y, 7500 + variant);
        if (n < 0.1) c = FLAG[Math.max(0, base - 1)];
        else if (n > 0.93) c = FLAG[Math.min(4, base + 1)];
      }
      img.set(x, y, c);
    }
  }

  // Moss grows in the joints, then creeps a pixel or two onto the stone beside them.
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const c = img.colorAt(x, y);
      if (c[0] !== JOINT[0] || c[1] !== JOINT[1] || c[2] !== JOINT[2]) continue;
      const n = hash2(x, y, 7600 + variant);
      if (n < 0.5) {
        img.set(x, y, n < 0.22 ? LEAF[1] : LEAF[2]);
        // creep onto the stone: below and right of a horizontal joint, left of a vertical one
        if (n < 0.14) img.set(wrap(x + 1), wrap(y + 1), LEAF[2]);
        if (n < 0.08) img.set(wrap(x), wrap(y + 1), LEAF[3]);
      }
    }
  }
  // A crack across one slab.
  const cx = r.int(3, 10);
  const cy = r.int(5, 9);
  for (let k = 0; k < 4; k += 1) {
    const px = cx + k;
    const py = cy + Math.floor(k / 2);
    const col = img.colorAt(px, py);
    if (col[0] === JOINT[0] && col[1] === JOINT[1]) continue;
    img.set(px, py, FLAG[0]);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ boardwalk plank

/**
 * One cell of boardwalk. Four boards run side to side (4 pixels each, a dark seam between them), so the tile joins
 * itself horizontally without a break and vertically as a stack of boards. Each board has a butt joint with a nail on
 * either side, staggered so a row or a column of planks reads as one continuous walkway.
 */
function plankTile() {
  const w = WEATHERED;
  const img = new Img(16, 16);
  const boardTone = [2, 3, 2, 1];
  const joints = [6, 13, 2, 10];
  for (let b = 0; b < 4; b += 1) {
    const y0 = b * 4;
    const base = boardTone[b];
    // body of the board: lit top row, flat middle, shaded bottom row, then the seam
    img.fillRect(0, y0, 16, 3, w[base]);
    img.hline(0, y0, 16, w[Math.min(4, base + 1)]);
    img.hline(0, y0 + 2, 16, w[Math.max(0, base - 1)]);
    img.hline(0, y0 + 3, 16, SEAM);
    // grain: a few darker flecks along the board, wrapping
    for (let i = 0; i < 3; i += 1) {
      const gx = Math.floor(hash2(i, b, 7700) * 16);
      img.set(wrap(gx), y0 + 1, w[Math.max(0, base - 1)]);
      img.set(wrap(gx + 1), y0 + 1, w[Math.max(0, base - 1)]);
    }
    // the butt joint and its nails
    const j = joints[b];
    img.vline(j, y0, 4, SEAM);
    img.set(wrap(j + 1), y0, w[Math.min(4, base + 1)]);
    img.set(wrap(j - 2), y0 + 1, w[1]);
    img.set(wrap(j + 3), y0 + 1, w[1]);
  }
  // a knot or two
  img.set(4, 5, w[1]);
  img.set(11, 13, w[1]);
  // a little green: damp moss caught in a seam
  img.set(9, 3, LEAF[1]);
  img.set(10, 3, LEAF[2]);
  img.set(1, 11, LEAF[1]);
  return img;
}

// ------------------------------------------------------------------------------------------ heather and reeds

/** One heather sprig: woody stems fanning out, each tipped with a spike of tiny purple bells. */
function heatherClump(img, bx, by, stems, palette) {
  for (const [dx, h, lean] of stems) {
    for (let t = 0; t < h; t += 1) {
      const x = bx + dx + Math.round((lean * t) / 3);
      const y = by - t;
      // leafy stem below, flowers in the top third
      if (t < h - 4) img.set(x, y, LEAF[1]);
      else {
        const c = t % 3 === 0 ? palette[3] : t % 3 === 1 ? palette[2] : palette[1];
        img.set(x, y, c);
        if (t >= h - 3) img.set(x + (t % 2 === 0 ? 1 : -1), y, palette[t % 2 === 0 ? 2 : 1]);
      }
    }
    img.set(bx + dx + Math.round((lean * (h - 1)) / 3), by - h, palette[4]);
  }
  // a small green mat at the foot
  for (const dx of [-2, -1, 0, 1, 2]) img.set(bx + dx, by + 1, dx % 2 === 0 ? LEAF[2] : LEAF[1]);
  img.set(bx - 1, by, LEAF[2]);
  img.set(bx + 1, by, LEAF[1]);
}

function heather(variant) {
  const img = new Img(16, 16);
  if (variant === 0) {
    heatherClump(img, 8, 13, [[-3, 6, -1], [-1, 8, -1], [1, 9, 0], [3, 7, 1], [5, 5, 1]], HEATHER);
  } else {
    heatherClump(img, 5, 12, [[-2, 5, -1], [0, 7, 0], [2, 6, 1]], HEATHER_PINK);
    heatherClump(img, 11, 14, [[-2, 6, -1], [0, 8, 0], [2, 7, 1]], HEATHER);
  }
  return img;
}

/** A reed blade: thin and leaning, dark at the root, mid green along the stem and pale straw at the tip. */
function reedBlade(img, x, by, h, lean) {
  for (let t = 0; t < h; t += 1) {
    const px = x + Math.round((lean * t * t) / (h * 3));
    img.set(px, by - t, t === h - 1 ? REED[4] : t >= h - 3 ? REED[3] : t < 3 ? REED[1] : t % 3 === 0 ? REED[1] : REED[2]);
  }
}

/** A cattail: a straight stem with a slender brown head (two wide, four tall) and a thin spike above it. */
function cattail(img, x, by, h) {
  for (let t = 0; t < h; t += 1) img.set(x, by - t, t < 3 ? REED[0] : t % 3 === 0 ? REED[1] : REED[2]);
  const top = by - h;
  for (let k = 0; k < 4; k += 1) {
    img.set(x - 1, top + k - 1, k === 0 ? CATTAIL[3] : CATTAIL[2]);
    img.set(x, top + k - 1, CATTAIL[k === 3 ? 0 : 1]);
  }
  img.set(x - 1, top, CATTAIL[3]);
  img.set(x, top - 2, REED[3]);
  img.set(x, top - 3, REED[4]);
}

function reeds(variant) {
  const img = new Img(16, 16);
  // a dark root mat first, so the blades stand out of it
  for (const x of [3, 4, 6, 7, 9, 10, 12]) img.set(x, 15, REED[0]);
  if (variant === 0) {
    reedBlade(img, 3, 14, 7, -1);
    reedBlade(img, 5, 14, 11, -1);
    reedBlade(img, 11, 14, 10, 1);
    reedBlade(img, 13, 14, 6, 1);
    cattail(img, 8, 14, 8);
    reedBlade(img, 7, 14, 4, 0);
    reedBlade(img, 10, 14, 5, 0);
  } else {
    reedBlade(img, 2, 14, 6, -1);
    reedBlade(img, 4, 14, 9, -1);
    cattail(img, 6, 14, 7);
    cattail(img, 9, 14, 10);
    reedBlade(img, 11, 14, 8, 1);
    cattail(img, 13, 14, 6);
    reedBlade(img, 8, 14, 4, 1);
  }
  for (const x of [4, 7, 9, 11]) img.set(x, 14, REED[1]);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildExpansionLand(frames) {
  for (let v = 0; v < 4; v += 1) {
    frames.set(`terrain/highland_grass_v${v}`, highlandTile(v));
    frames.set(`terrain/marsh_grass_v${v}`, marshTile(v));
    frames.set(`terrain/ruin_floor_v${v}`, flagstoneTile(v));
  }
  frames.set('object/plank', plankTile());
  for (let v = 0; v < 2; v += 1) {
    frames.set(`decal/heather_${v}`, heather(v));
    frames.set(`decal/reeds_${v}`, reeds(v));
  }
}

void INK_WARM;
void PAL;
void lit;
void shade;
