// Phase 5 museum and dig-site art: the display case and pedestal, the dig spot, and the crafting sparkles.
//
// Frame names (the contract with src/data/objects.ts, src/data/nodes.ts and src/rendering/frameNames.ts):
//   object/case        32 x 32   two cells wide: a glass-topped case on a wooden base, a velvet tray inside (empty)
//   object/pedestal    16 x 24   a marble pedestal with a small bust on top
//   node/dig_spot      16 x 16   disturbed earth, a tuft of grass, a pale tip of bone poking out
//   fx/sparkle_{0-2}   16 x 16   warm sparkles growing and fading
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { BRASS } from './interior.mjs';
import { LEAF, paintBalls } from './objects.mjs';
import { GLASS } from './home.mjs';
import { INK, INK_WARM, lit, shade } from './draw5.mjs';

const VELVET = ramp([132, 50, 84], 5, { dark: 0.5, light: 0.4 });
const MARBLE = ramp([236, 230, 216], 5, { dark: 0.38, light: 0.15 });
const SOIL = ramp([132, 92, 62], 5, { dark: 0.5, light: 0.4 });
const BONE = ramp([240, 232, 206], 5, { dark: 0.4, light: 0.12 });

// ------------------------------------------------------------------------------------------ display case

function displayCase() {
  const img = new Img(32, 32);
  const wood = PAL.plank;
  const dark = PAL.bark;

  // the cabinet base: a lit moulding, two recessed doors with brass knobs, a plinth
  img.fillRect(0, 21, 32, 11, wood[2]);
  img.hline(0, 21, 32, wood[4]);
  img.hline(0, 22, 32, wood[3]);
  img.hline(0, 23, 32, dark[1]);
  for (const x0 of [3, 17]) {
    img.fillRect(x0, 25, 12, 5, wood[1]);
    img.hline(x0, 25, 12, dark[1]);
    img.vline(x0, 25, 5, dark[1]);
    img.hline(x0 + 1, 29, 11, wood[3]);
    img.vline(x0 + 11, 26, 4, wood[3]);
  }
  img.fillRect(14, 26, 1, 3, BRASS[3]);
  img.fillRect(17, 26, 1, 3, BRASS[3]);
  img.set(14, 26, BRASS[4]);
  img.set(17, 26, BRASS[4]);
  img.hline(0, 31, 32, dark[0]);
  img.vline(15, 24, 7, dark[0]);
  img.vline(16, 24, 7, dark[0]);

  // the glass box: corner posts, the tray seen through the top, the front glass and a rail
  img.fillRect(0, 3, 32, 18, dark[1]);
  img.fillRect(0, 3, 32, 2, wood[3]);
  img.hline(0, 3, 32, wood[4]);
  // inside: a plum velvet lining, a raised tray edged in gold piping
  img.fillRect(2, 5, 28, 8, VELVET[1]);
  img.fillRect(3, 6, 26, 6, VELVET[2]);
  img.hline(3, 6, 26, VELVET[3]);
  img.hline(3, 11, 26, VELVET[1]);
  for (let x = 3; x < 29; x += 1) img.set(x, 5, BRASS[3]);
  img.hline(3, 12, 26, BRASS[2]);
  img.vline(3, 6, 6, BRASS[3]);
  img.vline(28, 6, 6, BRASS[2]);
  // a pair of felt dips where an exhibit will rest
  for (const x0 of [6, 18]) {
    img.fillRect(x0, 7, 8, 4, VELVET[1]);
    img.hline(x0, 7, 8, VELVET[0]);
    img.hline(x0, 10, 8, VELVET[3]);
  }
  // the front glass: the dim inside of the case, with a pale reflection
  img.fillRect(2, 13, 28, 7, mix(VELVET[0], [20, 24, 46], 0.4));
  img.hline(2, 13, 28, VELVET[1]);
  img.hline(2, 19, 28, shade(wood[1], 0.2));
  // the glass over both: a pale cool wash, bright slanted glints, a rim of light
  for (let y = 5; y < 20; y += 1) {
    for (let x = 2; x < 30; x += 1) img.over(x, y, GLASS[3], y < 13 ? 64 : 46);
  }
  const glint = (x, y, len) => {
    for (let i = 0; i < len; i += 1) {
      img.over(x + i, y - i, [255, 255, 255], 120);
      img.over(x + i + 1, y - i, [255, 255, 255], 50);
    }
  };
  glint(5, 11, 5);
  glint(13, 11, 3);
  glint(20, 12, 4);
  glint(6, 19, 4);
  glint(24, 18, 3);
  // the posts and the rails on top of the glass
  for (const x of [0, 30]) {
    img.fillRect(x, 3, 2, 18, wood[2]);
    img.vline(x, 3, 18, x === 0 ? wood[4] : wood[1]);
    img.vline(x + 1, 3, 18, x === 0 ? wood[3] : dark[1]);
  }
  img.fillRect(2, 20, 28, 2, wood[3]);
  img.hline(2, 20, 28, wood[4]);
  img.hline(2, 21, 28, dark[1]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ pedestal and bust

const BRONZE = ramp([166, 120, 70], 5, { dark: 0.5, light: 0.42 });

function pedestal() {
  const img = new Img(16, 24);
  // the plinth, the fluted shaft and the capital, in pale marble lit from the left, cool in the shade
  const col = (x0, x1, y0, y1) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const rel = (x - x0 + 0.5) / (x1 - x0);
        img.set(x, y, rel < 0.16 ? MARBLE[4] : rel < 0.4 ? MARBLE[3] : rel < 0.72 ? MARBLE[2] : MARBLE[1]);
      }
    }
  };
  col(2, 14, 21, 24);
  img.hline(2, 21, 12, MARBLE[4]);
  img.hline(2, 23, 12, MARBLE[0]);
  col(3, 13, 19, 21);
  img.hline(3, 19, 10, MARBLE[4]);
  img.hline(3, 20, 10, MARBLE[1]);
  col(4, 12, 13, 19);
  for (const x of [6, 9]) img.vline(x, 13, 6, MARBLE[1]);
  img.vline(11, 13, 6, MARBLE[0]);
  img.set(5, 14, MARBLE[4]);
  col(3, 13, 11, 13);
  img.hline(3, 11, 10, MARBLE[4]);
  img.hline(3, 12, 10, MARBLE[0]);
  // the bust, in bronze: broad shoulders, a thick neck, a head with a brow and a nose, a crown of curls
  img.fillRect(3, 8, 10, 3, BRONZE[2]);
  img.hline(3, 8, 10, BRONZE[3]);
  img.vline(3, 8, 3, BRONZE[3]);
  img.vline(12, 8, 3, BRONZE[1]);
  img.hline(3, 10, 10, BRONZE[0]);
  img.set(3, 8, BRONZE[1]);
  img.set(12, 8, BRONZE[0]);
  img.fillRect(6, 6, 4, 3, BRONZE[2]);
  img.vline(6, 6, 3, BRONZE[3]);
  img.vline(9, 6, 3, BRONZE[1]);
  img.ellipse(8, 3.6, 3, 3.4, BRONZE[2]);
  img.ellipse(7.4, 3.2, 2.3, 2.7, BRONZE[3]);
  img.ellipse(6.6, 2.4, 1.4, 1.2, BRONZE[4]);
  for (const x of [5, 7, 9, 10]) img.set(x, 1, BRONZE[4]);
  img.set(10, 2, BRONZE[1]);
  img.set(10, 3, BRONZE[1]);
  img.set(6, 4, BRONZE[0]);
  img.set(9, 4, BRONZE[0]);
  img.set(8, 5, BRONZE[1]);
  img.set(8, 4, BRONZE[3]);
  // a green bloom of verdigris on the shoulder
  for (const [x, y] of [[4, 9], [5, 9], [11, 9]]) img.set(x, y, [90, 150, 126]);
  // veins in the marble
  for (const [x, y] of [[6, 15], [7, 16], [7, 17], [8, 18], [10, 21], [11, 22]]) img.set(x, y, mix(MARBLE[2], [150, 156, 172], 0.5));
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ dig spot

/** Drops the sprite onto a soft ground shadow that lives inside the same 16 x 16 (as the other node frames do). */
function withShadow(body, { cx = 8, cy = 13.2, rx = 6.6, ry = 2.2, alpha = 74 } = {}) {
  const out = new Img(body.w, body.h);
  out.ellipse(cx, cy, rx, ry, INK, alpha, true);
  out.ellipse(cx, cy - 0.2, rx * 0.6, ry * 0.6, INK, alpha * 0.6, true);
  out.blit(body, 0, 0);
  return out;
}

function digSpot() {
  const body = new Img(16, 16);
  // a low ring of freshly turned earth round a shallow hollow: lumps lit from the top left
  paintBalls(
    body,
    [
      { x: 8, y: 10.6, r: 5.6, tone: 0.1 },
      { x: 4.2, y: 11.6, r: 3.2, tone: -0.02 },
      { x: 12, y: 11.8, r: 3.4, tone: -0.1 },
      { x: 5.6, y: 8.6, r: 2.8, tone: 0.2 },
      { x: 11.2, y: 8.8, r: 2.6, tone: 0.08 },
    ],
    SOIL,
    71,
  );
  // the hollow: a dark scoop in the middle of the mound, with a lit far lip
  body.ellipse(8.4, 10.6, 3.3, 1.9, SOIL[0]);
  body.ellipse(8.4, 11, 2.6, 1.3, mix(SOIL[0], [20, 14, 18], 0.4));
  body.hline(6, 8, 5, SOIL[4]);
  // dark cracks between the clods and a few pale crumbs
  for (const [x, y] of [[4, 10], [5, 12], [12, 10], [11, 13], [3, 12]]) if (body.alphaAt(x, y) > 0) body.set(x, y, SOIL[0]);
  for (const [x, y] of [[4, 11], [13, 11], [6, 13], [10, 13], [3, 10]]) if (body.alphaAt(x, y) > 0) body.set(x, y, SOIL[4]);
  // a tuft of grass leaning at the left edge of the mound
  for (const [x, y, c] of [[3, 8, LEAF[3]], [3, 7, LEAF[3]], [2, 6, LEAF[4]], [4, 8, LEAF[2]], [4, 7, LEAF[3]], [5, 6, LEAF[3]], [4, 9, LEAF[1]], [3, 9, LEAF[1]], [5, 8, LEAF[2]]]) body.set(x, y, c);
  // the tip of a bone poking up out of the hollow: a shaft and a knobbed end with two bumps
  for (const [x, y, c] of [[9, 10, BONE[2]], [10, 9, BONE[3]], [10, 8, BONE[3]], [11, 7, BONE[3]], [11, 6, BONE[4]], [12, 5, BONE[4]], [9, 9, BONE[1]], [10, 10, BONE[1]], [11, 8, BONE[2]], [12, 6, BONE[2]], [12, 7, BONE[1]]]) body.set(x, y, c);
  for (const [x, y, c] of [[11, 4, BONE[3]], [12, 4, BONE[4]], [13, 5, BONE[2]], [13, 6, BONE[1]], [12, 3, BONE[3]], [13, 4, BONE[2]]]) body.set(x, y, c);
  body.set(12, 5, [255, 252, 238]);
  // a sherd of pottery beside it
  for (const [x, y, c] of [[6, 11, PAL.clay[3]], [7, 11, PAL.clay[2]], [6, 10, PAL.clay[4]]]) body.set(x, y, c);
  body.outline(INK_WARM);
  return withShadow(body);
}

// ------------------------------------------------------------------------------------------ sparkles

const SPARK = [[255, 252, 232], [255, 236, 150], [250, 204, 84], [228, 160, 56]];

function star(img, cx, cy, arm, alpha = 255, { diag = false } = {}) {
  img.over(cx, cy, SPARK[0], alpha);
  for (let i = 1; i <= arm; i += 1) {
    const c = i === arm ? SPARK[3] : i === 1 ? SPARK[1] : SPARK[2];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) img.over(cx + dx * i, cy + dy * i, c, Math.round(alpha * (i === arm ? 0.8 : 1)));
  }
  if (diag) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) img.over(cx + dx, cy + dy, SPARK[1], Math.round(alpha * 0.85));
}

function sparkle(stage) {
  const img = new Img(16, 16);
  if (stage === 0) {
    // small and bright: one little star and two points of light
    star(img, 8, 8, 2);
    img.over(3, 4, SPARK[1], 230);
    img.over(12, 11, SPARK[1], 230);
    img.over(12, 3, SPARK[0], 200);
    img.over(4, 12, SPARK[2], 200);
  } else if (stage === 1) {
    // full: a big star, four smaller ones round it
    star(img, 8, 8, 4, 255, { diag: true });
    star(img, 3, 3, 2);
    star(img, 13, 4, 1);
    star(img, 12, 13, 2);
    star(img, 3, 12, 1);
    img.over(8, 1, SPARK[1], 220);
    img.over(14, 8, SPARK[2], 200);
  } else {
    // fading: the stars drift apart and thin out
    star(img, 8, 8, 2, 150);
    star(img, 2, 2, 1, 130);
    star(img, 14, 3, 1, 120);
    star(img, 13, 14, 1, 110);
    star(img, 2, 13, 1, 100);
    for (const [x, y, a] of [[8, 0, 110], [15, 8, 100], [0, 8, 100], [8, 15, 90], [5, 5, 90], [11, 11, 80]]) img.over(x, y, SPARK[1], a);
  }
  return img;
}

/** @param {Map<string, Img>} frames */
export function buildMuseum(frames) {
  frames.set('object/case', displayCase());
  frames.set('object/pedestal', pedestal());
  frames.set('node/dig_spot', digSpot());
  for (let i = 0; i < 3; i += 1) frames.set(`fx/sparkle_${i}`, sparkle(i));
}

void BRAND;
void DERIVED;
void hash2;
void rng;
void lit;
