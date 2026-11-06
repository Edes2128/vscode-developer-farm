// Phase 7 standing objects: the birches, the standing stone, the ruin pieces (wall, pillar, arch), the cairn and the
// copper sprinkler. (The stilted lodge is in expansion_lodge.mjs.)
//
// Frame names (the contract with src/data/objects.ts):
//   object/birch_{a,b}      48 x 56   one solid cell, anchor pixel (16, 40): a slender white-barked tree, trunk down to row 55
//   object/standing_stone   16 x 32   one solid cell, anchor (0, 16): a leaning grey monolith with a lichen patch
//   object/ruin_wall        32 x 24   two solid cells, anchor (0, 8): a broken mossy wall, stone down to row 23
//   object/ruin_pillar      16 x 40   one solid cell, anchor (0, 24): a snapped column on its plinth, stone down to row 39
//   object/ruin_arch        48 x 40   solid, OPEN, solid; anchor (0, 24): the middle column (x 16..31) is clear from y 16 down
//   object/cairn            16 x 16   one solid cell: three stones, outlined all round like object/rock_*
//   object/sprinkler        16 x 24   one solid cell, anchor (0, 8): a copper rotary head on a wooden post, post down to row 23
//
// Lit from the top left, 1px dark outline on the sides and top. Standing pieces run on to the last row of their sprite
// with no outline there (like the oaks and the cottages); the cairn, like the rocks, has its own outlined foot.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { INK_WARM, line } from './draw5.mjs';
import { LEAF, paintBalls, STONE } from './objects.mjs';

const INK = PAL.ink;

// ------------------------------------------------------------------------------------------ birch

const BIRCH_LEAF = ramp(mix(BRAND.sageGreen, BRAND.wheatGold, 0.22), 5, { dark: 0.6, light: 0.28 });
const BIRCH_BARK = ramp([240, 236, 224], 5, { dark: 0.5, light: 0.1 });
const BARK_MARK = [64, 58, 62];

/** A slender white trunk: lit on the left, grey on the right, with dark horizontal scars, flaring a little at the root. */
function birchTrunk(img, cx, top, bottom, seed) {
  const r = rng(seed);
  for (let y = top; y <= bottom; y += 1) {
    const flare = y > bottom - 3 ? 1 : 0;
    const hw = 2 + flare;
    for (let x = cx - hw; x < cx + hw; x += 1) {
      const rel = (x - (cx - hw)) / (hw * 2);
      img.set(x, y, rel < 0.26 ? BIRCH_BARK[4] : rel < 0.55 ? BIRCH_BARK[3] : rel < 0.8 ? BIRCH_BARK[2] : BIRCH_BARK[1]);
    }
  }
  // the dark horizontal scars birch bark is known for
  let y = top + 2;
  while (y < bottom - 1) {
    const x0 = cx - 2 + r.int(0, 1);
    const len = r.int(2, 3);
    for (let k = 0; k < len; k += 1) img.set(x0 + k, y, k === 0 ? BARK_MARK : BIRCH_BARK[0]);
    if (r() < 0.5) img.set(x0 + len - 1, y + 1, BIRCH_BARK[0]);
    y += r.int(3, 4);
  }
  // the root: darker, a little earth in it
  for (let x = cx - 3; x < cx + 3; x += 1) img.set(x, bottom, x < cx - 1 ? BIRCH_BARK[2] : x < cx + 1 ? BIRCH_BARK[1] : BIRCH_BARK[0]);
  img.set(cx - 2, bottom - 1, BIRCH_BARK[2]);
}

function birch(seed, balls, twigs) {
  const img = new Img(48, 56);
  birchTrunk(img, 24, 32, 55, seed);
  // thin pale limbs reaching into the crown
  line(img, 23, 38, 17, 29, BIRCH_BARK[2]);
  line(img, 25, 37, 31, 29, BIRCH_BARK[1]);
  line(img, 24, 36, 24, 30, BIRCH_BARK[2]);
  paintBalls(img, balls, BIRCH_LEAF, seed);
  // small separate leaf clusters hanging at the lower edge: the birch's light, weeping look
  paintBalls(img, twigs, BIRCH_LEAF, seed + 7);
  img.outline(INK);
  return img;
}

const BIRCH_A_BALLS = [
  { x: 24, y: 7, r: 5, tone: 0.24 },
  { x: 17, y: 11, r: 5, tone: 0.16 },
  { x: 31, y: 11, r: 5, tone: 0.14 },
  { x: 24, y: 14, r: 6, tone: 0.1 },
  { x: 12, y: 17, r: 5, tone: 0.04 },
  { x: 36, y: 17, r: 5, tone: 0.02 },
  { x: 19, y: 19, r: 6, tone: 0.02 },
  { x: 29, y: 20, r: 6, tone: -0.02 },
  { x: 24, y: 24, r: 6, tone: -0.04 },
  { x: 14, y: 25, r: 4, tone: -0.08 },
  { x: 34, y: 26, r: 4, tone: -0.1 },
  { x: 21, y: 29, r: 4, tone: -0.12 },
  { x: 28, y: 30, r: 4, tone: -0.14 },
];
const BIRCH_A_TWIGS = [
  { x: 9, y: 24, r: 2.6, tone: -0.1 },
  { x: 39, y: 24, r: 2.6, tone: -0.12 },
  { x: 16, y: 32, r: 2.4, tone: -0.16 },
  { x: 33, y: 32, r: 2.4, tone: -0.18 },
];
const BIRCH_B_BALLS = [
  { x: 22, y: 6, r: 5, tone: 0.24 },
  { x: 29, y: 10, r: 5, tone: 0.16 },
  { x: 15, y: 11, r: 5, tone: 0.14 },
  { x: 23, y: 13, r: 6, tone: 0.08 },
  { x: 36, y: 15, r: 5, tone: 0.04 },
  { x: 10, y: 19, r: 4, tone: 0.02 },
  { x: 17, y: 20, r: 6, tone: 0 },
  { x: 30, y: 20, r: 6, tone: -0.02 },
  { x: 24, y: 24, r: 6, tone: -0.05 },
  { x: 37, y: 24, r: 4, tone: -0.1 },
  { x: 14, y: 27, r: 4, tone: -0.1 },
  { x: 22, y: 30, r: 4, tone: -0.12 },
  { x: 30, y: 29, r: 4, tone: -0.14 },
];
const BIRCH_B_TWIGS = [
  { x: 8, y: 25, r: 2.4, tone: -0.1 },
  { x: 41, y: 20, r: 2.6, tone: -0.1 },
  { x: 18, y: 33, r: 2.4, tone: -0.16 },
  { x: 36, y: 30, r: 2.4, tone: -0.18 },
];

// ------------------------------------------------------------------------------------------ cut stone (ruins)

const JOINT = mix(STONE[0], [28, 34, 30], 0.35);
const LICHEN = ramp([172, 176, 112], 5, { dark: 0.5, light: 0.3 });

/**
 * Paints dressed stone into every pixel of `inside(x, y)`: courses of blocks counted up from `bottomY`, a dark mortar
 * line under each course and between blocks, a lit top and left edge to each block, and a lit rim where the stone's own
 * silhouette turns away from the light. The bottom course carries no mortar line on its last row, so a wall stands
 * firmly on the ground.
 */
function paintBlocks(img, inside, { x0, x1, y0, bottomY, courseH, seed, widths = [8, 11, 9, 12] }) {
  const blockAt = (course, x) => {
    // Block boundaries of a course: cumulative widths from a per-course offset, wrapping the width list.
    const off = Math.floor(hash2(course, 5, seed) * 9);
    let bx = x0 - off;
    let k = Math.floor(hash2(course, 9, seed) * widths.length);
    for (;;) {
      const w = widths[k % widths.length];
      if (x < bx + w) return { start: bx, end: bx + w - 1, id: k };
      bx += w;
      k += 1;
    }
  };
  for (let y = y0; y <= bottomY; y += 1) {
    const course = Math.floor((bottomY - y) / courseH);
    const cy = (bottomY - y) % courseH; // 0 = the last row of the course
    for (let x = x0; x <= x1; x += 1) {
      if (!inside(x, y)) continue;
      const blk = blockAt(course, x);
      const toneBase = [2, 3, 2, 1, 2][Math.floor(hash2(blk.id + blk.start, course, seed + 3) * 5)];
      let c;
      if (x === blk.end) c = JOINT;
      else if (cy === 0 && y !== bottomY) c = JOINT;
      else {
        let t = toneBase;
        if (cy === courseH - 1) t += 1;
        else if (x === blk.start + 1 || x === blk.start) t += 1;
        else if (cy === 1) t -= 1;
        else if (x === blk.end - 1) t -= 1;
        const n = hash2(x, y, seed);
        if (n < 0.08) t -= 1;
        else if (n > 0.94) t += 1;
        c = STONE[Math.max(0, Math.min(4, t))];
      }
      img.set(x, y, c);
    }
  }
  // the silhouette's own rim: a lit upper and left edge, a shaded lower and right edge
  const marks = [];
  for (let y = y0; y <= bottomY; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) marks.push([x, y, STONE[4]]);
      else if (!inside(x - 1, y)) marks.push([x, y, STONE[3]]);
      else if (!inside(x + 1, y)) marks.push([x, y, STONE[1]]);
    }
  }
  for (const [x, y, c] of marks) img.set(x, y, c);
}

/** Moss on the top surfaces and in the joints of whatever stone is in `inside`, with a few drips down the face. */
function mossOver(img, inside, { x0, x1, y0, y1, seed, amount = 1 }) {
  const jointSame = (c) => c[0] === JOINT[0] && c[1] === JOINT[1] && c[2] === JOINT[2];
  const marks = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!inside(x, y)) continue;
      const n = hash2(x, y, seed + 11);
      const top = !inside(x, y - 1);
      if (top && n < 0.62 * amount) {
        marks.push([x, y, n < 0.3 ? LEAF[3] : LEAF[2]]);
        if (hash2(x, y, seed + 17) < 0.3 * amount && inside(x, y + 1)) marks.push([x, y + 1, LEAF[1]]);
        if (hash2(x, y, seed + 23) < 0.12 * amount) {
          for (let k = 1; k <= 3; k += 1) if (inside(x, y + k)) marks.push([x, y + k, k === 3 ? LEAF[1] : LEAF[2]]);
        }
      } else if (!top && jointSame(img.colorAt(x, y)) && n < 0.4 * amount) {
        marks.push([x, y, n < 0.2 ? LEAF[1] : LEAF[2]]);
      } else if (!top && inside(x, y - 1) && jointSame(img.colorAt(x, y - 1)) && n < 0.1 * amount) {
        marks.push([x, y, LEAF[2]]);
      }
    }
  }
  for (const [x, y, c] of marks) img.set(x, y, c);
}

// ------------------------------------------------------------------------------------------ standing stone

function standingStone() {
  const img = new Img(16, 32);
  const TOP = 3;
  const BASE = 31;
  const center = (y) => 7.6 + ((BASE - y) / (BASE - TOP)) * 3.2; // leaning to the right as it climbs
  const half = (y) => 5.3 - ((BASE - y) / (BASE - TOP)) * 1.5;
  const edgeL = (y) => Math.round(center(y) - half(y));
  const edgeR = (y) => Math.round(center(y) + half(y));
  // chipped, rounded crown
  const crown = (y) => (y === TOP ? 2 : y === TOP + 1 ? 1 : y === TOP + 2 ? 0.5 : 0);
  for (let y = TOP; y <= BASE; y += 1) {
    const l = edgeL(y) + Math.round(crown(y));
    const r = edgeR(y) - Math.round(crown(y) * 1.6);
    for (let x = l; x < r; x += 1) {
      const rel = (x - l) / Math.max(1, r - l);
      let t = rel < 0.2 ? 3 : rel < 0.5 ? 2 : rel < 0.78 ? 1 : 0;
      if (rel < 0.2 && y > 22) t = 2;
      const n = hash2(x, y, 8101);
      if (n < 0.1) t = Math.max(0, t - 1);
      else if (n > 0.92) t = Math.min(4, t + 1);
      img.set(x, y, STONE[t]);
    }
    // a lit top edge on the crown
    if (y === TOP + 1) for (let x = l; x < r - 1; x += 1) img.set(x, y, STONE[4]);
  }
  // cracks: two fine dark lines running down the face
  for (const [x, y, len] of [[8, 7, 6], [10, 15, 7]]) {
    for (let k = 0; k < len; k += 1) {
      const px = x + (k % 3 === 2 ? 1 : 0) + Math.floor(k / 4);
      if (img.alphaAt(px, y + k) > 0) img.set(px, y + k, STONE[0]);
    }
  }
  // a chip taken out of the right shoulder
  img.set(edgeR(TOP + 4) - 1, TOP + 4, STONE[1]);
  // the lichen patch: a muted yellow-green crust, thick on the lit side and breaking into flecks at its edge
  for (let y = 11; y <= 21; y += 1) {
    for (let x = 3; x <= 12; x += 1) {
      if (img.alphaAt(x, y) === 0) continue;
      const dx = (x - 6.0) / 3.6;
      const dy = (y - 15.8) / 4.6;
      const n = hash2(x, y, 8102);
      const d = dx * dx + dy * dy + (n - 0.5) * 0.9;
      if (d < 0.55) img.set(x, y, n < 0.35 ? LICHEN[3] : n < 0.8 ? LICHEN[2] : LICHEN[1]);
      else if (d < 1.0 && n < 0.45) img.set(x, y, n < 0.2 ? LICHEN[1] : LICHEN[2]);
    }
  }
  for (const [x, y] of [[5, 14], [7, 16], [6, 18]]) if (img.alphaAt(x, y) > 0) img.set(x, y, LICHEN[4]);
  // grass-green moss round the foot
  for (let x = edgeL(BASE); x < edgeR(BASE); x += 1) {
    const n = hash2(x, 7, 8104);
    if (n < 0.65) img.set(x, BASE, n < 0.3 ? LEAF[1] : LEAF[2]);
    if (n < 0.35) img.set(x, BASE - 1, LEAF[2]);
    if (n < 0.15) img.set(x, BASE - 2, LEAF[3]);
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ ruin wall

function ruinWall() {
  const img = new Img(32, 24);
  // the top of the wall, per column: a tall stub on the left, a tooth-gap, a lower run and a second broken tooth
  const tops = [
    24, 8, 6, 4, 3, 3, 2, 2, 3, 3, 5, 6, 9, 9, 10, 12, 11, 10, 10, 11, 12, 11, 9, 8, 7, 6, 6, 7, 8, 9, 11, 24,
  ];
  const inside = (x, y) => x >= 1 && x <= 30 && y >= tops[x] && y <= 23;
  paintBlocks(img, inside, { x0: 1, x1: 30, y0: 2, bottomY: 23, courseH: 5, seed: 8201, widths: [10, 8, 12, 9] });
  mossOver(img, inside, { x0: 1, x1: 30, y0: 2, y1: 23, seed: 8201, amount: 1 });
  // a notch knocked out of a joint and a fallen pebble at the foot
  for (const [x, y] of [[14, 15], [15, 15], [14, 16]]) img.set(x, y, STONE[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ ruin pillar

function ruinPillar() {
  const img = new Img(16, 40);
  // plinth: a wider base, two steps
  const plinth = (x, y) => (y >= 35 && x >= 2 && x <= 13) || (y >= 31 && y < 35 && x >= 3 && x <= 12);
  // shaft: a column 8 wide from the plinth up to a jagged break
  const breakTop = [0, 0, 0, 0, 10, 10, 11, 12, 12, 13, 15, 15, 0, 0, 0, 0];
  const shaft = (x, y) => x >= 4 && x <= 11 && y >= breakTop[x] && y < 31;
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (plinth(x, y)) {
        const rel = (x - 2) / 12;
        let t = y < 33 ? 3 : y < 35 ? 2 : 2;
        t = rel < 0.2 ? t + 1 : rel > 0.78 ? t - 1 : t;
        if (y === 31 || y === 35) t = 4;
        else if (y === 34) t = 1;
        else if (y === 39) t = 1;
        const n = hash2(x, y, 8301);
        if (n < 0.1) t -= 1;
        img.set(x, y, STONE[Math.max(0, Math.min(4, t))]);
      } else if (shaft(x, y)) {
        const rel = (x - 4) / 8;
        // a turned shaft lit from the left, with two flutes
        let t = rel < 0.15 ? 4 : rel < 0.42 ? 3 : rel < 0.68 ? 2 : rel < 0.9 ? 1 : 0;
        if (x === 6 || x === 9) t = Math.max(0, t - 1);
        const n = hash2(x, y, 8302);
        if (n < 0.08) t = Math.max(0, t - 1);
        else if (n > 0.95) t = Math.min(4, t + 1);
        img.set(x, y, STONE[t]);
      }
    }
  }
  // drum joints where the column's pieces meet
  for (const y of [24, 29]) {
    for (let x = 4; x <= 11; x += 1) if (shaft(x, y)) img.set(x, y, JOINT);
    for (let x = 4; x <= 11; x += 1) if (shaft(x, y + 1)) img.set(x, y + 1, STONE[x < 7 ? 3 : 2]);
  }
  // the fresh fracture: a pale slanted face along the break
  for (let x = 4; x <= 11; x += 1) {
    if (!shaft(x, breakTop[x])) continue;
    img.set(x, breakTop[x], STONE[4]);
    if (hash2(x, 3, 8303) < 0.6) img.set(x, breakTop[x] + 1, STONE[3]);
  }
  const inside = (x, y) => plinth(x, y) || shaft(x, y);
  mossOver(img, (x, y) => plinth(x, y) || (shaft(x, y) && y > 22), { x0: 0, x1: 15, y0: 0, y1: 39, seed: 8304, amount: 1.1 });
  // moss clinging to the lower shaft, and a trailing vine
  for (let y = 24; y < 31; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      if (!shaft(x, y)) continue;
      const n = hash2(x, y, 8305);
      if (n < 0.2 * ((y - 22) / 9)) img.set(x, y, n < 0.08 ? LEAF[1] : LEAF[2]);
    }
  }
  for (let k = 0; k < 10; k += 1) {
    const x = 11 - (k % 4 === 3 ? 1 : 0);
    if (shaft(x, 18 + k)) img.set(x, 18 + k, k % 3 === 0 ? LEAF[3] : LEAF[2]);
  }
  void inside;
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ ruin arch

function ruinArch() {
  const img = new Img(48, 40);
  // geometry: the opening is a half circle of radius 8 over x 16..31 centred on (24, 16); below y = 16 the middle
  // column (x 16..31) holds nothing at all, and the piers stand clear of it with their outline beside it.
  const CX = 24;
  const CY = 16;
  const inOpening = (x, y) => (x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2 <= 64;
  // the ring of voussoirs, radius 8 to 13, whole from pier to pier
  const ring = (x, y) => {
    if (y > 15) return false;
    const d2 = (x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2;
    return d2 > 64 && d2 <= 169 && x >= 11 && x <= 37;
  };
  // the left pier climbs past the springing to a broken capital; the right pier is lower, its top corner knocked off
  const leftTop = [0, 0, 9, 6, 4, 4, 3, 4, 4, 5, 6, 7, 9, 10, 11];
  const leftStone = (x, y) => x >= 2 && x <= 14 && y >= leftTop[x] && y < 40;
  const rightTop = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 10, 9, 9, 9, 10, 11, 13, 14, 16, 18, 20, 22];
  const rightStone = (x, y) => x >= 33 && x <= 45 && y >= rightTop[x] && y < 40;
  const anyStone = (x, y) => (leftStone(x, y) || rightStone(x, y) || ring(x, y)) && !(x >= 16 && x <= 31 && y >= 16) && !inOpening(x, y);

  paintBlocks(img, anyStone, { x0: 1, x1: 46, y0: 3, bottomY: 39, courseH: 6, seed: 8401, widths: [9, 12, 8, 11] });
  // voussoir joints on the ring: radial dark lines every 15 degrees
  for (let y = 0; y <= 16; y += 1) {
    for (let x = 8; x <= 40; x += 1) {
      if (!ring(x, y)) continue;
      const angle = Math.atan2(CY - (y + 0.5), x + 0.5 - CX);
      const slot = (angle * 180) / Math.PI / 17;
      const frac = slot - Math.floor(slot);
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
      const arc = (frac * 17 * Math.PI * d) / 180;
      let c = STONE[2];
      if (arc < 1) c = JOINT;
      else if (d < 9.3) c = STONE[1];
      else if (d > 12) c = x < CX ? STONE[4] : STONE[3];
      else if (arc < 2.2 || x < 16) c = STONE[3];
      const n = hash2(x, y, 8402);
      if (n < 0.1 && arc >= 1) c = STONE[Math.max(0, STONE.indexOf(c) - 1)] ?? c;
      img.set(x, y, c);
    }
  }
  // a keystone at the crown, a shade lighter than the rest of the ring
  for (let x = 22; x <= 25; x += 1) {
    for (let y = 2; y <= 8; y += 1) {
      if (ring(x, y)) img.set(x, y, x === 22 ? STONE[4] : x === 25 ? STONE[2] : STONE[3]);
    }
  }
  for (let y = 2; y <= 8; y += 1) {
    if (ring(21, y)) img.set(21, y, JOINT);
    if (ring(26, y)) img.set(26, y, JOINT);
  }
  mossOver(img, anyStone, { x0: 1, x1: 46, y0: 3, y1: 39, seed: 8403, amount: 1.1 });
  // ivy: a rope of leaves hanging from the ring over the left pier's face and a short one on the right
  const ivy = (x, y, len) => {
    for (let k = 0; k < len; k += 1) {
      const px = x + (k % 4 === 3 ? 1 : 0);
      if (anyStone(px, y + k)) img.set(px, y + k, k % 3 === 1 ? LEAF[3] : LEAF[2]);
      if (k % 3 === 0 && anyStone(px + 1, y + k)) img.set(px + 1, y + k, LEAF[1]);
    }
  };
  ivy(12, 12, 14);
  ivy(6, 14, 9);
  ivy(41, 18, 9);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ cairn

function cairnStone(img, cx, cy, rx, ry, seed, tint = 0, crescent = true) {
  // a dark crescent just under the stone, so it reads as sitting on the one below
  if (crescent) img.ellipse(cx + 0.2, cy + 1, rx + 0.4, ry + 0.2, STONE[0]);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const wob = 1 + (hash2(x, y, seed) - 0.5) * 0.16;
      if (dx * dx + dy * dy > wob) continue;
      let lit = -0.62 * dx - 0.9 * dy + 0.35 + tint + (hash2(x, y, seed + 1) - 0.5) * 0.18;
      lit += dy > 0.55 ? -0.3 : 0;
      const t = lit > 0.62 ? 4 : lit > 0.28 ? 3 : lit > -0.05 ? 2 : lit > -0.4 ? 1 : 0;
      img.set(x, y, STONE[t]);
    }
  }
}

function cairn() {
  const img = new Img(16, 16);
  cairnStone(img, 8, 11.6, 6.2, 2.7, 8501, -0.08);
  cairnStone(img, 8.6, 8, 4.4, 2.3, 8502, 0.02);
  cairnStone(img, 7.8, 5.2, 2.8, 1.8, 8503, 0.12);
  // a pebble perched on top, and a little moss in the lowest crack
  img.set(8, 2, STONE[3]);
  img.set(9, 2, STONE[2]);
  img.set(8, 3, STONE[2]);
  for (const x of [4, 5, 11]) img.set(x, 12, LEAF[2]);
  img.set(5, 11, LEAF[3]);
  img.outline(INK);
  return img;
}

// ------------------------------------------------------------------------------------------ sprinkler

const COPPER = ramp([224, 122, 56], 5, { dark: 0.45, light: 0.4 });
const PATINA = ramp([96, 164, 142], 5, { dark: 0.45, light: 0.35 });
const DROP = ramp([108, 176, 232], 5, { dark: 0.5, light: 0.42 });

function sprinkler() {
  const img = new Img(16, 24);
  const bark = PAL.bark;
  // the post, down to the last row, with a copper cap ring where the pipe goes in
  img.fillRect(6, 13, 4, 11, bark[2]);
  img.vline(6, 13, 11, bark[3]);
  img.vline(9, 13, 11, bark[1]);
  img.vline(7, 18, 3, bark[3]);
  img.vline(8, 21, 2, bark[1]);
  img.fillRect(5, 12, 6, 2, COPPER[2]);
  img.hline(5, 12, 6, COPPER[4]);
  img.hline(5, 13, 6, COPPER[1]);
  img.set(10, 12, COPPER[1]);
  // the riser pipe
  img.fillRect(7, 8, 2, 4, COPPER[2]);
  img.vline(7, 8, 4, COPPER[3]);
  img.vline(8, 9, 3, COPPER[1]);
  // a brass collar, then the rose: a little copper dome, lit from the top left
  img.fillRect(5, 7, 6, 1, PATINA[2]);
  img.hline(5, 7, 3, PATINA[4]);
  for (let y = 3; y < 7; y += 1) {
    const half = [2, 3, 4, 4][y - 3];
    for (let x = 8 - half; x < 8 + half; x += 1) {
      const rel = (x - (8 - half)) / (half * 2);
      let c = rel < 0.28 ? COPPER[4] : rel < 0.6 ? COPPER[3] : rel < 0.85 ? COPPER[2] : COPPER[1];
      if (y === 6) c = COPPER[Math.max(0, [4, 3, 2, 1].indexOf(c) === -1 ? 1 : 1)];
      img.set(x, y, c);
    }
  }
  // the little holes in the rose
  for (const x of [6, 8, 10]) img.set(x, 4, COPPER[0]);
  img.outline(INK_WARM);
  // the spray: two arcs of drops flung up and out of the rose, over clear pixels only
  const drop = (x, y, c) => {
    if (img.alphaAt(x, y) === 0) img.set(x, y, DROP[c]);
  };
  for (const [dx, y, c] of [[3, 1, 3], [4, 0, 4], [5, 0, 3], [6, 1, 3], [7, 3, 2], [8, 5, 2], [7, 6, 1]]) {
    drop(8 - dx - 1, y, c);
    drop(8 + dx, y, c);
  }
  drop(7, 0, 4);
  drop(8, 0, 4);
  drop(6, 1, 3);
  drop(9, 1, 3);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildExpansionThings(frames) {
  frames.set('object/birch_a', birch(8001, BIRCH_A_BALLS, BIRCH_A_TWIGS));
  frames.set('object/birch_b', birch(8011, BIRCH_B_BALLS, BIRCH_B_TWIGS));
  frames.set('object/standing_stone', standingStone());
  frames.set('object/ruin_wall', ruinWall());
  frames.set('object/ruin_pillar', ruinPillar());
  frames.set('object/ruin_arch', ruinArch());
  frames.set('object/cairn', cairn());
  frames.set('object/sprinkler', sprinkler());
}

export { BIRCH_BARK, COPPER, DERIVED, INK, PATINA };
