// Phase 7 items and the moonbloom crop.
//
// Frame names (the contract with src/data/items.ts and src/data/crops.ts):
//   item/sprinkler, item/fertilizer, item/seeds_moonbloom, item/moonbloom
//   item/heron_feather, item/kingfisher_feather, item/moth_dust, item/hare_fur, item/owl_feather, item/stag_antler
//   crop/moonbloom_{0,1,2,3}     seed, sprout, bud, ripe (a pale flower that glows blue-white); feet at row 14
//
// 16 x 16 each, outlined like the other item/* and crop/* frames, lit from the top left.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { halo, line } from './draw5.mjs';
import { LEAF } from './objects.mjs';

const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;

const COPPER = ramp([224, 122, 56], 5, { dark: 0.45, light: 0.4 });
const PATINA = ramp([96, 164, 142], 5, { dark: 0.45, light: 0.35 });
const DROP = ramp([108, 176, 232], 5, { dark: 0.5, light: 0.42 });
/** The moonbloom's petals: a pale blue that is nearly white where the light catches it. */
export const MOON = ramp([196, 222, 255], 5, { dark: 0.5, light: 0.14 });
/** Leaves of the night flower: a cool blue-green. */
const LEAFB = ramp([104, 156, 146], 5, { dark: 0.55, light: 0.4 });
const MOON_CORE = [255, 246, 196];
const EARTH_SACK = ramp([128, 94, 62], 5, { dark: 0.5, light: 0.32 });
const LINEN = ramp([226, 214, 186], 5, { dark: 0.4, light: 0.12 });
const BONE = ramp([238, 228, 202], 5, { dark: 0.48, light: 0.1 });
const FUR = ramp([232, 234, 240], 5, { dark: 0.44, light: 0.08 });

// ------------------------------------------------------------------------------------------ items: tools and supplies

function sprinklerIcon() {
  const img = new Img(16, 16);
  // a short post and a copper pipe up into a little rose, with a few drops flung off it
  img.fillRect(6, 11, 4, 4, PAL.bark[2]);
  img.vline(6, 11, 4, PAL.bark[3]);
  img.vline(9, 11, 4, PAL.bark[1]);
  img.fillRect(5, 10, 6, 1, COPPER[2]);
  img.hline(5, 10, 6, COPPER[3]);
  img.fillRect(7, 7, 2, 3, COPPER[2]);
  img.vline(7, 7, 3, COPPER[3]);
  img.hline(5, 6, 6, PATINA[2]);
  img.hline(5, 6, 2, PATINA[4]);
  for (let y = 3; y < 6; y += 1) {
    const half = [2, 3, 4][y - 3];
    for (let x = 8 - half; x < 8 + half; x += 1) {
      const rel = (x - (8 - half)) / (half * 2);
      img.set(x, y, rel < 0.3 ? COPPER[4] : rel < 0.62 ? COPPER[3] : rel < 0.85 ? COPPER[2] : COPPER[1]);
    }
  }
  img.set(6, 4, COPPER[0]);
  img.set(8, 4, COPPER[0]);
  img.set(10, 4, COPPER[0]);
  img.outline(INK_WARM);
  const drop = (x, y, c) => {
    if (img.alphaAt(x, y) === 0) img.set(x, y, DROP[c]);
  };
  for (const [x, y, c] of [[2, 3, 3], [1, 5, 2], [3, 1, 4], [13, 3, 3], [14, 5, 2], [12, 1, 4], [7, 1, 3], [8, 0, 4]]) drop(x, y, c);
  return img;
}

function fertilizerIcon() {
  const img = new Img(16, 16);
  // a lumpy sack of dark compost, tied at the neck, with a cream label and a green leaf on it
  img.fillRect(4, 6, 8, 8, EARTH_SACK[2]);
  img.fillRect(3, 8, 10, 6, EARTH_SACK[2]);
  img.hline(4, 6, 8, EARTH_SACK[3]);
  img.vline(3, 8, 6, EARTH_SACK[3]);
  img.vline(12, 8, 6, EARTH_SACK[1]);
  img.hline(3, 13, 10, EARTH_SACK[0]);
  img.vline(11, 7, 1, EARTH_SACK[1]);
  // gathered neck with a cord, and a spill of crumbly compost out of the top
  img.fillRect(6, 4, 4, 2, EARTH_SACK[1]);
  img.hline(5, 6, 6, PAL.berry[0]);
  img.set(5, 5, EARTH_SACK[3]);
  img.set(10, 5, EARTH_SACK[2]);
  for (const [x, y] of [[6, 3], [7, 2], [8, 3], [9, 2], [9, 3]]) img.set(x, y, [74, 54, 40]);
  img.set(7, 2, [104, 78, 54]);
  // label
  img.fillRect(5, 8, 6, 5, LINEN[3]);
  img.hline(5, 8, 6, LINEN[4]);
  img.hline(5, 12, 6, LINEN[1]);
  img.vline(10, 9, 3, LINEN[2]);
  // the leaf mark: a stem and two green leaves
  img.vline(8, 10, 2, LEAF[1]);
  img.set(7, 10, LEAF[3]);
  img.set(7, 9, LEAF[2]);
  img.set(9, 10, LEAF[3]);
  img.set(9, 9, LEAF[2]);
  img.set(8, 9, LEAF[3]);
  img.outline(INK_WARM);
  return img;
}

/** The seed packets: same card as farming.mjs (cream, a coloured header, a little plant), so the shelf reads as a set. */
function seedPacket(accent, bloom) {
  const img = new Img(16, 16);
  img.fillRect(3, 3, 10, 11, PAL.white[2]);
  img.hline(3, 3, 10, PAL.parchment[1]);
  img.fillRect(3, 3, 10, 2, accent[1]);
  img.hline(3, 5, 10, accent[0]);
  img.vline(12, 6, 8, PAL.parchment[0]);
  img.hline(3, 13, 10, PAL.parchment[0]);
  // the little plant: a stem, two leaves and a pale bloom with a glint
  img.vline(8, 10, 3, LEAF[1]);
  img.set(7, 9, LEAF[3]);
  img.set(9, 9, LEAF[3]);
  img.ellipse(8, 8, 1.5, 1.4, bloom[2]);
  img.set(7, 7, MOON[4]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ items: the flower

/** Paints one petal as a shaded ellipse. */
function petal(img, cx, cy, rx, ry, tone) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const lit = -0.6 * dx - 0.7 * dy + tone;
      img.set(x, y, MOON[lit > 0.55 ? 4 : lit > 0.1 ? 3 : lit > -0.45 ? 2 : 1]);
    }
  }
}

/** The open flower, centred on (cx, cy): six overlapping petals round a warm white core. */
function bloom(img, cx, cy, radius, petalR) {
  const angles = [-90, -30, 30, 90, 150, 210];
  // back petals first (the ones pointing up), front petals last
  const order = [...angles.keys()].sort((a, b) => Math.sin((angles[a] * Math.PI) / 180) - Math.sin((angles[b] * Math.PI) / 180));
  for (const i of order) {
    const a = (angles[i] * Math.PI) / 180;
    petal(img, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.92, petalR, petalR * 0.95, i === 0 || i === 5 ? 0.18 : i === 3 ? -0.2 : 0);
  }
  img.ellipse(cx, cy, 1.7, 1.6, MOON_CORE);
  img.set(Math.round(cx - 1), Math.round(cy - 1), [255, 255, 240]);
  img.set(Math.round(cx + 1), Math.round(cy + 1), [236, 206, 120]);
}

function moonbloomItem() {
  const img = new Img(16, 16);
  // short stem and two cool leaves under the flower
  img.vline(8, 10, 5, LEAFB[1]);
  img.vline(7, 11, 2, LEAFB[2]);
  for (const [x, y] of [[5, 12], [6, 12], [4, 11], [5, 11]]) img.set(x, y, LEAFB[y === 12 ? 2 : 3]);
  for (const [x, y] of [[10, 13], [11, 13], [12, 12], [11, 12]]) img.set(x, y, LEAFB[y === 13 ? 2 : 3]);
  bloom(img, 8, 6, 3.3, 2.3);
  img.outline(INK);
  return img;
}

// ------------------------------------------------------------------------------------------ items: feathers

/**
 * A feather lying along the line from `p0` (the quill) to `p1` (the tip). `halfWidth` is the vane's widest half-width,
 * `colors` its ramp, `tipColor` the colour of the last stretch and `bars` how many pale bands cross it.
 */
function feather(img, p0, p1, { halfWidth, colors, tipColor, quillColor, barColor = null, bars = 0, edge = null, quill = 0.18 }) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const px = x + 0.5 - p0[0];
      const py = y + 0.5 - p0[1];
      const u = (px * ux + py * uy) / len; // 0 at the quill, 1 at the tip
      const v = -px * uy + py * ux; // across the vane; negative towards the upper left (the lit side)
      if (u < -0.02 || u > 1.02) continue;
      const along = Math.max(0, (u - quill) / (1 - quill));
      const hw = u < quill ? 0 : halfWidth * Math.pow(Math.sin(Math.PI * Math.min(1, along * 0.92 + 0.04)), 0.62);
      if (Math.abs(v) < 0.62) {
        img.set(x, y, u < quill + 0.1 ? quillColor : v < 0 ? colors[4] : colors[3]);
      } else if (Math.abs(v) <= hw) {
        let t = v < 0 ? 3 : 2;
        // diagonal barbs: a faint striping along the vane
        if (Math.floor(u * 15 + Math.abs(v) * 0.8) % 2 === 0) t -= 1;
        if (Math.abs(v) > hw - 0.9) t = v < 0 ? t : t - 1;
        let c = colors[Math.max(0, Math.min(4, t))];
        if (u > 0.82) c = tipColor;
        if (barColor && bars > 0 && Math.floor(u * bars * 2) % 2 === 0 && u > 0.2 && u < 0.95) c = barColor;
        if (edge && Math.abs(v) > hw - 0.9 && u > 0.25) c = edge;
        img.set(x, y, c);
      }
    }
  }
}

function heronFeather() {
  const img = new Img(16, 16);
  const SLATE = ramp([126, 148, 176], 5, { dark: 0.5, light: 0.28 });
  feather(img, [2.2, 14], [13.8, 2], {
    halfWidth: 2.3,
    colors: SLATE,
    tipColor: [52, 62, 84],
    quillColor: [214, 218, 224],
  });
  img.outline(INK);
  return img;
}

function kingfisherFeather() {
  const img = new Img(16, 16);
  const BLUE = ramp([36, 164, 220], 5, { dark: 0.5, light: 0.4 });
  feather(img, [3.2, 13.6], [12.6, 3.4], {
    halfWidth: 3.0,
    colors: BLUE,
    tipColor: BLUE[4],
    quillColor: [240, 214, 168],
    edge: null,
    quill: 0.14,
  });
  // a fleck of the bird's orange breast at the base of the vane
  for (const [x, y] of [[5, 11], [4, 12]]) if (img.alphaAt(x, y) > 0) img.set(x, y, [236, 128, 52]);
  img.outline(INK);
  return img;
}

function owlFeather() {
  const img = new Img(16, 16);
  const BROWN = ramp([150, 104, 66], 5, { dark: 0.5, light: 0.3 });
  feather(img, [12.6, 14], [3.2, 2.2], {
    halfWidth: 3.5,
    colors: BROWN,
    tipColor: BROWN[1],
    quillColor: [232, 214, 178],
    barColor: [232, 206, 160],
    bars: 3,
    edge: [226, 200, 154],
    quill: 0.2,
  });
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ items: dust, fur, antler

function mothDust() {
  const img = new Img(16, 16);
  // a little linen pouch, drawn tight at the neck with a cord
  img.ellipse(8, 11, 4.8, 3.6, LINEN[2]);
  img.ellipse(7, 10, 2.8, 2, LINEN[3]);
  img.hline(5, 14, 7, LINEN[1]);
  img.vline(12, 10, 3, LINEN[1]);
  img.fillRect(6, 7, 4, 3, LINEN[2]);
  img.vline(6, 7, 3, LINEN[3]);
  img.hline(5, 8, 6, PAL.clay[1]);
  img.set(10, 8, PAL.clay[2]);
  img.set(11, 9, PAL.clay[1]);
  img.set(5, 9, PAL.clay[2]);
  img.set(6, 10, LINEN[4]);
  // a few stitches on the pouch
  img.set(8, 12, LINEN[1]);
  img.set(9, 12, LINEN[1]);
  // the open mouth, with a pinch of powder heaped in it
  img.fillRect(6, 6, 4, 1, LINEN[1]);
  img.outline(INK_WARM);
  // glowing powder: a warm white heap, a blue-violet fringe, sparkles drifting up
  const GLOW_CORE = [255, 252, 224];
  const GLOW_MID = [190, 224, 255];
  const GLOW_EDGE = [160, 164, 236];
  for (const [x, y] of [[7, 5], [8, 5], [7, 4], [8, 4], [9, 5]]) img.set(x, y, GLOW_MID);
  for (const [x, y] of [[7, 4], [8, 5]]) img.set(x, y, GLOW_CORE);
  for (const [x, y] of [[6, 5], [10, 5], [9, 4], [6, 4]]) img.over(x, y, GLOW_EDGE, 190);
  for (const [x, y, c] of [[4, 2, GLOW_CORE], [11, 1, GLOW_MID], [13, 4, GLOW_CORE], [3, 5, GLOW_MID], [9, 1, GLOW_CORE]]) img.set(x, y, c);
  for (const [x, y] of [[4, 1], [4, 3], [3, 2], [5, 2], [11, 0], [11, 2], [10, 1], [12, 1]]) img.over(x, y, GLOW_EDGE, 120);
  return img;
}

function hareFur() {
  const img = new Img(16, 16);
  // a tuft of winter fur: a soft irregular pad, white with grey-blue lying in its shade, fringed with loose hairs
  const rows = [
    [5, 10],
    [3, 12],
    [2, 13],
    [2, 13],
    [2, 13],
    [3, 13],
    [3, 12],
    [4, 11],
    [5, 10],
  ];
  rows.forEach(([x0, x1], i) => {
    const y = 3 + i;
    for (let x = x0; x <= x1; x += 1) {
      const rel = (x - x0) / (x1 - x0 + 1);
      let t = rel < 0.25 ? 4 : rel < 0.55 ? 3 : rel < 0.82 ? 2 : 1;
      if (i >= 6) t -= 1;
      if (i <= 1 && rel < 0.5) t = 4;
      const n = hash2(x, y, 9601);
      if (n < 0.14) t -= 1;
      else if (n > 0.9) t += 1;
      img.set(x, y, FUR[Math.max(0, Math.min(4, t))]);
    }
  });
  // strands: little darker flicks following the lay of the coat
  for (const [x, y] of [[5, 6], [6, 7], [8, 5], [9, 6], [7, 9], [10, 8], [4, 8], [11, 10]]) img.set(x, y, FUR[1]);
  for (const [x, y] of [[6, 5], [8, 8], [10, 7], [5, 9]]) img.set(x, y, FUR[0]);
  // loose hairs sticking out at the rim
  for (const [x, y] of [[1, 6], [1, 8], [14, 7], [14, 9], [4, 2], [9, 2], [6, 12], [10, 12], [12, 11]]) img.set(x, y, FUR[3]);
  // a pale blue-grey band: the summer coat coming through
  for (const [x, y] of [[7, 11], [8, 11], [9, 11], [11, 11]]) img.set(x, y, [150, 160, 182]);
  img.outline(INK_WARM);
  return img;
}

function stagAntler() {
  const img = new Img(16, 16);
  const mask = new Set();
  /** A tapering rod of bone along a polyline, radius `r0` at the start and `r1` at the tip. */
  const taper = (pts, r0, r1) => {
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i += 1) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let walked = 0;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        const r = r0 + (r1 - r0) * ((walked + seg * t) / total);
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy += 1) {
          for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx += 1) {
            if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r) mask.add(yy * 16 + xx);
          }
        }
      }
      walked += seg;
    }
  };
  taper([[8, 12], [6.6, 9.4], [7.4, 6.4], [9.4, 3.8], [10.6, 1.2]], 1.9, 0.7);
  taper([[6.6, 10], [4.6, 8.4], [2.8, 6.4]], 1.2, 0.5);
  taper([[7.2, 7.6], [5.4, 5.6], [4.6, 3.2]], 1.1, 0.5);
  taper([[8.8, 4.6], [11.4, 4.4], [13.2, 2.8]], 1.0, 0.5);
  taper([[9.8, 2.6], [12.6, 1.2]], 0.8, 0.45);
  const has = (x, y) => mask.has(y * 16 + x);
  for (const key of mask) {
    const x = key % 16;
    const y = Math.floor(key / 16);
    if (x < 0 || x > 15 || y < 0 || y > 15) continue;
    let t = 2;
    if (!has(x - 1, y) || !has(x, y - 1)) t = 4;
    else if (!has(x + 1, y) || !has(x, y + 1)) t = 1;
    else if (hash2(x, y, 9702) > 0.78) t = 3;
    if (t === 2 && hash2(x, y, 9701) > 0.88) t = 1;
    img.set(x, y, BONE[t]);
  }
  // the burr: a rough ring of bone where the antler left the skull, browner at the foot
  img.fillRect(4, 12, 8, 3, BONE[2]);
  img.hline(5, 11, 6, BONE[3]);
  img.hline(4, 12, 8, BONE[4]);
  img.hline(4, 14, 8, [150, 112, 78]);
  img.set(4, 13, BONE[3]);
  img.set(11, 13, BONE[1]);
  img.set(11, 12, BONE[1]);
  img.set(9, 14, [118, 88, 62]);
  img.set(6, 13, BONE[1]);
  img.set(8, 13, BONE[1]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ crop: moonbloom

/** A pair of small leaves on the soil: the first sign of the seed. */
function moonLeaf(img, x, y, dir, size) {
  // a leaf as a short slanted run of pixels with a lit upper edge
  for (let k = 0; k < size; k += 1) {
    img.set(x + dir * k, y - Math.floor(k / 2), k === size - 1 ? LEAFB[4] : LEAFB[3]);
    img.set(x + dir * k, y - Math.floor(k / 2) + 1, LEAFB[2]);
  }
}

function moonbloomCrop(stage) {
  const img = new Img(16, 16);
  const base = 14;
  if (stage === 0) {
    // the seed: the first two leaves unfolding, the pale seed coat still riding on the tip
    img.set(8, base - 4, MOON[3]);
    img.set(8, base - 3, MOON[4]);
    img.set(7, base - 3, LEAFB[3]);
    img.set(9, base - 3, LEAFB[3]);
    img.set(8, base - 2, LEAFB[1]);
    img.set(7, base - 2, LEAFB[3]);
    img.set(9, base - 2, LEAFB[2]);
    img.set(6, base - 2, LEAFB[2]);
    img.set(10, base - 2, LEAFB[2]);
    img.set(8, base - 1, LEAFB[1]);
  } else if (stage === 1) {
    // a sprout: a short stem and a rosette of four cool leaves
    img.vline(8, base - 4, 4, LEAFB[1]);
    moonLeaf(img, 7, base - 3, -1, 4);
    moonLeaf(img, 9, base - 3, 1, 4);
    moonLeaf(img, 7, base - 6, -1, 2);
    moonLeaf(img, 9, base - 6, 1, 2);
    img.set(8, base - 5, LEAFB[4]);
  } else if (stage === 2) {
    // a bud: a taller stem with leaves, and a closed pale bud with a blue-violet tip
    img.vline(8, base - 8, 8, LEAFB[1]);
    img.vline(7, base - 4, 4, LEAFB[2]);
    moonLeaf(img, 7, base - 3, -1, 5);
    moonLeaf(img, 9, base - 4, 1, 5);
    moonLeaf(img, 7, base - 6, -1, 3);
    // the bud
    img.set(7, base - 10, MOON[4]);
    img.fillRect(7, base - 9, 3, 3, MOON[3]);
    img.set(7, base - 9, MOON[4]);
    img.set(9, base - 7, MOON[2]);
    img.set(8, base - 11, [150, 160, 236]);
    img.set(8, base - 10, MOON[3]);
    img.set(9, base - 8, MOON[2]);
    img.set(6, base - 8, LEAFB[3]);
    img.set(10, base - 8, LEAFB[3]);
  } else {
    // ripe: the flower fully open, glowing
    img.vline(8, base - 6, 6, LEAFB[1]);
    img.vline(7, base - 3, 3, LEAFB[2]);
    moonLeaf(img, 7, base - 2, -1, 5);
    moonLeaf(img, 9, base - 3, 1, 5);
    bloom(img, 8, 5.8, 3.2, 2.3);
  }
  img.outline(INK);
  // the glow stays well inside the tile, so it never ends in a hard edge at the frame
  if (stage === 3) halo(img, 8, 6.4, 6.5, [190, 224, 255], { steps: [92, 56, 26] });
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildExpansionLife(frames) {
  frames.set('item/sprinkler', sprinklerIcon());
  frames.set('item/fertilizer', fertilizerIcon());
  frames.set('item/seeds_moonbloom', seedPacket(ramp([84, 104, 206], 5, { dark: 0.5, light: 0.35 }), ramp([120, 160, 240], 5)));
  frames.set('item/moonbloom', moonbloomItem());
  frames.set('item/heron_feather', heronFeather());
  frames.set('item/kingfisher_feather', kingfisherFeather());
  frames.set('item/moth_dust', mothDust());
  frames.set('item/hare_fur', hareFur());
  frames.set('item/owl_feather', owlFeather());
  frames.set('item/stag_antler', stagAntler());
  for (let stage = 0; stage < 4; stage += 1) frames.set(`crop/moonbloom_${stage}`, moonbloomCrop(stage));
}

void BRAND;
void DERIVED;
void mix;
