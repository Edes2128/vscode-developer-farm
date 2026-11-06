// Phase 6 market and weather art: the village notice board, the travelling merchant's cart, the spring-festival egg
// and the five weather icons for the HUD. (Rowan, the merchant himself, is a character style in characters.mjs.)
//
// Frame names (the contract with src/data/objects.ts, src/data/items.ts and src/rendering/frameNames.ts):
//   object/notice_board   32 x 32   two cells wide: posts, a shingled roof, a cork board with pinned notices
//   object/merchant_cart  48 x 32   three cells wide: a covered cart parked as a stall (teal and cream awning)
//   item/festival_egg     16 x 16   a painted spring egg lying on grass, soft shadow baked in
//   icon/weather_{sun,cloud,rain,storm,snow}   16 x 16   HUD icons, outlined like icon/coin
//
// The two standing objects (board, cart) rest on the bottom row of their sprite: the stone footings under the posts
// and the wheel tyres run down to row 31, which is art, not outline, exactly like the farmhouse or the kitchen. The
// footprint is the bottom 16 rows; the top 16 rows (roof, awning) overhang. Lit from the top left, 1px dark outline.
import { Img } from '../canvas.mjs';
import { mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { BRASS, BURLAP, CREAM, IRON } from './interior.mjs';
import { LEAF, STONE } from './objects.mjs';
import { MERCHANT_TEAL } from './characters.mjs';
import { INK_WARM, line } from './draw5.mjs';

/** Rowan's coat and the cart's awning share this teal, so the man and his cart read as one. */
const TEAL = MERCHANT_TEAL;
const CORK = ramp([194, 146, 94], 5, { dark: 0.5, light: 0.35 });
const PAPER_BLUE = ramp([200, 224, 240], 5, { dark: 0.3, light: 0.12 });
const PAPER_PINK = ramp([246, 206, 216], 5, { dark: 0.3, light: 0.12 });

// ------------------------------------------------------------------------------------------ notice board

const PAPER_INK = mix(PAL.parchment[1], PAL.bark[1], 0.45);
const EAVE_SHADOW = [58, 42, 34];
const CORK_SHADOW = CORK[1];

/** The little sheets on the board: shadows first (so no sheet is darkened by its neighbour), then the sheets. */
function pinSheets(img, sheets) {
  for (const { x, y, w, h } of sheets) img.hline(x, y + h, w, CORK_SHADOW);
  for (const { x, y, w, h, paper, head = null, lines = 2, pin = PAL.berry[2], curl = false } of sheets) {
    img.fillRect(x, y, w, h, paper[3]);
    img.hline(x, y, w, paper[4]);
    img.vline(x + w - 1, y + 1, h - 1, paper[2]);
    img.hline(x, y + h - 1, w, paper[2]);
    if (head) img.hline(x + 1, y + 2, Math.max(2, w - 3), head);
    for (let i = 0; i < lines; i += 1) {
      const ly = y + (head ? 4 : 2) + i * 2;
      if (ly >= y + h - 1) break;
      img.hline(x + 1, ly, i === lines - 1 ? Math.max(1, w - 4) : w - 2, PAPER_INK);
    }
    img.set(x + Math.floor(w / 2), y, pin);
    if (curl) {
      // a dog-eared corner at the bottom right
      img.set(x + w - 1, y + h - 1, CORK[2]);
      img.set(x + w - 2, y + h - 1, paper[1]);
      img.set(x + w - 1, y + h - 2, paper[1]);
    }
  }
}

function noticeBoard() {
  const img = new Img(32, 32);
  const bark = PAL.bark;
  const plank = PAL.plank;

  // the two posts, down to the last row, each standing in a little stone footing
  for (const x0 of [3, 25]) {
    img.fillRect(x0, 8, 4, 24, bark[2]);
    img.vline(x0, 8, 24, bark[3]);
    img.vline(x0 + 3, 8, 24, bark[1]);
    img.vline(x0 + 1, 15, 3, bark[3]);
    img.vline(x0 + 2, 21, 3, bark[1]);
    img.fillRect(x0 - 1, 29, 6, 3, STONE[2]);
    img.hline(x0 - 1, 29, 6, STONE[3]);
    img.set(x0 - 1, 29, STONE[4]);
    img.vline(x0 + 4, 30, 2, STONE[1]);
    img.hline(x0 - 1, 31, 6, STONE[1]);
    img.set(x0 + 2, 30, STONE[1]);
  }

  // the board: a plank frame (lit along the top and left) round a field of cork
  img.fillRect(6, 10, 20, 18, plank[2]);
  img.hline(6, 10, 20, plank[4]);
  img.hline(6, 11, 20, plank[3]);
  img.vline(6, 10, 18, plank[4]);
  img.vline(7, 11, 16, plank[3]);
  img.vline(25, 10, 18, bark[1]);
  img.vline(24, 11, 16, plank[1]);
  img.hline(6, 27, 20, bark[1]);
  img.hline(7, 26, 17, plank[1]);
  img.fillRect(8, 12, 16, 14, CORK[3]);
  for (let y = 12; y < 26; y += 1) {
    for (let x = 8; x < 24; x += 1) {
      const n = hash2(x, y, 6001);
      if (n < 0.12) img.set(x, y, CORK[2]);
      else if (n > 0.93) img.set(x, y, CORK[4]);
    }
  }
  // the frame's shadow on the cork: along the top and the left
  img.hline(8, 12, 16, CORK[2]);
  img.hline(8, 13, 16, mix(CORK[2], CORK[3], 0.5));
  img.vline(8, 14, 12, mix(CORK[2], CORK[3], 0.5));

  pinSheets(img, [
    { x: 9, y: 14, w: 5, h: 7, paper: CREAM, head: PAL.berry[1], lines: 2 },
    { x: 15, y: 15, w: 4, h: 6, paper: PAPER_BLUE, lines: 2 },
    { x: 20, y: 14, w: 4, h: 5, paper: CREAM, head: LEAF[1], lines: 1, pin: BRASS[3] },
    { x: 9, y: 22, w: 6, h: 4, paper: PAPER_PINK, lines: 1 },
    { x: 16, y: 21, w: 7, h: 5, paper: CREAM, lines: 2, curl: true },
  ]);

  // the roof: a small hipped roof of clay shingles, narrowing to a ridge, overhanging both posts
  const RT = 9;
  for (let k = 0; k < RT; k += 1) {
    const inset = Math.round(((RT - 1 - k) * 8) / (RT - 1));
    const row = Math.floor(k / 2);
    for (let x = inset; x < 32 - inset; x += 1) {
      const joint = (x + (row % 2) * 3) % 6 === 0;
      let c;
      if (k === 0) c = PAL.clay[4];
      else if (k === RT - 1) c = PAL.clay[0];
      else if (k === RT - 2) c = joint ? PAL.clay[0] : PAL.clay[1];
      else if (joint) c = PAL.clay[1];
      else c = k % 2 === 1 ? PAL.clay[3] : PAL.clay[2];
      img.set(x, 1 + k, c);
    }
  }
  // the eave's shadow on the top of the board
  for (let x = 6; x < 26; x += 1) img.set(x, 10, mix(img.colorAt(x, 10), EAVE_SHADOW, 0.55));
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ merchant cart

/** A tied sack drawn from a picture: L light, M mid, D dark, t the rope. Resting on its bottom row. */
function sack(img, x, y, rows, cloth, rope) {
  const key = { L: cloth[3], M: cloth[2], D: cloth[1], d: cloth[0], H: cloth[4], t: rope };
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== '.') img.set(x + dx, y + dy, key[ch]);
    });
  });
}
const SACK_BIG = ['...HL...', '..tttt..', '.LLMMDD.', 'LHLMMMDD', 'LLMMMMDD', 'LMMMMMDD', 'MMMMMDDD', '.dDDDDd.'];
const SACK_SMALL = ['..LL..', '.tttt.', 'LLMMDD', 'LMMMDD', 'MMMDDD', '.dDDd.'];

function crate(img, x, y, w, h) {
  img.fillRect(x, y, w, h, PAL.plank[2]);
  img.hline(x, y, w, PAL.plank[4]);
  img.hline(x, y + 1, w, PAL.plank[3]);
  img.hline(x, y + h - 1, w, PAL.bark[1]);
  img.vline(x, y, h, PAL.plank[3]);
  img.vline(x + w - 1, y, h, PAL.bark[1]);
  if (h > 4) img.hline(x + 1, y + 3, w - 2, PAL.plank[1]);
}

/** A seed packet standing in a crate: cream sheet, a coloured header and a tiny plant. */
function packet(img, x, y, w, h, accent, leaf) {
  img.fillRect(x, y, w, h, CREAM[3]);
  img.vline(x + w - 1, y, h, CREAM[1]);
  img.fillRect(x, y, w, 2, accent);
  img.hline(x, y, w, mix(accent, [255, 240, 176], 0.3));
  if (w > 2) {
    img.set(x + 1, y + h - 1, leaf);
    img.set(x + 1, y + h - 2, leaf);
    img.set(x, y + h - 3, leaf);
  }
}

function wheel(img, cx, cy) {
  const R = 6.4;
  for (let y = cy - 7; y <= cy + 7; y += 1) {
    for (let x = cx - 7; x <= cx + 7; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R) continue;
      const side = x - cx + (y - cy);
      if (d > R - 1.1) img.set(x, y, side < 0 ? IRON[2] : IRON[0]);
      else if (d > R - 2.4) img.set(x, y, side < -2 ? PAL.plank[4] : side < 3 ? PAL.plank[3] : PAL.plank[2]);
      else img.set(x, y, PAL.bark[0]);
    }
  }
  for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    line(img, cx, cy, cx + dx, cy + dy, dx + dy < 0 ? PAL.plank[4] : PAL.plank[3]);
  }
  img.fillRect(cx - 1, cy - 1, 3, 3, BRASS[2]);
  img.set(cx - 1, cy - 1, BRASS[4]);
  img.set(cx + 1, cy + 1, BRASS[1]);
}

const GOLD_SACK = ramp(mix(BURLAP[2], PAL.gold[2], 0.5), 5, { dark: 0.45, light: 0.3 });

function merchantCart() {
  const img = new Img(48, 32);
  const bark = PAL.bark;
  const plank = PAL.plank;

  // the shade under the awning: a dark teal canvas back wall the goods stand against
  img.fillRect(7, 9, 34, 13, TEAL[0]);
  img.fillRect(7, 9, 34, 3, mix(TEAL[0], [20, 24, 40], 0.5));

  // the wagon box: a rim plank, upright boards
  img.fillRect(4, 21, 40, 9, plank[2]);
  img.hline(4, 21, 40, plank[4]);
  img.hline(4, 22, 40, plank[3]);
  img.hline(4, 23, 40, bark[1]);
  for (let x = 5; x < 43; x += 6) img.vline(x, 24, 5, bark[1]);
  img.hline(4, 28, 40, bark[1]);
  img.hline(4, 29, 40, bark[0]);

  // two posts holding the awning
  for (const x0 of [4, 41]) {
    img.fillRect(x0, 9, 3, 13, bark[2]);
    img.vline(x0, 9, 13, bark[3]);
    img.vline(x0 + 2, 9, 13, bark[1]);
  }

  // goods along the front: two sacks, a crate of seed packets, another crate, one more sack
  sack(img, 7, 13, SACK_BIG, BURLAP, PAL.bark[3]);
  sack(img, 14, 15, SACK_SMALL, GOLD_SACK, PAL.clay[3]);
  crate(img, 21, 17, 9, 4);
  packet(img, 22, 11, 3, 6, PAL.clay[2], LEAF[2]);
  packet(img, 25, 12, 3, 5, PAL.sun[1], LEAF[1]);
  packet(img, 28, 11, 2, 6, PAL.berry[2], LEAF[2]);
  crate(img, 30, 17, 7, 4);
  packet(img, 31, 12, 3, 5, TEAL[3], LEAF[1]);
  packet(img, 34, 11, 2, 6, PAL.sun[1], LEAF[2]);
  sack(img, 35, 15, SACK_SMALL, BURLAP, PAL.clay[2]);

  // a little painted sign on the front of the box: teal border, cream board, a gold coin, a sprout and writing
  img.fillRect(16, 23, 16, 6, TEAL[1]);
  img.fillRect(17, 24, 14, 4, CREAM[3]);
  img.hline(17, 24, 14, CREAM[4]);
  img.hline(17, 27, 14, PAL.parchment[1]);
  img.fillRect(18, 25, 3, 2, PAL.gold[3]);
  img.set(18, 25, PAL.gold[4]);
  img.set(20, 26, PAL.gold[1]);
  img.hline(22, 25, 4, PAPER_INK);
  img.hline(22, 26, 3, PAPER_INK);
  img.vline(28, 25, 2, LEAF[2]);
  img.set(27, 25, LEAF[3]);
  img.set(29, 25, LEAF[3]);

  // the two big spoked wheels, standing on the last row
  wheel(img, 10, 25);
  wheel(img, 37, 25);

  // the awning: teal and cream stripes (teal at both ends), a scalloped hem, a lit top edge
  for (let x = 2; x < 46; x += 1) {
    const stripe = Math.floor((x - 2) / 4) % 2 === 0;
    const base = stripe ? TEAL[2] : CREAM[3];
    const light = stripe ? TEAL[3] : CREAM[4];
    const dark = stripe ? TEAL[1] : PAL.parchment[1];
    img.vline(x, 1, 7, base);
    img.set(x, 1, light);
    img.set(x, 2, light);
    img.set(x, 7, dark);
    const c = (x - 2) % 4;
    const drop = c === 1 || c === 2 ? 3 : 2;
    img.vline(x, 8, drop, dark);
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ festival egg

const EGG_PINK = [[176, 100, 138], [222, 138, 174], [246, 178, 204], [253, 212, 226], [255, 242, 246]];
const EGG_BLUE = [[44, 92, 152], [64, 124, 188], [98, 170, 224], [152, 208, 242], [214, 240, 255]];
const EGG_YELLOW = [[196, 140, 40], [226, 178, 56], [248, 214, 92], [255, 238, 140], [255, 250, 200]];

/** [first, last] column of the shell on each row, y = 1..11: blunt end down, leaning a pixel to the right. */
const EGG_ROWS = [[7, 10], [6, 11], [5, 12], [4, 12], [3, 12], [3, 12], [3, 12], [3, 12], [3, 11], [4, 11], [5, 10]];

/**
 * A painted egg standing in the grass: a pink shell, a thick blue zig-zag round its middle, yellow dots and a glint.
 * Outlined, with a soft shadow on the grass baked into the same 16 x 16.
 */
function festivalEgg() {
  const img = new Img(16, 16);
  EGG_ROWS.forEach(([x0, x1], i) => {
    const y = i + 1;
    for (let x = x0; x <= x1; x += 1) {
      // light from the left: a smooth fall-off across the shell, a little darker near the foot
      const rel = (x - x0) / (x1 - x0 + 1);
      let tone = rel < 0.2 ? 3 : rel < 0.5 ? 2 : rel < 0.82 ? 1 : 0;
      if (rel < 0.2 && y > 8) tone = 2;
      if (y >= 10 && tone > 0) tone -= 1;
      img.set(x, y, EGG_PINK[tone]);
    }
  });
  // the zig-zag: two pixels thick, peaks every four columns, across the broadest part
  for (let x = 3; x <= 12; x += 1) {
    const ya = 6 + [1, 0, -1, 0][x % 4];
    for (const y of [ya, ya + 1]) {
      const [x0, x1] = EGG_ROWS[y - 1];
      if (x < x0 || x > x1) continue;
      const rel = (x - x0) / (x1 - x0 + 1);
      img.set(x, y, EGG_BLUE[rel < 0.2 ? 3 : rel < 0.55 ? 2 : rel < 0.85 ? 1 : 0]);
    }
  }
  // yellow dots above and below the band, and a glint on the lit shoulder
  for (const [x, y] of [[8, 2], [6, 10], [9, 10], [6, 4]]) img.set(x, y, EGG_YELLOW[3]);
  img.set(5, 4, EGG_PINK[4]);
  img.set(4, 5, EGG_PINK[4]);
  img.set(5, 3, EGG_PINK[4]);
  img.outline(INK_WARM);
  // the soft shadow: a flattened dark-green ellipse under and to the right, only where the picture is still clear
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (img.alphaAt(x, y) > 0) continue;
      const dx = (x + 0.5 - 8.8) / 6.4;
      const dy = (y + 0.5 - 12.6) / 2.4;
      const d = dx * dx + dy * dy;
      if (d <= 1) img.set(x, y, [30, 48, 36], d < 0.5 ? 104 : 60);
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ weather icons

const SUN = ramp([255, 206, 66], 5, { dark: 0.4, light: 0.45 });
const RAY = ramp([250, 170, 52], 5, { dark: 0.45, light: 0.35 });
const BOLT = ramp([255, 220, 70], 5, { dark: 0.45, light: 0.4 });
const DROP = ramp([84, 156, 226], 5, { dark: 0.5, light: 0.4 });
const CLOUD_SOFT = ramp([228, 234, 242], 5, { dark: 0.36, light: 0.14 });
const CLOUD_RAIN = ramp([172, 184, 204], 5, { dark: 0.4, light: 0.25 });
const CLOUD_STORM = ramp([86, 94, 122], 5, { dark: 0.5, light: 0.3 });
const CLOUD_SNOW = ramp([226, 238, 248], 5, { dark: 0.34, light: 0.14 });

/**
 * A cloud from a union of puffs (circles) over a flat belly. Each puff is lit from the top left like a little
 * sphere; the last two rows of every column fall into shade so the cloud sits flat underneath.
 */
function cloud(img, puffs, belly, colors) {
  const owner = new Map();
  const claim = (x, y, i, score) => {
    const key = y * 16 + x;
    const held = owner.get(key);
    if (!held || score < held.score) owner.set(key, { i, score });
  };
  puffs.forEach(([cx, cy, r], i) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (r * r);
        if (d <= 1 && y <= belly.bottom) claim(x, y, i, d);
      }
    }
  });
  for (let y = belly.top; y <= belly.bottom; y += 1) {
    for (let x = belly.x0; x <= belly.x1; x += 1) {
      if (owner.has(y * 16 + x)) continue;
      // under the puffs: borrow the nearest puff's light, but from its lower half
      let best = 0;
      puffs.forEach(([cx], i) => {
        if (Math.abs(x + 0.5 - cx) < Math.abs(x + 0.5 - puffs[best][0])) best = i;
      });
      owner.set(y * 16 + x, { i: best, score: 2 });
    }
  }
  const bottoms = new Map();
  for (const key of owner.keys()) bottoms.set(key % 16, Math.max(bottoms.get(key % 16) ?? -1, Math.floor(key / 16)));
  for (const [key, { i, score }] of owner) {
    const x = key % 16;
    const y = Math.floor(key / 16);
    const [cx, cy, r] = puffs[i];
    const l = -((x + 0.5 - cx) * 0.5 + (y + 0.5 - cy) * 0.9) / r;
    let t = score > 1 ? 3 : l > 0.6 ? 4 : l < -0.62 ? 2 : 3;
    const fromBottom = bottoms.get(x) - y;
    if (fromBottom === 0) t = 1;
    else if (fromBottom === 1) t = Math.min(t, 2);
    img.set(x, y, colors[t]);
  }
}

/** The big cloud (four puffs on a flat belly) and the smaller one that sits above rain, lightning and snow. */
const BIG_PUFFS = [[3.6, 8.8, 2.3], [6.6, 6.2, 3.2], [10.6, 6.8, 3.4], [13.0, 9.2, 2.3]];
const BIG_BELLY = { top: 9, bottom: 11, x0: 3, x1: 13 };
const SMALL_PUFFS = [[4.4, 7.0, 2.5], [7.6, 4.6, 3.2], [11.4, 5.2, 3.4]];
const SMALL_BELLY = { top: 7, bottom: 9, x0: 3, x1: 14 };

function sunIcon() {
  const img = Img.fromAscii(
    [
      '................',
      '................',
      '........r.......',
      '...r....r....r..',
      '....r.......r...',
      '.......ooo......',
      '......ooooo.....',
      '.....ooooooo....',
      '..rr.ooooooo.rr.',
      '.....ooooooo....',
      '......ooooo.....',
      '.......ooo......',
      '....r.......r...',
      '...r....r....r..',
      '........r.......',
      '................',
    ],
    { o: SUN[2], r: RAY[2] },
  );
  // shading on the disc: a lit upper left, a warm shadow lower right
  for (const [x, y] of [[7, 5], [6, 6], [7, 6], [5, 7], [6, 7]]) img.set(x, y, SUN[4]);
  for (const [x, y] of [[8, 5], [7, 5]]) img.set(x, y, SUN[3]);
  for (const [x, y] of [[10, 8], [10, 9], [9, 10], [8, 11], [9, 11], [11, 8], [11, 9]]) img.set(x, y, SUN[1]);
  img.outline(INK_WARM);
  return img;
}

function cloudIcon() {
  const img = new Img(16, 16);
  cloud(img, BIG_PUFFS, BIG_BELLY, CLOUD_SOFT);
  img.outline(INK_WARM);
  return img;
}

/** A drop: two columns narrower at the top, with a glint. Painted from its top row. */
function drop(img, x, y, colors = DROP) {
  img.set(x + 1, y, colors[3]);
  img.fillRect(x, y + 1, 3, 2, colors[2]);
  img.set(x + 1, y + 3, colors[1]);
  img.set(x, y + 1, colors[4]);
  img.set(x + 2, y + 2, colors[1]);
}

function rainIcon() {
  const img = new Img(16, 16);
  cloud(img, SMALL_PUFFS, SMALL_BELLY, CLOUD_RAIN);
  drop(img, 2, 11);
  drop(img, 6, 12);
  drop(img, 10, 11);
  img.outline(INK_WARM);
  return img;
}

function stormIcon() {
  const img = new Img(16, 16);
  cloud(img, SMALL_PUFFS, SMALL_BELLY, CLOUD_STORM);
  const bolt = ['...XX', '..XXX', '.XXX.', 'XXXXX', '..XX.', '.XX..', '.X...'];
  bolt.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== '.') img.set(4 + dx, 8 + dy, dx + dy < 4 ? BOLT[3] : BOLT[2]);
    });
  });
  drop(img, 11, 11);
  img.outline(INK_WARM);
  return img;
}

function snowIcon() {
  const img = new Img(16, 16);
  cloud(img, SMALL_PUFFS, SMALL_BELLY, CLOUD_SNOW);
  const flake = (cx, cy) => {
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) img.set(cx + dx, cy + dy, CLOUD_SNOW[dx === 0 && dy === 0 ? 4 : 3]);
  };
  flake(3, 13);
  flake(8, 14);
  flake(12, 13);
  img.outline(INK_WARM);
  return img;
}

export function buildMarket(frames) {
  frames.set('object/notice_board', noticeBoard());
  frames.set('object/merchant_cart', merchantCart());
  frames.set('item/festival_egg', festivalEgg());
  frames.set('icon/weather_sun', sunIcon());
  frames.set('icon/weather_cloud', cloudIcon());
  frames.set('icon/weather_rain', rainIcon());
  frames.set('icon/weather_storm', stormIcon());
  frames.set('icon/weather_snow', snowIcon());
}
