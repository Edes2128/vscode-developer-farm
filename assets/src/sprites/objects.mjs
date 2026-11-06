// World objects: trees, bushes, rocks, fences, the farmhouse, the well, signs, the bridge and ground decals.
// Everything is drawn in a top-left light, outlined, and built from the brand palette ramps.
//
// Frame names are the contract with src/data/objects.ts; anchors and footprints live there.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';

const LEAF = ramp(mix(BRAND.forestGreen, BRAND.sageGreen, 0.2), 5, { dark: 0.55, light: 0.4 });
const PINE = ramp(mix(BRAND.forestGreen, [34, 74, 72], 0.35), 5, { dark: 0.6, light: 0.38 });
const AUTUMN = ramp(mix(BRAND.terracotta, BRAND.wheatGold, 0.3), 5, { dark: 0.55, light: 0.4 });
const STONE = ramp(DERIVED.stone, 5, { dark: 0.5, light: 0.3 });
const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;

/** Which of a ramp's five tones a lit value selects. */
function tone(lit) {
  return lit > 0.62 ? 4 : lit > 0.28 ? 3 : lit > -0.05 ? 2 : lit > -0.4 ? 1 : 0;
}

/** Paints overlapping shaded balls back to front. The lower a ball sits, the closer it is to the viewer. */
function paintBalls(img, balls, colors, seed) {
  const sorted = [...balls].sort((a, b) => a.y - b.y);
  for (const ball of sorted) {
    for (let y = Math.floor(ball.y - ball.r); y <= Math.ceil(ball.y + ball.r); y += 1) {
      for (let x = Math.floor(ball.x - ball.r); x <= Math.ceil(ball.x + ball.r); x += 1) {
        const dx = (x + 0.5 - ball.x) / ball.r;
        const dy = (y + 0.5 - ball.y) / ball.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        let lit = -0.55 * dx - 0.75 * dy + 0.5 * nz + (ball.tone ?? 0);
        lit += (hash2(x, y, seed) - 0.5) * 0.18;
        img.set(x, y, colors[tone(lit)]);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------ trees

function trunk(img, cx, top, bottom, halfWidth, colors, seed) {
  const r = rng(seed);
  for (let y = top; y <= bottom; y += 1) {
    const flare = y > bottom - 4 ? Math.floor((y - (bottom - 4)) / 2) + 1 : 0;
    const hw = halfWidth + flare;
    for (let x = cx - hw; x < cx + hw; x += 1) {
      const rel = (x - (cx - hw)) / (hw * 2);
      img.set(x, y, rel < 0.28 ? colors[3] : rel < 0.66 ? colors[2] : colors[1]);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const x = cx - halfWidth + r.int(1, halfWidth * 2 - 2);
    const y = r.int(top + 2, bottom - 3);
    img.vline(x, y, r.int(2, 4), colors[0]);
  }
}

function oak(seed, colors = LEAF) {
  const img = new Img(48, 56);
  const r = rng(seed);
  trunk(img, 24, 34, 55, 4, PAL.bark, seed);
  const j = () => r.int(-1, 1);
  const balls = [
    { x: 24 + j(), y: 11 + j(), r: 9, tone: 0.18 },
    { x: 14 + j(), y: 16 + j(), r: 8, tone: 0.1 },
    { x: 34 + j(), y: 16 + j(), r: 8, tone: 0.1 },
    { x: 24 + j(), y: 21 + j(), r: 11, tone: 0.05 },
    { x: 9 + j(), y: 25 + j(), r: 7, tone: -0.02 },
    { x: 39 + j(), y: 25 + j(), r: 7, tone: -0.02 },
    { x: 17 + j(), y: 29 + j(), r: 8, tone: -0.08 },
    { x: 31 + j(), y: 29 + j(), r: 8, tone: -0.08 },
    { x: 24 + j(), y: 32 + j(), r: 7, tone: -0.12 },
  ];
  paintBalls(img, balls, colors, seed);
  img.outline(INK);
  return img;
}

function pine(seed) {
  const img = new Img(48, 56);
  const r = rng(seed);
  trunk(img, 24, 47, 55, 3, PAL.bark, seed);
  const tiers = [
    { top: 2, h: 14, w: 14 },
    { top: 11, h: 17, w: 24 },
    { top: 22, h: 19, w: 34 },
    { top: 34, h: 18, w: 44 },
  ];
  for (const [index, tier] of tiers.entries()) {
    for (let dy = 0; dy < tier.h; dy += 1) {
      const half = Math.round(((dy + 1) / tier.h) * (tier.w / 2));
      const scallop = dy === tier.h - 1 ? ((index + r.int(0, 1)) % 2) : 0;
      for (let dx = -half + scallop; dx < half - scallop; dx += 1) {
        const x = 24 + dx;
        const y = tier.top + dy;
        const rel = dx / Math.max(half, 1);
        let t = rel < -0.45 ? 3 : rel < 0.05 ? 2 : 1;
        if (dy === tier.h - 1 || dy === tier.h - 2) t = 0; // shadow under the tier
        if (dy < 3 && rel < 0) t = Math.min(4, t + 1);
        if (hash2(x, y, seed) < 0.1) t = Math.max(0, t - 1);
        img.set(x, y, PINE[t]);
      }
    }
  }
  img.outline(INK);
  return img;
}

// ------------------------------------------------------------------------------------------ small things

function bush(seed, berries = false) {
  const img = new Img(16, 16);
  paintBalls(
    img,
    [
      { x: 5.5, y: 9, r: 5, tone: 0.02 },
      { x: 10.5, y: 9, r: 5, tone: -0.04 },
      { x: 8, y: 6.5, r: 5, tone: 0.14 },
    ],
    LEAF,
    seed,
  );
  if (berries) {
    for (const [x, y] of [[5, 9], [9, 7], [11, 10]]) {
      img.set(x, y, PAL.berry[2]);
      img.set(x + 1, y, PAL.berry[1]);
      img.set(x, y - 1, PAL.berry[2]);
    }
  }
  img.outline(INK);
  return img;
}

function rock(w, h, seed, mossy) {
  const img = new Img(w, h);
  const r = rng(seed);
  const cx = w / 2;
  const cy = h - h * 0.38;
  const rx = w / 2 - 2;
  const ry = h * 0.36;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const wob = 1 + (hash2(Math.floor(x / 2), Math.floor(y / 2), seed) - 0.5) * 0.18;
      const d2 = dx * dx + dy * dy;
      if (d2 > wob) continue;
      const lit = -0.6 * dx - 0.9 * dy + 0.4 + (hash2(x, y, seed) - 0.5) * 0.14;
      img.set(x, y, STONE[tone(lit)]);
    }
  }
  if (mossy) {
    for (let i = 0; i < w / 2; i += 1) {
      const x = r.int(3, w - 4);
      const y = r.int(Math.floor(cy - ry), Math.floor(cy - ry) + 3);
      if (img.alphaAt(x, y) > 0) img.set(x, y, LEAF[r.int(1, 3)]);
    }
  }
  img.outline(INK);
  return img;
}

function stump() {
  const img = new Img(16, 16);
  // side
  for (let y = 8; y < 14; y += 1) {
    for (let x = 3; x < 13; x += 1) {
      const rel = (x - 3) / 10;
      img.set(x, y, rel < 0.3 ? PAL.bark[3] : rel < 0.7 ? PAL.bark[2] : PAL.bark[1]);
    }
  }
  img.ellipse(8, 14, 5.5, 1.8, PAL.bark[1]);
  // top
  img.ellipse(8, 8, 5.2, 3.2, PAL.plank[3]);
  img.ellipse(8, 8, 3.4, 2, PAL.plank[2]);
  img.ellipse(8, 8, 1.6, 1, PAL.plank[3]);
  img.vline(5, 10, 3, PAL.bark[0]);
  img.vline(10, 10, 3, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function log() {
  const img = new Img(32, 16);
  for (let y = 5; y < 14; y += 1) {
    for (let x = 4; x < 29; x += 1) {
      const rel = (y - 5) / 9;
      img.set(x, y, rel < 0.28 ? PAL.bark[3] : rel < 0.66 ? PAL.bark[2] : PAL.bark[1]);
    }
  }
  for (let x = 7; x < 26; x += 3) img.vline(x, 6 + (x % 2), 4, PAL.bark[0]);
  img.ellipse(5, 9.5, 2.6, 4.6, PAL.plank[3]);
  img.ellipse(5, 9.5, 1.4, 2.6, PAL.plank[2]);
  img.set(5, 9, PAL.plank[3]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ fence

// Neighbour bits for fence autotiling. MUST match FENCE_* in src/engine/world/autotile.ts.
const F_N = 1;
const F_E = 2;
const F_S = 4;
const F_W = 8;

function fence(mask) {
  const img = new Img(16, 16);
  const rail = (x0, x1, y) => {
    img.hline(x0, y, x1 - x0, PAL.plank[3]);
    img.hline(x0, y + 1, x1 - x0, PAL.plank[2]);
    img.hline(x0, y + 2, x1 - x0, PAL.plank[1]);
  };
  if (mask & F_W) {
    rail(0, 8, 6);
    rail(0, 8, 10);
  }
  if (mask & F_E) {
    rail(8, 16, 6);
    rail(8, 16, 10);
  }
  if (mask & F_N) {
    // a rail receding away from the viewer: a thin strip along the top of the post line
    img.fillRect(7, 0, 2, 7, PAL.plank[3]);
    img.vline(9, 0, 7, PAL.plank[1]);
  }
  if (mask & F_S) {
    img.fillRect(7, 8, 2, 8, PAL.plank[2]);
    img.vline(9, 8, 8, PAL.plank[1]);
    img.vline(7, 8, 8, PAL.plank[3]);
  }
  // post
  img.fillRect(6, 4, 4, 11, PAL.plank[2]);
  img.vline(6, 4, 11, PAL.plank[3]);
  img.vline(9, 4, 11, PAL.plank[1]);
  img.hline(6, 4, 4, PAL.plank[4]);
  img.hline(6, 14, 4, PAL.plank[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ props

function signpost(variant) {
  const img = new Img(16, 24);
  img.fillRect(7, 9, 3, 14, PAL.bark[2]);
  img.vline(7, 9, 14, PAL.bark[3]);
  img.vline(9, 9, 14, PAL.bark[1]);
  // A board with an arrow tip: the pointing end is trimmed more the further a row is from the middle.
  const pointRight = variant === 1;
  for (let y = 2; y < 10; y += 1) {
    const cut = Math.floor(Math.abs(y - 5.5));
    const x0 = pointRight ? 1 : 1 + cut;
    const x1 = pointRight ? 14 - cut : 14;
    img.hline(x0, y, x1 - x0, y === 2 ? PAL.plank[4] : y === 9 ? PAL.plank[1] : PAL.plank[3]);
  }
  img.hline(pointRight ? 3 : 5, 4, 6, PAL.bark[0]);
  img.hline(pointRight ? 3 : 5, 6, 5, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function mailbox() {
  const img = new Img(16, 24);
  img.fillRect(7, 10, 2, 13, PAL.bark[2]);
  img.vline(7, 10, 13, PAL.bark[3]);
  // box: a rounded-top loaf
  img.fillRect(3, 7, 10, 5, PAL.clay[2]);
  img.ellipse(8, 7.5, 5, 3.2, PAL.clay[3]);
  img.fillRect(3, 9, 10, 3, PAL.clay[2]);
  img.hline(3, 11, 10, PAL.clay[1]);
  img.hline(4, 8, 8, PAL.clay[4]);
  img.vline(12, 8, 4, PAL.clay[1]);
  img.fillRect(5, 9, 3, 1, PAL.clay[0]); // slot
  // flag
  img.fillRect(13, 4, 2, 6, PAL.berry[2]);
  img.set(13, 4, PAL.berry[1]);
  img.outline(INK_WARM);
  return img;
}

function well() {
  const img = new Img(32, 40);
  // posts and roof
  img.fillRect(4, 10, 3, 22, PAL.bark[2]);
  img.vline(4, 10, 22, PAL.bark[3]);
  img.fillRect(25, 10, 3, 22, PAL.bark[2]);
  img.vline(27, 10, 22, PAL.bark[1]);
  // stone ring
  img.ellipse(16, 31, 13.5, 6.5, STONE[1]);
  for (let y = 25; y < 34; y += 1) {
    for (let x = 3; x < 29; x += 1) {
      const dx = (x + 0.5 - 16) / 13.5;
      const dy = (y + 0.5 - 31) / 6.5;
      if (dx * dx + dy * dy > 1) continue;
      const brick = ((x + (Math.floor(y / 3) % 2) * 3) % 6 === 0 || y % 3 === 0) && y > 28;
      img.set(x, y, brick ? STONE[1] : dy < -0.2 ? STONE[3] : STONE[2]);
    }
  }
  img.ellipse(16, 28.5, 10, 4, STONE[4]);
  img.ellipse(16, 29, 8.5, 3, PAL.water[0]);
  img.ellipse(16, 29.5, 6.5, 2, PAL.water[1]);
  // rope and bucket
  img.vline(16, 12, 11, PAL.plank[3]);
  img.fillRect(14, 22, 5, 4, PAL.plank[2]);
  img.hline(14, 22, 5, PAL.plank[4]);
  img.hline(14, 25, 5, PAL.plank[0]);
  // roof
  for (let y = 1; y < 13; y += 1) {
    const half = 3 + Math.round(y * 1.05);
    for (let x = 16 - half; x < 16 + half; x += 1) {
      if (x < 0 || x > 31) continue;
      const row = y % 4;
      img.set(x, y, row === 3 ? PAL.clay[0] : row === 0 ? PAL.clay[3] : x < 14 ? PAL.clay[2] : PAL.clay[1]);
    }
  }
  img.hline(8, 1, 16, PAL.clay[4]);
  img.outline(INK_WARM);
  return img;
}

function bridge() {
  const img = new Img(80, 32);
  // planks run across the way of travel
  for (let x = 0; x < 80; x += 5) {
    const shade = hash2(x, 3, 91);
    const c = shade < 0.34 ? PAL.plank[2] : shade < 0.68 ? PAL.plank[3] : PAL.plank[1];
    img.fillRect(x, 4, 4, 24, c);
    img.vline(x + 4, 4, 24, PAL.bark[0]);
    img.hline(x, 4, 4, PAL.plank[4]);
    img.set(x + 1, 8, PAL.bark[1]);
    img.set(x + 2, 22, PAL.bark[1]);
  }
  // side beams
  img.fillRect(0, 0, 80, 4, PAL.bark[2]);
  img.hline(0, 0, 80, PAL.bark[3]);
  img.hline(0, 3, 80, PAL.bark[0]);
  img.fillRect(0, 28, 80, 4, PAL.bark[2]);
  img.hline(0, 28, 80, PAL.bark[3]);
  img.hline(0, 31, 80, PAL.bark[0]);
  // posts
  for (const x of [0, 76]) {
    for (const y of [0, 28]) {
      img.fillRect(x, y, 4, 4, PAL.plank[3]);
      img.hline(x, y, 4, PAL.plank[4]);
    }
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ shipping bin and seed stall

function shippingBin() {
  const img = new Img(32, 24);
  // body: upright planks
  for (let x = 2; x < 30; x += 1) {
    const c = (x + 1) % 5 === 0 ? PAL.bark[1] : x < 6 ? PAL.plank[3] : x > 26 ? PAL.plank[1] : PAL.plank[2];
    img.vline(x, 11, 12, c);
  }
  img.hline(2, 22, 28, PAL.bark[0]);
  // iron bands
  for (const x of [5, 25]) {
    img.fillRect(x, 11, 2, 12, STONE[2]);
    img.vline(x, 11, 12, STONE[3]);
  }
  // lid, propped open: a dark inside and a lit rim
  img.fillRect(1, 5, 30, 7, PAL.bark[0]);
  img.fillRect(2, 4, 28, 3, PAL.plank[3]);
  img.hline(2, 4, 28, PAL.plank[4]);
  img.fillRect(2, 7, 28, 4, PAL.plank[2]);
  img.hline(2, 10, 28, PAL.plank[1]);
  for (const x of [5, 25]) img.fillRect(x, 4, 2, 7, STONE[2]);
  // a gold-coloured label
  img.fillRect(13, 14, 6, 4, PAL.gold[2]);
  img.hline(13, 14, 6, PAL.gold[4]);
  img.hline(13, 17, 6, PAL.gold[1]);
  img.outline(INK_WARM);
  return img;
}

function seedStall() {
  const img = new Img(32, 40);
  // posts
  for (const x of [2, 27]) {
    img.fillRect(x, 9, 3, 28, PAL.bark[2]);
    img.vline(x, 9, 28, PAL.bark[3]);
  }
  // striped awning with a scalloped edge
  for (let x = 0; x < 32; x += 1) {
    const stripe = Math.floor(x / 4) % 2 === 0;
    const c = stripe ? PAL.clay[2] : PAL.white[2];
    const edge = stripe ? PAL.clay[1] : PAL.parchment[1];
    img.vline(x, 3, 9, c);
    img.hline(x, 3, 1, stripe ? PAL.clay[3] : PAL.white[2]);
    img.vline(x, 12, x % 4 === 1 || x % 4 === 2 ? 2 : 1, edge);
  }
  // counter
  img.fillRect(1, 27, 30, 3, PAL.plank[3]);
  img.hline(1, 27, 30, PAL.plank[4]);
  img.fillRect(2, 30, 28, 9, PAL.plank[2]);
  for (let x = 6; x < 30; x += 6) img.vline(x, 30, 9, PAL.bark[1]);
  img.hline(2, 38, 28, PAL.bark[0]);
  // goods: seed packets and the honesty tin
  const packet = (x, accent) => {
    img.fillRect(x, 20, 4, 7, PAL.white[2]);
    img.fillRect(x, 20, 4, 2, accent);
    img.set(x + 1, 24, LEAF[2]);
  };
  packet(6, PAL.clay[2]);
  packet(11, PAL.sun[2]);
  packet(16, PAL.berry[2]);
  img.fillRect(23, 22, 5, 5, STONE[2]);
  img.hline(23, 22, 5, STONE[4]);
  img.hline(24, 24, 3, STONE[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ house

/** The un-outlined house picture; `windows: false` leaves the front wall bare for a variant (the store) to dress. */
function houseBody({ roof = PAL.clay, wall = PAL.gold, shutter = PAL.forest, windows = true } = {}) {
  const W = 96;
  const H = 80;
  const img = new Img(W, H);

  // foundation
  for (let y = 74; y < 80; y += 1) {
    for (let x = 2; x < 94; x += 1) {
      const course = Math.floor((y - 74) / 3);
      const joint = (x + course * 5) % 10 === 0 || y === 77;
      img.set(x, y, joint ? STONE[1] : y < 76 ? STONE[3] : STONE[2]);
    }
  }

  // wall: horizontal boards
  for (let y = 44; y < 74; y += 1) {
    const board = Math.floor((y - 44) / 5);
    const seam = (y - 44) % 5 === 4;
    for (let x = 4; x < 92; x += 1) {
      const joint = (x + board * 11) % 29 === 0;
      let c = wall[2];
      if (seam || joint) c = wall[1];
      else if ((y - 44) % 5 === 0) c = wall[3];
      else if (x < 8) c = wall[3];
      else if (x > 87) c = wall[1];
      img.set(x, y, c);
    }
  }
  // eave shadow on the wall
  img.fillRect(4, 44, 88, 3, wall[0]);
  img.fillRect(4, 47, 88, 1, wall[1]);

  // roof: a trapezoid of shingles
  const roofTop = 4;
  const roofBottom = 44;
  for (let y = roofTop; y < roofBottom; y += 1) {
    const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 9);
    const row = Math.floor((y - roofTop) / 4);
    const offset = (row % 2) * 4;
    for (let x = 1 + inset; x < W - 1 - inset; x += 1) {
      const sx = (x + offset) % 8;
      const sy = (y - roofTop) % 4;
      let c = roof[2];
      if (sy === 3) c = roof[0];
      else if (sx === 7) c = roof[1];
      else if (sy === 0) c = roof[3];
      if (row === 0) c = sy === 3 ? roof[1] : roof[3];
      img.set(x, y, c);
    }
  }
  // ridge cap
  img.fillRect(11, 2, 74, 3, roof[1]);
  img.hline(11, 2, 74, roof[3]);

  // chimney
  const cx = 66;
  img.fillRect(cx, 0, 12, 24, STONE[2]);
  img.vline(cx, 0, 24, STONE[3]);
  img.vline(cx + 11, 0, 24, STONE[1]);
  for (let y = 4; y < 24; y += 4) img.hline(cx, y, 12, STONE[1]);
  img.fillRect(cx - 1, 0, 14, 3, STONE[3]);
  img.hline(cx - 1, 2, 14, STONE[1]);

  // door
  img.fillRect(32, 50, 16, 24, PAL.bark[0]); // frame
  img.fillRect(34, 52, 12, 22, PAL.plank[2]);
  for (let x = 34; x < 46; x += 3) img.vline(x, 52, 22, PAL.bark[1]);
  img.hline(34, 52, 12, PAL.plank[4]);
  img.fillRect(43, 63, 2, 2, wall[4]); // knob
  img.fillRect(30, 74, 20, 4, STONE[3]); // step
  img.hline(30, 77, 20, STONE[1]);

  // windows
  const window = (x, y) => {
    img.fillRect(x - 2, y - 2, 18, 16, PAL.bark[0]);
    img.fillRect(x, y, 14, 12, PAL.sky[1]);
    img.fillRect(x, y, 14, 4, PAL.sky[2]);
    img.set(x + 1, y + 1, PAL.white[2]);
    img.set(x + 2, y + 2, PAL.white[2]);
    img.vline(x + 6, y, 12, PAL.bark[1]);
    img.hline(x, y + 5, 14, PAL.bark[1]);
    // shutters
    img.fillRect(x - 5, y - 1, 3, 14, shutter[2]);
    img.fillRect(x + 16, y - 1, 3, 14, shutter[1]);
    for (let i = 1; i < 14; i += 3) {
      img.hline(x - 5, y - 1 + i, 3, shutter[3]);
      img.hline(x + 16, y - 1 + i, 3, shutter[2]);
    }
  };
  if (windows) {
    window(10, 54);
    window(62, 54);
    // flower boxes
    for (const x of [8, 60]) {
      img.fillRect(x, 67, 18, 4, PAL.bark[2]);
      img.hline(x, 70, 18, PAL.bark[0]);
      for (let i = 0; i < 18; i += 2) {
        img.set(x + i, 66, LEAF[2 + (i % 4 === 0 ? 1 : 0)]);
        img.set(x + i, 65, i % 6 === 0 ? PAL.berry[2] : i % 6 === 2 ? PAL.sun[2] : PAL.blossom[2]);
      }
    }
  }

  return img;
}

function house(options) {
  const img = houseBody(options);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ coop, trough, fountain, bench

function coop() {
  const img = new Img(48, 40);
  // roof: a low gable of terracotta shingles
  for (let y = 2; y < 16; y += 1) {
    const inset = Math.round(((16 - y) / 14) * 6);
    for (let x = 1 + inset; x < 47 - inset; x += 1) {
      const row = Math.floor((y - 2) / 3);
      const sx = (x + (row % 2) * 3) % 6;
      const sy = (y - 2) % 3;
      img.set(x, y, sy === 2 ? PAL.clay[0] : sx === 5 ? PAL.clay[1] : sy === 0 ? PAL.clay[3] : PAL.clay[2]);
    }
  }
  img.fillRect(7, 2, 34, 2, PAL.clay[1]);
  // walls: boards
  for (let y = 16; y < 36; y += 1) {
    for (let x = 3; x < 45; x += 1) {
      const board = (x - 3) % 6 === 5;
      img.set(x, y, board ? PAL.plank[1] : x < 8 ? PAL.plank[3] : x > 40 ? PAL.plank[1] : PAL.plank[2]);
    }
  }
  img.fillRect(3, 16, 42, 2, PAL.bark[1]);
  // the little door for the hens, with a ramp
  img.fillRect(30, 24, 8, 11, PAL.bark[0]);
  img.fillRect(31, 25, 6, 10, PAL.bark[1]);
  img.fillRect(29, 35, 10, 3, PAL.plank[3]);
  for (let x = 30; x < 38; x += 2) img.vline(x, 35, 3, PAL.bark[1]);
  // a window with shutters, and a straw-coloured nesting box
  img.fillRect(10, 22, 10, 8, PAL.bark[0]);
  img.fillRect(11, 23, 8, 6, PAL.sky[1]);
  img.set(12, 24, PAL.white[2]);
  img.fillRect(8, 22, 2, 8, PAL.forest[2]);
  img.fillRect(20, 22, 2, 8, PAL.forest[1]);
  img.fillRect(12, 30, 6, 4, PAL.sun[1]);
  img.hline(12, 30, 6, PAL.sun[2]);
  img.hline(3, 36, 42, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function trough() {
  const img = new Img(16, 16);
  img.fillRect(1, 8, 14, 6, PAL.plank[2]);
  img.hline(1, 8, 14, PAL.plank[4]);
  img.fillRect(2, 6, 12, 3, PAL.sun[1]);
  for (const x of [3, 6, 9, 12]) img.set(x, 6, PAL.sun[2]);
  img.hline(1, 13, 14, PAL.plank[0]);
  img.fillRect(2, 14, 2, 1, PAL.bark[0]);
  img.fillRect(12, 14, 2, 1, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function fountain() {
  const img = new Img(32, 40);
  // basin
  img.ellipse(16, 31, 14.5, 7, STONE[1]);
  for (let y = 24; y < 38; y += 1) {
    for (let x = 1; x < 31; x += 1) {
      const dx = (x + 0.5 - 16) / 14.5;
      const dy = (y + 0.5 - 31) / 7;
      if (dx * dx + dy * dy > 1) continue;
      img.set(x, y, dy < -0.3 ? STONE[3] : dy > 0.5 ? STONE[1] : STONE[2]);
    }
  }
  img.ellipse(16, 29, 11.5, 4.6, STONE[4]);
  img.ellipse(16, 29.4, 10, 3.6, PAL.water[2]);
  img.ellipse(15, 28.6, 5, 1.6, PAL.water[3]);
  // the column and its spout
  img.fillRect(14, 12, 4, 17, STONE[2]);
  img.vline(14, 12, 17, STONE[3]);
  img.vline(17, 12, 17, STONE[1]);
  img.ellipse(16, 12, 5.5, 2.4, STONE[3]);
  img.ellipse(16, 11.4, 3.6, 1.4, PAL.water[3]);
  // falling water
  for (const [x, y] of [[12, 14], [11, 17], [10, 21], [20, 14], [21, 17], [22, 21], [16, 8], [15, 5], [17, 6]]) img.set(x, y, PAL.water[4]);
  img.outline(INK);
  return img;
}

function bench() {
  const img = new Img(32, 16);
  img.fillRect(2, 5, 28, 3, PAL.plank[3]);
  img.hline(2, 5, 28, PAL.plank[4]);
  img.hline(2, 7, 28, PAL.plank[1]);
  img.fillRect(2, 9, 28, 3, PAL.plank[2]);
  img.hline(2, 9, 28, PAL.plank[3]);
  img.hline(2, 11, 28, PAL.plank[0]);
  for (const x of [4, 26]) img.fillRect(x, 12, 2, 3, PAL.bark[1]);
  for (const x of [4, 26]) img.fillRect(x, 2, 2, 4, PAL.bark[2]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ decals

function flower(colors, variant) {
  const img = new Img(16, 16);
  const plant = (x, y) => {
    img.vline(x, y + 1, 3, LEAF[1]);
    img.set(x - 1, y + 3, LEAF[2]);
    img.set(x, y - 1, colors[2]);
    img.set(x - 1, y, colors[2]);
    img.set(x + 1, y, colors[1]);
    img.set(x, y, PAL.sun[2]);
  };
  plant(7, 8);
  if (variant === 1) {
    plant(11, 10);
    plant(4, 11);
  }
  return img;
}

function tuft(variant) {
  const img = new Img(16, 16);
  const r = rng(500 + variant);
  const x0 = 6 + variant;
  for (let i = 0; i < 4; i += 1) {
    const x = x0 + i * 2 - 3 + r.int(-1, 0);
    const h = r.int(3, 5);
    const lean = i % 2 === 0 ? -1 : 1;
    for (let k = 0; k < h; k += 1) img.set(x + (k > 1 ? lean : 0), 11 - k, k === h - 1 ? LEAF[3] : LEAF[1]);
  }
  return img;
}

function pebbles(variant) {
  const img = new Img(16, 16);
  const r = rng(700 + variant);
  for (let i = 0; i < 3; i += 1) {
    const x = r.int(3, 11);
    const y = r.int(5, 11);
    img.set(x, y, STONE[3]);
    img.set(x + 1, y, STONE[2]);
    img.set(x, y + 1, STONE[1]);
    img.set(x + 1, y + 1, STONE[0]);
  }
  return img;
}

/** A forest-floor fern: feathery fronds fanning out from the crown, each a rib with paired leaflets. */
function fern(variant) {
  const img = new Img(16, 16);
  const FERN = [[50, 86, 62], [72, 118, 70], [98, 146, 80], [128, 176, 96], [172, 208, 120]];
  const frond = (bx, by, angle, len) => {
    let x = bx;
    let y = by;
    let a = angle;
    for (let t = 1; t <= len; t += 1) {
      a += Math.sign(angle || 1) * 0.12; // the frond curls outwards
      x += Math.sin(a) * 1.0;
      y -= Math.cos(a) * 0.9;
      const px = Math.round(x);
      const py = Math.round(y);
      img.set(px, py, FERN[0]);
      // paired leaflets on alternate steps, shorter towards the tip
      if (t >= 2 && t < len && t % 2 === 0) {
        const reach = t < len - 2 ? 2 : 1;
        for (let k = 1; k <= reach; k += 1) {
          img.set(Math.round(x + Math.cos(a) * k), Math.round(y + Math.sin(a) * k - 0.4), k === reach ? FERN[2] : FERN[1]);
          img.set(Math.round(x - Math.cos(a) * k), Math.round(y - Math.sin(a) * k - 0.4), k === reach ? FERN[2] : FERN[1]);
        }
      }
      if (t === len) img.set(px, py - 1, FERN[3]);
    }
  };
  if (variant === 0) {
    for (const [angle, len] of [[-1.25, 5], [-0.55, 8], [0.0, 9], [0.55, 8], [1.25, 5]]) frond(8, 13, angle, len);
  } else {
    for (const [angle, len] of [[-0.9, 7], [-0.2, 9], [0.5, 8]]) frond(6, 13, angle, len);
    frond(11, 14, 1.0, 5);
  }
  img.set(7, 13, FERN[0]);
  img.set(8, 13, FERN[0]);
  img.set(9, 13, FERN[1]);
  return img;
}

/** Bluebells: slender stems that nod over at the top, hung with small blue bells. */
function bluebell(variant) {
  const img = new Img(16, 16);
  const BELL = ramp([104, 126, 240], 3, { dark: 0.45, light: 0.4 });
  const bell = (x, y) => {
    img.set(x, y, BELL[2]);
    img.set(x + 1, y, BELL[1]);
    img.set(x, y + 1, BELL[1]);
    img.set(x + 1, y + 1, BELL[0]);
  };
  const stem = (x, height, lean, bells) => {
    for (let t = 0; t < height; t += 1) {
      const arch = t > height - 4 ? Math.round((t - (height - 4)) * 0.8 * lean) : 0;
      img.set(x + arch, 13 - t, LEAF[1]);
    }
    const topX = x + Math.round(3 * 0.8 * lean);
    for (let i = 0; i < bells; i += 1) bell(topX + (lean > 0 ? 0 : -1) + lean * (i > 0 ? 1 : 0), 13 - height + 3 + i * 3 - (i === 0 ? 1 : 0));
  };
  // a low tuft of strap leaves at the foot
  for (const [x, y] of [[6, 13], [7, 12], [9, 12], [10, 13], [5, 12], [11, 12], [4, 13], [12, 13]]) img.set(x, y, LEAF[2]);
  for (const x of [7, 8, 9]) img.set(x, 13, LEAF[1]);
  if (variant === 0) {
    stem(7, 9, 1, 3);
    stem(10, 6, -1, 2);
  } else {
    stem(5, 7, -1, 2);
    stem(8, 10, 1, 3);
    stem(11, 6, 1, 2);
  }
  return img;
}

function mushroom() {
  const img = new Img(16, 16);
  img.fillRect(7, 9, 2, 3, PAL.white[1]);
  img.ellipse(8, 8.5, 3.6, 2.6, PAL.berry[2]);
  img.hline(5, 9, 6, PAL.berry[1]);
  img.set(6, 7, PAL.white[2]);
  img.set(9, 8, PAL.white[2]);
  img.outline(INK, { diagonals: false });
  return img;
}

// ------------------------------------------------------------------------------------------ fx

function shadow(w, h, alpha = 70) {
  const img = new Img(w, h);
  img.ellipse(w / 2, h / 2, w / 2, h / 2, PAL.ink, alpha);
  return img;
}

function smoke(size) {
  const img = new Img(size, size);
  const c = size / 2;
  img.ellipse(c, c, c, c, PAL.white[2], 200);
  img.ellipse(c - 0.5, c - 0.5, c * 0.62, c * 0.62, PAL.white[2], 255);
  return img;
}

function interactArrow() {
  const img = new Img(11, 10);
  for (let y = 0; y < 5; y += 1) img.hline(y, y + 1, 9 - y * 2, PAL.sun[2]);
  img.fillRect(3, 0, 5, 3, PAL.sun[2]);
  img.hline(3, 0, 5, PAL.sun[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildObjects(frames) {
  frames.set('object/oak_a', oak(11));
  frames.set('object/oak_b', oak(23));
  frames.set('object/oak_autumn', oak(37, AUTUMN));
  frames.set('object/pine_a', pine(5));
  frames.set('object/pine_b', pine(17));
  frames.set('object/bush', bush(3));
  frames.set('object/bush_berry', bush(8, true));
  frames.set('object/rock_small', rock(16, 16, 4, false));
  frames.set('object/rock_mossy', rock(16, 16, 9, true));
  frames.set('object/boulder', rock(32, 24, 12, true));
  frames.set('object/stump', stump());
  frames.set('object/log', log());
  for (let mask = 0; mask < 16; mask += 1) frames.set(`object/fence_m${mask}`, fence(mask));
  frames.set('object/signpost_left', signpost(0));
  frames.set('object/signpost_right', signpost(1));
  frames.set('object/mailbox', mailbox());
  frames.set('object/well', well());
  frames.set('object/bridge_h', bridge());
  frames.set('object/farmhouse', house());
  frames.set('object/cottage_blue', house({ roof: ramp(mix(BRAND.riverBlue, [60, 76, 110], 0.45), 5, { dark: 0.5, light: 0.4 }), wall: ramp(mix(DERIVED.cream, BRAND.sageGreen, 0.35), 5, { dark: 0.45, light: 0.3 }), shutter: ramp(BRAND.terracotta, 5) }));
  frames.set('object/cottage_green', house({ roof: ramp(mix(BRAND.forestGreen, [40, 90, 70], 0.3), 5, { dark: 0.55, light: 0.35 }), wall: ramp(mix(DERIVED.parchment, BRAND.wheatGold, 0.4), 5, { dark: 0.45, light: 0.35 }), shutter: ramp(BRAND.riverBlue, 5) }));
  frames.set('object/coop', coop());
  frames.set('object/trough', trough());
  frames.set('object/fountain', fountain());
  frames.set('object/bench', bench());
  frames.set('object/shipping_bin', shippingBin());
  frames.set('object/seed_stall', seedStall());

  const flowerColors = {
    red: PAL.berry,
    yellow: PAL.sun,
    blue: ramp(mix(BRAND.riverBlue, [120, 140, 230], 0.5), 3),
    white: PAL.white,
    pink: PAL.blossom,
  };
  for (const [name, colors] of Object.entries(flowerColors)) {
    for (let v = 0; v < 2; v += 1) frames.set(`decal/flower_${name}_${v}`, flower(colors, v));
  }
  for (let v = 0; v < 3; v += 1) frames.set(`decal/tuft_${v}`, tuft(v));
  for (let v = 0; v < 2; v += 1) frames.set(`decal/pebbles_${v}`, pebbles(v));
  frames.set('decal/mushroom', mushroom());
  for (let v = 0; v < 2; v += 1) frames.set(`decal/fern_${v}`, fern(v));
  for (let v = 0; v < 2; v += 1) frames.set(`decal/bluebell_${v}`, bluebell(v));

  frames.set('fx/shadow_tree', shadow(40, 12));
  frames.set('fx/shadow_pine', shadow(36, 11));
  frames.set('fx/shadow_small', shadow(14, 6));
  frames.set('fx/shadow_medium', shadow(26, 8));
  frames.set('fx/shadow_house', shadow(100, 16, 60));
  frames.set('fx/shadow_player', shadow(12, 5, 80));
  for (const [i, size] of [6, 8, 10, 12].entries()) frames.set(`fx/smoke_${i}`, smoke(size));
  frames.set('fx/interact_arrow', interactArrow());
}

export const OBJECT_MASKS = { N: F_N, E: F_E, S: F_S, W: F_W };
export { DERIVED, houseBody, LEAF, paintBalls, STONE, tone };
