// Fishing art for Phase 4: the dock, the fishing rod, six fish, the float and the timing bar, ripples and splashes.
//
// Frame names (the contract with src/data/objects.ts, src/data/items.ts and src/rendering/frameNames.ts):
//   object/dock_h                              64 x 32, 4 x 2 cells, lies over water
//   item/{fishing_rod, minnow, perch, carp, trout, catfish, pike}   16 x 16 icons (fish swim to the right)
//   tool/fishing_rod                           16 x 16, held at the lower left, rod angled up and to the right
//   fx/bobber_{0,1}                            8 x 8, the float on the water and the float pulled under
//   fx/bite_mark                               8 x 12, a bold exclamation mark
//   fx/ripple_{0-2}                            16 x 16, one to three widening rings (draw on water)
//   fx/fish_bar 48 x 8, fx/fish_zone 4 x 4, fx/fish_marker 3 x 10   the timing bar and its parts
//   fx/splash_{0-2}                            16 x 16, water thrown up as a fish is landed
import { Img } from '../canvas.mjs';
import { mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';

const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;
const STEEL = ramp([156, 164, 172], 5, { dark: 0.45, light: 0.35 });
const ROPE = ramp([204, 170, 108], 5, { dark: 0.45, light: 0.35 });

// ------------------------------------------------------------------------------------------ dock

function dock() {
  const W = 64;
  const H = 32;
  const img = new Img(W, H);
  // planks run across the way of walking, each worn a little differently
  for (let x = 0; x < W; x += 5) {
    const shade = hash2(x, 7, 133);
    const c = shade < 0.34 ? PAL.plank[2] : shade < 0.68 ? PAL.plank[3] : PAL.plank[1];
    img.fillRect(x, 4, 4, 24, c);
    img.vline(x + 4, 4, 24, PAL.bark[0]);
    img.hline(x, 4, 4, PAL.plank[4]);
    img.set(x + 1, 7 + (x % 3), PAL.bark[1]);
    img.set(x + 2, 23 - (x % 4), PAL.bark[1]);
    img.set(x + 1, 6, PAL.bark[0]); // nails
    img.set(x + 1, 25, PAL.bark[0]);
  }
  // side beams, lit on top
  for (const y of [0, 28]) {
    img.fillRect(0, y, W, 4, PAL.bark[2]);
    img.hline(0, y, W, PAL.bark[3]);
    img.hline(0, y + 3, W, PAL.bark[0]);
  }
  // mooring posts at the open end and half-way along: round pilings seen from above
  const piling = (cx, cy) => {
    img.ellipse(cx, cy + 0.6, 3.4, 3.2, PAL.bark[0]);
    img.ellipse(cx, cy, 3.2, 3.0, PAL.bark[1]);
    img.ellipse(cx - 0.2, cy - 0.3, 2.5, 2.4, PAL.plank[2]);
    img.ellipse(cx - 0.6, cy - 0.7, 1.6, 1.5, PAL.plank[3]);
    img.set(cx - 1, cy - 1, PAL.plank[4]);
    img.set(cx + 1, cy + 1, PAL.plank[1]);
  };
  for (const x of [30, 60]) {
    piling(x, 3.5);
    piling(x, 28.5);
  }
  // a coiled rope near the end, its tail running to a post
  const cx = 47;
  const cy = 15;
  for (let y = cy - 6; y <= cy + 6; y += 1) {
    for (let x = cx - 7; x <= cx + 7; x += 1) {
      const dx = (x + 0.5 - cx) / 7;
      const dy = (y + 0.5 - cy) / 5.6;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      if (d < 0.3) {
        img.set(x, y, PAL.bark[0]);
        continue;
      }
      const band = (d - 0.3) / 0.7 * 3;
      const ring = Math.floor(band);
      const seam = band - ring > 0.82;
      let c = ring % 2 === 0 ? ROPE[2] : ROPE[3];
      if ((x + y * 2 + ring) % 4 === 0) c = ROPE[4];
      if (seam) c = ROPE[0];
      if (dx > 0.3 && dy > 0.1) c = c === ROPE[0] ? c : mix(c, ROPE[0], 0.3);
      img.set(x, y, c);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    img.set(54 + i, 13 - Math.floor(i / 3), ROPE[i % 2 === 0 ? 2 : 1]);
    img.set(54 + i, 14 - Math.floor(i / 3), ROPE[0]);
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ rod

function rod() {
  const img = new Img(16, 16);
  // the rod: thick near the hand, thin at the tip, rising to the upper right
  for (let i = 0; i < 12; i += 1) {
    const x = 1 + i;
    const y = 14 - i;
    img.set(x, y, PAL.plank[2]);
    if (i < 8) img.set(x + 1, y, PAL.plank[1]);
    if (i % 4 === 0) img.set(x, y - 1, PAL.plank[3]);
  }
  img.set(13, 2, PAL.plank[3]);
  img.set(14, 1, PAL.bark[2]);
  // a cork grip and a small reel
  for (const [x, y] of [[1, 14], [2, 13], [3, 12]]) {
    img.set(x, y, [210, 170, 110]);
    img.set(x + 1, y, [160, 120, 72]);
  }
  img.fillRect(5, 9, 3, 3, STEEL[2]);
  img.hline(5, 9, 3, STEEL[4]);
  img.set(6, 10, STEEL[0]);
  img.set(7, 11, STEEL[1]);
  img.set(4, 11, STEEL[3]);
  img.outline(INK_WARM);
  // the line and hook hang from the tip, thin enough to need no outline
  for (let y = 2; y < 8; y += 1) img.set(15, y, PAL.white[1]);
  img.set(14, 8, STEEL[3]);
  img.set(14, 9, STEEL[2]);
  return img;
}

// ------------------------------------------------------------------------------------------ fish

/**
 * One fish swimming to the right, built from a body profile and then dressed per species.
 * `len` is the body length without the tail; the tail starts at `x0`.
 */
function fishBody(img, { x0, len, cy, half, shape, back, side, belly, tailLen, tailHalf, fork, fin, tailColor, peduncle = 1.1 }) {
  const rows = new Map();
  for (let i = 0; i < len; i += 1) {
    const u = (i + 0.5) / len;
    const h = Math.max(peduncle, half * Math.pow(Math.sin(Math.PI * Math.pow(u, shape)), 0.62));
    const x = x0 + i;
    const top = Math.round(cy - h);
    const bottom = Math.round(cy + h) - 1;
    rows.set(x, [top, bottom]);
    for (let y = top; y <= bottom; y += 1) {
      const v = bottom === top ? 0.5 : (y - top) / (bottom - top);
      img.set(x, y, v < 0.26 ? back : v > 0.74 ? belly : side);
    }
  }
  // tail fin: a wedge that widens away from the body; a fork cuts a notch in it
  for (let t = 1; t <= tailLen; t += 1) {
    const reach = Math.max(0.5, (t / tailLen) * tailHalf);
    for (let y = Math.round(cy - reach); y < Math.round(cy + reach); y += 1) {
      if (fork && t >= Math.ceil(tailLen / 2) && Math.abs(y + 0.5 - cy) < t * 0.28) continue;
      img.set(x0 - t, y, tailColor ?? fin);
    }
  }
  return rows;
}

const FISH_LOOK = {
  minnow: {
    x0: 4, len: 10, cy: 8, half: 2.4, shape: 0.95, tailLen: 3, tailHalf: 2.6, fork: true,
    back: [88, 120, 152], side: [164, 192, 210], belly: [232, 240, 244], fin: [186, 208, 222],
  },
  perch: {
    x0: 4, len: 10, cy: 8.5, half: 4.4, shape: 1.15, tailLen: 3, tailHalf: 3.4, fork: true,
    back: [78, 98, 52], side: [160, 154, 68], belly: [238, 224, 150], fin: [226, 112, 44],
  },
  carp: {
    x0: 4, len: 10, cy: 8.5, half: 4.6, shape: 1.0, tailLen: 3, tailHalf: 4.0, fork: true,
    back: [140, 88, 38], side: [212, 160, 70], belly: [244, 218, 148], fin: [204, 112, 44],
  },
  trout: {
    x0: 3, len: 11, cy: 8, half: 3.2, shape: 1.35, tailLen: 2, tailHalf: 3.2, fork: false,
    back: [82, 114, 76], side: [150, 176, 124], belly: [238, 226, 188], fin: [150, 176, 124],
  },
  catfish: {
    x0: 3, len: 9, cy: 8.5, half: 4.0, shape: 1.8, tailLen: 2, tailHalf: 3.0, fork: false,
    back: [66, 66, 86], side: [108, 106, 124], belly: [188, 182, 176], fin: [74, 74, 94], peduncle: 1.4,
  },
  pike: {
    x0: 3, len: 11, cy: 8.5, half: 3.0, shape: 1.15, tailLen: 2, tailHalf: 3.6, fork: true,
    back: [70, 96, 52], side: [124, 146, 66], belly: [226, 222, 160], fin: [124, 146, 66],
  },
};

function fishIcon(kind) {
  const img = new Img(16, 16);
  const look = FISH_LOOK[kind];
  const lit = (c) => mix(c, [255, 240, 176], 0.3);
  const shade = (c) => mix(c, [40, 44, 84], 0.35);
  const rows = fishBody(img, look);
  const xHead = look.x0 + look.len - 1;
  const [topHead] = rows.get(xHead - 2);
  const eyeY = Math.round(look.cy - look.half * 0.35);
  const mid = (x) => {
    const [t, b] = rows.get(x);
    return [t, b];
  };

  if (kind === 'minnow') {
    for (let x = look.x0 + 1; x < xHead - 1; x += 1) img.set(x, 8, [64, 86, 118]); // dark lateral stripe
    img.set(look.x0 + 4, 5, look.fin);
    img.set(look.x0 + 5, 5, look.fin);
    img.set(xHead - 1, eyeY, INK);
  } else if (kind === 'perch') {
    for (const x of [look.x0 + 3, look.x0 + 5, look.x0 + 7]) {
      const [t, b] = mid(x);
      for (let y = t; y <= b - 2; y += 1) img.set(x, y, [58, 70, 36]);
    }
    for (let x = look.x0 + 3; x < look.x0 + 9; x += 1) {
      const [t] = mid(x);
      img.set(x, t - 1, look.fin);
      if (x % 2 === 0) img.set(x, t - 2, look.fin);
    }
    img.set(xHead - 4, mid(xHead - 4)[1] + 1, look.fin);
    img.set(xHead - 5, mid(xHead - 5)[1] + 1, look.fin);
    img.set(xHead - 2, eyeY, INK);
    img.set(xHead - 1, eyeY - 1, [250, 214, 120]);
  } else if (kind === 'carp') {
    for (let x = look.x0 + 2; x < xHead - 2; x += 1) {
      const [t, b] = mid(x);
      for (let y = t + 1; y <= b - 1; y += 1) if ((x + y) % 3 === 0) img.set(x, y, shade(look.side));
    }
    for (let x = look.x0 + 2; x < look.x0 + 10; x += 1) img.set(x, mid(x)[0] - 1, shade(look.fin));
    img.set(xHead - 3, mid(xHead - 3)[1] + 1, look.fin);
    img.set(xHead - 4, mid(xHead - 4)[1] + 1, look.fin);
    img.set(xHead - 2, eyeY, INK);
    img.set(xHead + 1, eyeY + 3, [168, 120, 52]); // barbels
    img.set(xHead + 1, eyeY + 4, [168, 120, 52]);
  } else if (kind === 'trout') {
    for (let x = look.x0 + 1; x < xHead - 3; x += 1) {
      img.set(x, 8, [226, 128, 136]); // rose lateral band
      if (x % 2 === 0) img.set(x, 7, [236, 156, 160]);
    }
    for (const [dx, dy] of [[3, -2], [5, -1], [7, -2], [9, -1], [4, 1], [8, 1]]) img.set(look.x0 + dx, 8 + dy, [38, 52, 44]);
    img.set(xHead - 2, eyeY, INK);
    img.set(look.x0 + 4, mid(look.x0 + 4)[0] - 1, shade(look.back));
    img.set(look.x0 + 3, mid(look.x0 + 3)[0] - 1, shade(look.back));
  } else if (kind === 'catfish') {
    for (let x = xHead - 6; x <= xHead; x += 1) img.set(x, mid(x)[1], lit(look.belly));
    img.set(look.x0 + 5, mid(look.x0 + 5)[0] - 1, look.fin);
    img.set(look.x0 + 6, mid(look.x0 + 6)[0] - 1, look.fin);
    img.set(xHead - 3, eyeY, INK);
  } else if (kind === 'pike') {
    for (const [dx, dy] of [[2, -1], [4, 0], [6, -1], [8, 0], [3, 1], [7, 1], [5, -2]]) img.set(look.x0 + dx, 8 + dy, [232, 226, 150]);
    // a flat duck-bill snout and a long dorsal fin set far back
    img.set(xHead + 1, 8, look.back);
    img.set(xHead + 1, 9, look.side);
    img.hline(xHead - 2, 10, 3, shade(look.belly));
    for (let x = look.x0 + 2; x < look.x0 + 6; x += 1) img.set(x, mid(x)[0] - 1, look.fin);
    img.set(look.x0 + 5, mid(look.x0 + 5)[1] + 1, look.fin);
    img.set(xHead - 3, eyeY, INK);
    img.set(xHead - 2, eyeY, [236, 200, 90]);
  }
  void topHead;
  img.outline(INK);
  if (kind === 'catfish') {
    // long whiskers sweeping forward and out, thin enough to need no outline
    const w = [172, 178, 196];
    for (const [dx, dy] of [[2, 3], [3, 4], [4, 5], [2, 4], [3, 5], [2, 1], [3, 0], [4, -1]]) img.set(xHead + dx, eyeY + dy, w);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ float, bite, ripples

const FLOAT_RED = ramp([212, 64, 56], 5, { dark: 0.5, light: 0.4 });
const WATER_LIGHT = [204, 226, 236];

function bobber(dipped) {
  const body = new Img(8, 8);
  const dy = dipped ? 1 : 0;
  body.fillRect(3, 2 + dy, 2, 1, FLOAT_RED[2]);
  body.fillRect(2, 3 + dy, 4, 1, FLOAT_RED[2]);
  body.set(2, 3 + dy, FLOAT_RED[3]);
  body.set(3, 2 + dy, FLOAT_RED[3]);
  body.set(5, 3 + dy, FLOAT_RED[1]);
  body.fillRect(2, 4 + dy, 4, 1, PAL.white[2]);
  body.set(5, 4 + dy, PAL.parchment[1]);
  body.fillRect(3, 5 + dy, 2, 1, PAL.white[1]);
  body.outline(INK_WARM);
  // the thin yellow-tipped stalk
  body.set(3, 0 + dy, PAL.sun[2]);
  body.set(3, 1 + dy, PAL.white[2]);
  // the water around it
  const out = new Img(8, 8);
  out.blit(body, 0, 0);
  if (!dipped) {
    for (const x of [1, 2, 5, 6]) out.set(x, 6, WATER_LIGHT);
    for (let x = 1; x < 7; x += 1) out.set(x, 7, WATER_LIGHT, 130);
  } else {
    // the white half is below the surface: tint it
    for (let y = 5; y < 8; y += 1) for (let x = 1; x < 7; x += 1) if (out.alphaAt(x, y) > 0) out.over(x, y, PAL.water[1], 150);
    for (let x = 0; x < 8; x += 1) out.set(x, 5, WATER_LIGHT);
    for (let x = 1; x < 7; x += 1) out.set(x, 6, WATER_LIGHT, 150);
    for (let x = 2; x < 6; x += 1) out.set(x, 7, WATER_LIGHT, 80);
  }
  return out;
}

function biteMark() {
  const img = new Img(8, 12);
  const SUN = ramp([250, 206, 70], 5, { dark: 0.4, light: 0.45 });
  img.fillRect(2, 1, 4, 5, SUN[2]);
  img.fillRect(3, 6, 2, 2, SUN[2]);
  img.vline(2, 1, 5, SUN[3]);
  img.vline(5, 1, 5, SUN[1]);
  img.set(3, 1, SUN[4]);
  img.set(4, 7, SUN[1]);
  img.fillRect(3, 9, 2, 2, SUN[2]);
  img.set(3, 9, SUN[3]);
  img.set(4, 10, SUN[1]);
  img.outline(INK_WARM);
  return img;
}

function ripple(rings) {
  const img = new Img(16, 16);
  const ring = (rx, ry, alpha) => {
    for (let i = 0; i < 72; i += 1) {
      const a = (i / 72) * Math.PI * 2;
      const x = Math.round(7.5 + Math.cos(a) * rx);
      const y = Math.round(8 + Math.sin(a) * ry);
      const up = Math.sin(a) < -0.2;
      img.set(x, y, up ? [232, 244, 248] : WATER_LIGHT, alpha);
    }
  };
  const radii = [[2.2, 1.3, 255], [4.8, 2.7, 220], [7.2, 3.9, 165]];
  if (rings === 1) ring(...radii[0]);
  if (rings === 2) {
    ring(...radii[0]);
    ring(...radii[1]);
  }
  if (rings === 3) {
    ring(...radii[0]);
    ring(...radii[1]);
    ring(...radii[2]);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ timing bar

function fishBar() {
  const img = new Img(48, 8);
  const GOLD = ramp([222, 178, 78], 5, { dark: 0.5, light: 0.4 });
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const corner = (x === 0 || x === 47) && (y === 0 || y === 7);
      if (corner) continue;
      const edge = x === 0 || x === 47 || y === 0 || y === 7;
      if (edge) img.set(x, y, y === 0 ? GOLD[3] : y === 7 ? GOLD[1] : GOLD[2]);
      else img.set(x, y, y === 1 ? [46, 54, 62] : y === 6 ? [18, 22, 28] : [30, 36, 44]);
    }
  }
  for (const [x, y] of [[1, 1], [46, 1], [1, 6], [46, 6]]) img.set(x, y, GOLD[1]);
  return img;
}

function fishZone() {
  const img = new Img(4, 4);
  img.fill([112, 222, 92]);
  return img;
}

function fishMarker() {
  const img = new Img(3, 10);
  const GOLD = ramp([240, 196, 92], 5, { dark: 0.4, light: 0.4 });
  img.set(1, 0, PAL.white[2]);
  img.set(1, 9, GOLD[2]);
  for (let y = 1; y < 9; y += 1) {
    img.set(0, y, GOLD[3]);
    img.set(1, y, PAL.white[2]);
    img.set(2, y, GOLD[1]);
  }
  img.set(0, 1, PAL.white[1]);
  return img;
}

// ------------------------------------------------------------------------------------------ splashes

function splash(stage) {
  const img = new Img(16, 16);
  const W1 = [236, 246, 250];
  const W2 = PAL.water[4];
  const W3 = PAL.water[3];
  const ring = (rx, ry, alpha) => {
    for (let i = 0; i < 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      const x = Math.round(7.5 + Math.cos(a) * rx);
      const y = Math.round(11 + Math.sin(a) * ry);
      img.set(x, y, Math.sin(a) < 0 ? W1 : W3, alpha);
    }
  };
  const spike = (x, y0, height, alpha, color = W1) => {
    for (let k = 0; k < height; k += 1) img.set(x, y0 - k, k === height - 1 ? W1 : color, alpha);
  };
  if (stage === 0) {
    ring(3.6, 1.7, 255);
    spike(7, 10, 4, 255, W2);
    spike(8, 10, 6, 255, W2);
    spike(5, 10, 2, 255, W2);
    spike(10, 10, 3, 255, W2);
    for (const [x, y] of [[6, 4], [9, 3], [4, 6], [11, 5]]) img.set(x, y, W1);
  } else if (stage === 1) {
    ring(5.6, 2.5, 235);
    spike(6, 10, 6, 235, W2);
    spike(8, 10, 8, 235, W2);
    spike(10, 10, 5, 235, W2);
    spike(4, 10, 3, 235, W2);
    spike(12, 10, 3, 235, W2);
    for (const [x, y] of [[5, 2], [9, 0], [12, 3], [3, 4], [7, 1], [13, 6], [2, 7]]) img.set(x, y, W1, 245);
  } else {
    ring(7, 3.1, 140);
    for (const [x, y, a] of [[4, 5, 190], [11, 4, 190], [2, 8, 170], [13, 8, 170], [6, 2, 150], [9, 3, 150], [5, 9, 150], [10, 9, 150]]) {
      img.set(x, y, W1, a);
      img.set(x, y + 1, W2, Math.round(a * 0.7));
    }
    for (const [x, y] of [[1, 6], [14, 6], [3, 3], [12, 2]]) img.set(x, y, W2, 120);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildFishing(frames) {
  frames.set('object/dock_h', dock());
  frames.set('item/fishing_rod', rod());
  frames.set('tool/fishing_rod', rod());
  for (const kind of ['minnow', 'perch', 'carp', 'trout', 'catfish', 'pike']) frames.set(`item/${kind}`, fishIcon(kind));
  frames.set('fx/bobber_0', bobber(false));
  frames.set('fx/bobber_1', bobber(true));
  frames.set('fx/bite_mark', biteMark());
  for (let i = 0; i < 3; i += 1) frames.set(`fx/ripple_${i}`, ripple(i + 1));
  frames.set('fx/fish_bar', fishBar());
  frames.set('fx/fish_zone', fishZone());
  frames.set('fx/fish_marker', fishMarker());
  for (let i = 0; i < 3; i += 1) frames.set(`fx/splash_${i}`, splash(i));
}

void INK;
