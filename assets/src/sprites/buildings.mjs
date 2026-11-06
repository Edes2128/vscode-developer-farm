// Phase 5 buildings: the greenhouse, its building site, and the museum. All three share the cottages' construction:
// a 96 px wide picture, six cells across, a stone foundation, the door in the THIRD cell of the bottom row (x 32..48).
//
// Frame names (the contract with src/data/objects.ts):
//   object/greenhouse     96 x 64   3 rows of building + a 16 px roof row; door x 32..48, y 32..58
//   object/construction   96 x 64   the same footprint as a building site; the door cell (x 32..48) is left clear
//   object/museum         96 x 80   4 rows of building + a 16 px peak row; door x 32..48, y 50..74
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { BRASS, IRON, ORANGE_GLOW, RED } from './interior.mjs';
import { LEAF, paintBalls, STONE } from './objects.mjs';
import { GLASS, STEEL, TIMBER, WALNUT } from './home.mjs';
import { INK_WARM, line, lit, polygon, shade, spiral } from './draw5.mjs';

const SOIL = ramp(mix(DERIVED.woodDark, BRAND.terracotta, 0.3), 5, { dark: 0.5, light: 0.4 });

/** The cottages' foundation: courses of stone along the foot of the building. */
function foundation(img, y0, height, tones = STONE) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = 2; x < img.w - 2; x += 1) {
      const course = Math.floor((y - y0) / 3);
      const joint = (x + course * 5) % 10 === 0 || y === y0 + 3;
      img.set(x, y, joint ? tones[1] : y < y0 + 2 ? tones[3] : tones[2]);
    }
  }
}

// ------------------------------------------------------------------------------------------ greenhouse

/** What grows inside: leafy vines, a sunflower, a fern, ripe tomatoes, painted before the glass goes over it. */
function plantsInside(img) {
  const y0 = 26;
  for (let y = y0; y < 58; y += 1) {
    const t = (y - y0) / 32;
    for (let x = 4; x < 92; x += 1) img.set(x, y, mix(mix(GLASS[1], LEAF[0], 0.55), mix(LEAF[0], [22, 34, 32], 0.4), t));
  }
  // the far wall of the house: a pale timber back with a lit shelf
  img.hline(4, 40, 88, mix(GLASS[2], LEAF[1], 0.4));
  // a potting bench along the foot, with clay pots
  img.fillRect(4, 51, 88, 7, SOIL[1]);
  img.hline(4, 51, 88, SOIL[3]);
  for (let x = 6; x < 90; x += 7) {
    img.fillRect(x, 50, 5, 5, PAL.clay[2]);
    img.hline(x, 50, 5, PAL.clay[4]);
    img.hline(x, 54, 5, PAL.clay[0]);
  }
  // tomato vines on stakes
  for (const [sx, top] of [[12, 30], [27, 33]]) {
    img.vline(sx, top, 21, PAL.bark[2]);
    paintBalls(
      img,
      [
        { x: sx, y: top + 4, r: 3.4, tone: 0.1 },
        { x: sx + 2, y: top + 10, r: 4, tone: 0 },
        { x: sx - 2, y: top + 15, r: 4, tone: -0.05 },
      ],
      LEAF,
      sx,
    );
    for (const [dx, dy] of [[-3, 11], [4, 12], [-4, 16], [3, 6]]) {
      img.set(sx + dx, top + dy, RED[2]);
      img.set(sx + dx + 1, top + dy, RED[1]);
      img.set(sx + dx, top + dy - 1, RED[3]);
    }
  }
  // a big fern
  paintBalls(
    img,
    [
      { x: 20, y: 46, r: 4.4, tone: 0.1 },
      { x: 56, y: 45, r: 5.2, tone: 0.06 },
      { x: 62, y: 47, r: 4.4, tone: -0.02 },
    ],
    LEAF,
    77,
  );
  // a flowering bush with pink blossoms, and a hanging basket
  paintBalls(img, [{ x: 66, y: 44, r: 5, tone: 0.1 }, { x: 71, y: 46, r: 4, tone: -0.04 }], LEAF, 91);
  for (const [x, y, c] of [[63, 42, PAL.blossom], [66, 40, PAL.blossom], [69, 43, PAL.white], [65, 46, PAL.blossom], [71, 44, PAL.blossom], [68, 47, PAL.sun]]) {
    img.fillRect(x, y, 2, 2, c[2]);
    img.set(x, y, c[1] === undefined ? c[2] : lit(c[2], 0.3));
  }
  img.vline(78, 29, 3, PAL.parchment[1]);
  img.fillRect(75, 32, 7, 3, PAL.clay[2]);
  img.hline(75, 32, 7, PAL.clay[4]);
  for (const [x, y] of [[74, 34], [75, 36], [81, 35], [82, 37], [76, 37], [79, 36]]) img.set(x, y, LEAF[3]);
  for (const [x, y] of [[76, 31], [80, 31], [78, 30]]) img.set(x, y, PAL.sun[2]);
  // a banana plant: long arching leaves
  const fx = 86;
  img.vline(fx, 38, 14, LEAF[0]);
  for (const [dx, dy, len] of [[-6, -3, 6], [5, -3, 6], [-4, -6, 5], [3, -6, 5], [0, -8, 4]]) {
    for (let i = 0; i <= len; i += 1) {
      const px = fx + Math.round((dx * i) / len);
      const py = 39 + Math.round((dy * i) / len) + Math.round((i * i) / (len * 2.2));
      img.set(px, py, LEAF[3]);
      img.set(px, py + 1, LEAF[2]);
      img.set(px, py + 2, LEAF[1]);
    }
  }
}

function greenhouse() {
  const W = 96;
  const H = 64;
  const img = new Img(W, H);

  foundation(img, 58, 6);

  // the inside, then the glass over it, then the timber frame over that
  plantsInside(img);
  const wallX0 = 4;
  const wallX1 = 92;
  const wallY0 = 25;
  const wallY1 = 58;
  for (let y = wallY0; y < wallY1; y += 1) {
    const t = (y - wallY0) / (wallY1 - wallY0);
    for (let x = wallX0; x < wallX1; x += 1) {
      img.over(x, y, GLASS[3], t < 0.3 ? 104 : 72);
      if ((x + y) % 2 === 0 && t < 0.18) img.over(x, y, GLASS[4], 40);
    }
  }
  // slanted glints on every pane
  const glint = (x, y, len) => {
    for (let i = 0; i < len; i += 1) {
      img.over(x + i, y - i, [255, 255, 255], 150);
      img.over(x + i + 1, y - i, [255, 255, 255], 70);
    }
  };
  for (const x of [9, 18, 27, 52, 62, 72, 82]) {
    glint(x, 38, 6);
    glint(x + 1, 52, 4);
  }

  // timber: posts, a mid rail, the eave beam and the sill beam
  const post = (x0, w) => {
    img.fillRect(x0, wallY0, w, wallY1 - wallY0, TIMBER[2]);
    img.vline(x0, wallY0, wallY1 - wallY0, TIMBER[4]);
    if (w > 2) img.vline(x0 + 1, wallY0, wallY1 - wallY0, TIMBER[3]);
    img.vline(x0 + w - 1, wallY0, wallY1 - wallY0, TIMBER[1]);
  };
  post(4, 3);
  post(14, 2);
  post(23, 2);
  post(29, 3);
  post(48, 3);
  post(58, 2);
  post(68, 2);
  post(78, 2);
  post(89, 3);
  // the mid rail and the eave and sill beams
  for (const y of [40]) {
    img.hline(wallX0, y, wallX1 - wallX0, TIMBER[4]);
    img.hline(wallX0, y + 1, wallX1 - wallX0, TIMBER[2]);
    img.hline(wallX0, y + 2, wallX1 - wallX0, GLASS[1]);
  }
  img.fillRect(wallX0, 24, wallX1 - wallX0, 4, TIMBER[3]);
  img.hline(wallX0, 24, wallX1 - wallX0, TIMBER[4]);
  img.hline(wallX0, 27, wallX1 - wallX0, TIMBER[1]);
  for (let x = wallX0; x < wallX1; x += 1) img.over(x, 28, PAL.ink, 70); // the eave's shadow on the glass
  img.fillRect(wallX0, 55, wallX1 - wallX0, 3, TIMBER[2]);
  img.hline(wallX0, 55, wallX1 - wallX0, TIMBER[4]);
  img.hline(wallX0, 57, wallX1 - wallX0, TIMBER[0]);

  // the brass door: a frame, a glazed upper leaf, a brass kick plate and a knob
  img.fillRect(32, 31, 16, 27, BRASS[1]);
  img.vline(32, 31, 27, BRASS[4]);
  img.vline(33, 31, 27, BRASS[3]);
  img.vline(46, 31, 27, BRASS[2]);
  img.vline(47, 31, 27, BRASS[0]);
  img.hline(32, 31, 16, BRASS[4]);
  img.hline(33, 32, 14, BRASS[3]);
  // the glass in the leaf: take the plants behind it, tinted
  for (let y = 34; y < 48; y += 1) {
    for (let x = 35; x < 45; x += 1) {
      const base = mix(mix(GLASS[1], LEAF[1], 0.55), LEAF[0], ((y - 34) / 14) * 0.5);
      img.set(x, y, mix(base, GLASS[3], 0.4));
    }
  }
  paintBalls(img, [{ x: 38, y: 42, r: 3, tone: 0.05 }, { x: 42, y: 45, r: 3, tone: -0.05 }], LEAF, 5);
  for (let y = 34; y < 48; y += 1) for (let x = 35; x < 45; x += 1) img.over(x, y, GLASS[3], 110);
  for (const [x, y] of [[36, 41], [37, 40], [38, 39]]) img.over(x, y, [255, 255, 255], 170);
  img.vline(40, 34, 14, BRASS[2]);
  img.vline(39, 34, 14, BRASS[3]);
  img.hline(35, 40, 10, BRASS[2]);
  img.hline(35, 41, 10, BRASS[1]);
  img.fillRect(34, 48, 12, 10, BRASS[2]);
  img.hline(34, 48, 12, BRASS[4]);
  img.vline(34, 48, 10, BRASS[3]);
  img.vline(45, 48, 10, BRASS[1]);
  img.hline(35, 56, 10, BRASS[1]);
  img.fillRect(36, 50, 8, 6, BRASS[1]);
  img.hline(36, 50, 8, BRASS[0]);
  img.vline(36, 50, 6, BRASS[0]);
  img.hline(37, 55, 7, BRASS[3]);
  for (const [x, y] of [[37, 51], [42, 51], [37, 54], [42, 54]]) img.set(x, y, BRASS[4]);
  img.fillRect(42, 44, 2, 3, BRASS[4]);
  img.set(43, 46, BRASS[0]);
  img.fillRect(30, 58, 20, 4, STONE[3]); // step
  img.hline(30, 61, 20, STONE[1]);

  // the peaked glass roof: a trapezoid of panes between timber rafters
  const roofTop = 3;
  const roofBottom = 24;
  for (let y = roofTop; y < roofBottom; y += 1) {
    const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 13);
    const t = (y - roofTop) / (roofBottom - roofTop);
    for (let x = 1 + inset; x < W - 1 - inset; x += 1) {
      // the sky behind, a pale wash of green low down where the plants show through
      let c = t < 0.34 ? GLASS[4] : t < 0.7 ? GLASS[3] : GLASS[2];
      img.set(x, y, c);
    }
  }
  // rafters, purlins and the hip edges
  for (let k = -4; k <= 4; k += 1) {
    const x = 48 + k * 10;
    for (let y = roofTop; y < roofBottom; y += 1) {
      const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 13);
      if (x >= 1 + inset + 1 && x < W - 2 - inset) {
        img.set(x, y, TIMBER[3]);
        img.set(x + 1, y, TIMBER[1]);
      }
    }
  }
  for (const y of [10, 17]) {
    for (let x = 1; x < W - 1; x += 1) {
      const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 13);
      if (x >= 1 + inset && x < W - 1 - inset) img.set(x, y, x % 10 < 2 ? TIMBER[3] : TIMBER[2]);
    }
  }
  for (let y = roofTop; y < roofBottom; y += 1) {
    const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 13);
    img.set(1 + inset, y, TIMBER[4]);
    img.set(2 + inset, y, TIMBER[3]);
    img.set(W - 2 - inset, y, TIMBER[1]);
    img.set(W - 3 - inset, y, TIMBER[2]);
  }
  // glints on the roof glass
  for (const [x, y] of [[20, 20], [21, 19], [22, 18], [34, 20], [35, 19], [58, 16], [59, 15], [60, 14], [76, 21], [77, 20], [84, 22]]) img.set(x, y, [248, 255, 252]);
  // an opened pane near the ridge, propped on a stay
  polygon(img, [[62, 15], [75, 15], [77, 9], [64, 9]], (x, y) => (y < 11 ? GLASS[4] : GLASS[3]));
  img.hline(62, 15, 14, TIMBER[2]);
  img.hline(63, 14, 13, GLASS[0]);
  line(img, 64, 9, 77, 9, TIMBER[3]);
  line(img, 62, 15, 64, 9, TIMBER[1]);
  line(img, 75, 15, 77, 9, TIMBER[1]);
  img.set(67, 12, [248, 255, 252]);
  img.set(68, 11, [248, 255, 252]);
  img.vline(70, 15, 3, IRON[3]);
  // the eave beam, and the ridge with a little brass finial
  img.fillRect(1, 22, W - 2, 3, TIMBER[3]);
  img.hline(1, 22, W - 2, TIMBER[4]);
  img.hline(1, 24, W - 2, TIMBER[1]);
  img.fillRect(14, 2, 68, 3, TIMBER[3]);
  img.hline(14, 2, 68, TIMBER[4]);
  img.hline(14, 4, 68, TIMBER[1]);
  img.fillRect(47, 0, 3, 2, BRASS[2]);
  img.set(47, 0, BRASS[4]);
  img.set(48, 1, BRASS[1]);

  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ construction site

function construction() {
  const W = 96;
  const H = 64;
  const img = new Img(W, H);
  const rawWood = PAL.plank;

  // the laid foundation, in two halves: the door cell stays open ground
  foundation(img, 58, 6);
  img.fillRect(30, 58, 20, 6, [0, 0, 0], 0);
  // a pour of fresh mortar at the broken end of the course
  for (const [x, y] of [[29, 58], [29, 59], [28, 60], [50, 58], [50, 59], [51, 60]]) img.set(x, y, STONE[4]);

  // the wall frame: bare studs on the right, half-boarded on the left, plates top and bottom
  const stud = (x0, y0, y1) => {
    img.fillRect(x0, y0, 3, y1 - y0, rawWood[3]);
    img.vline(x0, y0, y1 - y0, rawWood[4]);
    img.vline(x0 + 2, y0, y1 - y0, rawWood[1]);
  };
  const plate = (x0, x1, y) => {
    img.fillRect(x0, y, x1 - x0, 3, rawWood[3]);
    img.hline(x0, y, x1 - x0, rawWood[4]);
    img.hline(x0, y + 2, x1 - x0, rawWood[1]);
  };
  for (const x of [4, 14, 22]) stud(x, 28, 58);
  for (const x of [27, 50]) stud(x, 28, 58); // the door posts, a pixel clear of the door cell on each side
  for (const x of [57, 65, 73, 81, 89]) stud(x, 28, 58);
  plate(4, 30, 25);
  plate(49, 92, 25);
  plate(4, 30, 55);
  plate(49, 92, 55);
  // two glass panes already glazed on the right, the third bay still open
  for (const x0 of [59, 67]) {
    for (let y = 30; y < 54; y += 1) {
      for (let x = x0; x < x0 + 6; x += 1) {
        const t = (y - 30) / 24;
        img.set(x, y, t < 0.35 ? GLASS[4] : t < 0.7 ? GLASS[3] : GLASS[2]);
      }
    }
    for (let i = 0; i < 4; i += 1) img.set(x0 + 1 + i, 40 - i, [248, 255, 252]);
    img.hline(x0, 29, 6, rawWood[1]);
  }

  // the roof frame: hip edges and rafters, a ridge beam, and a few panes laid on the right
  const roofTop = 3;
  const roofBottom = 24;
  const edgeX = (y) => Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 13);
  for (let y = roofTop; y < roofBottom; y += 1) {
    const inset = edgeX(y);
    img.set(1 + inset, y, rawWood[3]);
    img.set(2 + inset, y, rawWood[2]);
    img.set(W - 2 - inset, y, rawWood[1]);
    img.set(W - 3 - inset, y, rawWood[2]);
  }
  for (const x of [26, 62, 74]) {
    for (let y = roofTop + 2; y < roofBottom; y += 1) {
      img.set(x, y, rawWood[3]);
      img.set(x + 1, y, rawWood[1]);
    }
  }
  for (let y = 22; y < 25; y += 1) img.hline(1, y, W - 2, y === 22 ? rawWood[4] : y === 23 ? rawWood[3] : rawWood[1]);
  img.fillRect(14, 2, 68, 3, rawWood[3]);
  img.hline(14, 2, 68, rawWood[4]);
  img.hline(14, 4, 68, rawWood[1]);
  for (const x0 of [52, 64]) {
    for (let y = 7; y < 21; y += 1) {
      for (let x = x0; x < x0 + 10; x += 1) {
        const t = (y - 7) / 14;
        if (x < x0 + 1 || x > x0 + 8) continue;
        img.set(x, y, t < 0.4 ? GLASS[4] : GLASS[3]);
      }
    }
    for (let i = 0; i < 5; i += 1) img.set(x0 + 2 + i, 16 - i, [248, 255, 252]);
  }

  // scaffolding in front of the left bay: two poles, a top ledger, a plank deck, and a ladder up the outside
  const pole = (x0) => {
    img.fillRect(x0, 8, 3, 56, PAL.bark[2]);
    img.vline(x0, 8, 56, PAL.bark[3]);
    img.vline(x0 + 2, 8, 56, PAL.bark[1]);
    img.hline(x0, 8, 3, rawWood[3]);
    img.hline(x0, 63, 3, PAL.bark[0]);
  };
  pole(9);
  pole(26);
  for (const y of [20]) {
    img.fillRect(9, y, 20, 2, rawWood[2]);
    img.hline(9, y, 20, rawWood[4]);
    img.hline(9, y + 1, 20, PAL.bark[0]);
  }
  for (let x = 9; x < 29; x += 6) {
    const c = hash2(x, 4, 17) < 0.5 ? rawWood[3] : rawWood[2];
    const w = Math.min(5, 29 - x);
    img.fillRect(x, 36, w, 3, c);
    img.hline(x, 36, w, rawWood[4]);
    img.vline(x + w, 36, 3, PAL.bark[0]);
    img.hline(x, 38, w, PAL.bark[1]);
  }
  for (let i = 0; i < 15; i += 1) {
    img.set(12 + i, 36 - Math.round(i * 0.85), PAL.bark[2]);
    img.set(12 + Math.min(i + 1, 16), 36 - Math.round(i * 0.85), PAL.bark[1]);
  }
  // a bucket of mortar on the deck
  img.fillRect(22, 31, 6, 5, IRON[2]);
  img.hline(22, 31, 6, IRON[4]);
  img.hline(22, 35, 6, IRON[0]);
  img.hline(23, 32, 4, STONE[3]);
  img.vline(27, 32, 3, IRON[1]);
  // the ladder, leaning up the outside to the deck
  for (let i = 0; i < 28; i += 1) {
    const x = 1 + Math.round((i * 4) / 27);
    img.set(x, 62 - i, rawWood[3]);
    img.set(x + 1, 62 - i, rawWood[1]);
    img.set(x + 6, 62 - i, rawWood[3]);
    img.set(x + 7, 62 - i, rawWood[1]);
  }
  for (let i = 3; i < 28; i += 5) {
    const x = 1 + Math.round((i * 4) / 27);
    img.hline(x + 1, 62 - i, 7, rawWood[2]);
    img.hline(x + 1, 63 - i, 7, PAL.bark[1]);
  }

  // a "work in progress" sign: a striped board on two posts, a hammer and trowel picture, no words
  const sx = 13;
  const sy = 43;
  img.fillRect(sx + 2, sy + 12, 2, 8, PAL.bark[2]);
  img.fillRect(sx + 12, sy + 12, 2, 8, PAL.bark[2]);
  img.vline(sx + 2, sy + 12, 8, PAL.bark[3]);
  img.vline(sx + 12, sy + 12, 8, PAL.bark[3]);
  img.fillRect(sx, sy, 16, 13, PAL.sun[2]);
  img.hline(sx, sy, 16, PAL.sun[2]);
  for (let x = 0; x < 16; x += 1) {
    const stripe = Math.floor((x + 8) / 3) % 2 === 0;
    for (const y of [0, 1, 11, 12]) img.set(sx + x, sy + y, stripe ? PAL.ink : PAL.sun[2]);
  }
  img.fillRect(sx + 1, sy + 2, 14, 9, PAL.white[2]);
  img.hline(sx + 1, sy + 2, 14, PAL.white[1]);
  img.hline(sx + 1, sy + 10, 14, PAL.parchment[1]);
  // the picture: a hammer and a trowel crossed
  for (let i = 0; i < 7; i += 1) {
    img.set(sx + 4 + i, sy + 9 - i, PAL.bark[2]);
    img.set(sx + 11 - i, sy + 9 - i, PAL.bark[1]);
  }
  img.fillRect(sx + 9, sy + 3, 4, 2, IRON[2]);
  img.hline(sx + 9, sy + 3, 4, IRON[4]);
  img.fillRect(sx + 3, sy + 3, 3, 3, STEEL[3]);
  img.set(sx + 3, sy + 3, STEEL[4]);
  img.set(sx + 5, sy + 5, STEEL[1]);

  // a stack of planks and a rack of glass panes on the right
  for (let i = 0; i < 4; i += 1) {
    const y = 59 - i * 4;
    const x = 66 + (i % 2) * 2;
    img.fillRect(x, y, 26 - (i % 2) * 2, 3, i % 2 === 0 ? rawWood[3] : rawWood[2]);
    img.hline(x, y, 26 - (i % 2) * 2, rawWood[4]);
    img.hline(x, y + 2, 26 - (i % 2) * 2, PAL.bark[0]);
    img.set(x + 3, y + 1, PAL.bark[1]);
    img.set(x + 20, y + 1, PAL.bark[1]);
  }
  for (const x of [68, 88]) {
    img.fillRect(x, 43, 2, 5, PAL.bark[1]);
  }
  // panes standing in an A-frame rack
  img.fillRect(52, 62, 14, 2, PAL.bark[1]);
  for (let k = 0; k < 3; k += 1) {
    const x0 = 53 + k * 4;
    for (let y = 44; y < 62; y += 1) {
      for (let x = x0; x < x0 + 4; x += 1) {
        const t = (y - 44) / 18;
        img.set(x, y, k === 2 ? (t < 0.4 ? GLASS[4] : GLASS[3]) : t < 0.4 ? GLASS[3] : GLASS[2]);
      }
      img.set(x0 + 3, y, GLASS[1]);
    }
    img.set(x0, 46, [248, 255, 252]);
    img.set(x0 + 1, 47, [248, 255, 252]);
    img.set(x0, 52, [248, 255, 252]);
  }
  img.fillRect(52, 44, 1, 20, PAL.bark[2]);
  img.fillRect(65, 44, 1, 20, PAL.bark[2]);
  img.hline(52, 43, 14, rawWood[3]);

  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ museum

const PALE = ramp(mix(DERIVED.stone, DERIVED.cream, 0.6), 5, { dark: 0.4, light: 0.25 });
const SLATE = ramp([96, 104, 134], 5, { dark: 0.5, light: 0.36 });

function museumWindow(img, x, y, w, h, silhouette) {
  // a stone surround with a keystone, warm glow inside, an arched head
  img.fillRect(x - 2, y - 2, w + 4, h + 4, PALE[3]);
  img.vline(x - 2, y - 2, h + 4, PALE[4]);
  img.vline(x + w + 1, y - 2, h + 4, PALE[1]);
  img.hline(x - 2, y - 2, w + 4, PALE[4]);
  for (let yy = 0; yy < h; yy += 1) {
    const t = yy / (h - 1);
    const glow = t < 0.4 ? mix(ORANGE_GLOW[4], ORANGE_GLOW[3], t / 0.4) : mix(ORANGE_GLOW[3], ORANGE_GLOW[2], (t - 0.4) / 0.6);
    const arch = yy === 0 ? 2 : yy === 1 ? 1 : 0;
    for (let xx = arch; xx < w - arch; xx += 1) img.set(x + xx, y + yy, glow);
    // the corners the arch cuts away are stone
    for (let xx = 0; xx < arch; xx += 1) {
      img.set(x + xx, y + yy, PALE[2]);
      img.set(x + w - 1 - xx, y + yy, PALE[2]);
    }
  }
  img.vline(x + Math.floor(w / 2), y, h, PAL.bark[1]);
  img.hline(x, y + Math.floor(h / 2), w, PAL.bark[1]);
  if (silhouette) silhouette(x, y, w, h);
  for (const [dx, dy] of [[2, 3], [3, 4]]) img.set(x + dx, y + dy, PAL.white[2]);
  // sill
  img.fillRect(x - 3, y + h + 2, w + 6, 2, PALE[3]);
  img.hline(x - 3, y + h + 2, w + 6, PALE[4]);
  img.hline(x - 3, y + h + 3, w + 6, PALE[1]);
  // keystone
  img.fillRect(x + Math.floor(w / 2) - 1, y - 2, 2, 2, PALE[4]);
}

function museum() {
  const W = 96;
  const H = 80;
  const img = new Img(W, H);

  foundation(img, 74, 6, PALE);

  // the walls: pale ashlar, courses a few pixels deep with staggered joints, lit on the left
  for (let y = 40; y < 74; y += 1) {
    const course = Math.floor((y - 40) / 6);
    const seam = (y - 40) % 6 === 5;
    for (let x = 4; x < 92; x += 1) {
      const joint = (x + course * 7) % 16 === 0;
      let c = PALE[2];
      if (seam || joint) c = PALE[1];
      else if ((y - 40) % 6 === 0) c = PALE[3];
      else if (x < 8) c = PALE[3];
      else if (x > 87) c = PALE[1];
      img.set(x, y, c);
    }
  }
  // a plinth course and a lit string course
  for (let x = 4; x < 92; x += 1) {
    img.set(x, 70, PALE[4]);
    img.set(x, 71, PALE[2]);
    img.set(x, 72, PALE[1]);
    img.set(x, 73, PALE[0]);
  }
  // the cornice under the eaves
  img.fillRect(2, 35, 92, 5, PALE[3]);
  img.hline(2, 35, 92, PALE[4]);
  img.hline(2, 37, 92, PALE[2]);
  img.hline(2, 39, 92, PALE[0]);
  for (let x = 4; x < 92; x += 4) {
    img.fillRect(x, 38, 2, 1, PALE[1]);
    img.set(x, 38, PALE[4]);
  }

  // the roof: a trapezoid of slate tiles
  const roofTop = 8;
  const roofBottom = 36;
  for (let y = roofTop; y < roofBottom; y += 1) {
    const inset = Math.round(((roofBottom - 1 - y) / (roofBottom - roofTop)) * 9);
    const row = Math.floor((y - roofTop) / 4);
    const offset = (row % 2) * 4;
    for (let x = 1 + inset; x < W - 1 - inset; x += 1) {
      const sx = (x + offset) % 8;
      const sy = (y - roofTop) % 4;
      let c = SLATE[2];
      if (sy === 3) c = SLATE[0];
      else if (sx === 7) c = SLATE[1];
      else if (sy === 0) c = SLATE[3];
      if (row === 0) c = sy === 3 ? SLATE[1] : SLATE[3];
      img.set(x, y, c);
    }
  }
  img.fillRect(11, 6, 74, 3, SLATE[1]);
  img.hline(11, 6, 74, SLATE[4]);
  for (const x of [10, 83]) {
    img.fillRect(x, 3, 3, 4, BRASS[2]);
    img.set(x, 3, BRASS[4]);
    img.set(x + 2, 5, BRASS[1]);
  }
  // a stone chimney, like the cottages'
  const cx = 66;
  img.fillRect(cx, 0, 11, 20, PALE[2]);
  img.vline(cx, 0, 20, PALE[3]);
  img.vline(cx + 10, 0, 20, PALE[1]);
  for (let y = 4; y < 20; y += 4) img.hline(cx, y, 11, PALE[1]);
  img.fillRect(cx - 1, 0, 13, 3, PALE[3]);
  img.hline(cx - 1, 2, 13, PALE[1]);

  // the pediment: a low triangle over the portico, a shadowed tympanum with a round medallion
  const apexX = 40;
  const baseY = 41;
  const apexY = 22;
  const halfBase = 24;
  for (let y = apexY; y < baseY; y += 1) {
    const half = Math.round(((y - apexY + 1) / (baseY - apexY)) * halfBase);
    for (let x = apexX - half; x < apexX + half; x += 1) {
      const edge = Math.abs(x + 0.5 - apexX) > half - 2.2;
      img.set(x, y, edge ? (x < apexX ? PALE[4] : PALE[2]) : x < apexX ? PALE[2] : PALE[1]);
    }
    img.set(apexX - half, y, PALE[4]);
    img.set(apexX + half - 1, y, PALE[0]);
  }
  // the tympanum holds a round attic window, glowing warm, in a stone ring
  img.ellipse(40, 34.6, 6, 5.6, PALE[4]);
  img.ellipse(40.4, 35, 5.4, 5, PALE[1]);
  for (let y = 29; y < 41; y += 1) {
    for (let x = 34; x < 47; x += 1) {
      const d = Math.hypot(x + 0.5 - 40, (y + 0.5 - 34.6) * 1.07);
      if (d > 4.6) continue;
      img.set(x, y, mix(ORANGE_GLOW[4], ORANGE_GLOW[2], (y - 30) / 10));
    }
  }
  img.vline(40, 30, 9, PAL.bark[1]);
  img.hline(36, 34, 8, PAL.bark[1]);
  img.set(37, 32, PAL.white[2]);
  img.set(38, 31, PAL.white[2]);
  // the entablature across the portico
  img.fillRect(18, 41, 45, 6, PALE[3]);
  img.hline(18, 41, 45, PALE[4]);
  img.hline(18, 43, 45, PALE[2]);
  img.hline(18, 44, 45, PALE[1]);
  img.hline(18, 46, 45, PALE[0]);
  for (let x = 20; x < 62; x += 4) img.set(x, 45, PALE[4]);

  // the portico is a shadowed recess, so the columns stand out against it
  for (let y = 47; y < 74; y += 1) {
    for (let x = 20; x < 60; x += 1) {
      const n = hash2(x, y, 61);
      img.set(x, y, y < 49 ? PALE[0] : n < 0.1 ? PALE[0] : PALE[1]);
    }
  }
  for (let y = 49; y < 69; y += 3) for (let x = 20; x < 60; x += 1) if ((x + y) % 7 === 0) img.set(x, y, PALE[0]);
  // two short columns by the door
  const column = (x0) => {
    img.fillRect(x0 - 1, 47, 7, 2, PALE[3]); // capital
    img.hline(x0 - 1, 47, 7, PALE[4]);
    img.hline(x0 - 1, 48, 7, PALE[1]);
    for (let y = 49; y < 69; y += 1) {
      for (let k = 0; k < 5; k += 1) img.set(x0 + k, y, k === 0 ? PALE[4] : k === 1 ? PALE[3] : k < 4 ? PALE[2] : PALE[1]);
      if (y % 6 === 0) img.set(x0 + 2, y, PALE[3]);
    }
    img.fillRect(x0 - 1, 69, 7, 3, PALE[3]); // base
    img.hline(x0 - 1, 69, 7, PALE[4]);
    img.hline(x0 - 1, 71, 7, PALE[0]);
  };
  column(24);
  column(52);

  // the door: a stone surround, an arched head with a glowing fanlight, double leaves with brass pulls
  img.fillRect(31, 49, 18, 25, PALE[1]);
  img.fillRect(32, 50, 16, 24, PAL.bark[0]);
  for (let y = 50; y < 74; y += 1) {
    const arch = y === 50 ? 3 : y === 51 ? 2 : y === 52 ? 1 : 0;
    for (let x = 32; x < 48; x += 1) {
      if (x < 32 + arch || x >= 48 - arch) {
        img.set(x, y, PALE[1]);
        continue;
      }
      const rel = (x - 32) / 16;
      if (y < 56) {
        const t = (y - 50) / 5;
        img.set(x, y, mix(ORANGE_GLOW[4], ORANGE_GLOW[2], t));
      } else {
        img.set(x, y, rel < 0.5 ? (rel < 0.12 ? PAL.plank[3] : PAL.plank[2]) : rel > 0.88 ? PAL.plank[0] : PAL.plank[1]);
      }
    }
  }
  img.hline(32, 56, 16, PAL.bark[0]);
  img.vline(40, 50, 24, PAL.bark[0]);
  img.vline(39, 50, 6, PAL.bark[1]);
  img.vline(41, 50, 6, PAL.bark[1]);
  for (const x of [34, 36, 38, 42, 44, 46]) img.vline(x, 57, 15, PAL.bark[1]);
  img.hline(33, 72, 14, PAL.bark[0]);
  img.fillRect(37, 63, 2, 3, BRASS[3]);
  img.fillRect(42, 63, 2, 3, BRASS[3]);
  img.set(37, 63, BRASS[4]);
  img.set(42, 63, BRASS[4]);
  // steps up to the portico
  img.fillRect(26, 74, 28, 2, PALE[3]);
  img.hline(26, 74, 28, PALE[4]);
  img.hline(26, 75, 28, PALE[1]);
  img.fillRect(22, 76, 36, 3, PALE[2]);
  img.hline(22, 76, 36, PALE[4]);
  img.hline(22, 78, 36, PALE[0]);

  // warm windows to the right, each with a small exhibit in silhouette
  const dark = [168, 98, 40];
  const vaseSilhouette = (x, y, w, h) => {
    const cx = x + Math.floor(w / 2) + 2;
    img.fillRect(cx - 1, y + h - 8, 2, 2, dark);
    img.fillRect(cx - 2, y + h - 6, 4, 4, dark);
    img.fillRect(cx - 1, y + h - 2, 2, 2, dark);
    img.set(cx - 3, y + h - 5, dark);
    img.set(cx + 2, y + h - 5, dark);
  };
  const bustSilhouette = (x, y, w, h) => {
    const cx = x + Math.floor(w / 2) + 2;
    img.ellipse(cx, y + h - 8, 2, 2.3, dark);
    img.fillRect(cx - 3, y + h - 5, 6, 3, dark);
    img.fillRect(cx - 2, y + h - 2, 4, 2, dark);
  };
  museumWindow(img, 62, 52, 10, 16, vaseSilhouette);
  museumWindow(img, 78, 52, 10, 16, bustSilhouette);

  // the banner on the left: a brass pole, a green cloth with gold trim and a tiny vase and fossil emblem
  img.hline(6, 45, 16, BRASS[3]);
  img.hline(6, 46, 16, BRASS[1]);
  img.fillRect(5, 44, 2, 3, BRASS[4]);
  img.fillRect(21, 44, 2, 3, BRASS[2]);
  const cloth = ramp(BRAND.forestGreen, 5, { dark: 0.5, light: 0.4 });
  for (let y = 47; y < 68; y += 1) {
    const notch = y >= 64 ? (y - 63) * 1.2 - 0.4 : -1; // a swallowtail hem
    for (let x = 8; x < 20; x += 1) {
      if (Math.abs(x + 0.5 - 14) < notch) continue;
      let c = x < 10 ? cloth[3] : x > 17 ? cloth[1] : cloth[2];
      if (y === 47) c = cloth[4];
      img.set(x, y, c);
    }
  }
  img.hline(8, 49, 12, PAL.gold[3]);
  img.hline(8, 50, 12, PAL.gold[1]);
  img.hline(8, 64, 12, PAL.gold[3]);
  // a pale amphora with a terracotta band: the museum's emblem
  const amphora = [[12, 15], [13, 14], [13, 14], [11, 16], [11, 16], [11, 16], [11, 16], [12, 15], [12, 15], [13, 14], [12, 15]];
  amphora.forEach(([x0, x1], i) => {
    for (let x = x0; x <= x1; x += 1) img.set(x, 51 + i, x === x0 ? PAL.white[2] : x === x1 ? PAL.parchment[1] : PAL.white[2]);
  });
  img.hline(11, 55, 6, PAL.clay[2]);
  img.hline(11, 56, 6, PAL.clay[1]);
  for (const y of [54, 55]) {
    img.set(10, y, PAL.white[1]);
    img.set(17, y, PAL.parchment[1]);
  }
  img.set(12, 53, PAL.white[1]);
  img.hline(12, 57, 4, PAL.parchment[1]);
  img.set(12, 52, PAL.white[1]);
  // a gold diamond below it
  for (const [x, y] of [[13, 59], [14, 59], [12, 60], [13, 60], [14, 60], [15, 60], [13, 61], [14, 61]]) img.set(x, y, PAL.gold[3]);
  img.set(13, 60, PAL.gold[4]);

  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildBuildings(frames) {
  frames.set('object/greenhouse', greenhouse());
  frames.set('object/construction', construction());
  frames.set('object/museum', museum());
}

void lit;
void shade;
void WALNUT;
