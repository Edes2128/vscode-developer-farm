// Phase 5 item icons: cooked dishes and metal bars. 16 x 16, outlined, one clear colour story each.
//
// Frame names (the contract with src/data/items.ts and src/rendering/frameNames.ts):
//   item/{fried_egg, omelette, radish_salad, strawberry_jam, tomato_soup, pumpkin_pie, baked_trout, fish_stew}
//   item/{copper_bar, iron_bar}
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { IRON, RED } from './interior.mjs';
import { LEAF, paintBalls } from './objects.mjs';
import { COPPER } from './home.mjs';
import { INK, INK_WARM, lit, polygon, shade } from './draw5.mjs';

const PLATE = ramp([240, 238, 228], 5, { dark: 0.3, light: 0.1 });
const BOWL = ramp([226, 224, 214], 5, { dark: 0.35, light: 0.1 });
const BLUE = ramp(mix(BRAND.riverBlue, [70, 96, 150], 0.3), 5, { dark: 0.5, light: 0.4 });
const YOLK = ramp([250, 186, 44], 5, { dark: 0.45, light: 0.4 });
const EGGY = ramp([250, 214, 80], 5, { dark: 0.5, light: 0.4 });
const SOUP = ramp([226, 84, 46], 5, { dark: 0.5, light: 0.4 });
const PIE = ramp([228, 132, 44], 5, { dark: 0.5, light: 0.4 });
const CRUST = ramp([208, 152, 84], 5, { dark: 0.5, light: 0.4 });
const JAM = ramp([176, 28, 54], 5, { dark: 0.5, light: 0.4 });
const TROUT = ramp([200, 134, 62], 5, { dark: 0.5, light: 0.4 });
const LEMON = ramp([248, 218, 70], 5, { dark: 0.45, light: 0.4 });
const RADISH = ramp(mix(DERIVED.berry, DERIVED.blossom, 0.35), 5);
const STEW = ramp([214, 128, 56], 5, { dark: 0.5, light: 0.4 });
const POT = ramp([62, 62, 76], 5, { dark: 0.5, light: 0.45 });
const SILVER = ramp([200, 208, 218], 5, { dark: 0.35, light: 0.3 });
const COPPER_BAR = ramp([218, 112, 52], 5, { dark: 0.5, light: 0.42 });
const IRON_BAR = ramp([132, 142, 162], 5, { dark: 0.5, light: 0.4 });

/** A soft ellipse of plate rim and well, lit from the top left: used under plated dishes. */
function plate(img, cx, cy, rx, ry) {
  img.ellipse(cx, cy + 0.6, rx, ry, PLATE[1]);
  img.ellipse(cx, cy, rx, ry, PLATE[3]);
  img.ellipse(cx, cy + 0.3, rx - 1.4, ry - 0.9, PLATE[2]);
  img.set(Math.round(cx - rx + 2), Math.round(cy - 1), PLATE[4]);
  img.set(Math.round(cx - rx + 3), Math.round(cy - ry + 0.6), PLATE[4]);
}

function friedEgg() {
  const img = new Img(16, 16);
  // the white: a lacy, uneven pool with a crisp golden edge underneath
  const blob = (fn) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (fn(x + 0.5, y + 0.5)) img.set(x, y, PAL.white[2]);
  };
  blob((x, y) => ((x - 8) / 6.4) ** 2 + ((y - 9.4) / 4.6) ** 2 <= 1 || ((x - 5) / 3.4) ** 2 + ((y - 8) / 3.2) ** 2 <= 1 || ((x - 11.4) / 3.2) ** 2 + ((y - 10.8) / 3.2) ** 2 <= 1 || ((x - 8.4) / 2.4) ** 2 + ((y - 12.8) / 2.4) ** 2 <= 1);
  // browned crispy edge along the lower right, a cool shadow tone under it
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (img.alphaAt(x, y) === 0) continue;
      const nearEdge = img.alphaAt(x + 1, y) === 0 || img.alphaAt(x, y + 1) === 0 || img.alphaAt(x + 1, y + 1) === 0;
      if (nearEdge) img.set(x, y, hash2(x, y, 3) < 0.55 ? EGGY[1] : mix(PAL.white[2], EGGY[2], 0.55));
      else if (img.alphaAt(x - 1, y) === 0 || img.alphaAt(x, y - 1) === 0) img.set(x, y, PAL.white[2]);
      else if (x + y > 19) img.set(x, y, PAL.parchment[1]);
    }
  }
  // the yolk: a bright dome with a soft shine
  img.ellipse(8, 8, 3, 2.8, YOLK[1]);
  img.ellipse(7.8, 7.8, 2.7, 2.5, YOLK[2]);
  img.ellipse(7.2, 7.2, 1.7, 1.5, YOLK[3]);
  img.set(6, 6, [255, 250, 220]);
  img.set(7, 6, YOLK[4]);
  img.set(9, 10, YOLK[1]);
  img.outline(INK_WARM);
  return img;
}

function omelette() {
  const img = new Img(16, 16);
  plate(img, 8, 10.8, 7.4, 4.2);
  // a folded half-moon: a golden dome, a browned rim, a crease, chopped chives
  for (let y = 4; y < 13; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = (x + 0.5 - 8) / 6;
      const dy = (y + 0.5 - 11.2) / 6.2;
      if (dx * dx + dy * dy > 1 || y + 0.5 > 11.6) continue;
      const lit = -0.6 * dx - 0.8 * dy;
      img.set(x, y, lit > 0.72 ? EGGY[4] : lit > 0.28 ? EGGY[3] : lit > -0.25 ? EGGY[2] : EGGY[1]);
    }
  }
  // the browned underside of the fold
  for (let x = 3; x < 14; x += 1) img.set(x, 11, x < 5 || x > 11 ? EGGY[1] : mix(EGGY[1], [168, 98, 40], 0.5));
  img.set(2, 10, EGGY[1]);
  img.set(13, 10, EGGY[1]);
  // the crease where the omelette folds over
  for (const [x, y] of [[4, 9], [5, 8], [6, 8], [7, 7], [8, 7], [9, 7], [10, 8], [11, 8], [12, 9]]) img.set(x, y, mix(EGGY[1], [168, 98, 40], 0.35));
  for (const [x, y] of [[5, 6], [9, 5], [11, 6], [6, 10], [10, 10], [3, 9]]) img.set(x, y, mix(EGGY[2], [168, 98, 40], 0.5));
  for (const [x, y] of [[6, 5], [8, 6], [10, 9], [7, 9], [4, 8]]) img.set(x, y, LEAF[3]);
  img.set(8, 5, LEAF[4]);
  img.outline(INK_WARM);
  return img;
}

function radishSalad() {
  const img = new Img(16, 16);
  // the heap: leafy lettuce shaded like the bushes, with radish slices on top
  paintBalls(
    img,
    [
      { x: 5, y: 7, r: 3.6, tone: 0.1 },
      { x: 11, y: 7, r: 3.6, tone: 0.04 },
      { x: 8, y: 4.8, r: 3.8, tone: 0.2 },
      { x: 8, y: 7.4, r: 3.6, tone: 0.06 },
    ],
    LEAF,
    13,
  );
  for (const [x, y] of [[6, 5], [10, 6], [3, 7]]) {
    img.set(x, y, LEAF[1]);
    img.set(x + 1, y + 1, LEAF[1]);
  }
  for (const [x, y] of [[7, 3], [4, 5], [12, 5]]) img.set(x, y, LEAF[4]);
  // radish slices: pink rings round a pale heart
  for (const [x, y] of [[6, 5], [10, 4], [12, 7]]) {
    img.ellipse(x, y, 1.8, 1.7, RADISH[2]);
    img.ellipse(x, y, 0.9, 0.8, PAL.white[2]);
    img.set(x - 1, y - 1, RADISH[3]);
  }
  // the bowl: cream ceramic with a blue band
  const half = [7, 7, 6, 6, 5, 4, 3];
  half.forEach((hw, i) => {
    const y = 8 + i;
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      img.set(x, y, rel < 0.18 ? BOWL[4] : rel < 0.45 ? BOWL[3] : rel < 0.75 ? BOWL[2] : BOWL[1]);
    }
  });
  img.hline(1, 8, 14, BOWL[4]);
  img.hline(1, 9, 14, BLUE[2]);
  img.hline(1, 9, 3, BLUE[3]);
  img.hline(2, 10, 12, BLUE[1]);
  img.hline(5, 14, 6, BOWL[0]);
  img.outline(INK_WARM);
  return img;
}

function strawberryJam() {
  const img = new Img(16, 16);
  // the jar: glass body with deep red jam showing through, a pale highlight down the left
  for (let y = 5; y < 15; y += 1) {
    const hw = y < 6 ? 4 : y > 13 ? 5 : 6;
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      const c = rel < 0.16 ? JAM[4] : rel < 0.4 ? JAM[3] : rel < 0.78 ? JAM[2] : JAM[1];
      img.set(x, y, y > 13 ? JAM[0] : c);
    }
  }
  img.vline(3, 8, 5, [255, 214, 214]);
  img.set(3, 7, [255, 236, 236]);
  img.hline(5, 13, 6, JAM[1]);
  // a little paper label
  img.fillRect(5, 9, 6, 4, PAL.white[2]);
  img.hline(5, 9, 6, PAL.white[1]);
  img.hline(5, 12, 6, PAL.parchment[1]);
  img.ellipse(8, 10.8, 1.4, 1.2, JAM[2]);
  img.set(8, 9, LEAF[2]);
  // the cloth lid: a gingham circle gathered over the neck, tied with twine
  for (let y = 2; y < 8; y += 1) {
    const hw = y < 3 ? 4 : y < 5 ? 6 : y < 7 ? 7 : 7;
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const a = Math.floor(x / 2) % 2 === 0;
      const b = Math.floor(y / 2) % 2 === 0;
      let c = a && b ? RED[2] : a !== b ? mix(RED[3], PAL.white[2], 0.55) : PAL.white[2];
      if (y === 7 && (x + 8) % 3 !== 0) c = mix(c, RED[0], 0.35);
      img.set(x, y, c);
    }
  }
  // a scalloped hem
  for (const x of [1, 3, 5, 7, 9, 11, 13]) img.set(x, 8, x % 4 === 1 ? mix(RED[3], PAL.white[2], 0.55) : PAL.white[2]);
  img.hline(4, 6, 8, PAL.parchment[1]); // twine
  img.hline(4, 7, 8, PAL.plank[2]);
  img.set(11, 7, PAL.plank[3]);
  img.set(12, 8, PAL.plank[2]);
  img.outline(INK_WARM);
  return img;
}

function tomatoSoup() {
  const img = new Img(16, 16);
  // the bowl: cream with a blue band, a little foot
  const half = [7, 7, 6, 6, 5, 4];
  half.forEach((hw, i) => {
    const y = 8 + i;
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      img.set(x, y, rel < 0.18 ? BOWL[4] : rel < 0.45 ? BOWL[3] : rel < 0.75 ? BOWL[2] : BOWL[1]);
    }
  });
  img.hline(2, 10, 12, BLUE[2]);
  img.hline(2, 10, 3, BLUE[3]);
  img.hline(3, 11, 10, BLUE[1]);
  img.hline(5, 13, 6, BOWL[0]);
  img.fillRect(5, 14, 6, 1, BOWL[1]);
  // the rim and the soup: orange-red with a cream swirl and a basil leaf
  img.ellipse(8, 8, 7.2, 3.2, BOWL[3]);
  img.ellipse(8, 8.2, 6.3, 2.6, SOUP[1]);
  img.ellipse(8, 8.2, 5.8, 2.3, SOUP[2]);
  img.ellipse(7, 7.4, 3.4, 1.1, SOUP[3]);
  img.set(5, 7, SOUP[4]);
  for (const [x, y] of [[8, 8], [9, 8], [10, 8], [9, 7], [8, 9], [7, 9]]) img.set(x, y, PAL.white[2]);
  img.set(9, 8, PAL.parchment[1]);
  img.fillRect(11, 6, 2, 2, LEAF[3]);
  img.set(11, 6, LEAF[4]);
  img.set(12, 7, LEAF[2]);
  img.hline(2, 8, 2, BOWL[4]);
  img.outline(INK_WARM);
  // steam curls, drawn after the outline so they stay soft
  for (const [x, y, a] of [[6, 4, 180], [7, 3, 150], [6, 2, 120], [10, 3, 170], [9, 2, 140], [10, 1, 110]]) img.set(x, y, PAL.white[2], a);
  return img;
}

function pumpkinPie() {
  const img = new Img(16, 16);
  // the crust's wall: the lower half of a fluted drum, golden brown
  for (let y = 8; y < 14; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = (x + 0.5 - 8) / 7.2;
      const dy = (y + 0.5 - 9.2) / 4.6;
      if (dx * dx + dy * dy > 1) continue;
      const rel = (x - 0.5) / 15;
      img.set(x, y, rel < 0.2 ? CRUST[3] : rel < 0.62 ? CRUST[2] : CRUST[1]);
    }
  }
  for (const x of [3, 5, 7, 9, 11, 13]) {
    img.set(x, 11, CRUST[1]);
    img.set(x, 12, CRUST[0]);
  }
  for (let x = 4; x < 12; x += 1) img.set(x, 13, CRUST[0]);
  // the top: a crimped ring of crust round a glossy orange filling
  img.ellipse(8, 7.6, 7.4, 4.6, CRUST[3]);
  img.ellipse(8, 7.8, 6.2, 3.6, PIE[2]);
  img.ellipse(7.4, 7.2, 4.6, 2.4, PIE[3]);
  img.ellipse(6.2, 6.4, 2.2, 1, PIE[4]);
  for (let a = 0; a < 20; a += 1) {
    const t = (a / 20) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(t) * 6.7);
    const y = Math.round(7.4 + Math.sin(t) * 4.1);
    if (a % 2 === 0) img.set(x, y, CRUST[1]);
    else img.set(x, y, CRUST[4]);
  }
  // a swirl of whipped cream, a dusting of spice
  for (const [x, y] of [[9, 5], [10, 5], [8, 6], [9, 6], [10, 6], [11, 6], [9, 7], [10, 7], [11, 7], [10, 8]]) img.set(x, y, PAL.white[2]);
  img.set(11, 7, PAL.parchment[1]);
  img.set(10, 8, PAL.parchment[1]);
  img.set(9, 4, PAL.white[2]);
  for (const [x, y] of [[5, 8], [4, 7], [7, 9], [6, 6]]) img.set(x, y, PIE[1]);
  img.outline(INK_WARM);
  return img;
}

function bakedTrout() {
  const img = new Img(16, 16);
  plate(img, 8, 9.6, 7.5, 5.2);
  // the trout, tail to the left and head to the right: plump rows, golden back, pale belly
  const rows = [
    [5, 5, 9], [6, 4, 11], [7, 3, 12], [8, 3, 13], [9, 3, 12], [10, 4, 11], [11, 6, 9],
  ];
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x <= x1; x += 1) {
      const c = y <= 6 ? TROUT[2] : y >= 10 ? TROUT[4] : TROUT[3];
      img.set(x, y, y === 5 ? TROUT[1] : c);
    }
  }
  // the forked tail, a fin on the back and one under the belly
  for (const [x, y] of [[1, 6], [2, 6], [1, 10], [2, 10], [2, 7], [2, 9], [2, 8], [1, 8]]) img.set(x, y, x === 1 && y === 8 ? TROUT[2] : TROUT[1]);
  img.set(7, 4, TROUT[1]);
  img.set(8, 4, TROUT[1]);
  img.set(9, 4, TROUT[1]);
  img.set(9, 12, TROUT[1]);
  img.set(8, 12, TROUT[2]);
  // grill marks, a gill line, an eye and a smile
  for (const x of [5, 7]) {
    img.set(x, 9, TROUT[0]);
    img.set(x + 1, 8, TROUT[0]);
  }
  img.vline(10, 6, 5, TROUT[1]);
  img.set(12, 7, [250, 246, 230]);
  img.set(12, 8, INK);
  img.set(13, 9, TROUT[0]);
  // a lemon wedge and a sprig of herb on the plate
  img.ellipse(12.4, 12.6, 2.6, 2.2, LEMON[3]);
  img.ellipse(12.4, 12.8, 1.9, 1.5, LEMON[4]);
  for (const [x, y] of [[11, 12], [12, 11], [13, 12], [12, 13]]) img.set(x, y, LEMON[2]);
  img.set(12, 12, PAL.white[2]);
  for (const [x, y] of [[3, 12], [4, 12], [5, 11], [4, 13], [6, 12], [5, 13]]) img.set(x, y, LEAF[(x + y) % 2 === 0 ? 3 : 2]);
  img.outline(INK_WARM);
  return img;
}

function fishStew() {
  const img = new Img(16, 16);
  // the iron pot: a round belly, a lit rim and two lugs
  const half = [6, 7, 7, 7, 7, 6, 5];
  half.forEach((hw, i) => {
    const y = 7 + i;
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      img.set(x, y, rel < 0.16 ? POT[3] : rel < 0.4 ? POT[2] : rel < 0.74 ? POT[1] : POT[0]);
    }
  });
  img.hline(5, 13, 6, POT[0]);
  img.fillRect(0, 8, 2, 2, POT[2]);
  img.fillRect(14, 8, 2, 2, POT[1]);
  img.set(0, 8, POT[3]);
  img.set(3, 9, POT[3]);
  img.set(3, 10, POT[3]);
  // the stew: warm broth, carrot rounds, herbs, and a silver fish tail sticking up
  img.ellipse(8, 6.6, 6.4, 2.7, POT[3]);
  img.ellipse(8, 6.8, 5.7, 2.2, STEW[2]);
  img.ellipse(7, 6.2, 3.2, 1, STEW[3]);
  for (const [x, y] of [[10, 6], [4, 7], [11, 7]]) {
    img.fillRect(x, y, 2, 1, COPPER[3]);
    img.set(x, y, COPPER[4]);
  }
  for (const [x, y] of [[6, 6], [9, 8], [5, 5]]) img.set(x, y, LEAF[3]);
  for (const [x, y] of [[6, 2], [10, 2], [6, 3], [7, 3], [9, 3], [10, 3], [7, 4], [8, 4], [9, 4], [8, 5]]) img.set(x, y, SILVER[(x + y) % 2 === 0 ? 3 : 2]);
  img.set(8, 4, SILVER[4]);
  img.set(8, 5, SILVER[1]);
  img.outline(INK_WARM);
  // steam
  for (const [x, y, a] of [[3, 4, 150], [2, 3, 120], [13, 4, 150], [14, 3, 110]]) img.set(x, y, PAL.white[2], a);
  return img;
}

// ------------------------------------------------------------------------------------------ bars

function ingot(ramp5, stamp) {
  const img = new Img(16, 16);
  // an oblique box: a bright top, a lit front, a dark end
  polygon(img, [[3, 7], [5, 4], [14, 4], [12, 7]], (x, y) => (y === 4 ? ramp5[4] : x - y < 6 ? ramp5[4] : ramp5[3]));
  polygon(img, [[3, 7], [12, 7], [12, 13], [3, 13]], (x, y) => (x < 5 ? ramp5[3] : y > 11 ? ramp5[1] : ramp5[2]));
  polygon(img, [[12, 7], [14, 4], [14, 10], [12, 13]], (x, y) => (y > 11 ? ramp5[0] : ramp5[1]));
  img.hline(3, 7, 9, ramp5[4]);
  img.hline(4, 12, 8, ramp5[0]);
  img.vline(3, 8, 5, ramp5[3]);
  // the maker's stamp: a recessed panel on the front
  img.fillRect(6, 9, 4, 2, ramp5[1]);
  img.hline(6, 9, 4, ramp5[0]);
  img.hline(6, 10, 4, ramp5[3]);
  // a streak of shine along the top
  img.set(7, 5, [255, 250, 230]);
  img.set(8, 5, ramp5[4]);
  img.set(6, 6, ramp5[4]);
  stamp(img);
  img.outline(INK);
  return img;
}

/** @param {Map<string, Img>} frames */
export function buildCooking(frames) {
  frames.set('item/fried_egg', friedEgg());
  frames.set('item/omelette', omelette());
  frames.set('item/radish_salad', radishSalad());
  frames.set('item/strawberry_jam', strawberryJam());
  frames.set('item/tomato_soup', tomatoSoup());
  frames.set('item/pumpkin_pie', pumpkinPie());
  frames.set('item/baked_trout', bakedTrout());
  frames.set('item/fish_stew', fishStew());
  frames.set('item/copper_bar', ingot(COPPER_BAR, (img) => {
    img.set(10, 11, COPPER_BAR[4]);
    img.set(5, 11, COPPER_BAR[4]);
  }));
  frames.set('item/iron_bar', ingot(IRON_BAR, (img) => {
    img.set(10, 11, [214, 222, 236]);
    img.set(5, 11, IRON_BAR[4]);
  }));
}

void IRON;
void lit;
void shade;
