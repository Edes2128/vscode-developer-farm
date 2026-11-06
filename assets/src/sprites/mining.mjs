// Mining art for Phase 4: the mine entrance, ore nodes and their item icons, the pickaxe, rock dust.
//
// Frame names (the contract with src/data/objects.ts, src/data/items.ts and src/rendering/frameNames.ts):
//   object/cave_mouth                         48 x 40, bottom edge on the ground
//   node/{stone,copper,iron,coal,quartz,amethyst}   16 x 16, a rock or ore chunk with its own soft shadow
//   item/{pickaxe,stone,copper_ore,iron_ore,coal,quartz,amethyst}   16 x 16 icons
//   tool/pickaxe                              16 x 16, swung like the hoe (handle lower left, head upper right)
//   fx/dust_{0-2}                             16 x 16, a puff of rock dust growing and thinning
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { LEAF, paintBalls } from './objects.mjs';

const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;

const GREY = ramp([128, 127, 130], 5, { dark: 0.5, light: 0.22 });
const SLATE = ramp([100, 114, 134], 5, { dark: 0.5, light: 0.34 });
const COAL = [[16, 18, 28], [30, 32, 46], [46, 49, 66], [66, 72, 94], [124, 134, 162]];
const COPPER = ramp([224, 122, 56], 5, { dark: 0.45, light: 0.4 });
const RUST = ramp([178, 92, 60], 5, { dark: 0.45, light: 0.35 });
const SILVER = ramp([200, 208, 218], 5, { dark: 0.35, light: 0.3 });
const QUARTZ = ramp([234, 222, 240], 5, { dark: 0.55, light: 0.1 });
const AMETHYST = ramp([158, 96, 212], 5, { dark: 0.5, light: 0.4 });
const STEEL = ramp([156, 164, 172], 5, { dark: 0.45, light: 0.35 });
const MOSS = ramp(mix(BRAND.forestGreen, BRAND.sageGreen, 0.2), 5, { dark: 0.55, light: 0.4 });
const CAVE_FLOOR = ramp([110, 99, 92], 5, { dark: 0.5, light: 0.38 });

// ------------------------------------------------------------------------------------------ cave mouth

function caveMouth() {
  const W = 48;
  const H = 40;
  const img = new Img(W, H);
  const ROCK = ramp(mix(DERIVED.stone, [96, 88, 92], 0.4), 5, { dark: 0.55, light: 0.34 });
  const seed = 9100;

  // the rock mass: a broad mound with a ragged top edge
  const top = (x) => {
    const u = Math.abs(x + 0.5 - W / 2) / (W / 2);
    const bump = (hash2(Math.floor(x / 3), 1, seed) - 0.5) * 4;
    return Math.round(5 + Math.pow(u, 2.2) * 14 + bump);
  };
  for (let x = 1; x < W - 1; x += 1) {
    const t = top(x);
    for (let y = t; y < H; y += 1) {
      const chunk = hash2(Math.floor(x / 4), Math.floor((y + (Math.floor(x / 4) % 2) * 3) / 4), seed + 3);
      const lit = -0.55 * ((x - W / 2) / (W / 2)) - 0.9 * ((y - t) / 26) + (chunk - 0.5) * 0.7 + 0.34;
      const tn = lit > 0.6 ? 4 : lit > 0.3 ? 3 : lit > -0.05 ? 2 : lit > -0.4 ? 1 : 0;
      img.set(x, y, ROCK[tn]);
      // strata cracks
      if ((y + Math.floor(x / 6) * 2) % 7 === 0 && hash2(x, y, seed + 4) < 0.55) img.set(x, y, ROCK[Math.max(0, tn - 2)]);
    }
  }
  // moss over the top and down the shoulders
  for (let x = 1; x < W - 1; x += 1) {
    const t = top(x);
    const depth = 2 + Math.floor(hash2(x, 2, seed + 5) * 4);
    for (let y = t; y < t + depth; y += 1) {
      const n = hash2(x, y, seed + 6);
      img.set(x, y, y === t ? MOSS[3] : n < 0.35 ? MOSS[1] : MOSS[2]);
    }
    if (hash2(x, 3, seed + 7) < 0.14) img.vline(x, t + depth, 2 + Math.floor(hash2(x, 4, seed) * 3), MOSS[1]);
  }
  for (const [x, y] of [[8, 26], [9, 27], [39, 24], [40, 25], [41, 25], [5, 33], [43, 31], [44, 31]]) img.set(x, y, MOSS[hash2(x, y, 1) < 0.5 ? 1 : 2]);

  // the dark arch
  const cx = 24;
  const springY = 22;
  const rad = 12;
  const inside = (x, y) => {
    if (y >= springY) return x >= cx - rad && x < cx + rad;
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - springY;
    return dx * dx + dy * dy <= rad * rad;
  };
  for (let y = 8; y < H; y += 1) {
    for (let x = 8; x < 40; x += 1) {
      if (!inside(x, y)) continue;
      const depth = Math.min(1, Math.max(0, (y - 10) / 28));
      img.set(x, y, mix([8, 11, 16], [26, 24, 32], depth));
    }
  }
  // the arch's rim: a lit lower lip of cut stone
  for (let y = 8; y < H; y += 1) {
    for (let x = 7; x < 41; x += 1) {
      if (inside(x, y)) continue;
      const near = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
      if (near) img.set(x, y, x < cx ? ROCK[3] : ROCK[1]);
    }
  }
  // a glimpse of the tunnel floor
  for (let y = 36; y < H; y += 1) for (let x = 17; x < 31; x += 1) img.set(x, y, hash2(x, y, 4) < 0.25 ? CAVE_FLOOR[0] : mix(CAVE_FLOOR[0], CAVE_FLOOR[1], 0.35));

  // timber: two posts, a lintel, and a couple of braces
  const post = (x0) => {
    img.fillRect(x0, 20, 4, 20, PAL.bark[2]);
    img.vline(x0, 20, 20, PAL.bark[3]);
    img.vline(x0 + 3, 20, 20, PAL.bark[1]);
    for (let y = 24; y < 39; y += 5) img.set(x0 + 1 + (y % 2), y, PAL.bark[0]);
    img.hline(x0, 39, 4, PAL.bark[0]);
  };
  post(13);
  post(31);
  img.fillRect(11, 16, 26, 5, PAL.bark[2]);
  img.hline(11, 16, 26, PAL.plank[2]);
  img.hline(11, 17, 26, PAL.bark[3]);
  img.hline(11, 20, 26, PAL.bark[0]);
  for (let x = 15; x < 36; x += 6) img.vline(x, 18, 2, PAL.bark[1]);
  img.set(13, 18, IRON_NAIL);
  img.set(34, 18, IRON_NAIL);
  for (let i = 0; i < 4; i += 1) {
    img.set(17 + i, 21 + i, PAL.bark[2]);
    img.set(18 + i, 21 + i, PAL.bark[1]);
    img.set(30 - i, 21 + i, PAL.bark[2]);
    img.set(29 - i, 21 + i, PAL.bark[3]);
  }
  // a lantern hung from the right-hand post
  img.set(30, 21, PAL.bark[0]);
  img.fillRect(27, 24, 3, 5, [255, 214, 120]);
  img.hline(27, 24, 3, PAL.bark[0]);
  img.hline(27, 28, 3, PAL.bark[0]);
  img.set(28, 26, [255, 244, 190]);
  img.vline(26, 24, 5, PAL.bark[0]);
  img.vline(30, 24, 5, PAL.bark[0]);
  img.hline(27, 23, 3, IRON_NAIL);
  img.over(24, 27, [255, 200, 90], 70);
  for (const [x, y] of [[25, 25], [25, 26], [26, 27], [24, 26]]) img.over(x, y, [255, 200, 90], 70);

  // loose rocks and a few blades of grass at the foot
  const stone = (x, y, w, h, seed2) => {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        const dx = (xx + 0.5 - w / 2) / (w / 2);
        const dy = (yy + 0.5 - h / 2) / (h / 2);
        if (dx * dx + dy * dy > 1) continue;
        const lit = -0.6 * dx - 0.9 * dy + 0.3 + (hash2(xx, yy, seed2) - 0.5) * 0.2;
        img.set(x + xx, y + yy, ROCK[lit > 0.55 ? 4 : lit > 0.2 ? 3 : lit > -0.2 ? 2 : 1]);
      }
    }
  };
  stone(36, 35, 7, 5, 1);
  stone(40, 36, 6, 4, 2);
  stone(3, 36, 6, 4, 3);
  for (const [x, y] of [[2, 37], [3, 36], [4, 37], [10, 38], [11, 37], [12, 38], [44, 37], [45, 36], [46, 37]]) img.set(x, y, LEAF[x % 3 === 0 ? 3 : 2]);

  img.outline(INK);
  return img;
}

const IRON_NAIL = [120, 118, 130];

// ------------------------------------------------------------------------------------------ nodes and ore

/** Drops the sprite onto a soft ground shadow that lives inside the same 16 x 16. */
function withShadow(body, { cx = 8, cy = 13.2, rx = 6.6, ry = 2.2, alpha = 74 } = {}) {
  const out = new Img(body.w, body.h);
  out.ellipse(cx, cy, rx, ry, INK, alpha, true);
  out.ellipse(cx, cy - 0.2, rx * 0.6, ry * 0.6, INK, alpha * 0.6, true);
  out.blit(body, 0, 0);
  return out;
}

/** Scatters specks that land on the rock only. */
function fleck(img, count, seed, paintOne) {
  const r = rng(seed);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 200) {
    guard += 1;
    const x = r.int(3, 12);
    const y = r.int(5, 12);
    if (img.alphaAt(x, y) < 255 || img.alphaAt(x + 1, y) < 255) continue;
    paintOne(x, y, r);
    placed += 1;
  }
}

function rockLumps(img, colors, seed, scale = 1) {
  paintBalls(
    img,
    [
      { x: 8, y: 9.3, r: 5 * scale, tone: 0.06 },
      { x: 4.6, y: 11, r: 3.1 * scale, tone: -0.08 },
      { x: 11.6, y: 11, r: 3.4 * scale, tone: -0.1 },
      { x: 7, y: 6.6, r: 3 * scale, tone: 0.16 },
    ],
    colors,
    seed,
  );
  // a dark seam between the lumps
  for (const [x, y] of [[8, 11], [8, 12], [7, 12]]) if (img.alphaAt(x, y) > 0) img.set(x, y, colors[0]);
}

function crystal(img, cx, baseY, w, h, lean, colors) {
  // rows from the tip down: one pixel, two, then the full width
  for (let i = 0; i < h; i += 1) {
    const y = baseY - h + 1 + i;
    const rw = i === 0 ? 1 : i === 1 ? Math.max(2, w - 1) : w;
    const x0 = cx - Math.floor(rw / 2) + Math.round(lean * (1 - i / h) * 1.2);
    for (let k = 0; k < rw; k += 1) {
      const rel = rw === 1 ? 0.5 : k / (rw - 1);
      img.set(x0 + k, y, i === 0 ? colors[4] : rel < 0.34 ? colors[3] : rel < 0.75 ? colors[2] : colors[1]);
    }
    if (i > 0) img.set(x0 + rw - 1, y, colors[1]);
    if (i > 1 && rw > 2) img.set(x0 + Math.floor(rw / 2), y, i % 3 === 0 ? colors[3] : colors[2]);
  }
  img.set(cx + Math.round(lean * 0.6) - 1, baseY - h + 3, colors[4]);
}

function nodeSprite(kind) {
  const body = new Img(16, 16);
  if (kind === 'stone') {
    rockLumps(body, GREY, 11);
    fleck(body, 4, 91, (x, y) => {
      body.set(x, y, GREY[3]);
      body.set(x + 1, y, GREY[1]);
    });
    body.outline(INK);
  } else if (kind === 'copper') {
    rockLumps(body, GREY, 12);
    fleck(body, 6, 92, (x, y, r) => {
      body.set(x, y, COPPER[3]);
      body.set(x + 1, y, COPPER[2]);
      if (r() < 0.6) body.set(x, y + 1, COPPER[1]);
      if (r() < 0.4) body.set(x - 1, y, COPPER[4]);
    });
    body.outline(INK);
  } else if (kind === 'iron') {
    rockLumps(body, SLATE, 13);
    fleck(body, 6, 93, (x, y, r) => {
      body.set(x, y, r() < 0.5 ? RUST[3] : SILVER[3]);
      body.set(x + 1, y, r() < 0.5 ? RUST[2] : SILVER[2]);
      if (r() < 0.5) body.set(x, y + 1, RUST[1]);
    });
    body.outline(INK);
  } else if (kind === 'coal') {
    paintBalls(
      body,
      [
        { x: 7.4, y: 9.4, r: 4.6, tone: -0.22 },
        { x: 4, y: 11.2, r: 3, tone: -0.3 },
        { x: 11.8, y: 10.8, r: 3.6, tone: -0.26 },
        { x: 9.4, y: 6.6, r: 3, tone: -0.1 },
      ],
      COAL,
      14,
    );
    for (const [x, y] of [[6, 7], [10, 5], [4, 10], [12, 9], [6, 9]]) if (body.alphaAt(x, y) > 0) body.set(x, y, [168, 180, 208]);
    for (const [x, y] of [[7, 7], [11, 5], [5, 10]]) if (body.alphaAt(x, y) > 0) body.set(x, y, COAL[4]);
    body.outline([20, 24, 34]);
  } else {
    const colors = kind === 'quartz' ? QUARTZ : AMETHYST;
    paintBalls(
      body,
      [
        { x: 8, y: 12, r: 4.4, tone: -0.04 },
        { x: 4.6, y: 12.6, r: 2.8, tone: -0.1 },
        { x: 11.8, y: 12.4, r: 3, tone: -0.12 },
      ],
      GREY,
      15,
    );
    crystal(body, 8, 12, 4, 10, 0, colors);
    crystal(body, 4, 12, 3, 6, -1, colors);
    crystal(body, 12, 12, 3, 7, 1, colors);
    body.outline(INK);
  }
  return withShadow(body);
}

function oreItem(kind) {
  const img = new Img(16, 16);
  if (kind === 'stone') {
    paintBalls(
      img,
      [
        { x: 7.6, y: 9, r: 5.4, tone: 0.08 },
        { x: 11, y: 10.6, r: 3.4, tone: -0.06 },
        { x: 6, y: 6.4, r: 3, tone: 0.18 },
      ],
      GREY,
      21,
    );
    img.set(8, 12, GREY[0]);
    img.set(9, 11, GREY[1]);
    img.outline(INK);
  } else if (kind === 'copper_ore') {
    paintBalls(img, [{ x: 8, y: 9, r: 5.6, tone: 0.06 }, { x: 11, y: 11, r: 3.4, tone: -0.08 }, { x: 6, y: 6.6, r: 3, tone: 0.16 }], GREY, 22);
    for (const [x, y] of [[5, 6], [9, 7], [7, 10], [11, 10], [5, 11], [10, 5]]) {
      img.set(x, y, COPPER[3]);
      img.set(x + 1, y, COPPER[2]);
      img.set(x, y + 1, COPPER[1]);
    }
    img.set(5, 6, COPPER[4]);
    img.outline(INK);
  } else if (kind === 'iron_ore') {
    paintBalls(img, [{ x: 8, y: 9, r: 5.6, tone: 0.06 }, { x: 11, y: 11, r: 3.4, tone: -0.08 }, { x: 6, y: 6.6, r: 3, tone: 0.16 }], SLATE, 23);
    for (const [x, y, c] of [[5, 6, RUST], [9, 7, SILVER], [7, 10, RUST], [11, 10, SILVER], [5, 11, SILVER], [10, 5, RUST]]) {
      img.set(x, y, c[3]);
      img.set(x + 1, y, c[2]);
      img.set(x, y + 1, c[1]);
    }
    img.set(9, 7, SILVER[4]);
    img.outline(INK);
  } else if (kind === 'coal') {
    paintBalls(img, [{ x: 7, y: 9.6, r: 4.6, tone: -0.2 }, { x: 11.4, y: 10.6, r: 3.4, tone: -0.28 }, { x: 8.6, y: 6.2, r: 3.2, tone: -0.1 }], COAL, 24);
    for (const [x, y] of [[6, 8], [9, 5], [10, 10]]) img.set(x, y, [168, 180, 208]);
    for (const [x, y] of [[7, 8], [10, 5], [11, 10]]) img.set(x, y, COAL[4]);
    img.outline([20, 24, 34]);
  } else {
    const colors = kind === 'quartz' ? QUARTZ : AMETHYST;
    crystal(img, 8, 14, 5, 12, 0, colors);
    crystal(img, 4, 14, 3, 7, -1, colors);
    crystal(img, 12, 14, 3, 8, 1, colors);
    img.outline(INK);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ pickaxe

function pickaxe() {
  const img = new Img(16, 16);
  // handle from the lower left to the head at the upper right
  for (let i = 0; i < 11; i += 1) {
    img.set(2 + i, 13 - i, PAL.plank[2]);
    img.set(3 + i, 13 - i, PAL.plank[1]);
    if (i % 3 === 0) img.set(2 + i, 12 - i, PAL.plank[3]);
  }
  // the head: an iron arc crossing the handle, a point at each end
  const arc = [
    [6, 1], [7, 1], [8, 0], [9, 0], [10, 0], [11, 0], [12, 1], [13, 2], [14, 3], [14, 4], [15, 5], [15, 6],
  ];
  for (const [x, y] of arc) {
    img.set(x, y, STEEL[3]);
    img.set(x, y + 1, STEEL[2]);
  }
  for (const [x, y] of [[9, 0], [10, 0], [11, 0], [8, 0]]) img.set(x, y, STEEL[4]);
  for (const [x, y] of [[13, 3], [14, 5], [15, 7], [12, 2]]) img.set(x, y, STEEL[1]);
  img.set(5, 2, STEEL[2]);
  img.set(15, 7, STEEL[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ fx

const DUST = ramp([164, 158, 150], 5, { dark: 0.4, light: 0.35 });

function dust(stage) {
  const img = new Img(16, 16);
  // A soft cloud: opacity falls away from the middle in a few clear steps, lit from the top left.
  const puff = (cx, cy, r, alpha) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / (r * 0.85);
        const d = Math.hypot(dx, dy);
        if (d > 1) continue;
        const a = alpha * Math.pow(1 - d * d, 0.55);
        const steps = a > 0.8 * 255 ? 235 : a > 0.5 * 255 ? 175 : a > 0.25 * 255 ? 115 : a > 0.08 * 255 ? 60 : 0;
        if (steps === 0) continue;
        const lit = -0.5 * dx - 0.7 * dy + (hash2(x, y, 41) - 0.5) * 0.4;
        img.over(x, y, lit > 0.45 ? DUST[4] : lit > 0.0 ? DUST[3] : lit > -0.5 ? DUST[2] : DUST[1], Math.min(steps, Math.round(alpha)));
      }
    }
  };
  if (stage === 0) {
    puff(8, 10, 3.6, 240);
    puff(5.5, 11.4, 2.4, 220);
    puff(10.8, 11.4, 2.4, 220);
  } else if (stage === 1) {
    puff(8, 8.4, 4.2, 225);
    puff(4.4, 9.4, 3.4, 205);
    puff(11.6, 9.4, 3.4, 205);
    puff(5.8, 5.2, 3, 185);
    puff(10.6, 5, 3, 185);
    puff(8, 11.8, 3, 190);
  } else {
    puff(8, 8, 3.6, 130);
    puff(3, 6.4, 2.6, 115);
    puff(13, 6.4, 2.6, 115);
    puff(8, 2.6, 2.4, 100);
    puff(4, 12, 2.4, 100);
    puff(12, 12, 2.2, 95);
    for (const [x, y, a] of [[1, 3, 130], [14, 2, 120], [15, 9, 120], [0, 10, 110], [7, 14, 100], [10, 0, 110]]) img.set(x, y, DUST[3], a);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildMining(frames) {
  frames.set('object/cave_mouth', caveMouth());
  for (const kind of ['stone', 'copper', 'iron', 'coal', 'quartz', 'amethyst']) frames.set(`node/${kind}`, nodeSprite(kind));
  for (const kind of ['stone', 'copper_ore', 'iron_ore', 'coal', 'quartz', 'amethyst']) frames.set(`item/${kind}`, oreItem(kind));
  frames.set('item/pickaxe', pickaxe());
  frames.set('tool/pickaxe', pickaxe());
  for (let i = 0; i < 3; i += 1) frames.set(`fx/dust_${i}`, dust(i));
}

void INK;
