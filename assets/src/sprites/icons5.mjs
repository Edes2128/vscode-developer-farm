// Phase 5 item icons: furniture pictures and museum artifacts. 16 x 16, outlined, one clear colour story each.
//
// Frame names (the contract with src/data/items.ts and src/rendering/frameNames.ts):
//   item/{chair, table, bookshelf, rug, pot_plant, lantern, armchair, wardrobe, vase, clock}   furniture, as small pictures
//   item/{clay_pot, arrowhead, old_coin, fossil, rusty_key, glass_bead}                         artifacts
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { BRASS, IRON, ORANGE_GLOW } from './interior.mjs';
import { LEAF, paintBalls, STONE } from './objects.mjs';
import { WALNUT, STEEL } from './home.mjs';
import { INK, INK_WARM, lathe, lit, polygon, shade, spiral } from './draw5.mjs';

const BOOKS = [LEAF[2], PAL.clay[2], PAL.water[2], PAL.gold[2], PAL.berry[2], PAL.violet[2], PAL.white[2], LEAF[1], PAL.clay[3], PAL.water[1]];

// ------------------------------------------------------------------------------------------ furniture icons

function chairIcon() {
  const img = new Img(16, 16);
  for (const x of [3, 11]) {
    img.fillRect(x, 1, 2, 9, PAL.bark[2]);
    img.vline(x, 1, 9, PAL.bark[3]);
  }
  img.fillRect(3, 1, 10, 2, PAL.plank[3]);
  img.hline(3, 1, 10, PAL.plank[4]);
  img.hline(3, 2, 10, PAL.plank[1]);
  for (const x of [6, 9]) {
    img.vline(x, 3, 6, PAL.plank[2]);
    img.vline(x + 1, 3, 6, PAL.bark[1]);
  }
  img.fillRect(2, 9, 12, 3, PAL.plank[3]);
  img.hline(2, 9, 12, PAL.plank[4]);
  img.hline(2, 11, 12, PAL.plank[1]);
  img.fillRect(2, 12, 12, 1, PAL.bark[1]);
  for (const x of [3, 11]) {
    img.fillRect(x, 13, 2, 2, PAL.bark[2]);
    img.vline(x, 13, 2, PAL.bark[3]);
  }
  img.outline(INK_WARM);
  return img;
}

function tableIcon() {
  const img = new Img(16, 16);
  img.fillRect(1, 3, 14, 6, PAL.plank[3]);
  img.hline(1, 3, 14, PAL.plank[4]);
  img.hline(1, 8, 14, PAL.plank[1]);
  img.hline(2, 5, 12, PAL.plank[2]);
  img.fillRect(1, 9, 14, 2, PAL.plank[2]);
  img.hline(1, 9, 14, PAL.plank[3]);
  img.hline(1, 10, 14, PAL.bark[1]);
  // a cloth runner with terracotta ends
  img.fillRect(4, 4, 8, 4, PAL.white[2]);
  img.hline(4, 4, 8, PAL.white[1]);
  img.hline(4, 7, 8, PAL.parchment[1]);
  img.vline(4, 4, 4, PAL.clay[2]);
  img.vline(11, 4, 4, PAL.clay[2]);
  for (const x of [2, 12]) {
    img.fillRect(x, 11, 2, 4, PAL.bark[2]);
    img.vline(x, 11, 4, PAL.bark[3]);
    img.set(x + 1, 14, PAL.bark[0]);
  }
  img.outline(INK_WARM);
  return img;
}

function bookshelfIcon() {
  const img = new Img(16, 16);
  img.fillRect(1, 1, 14, 14, PAL.bark[2]);
  img.vline(1, 1, 14, PAL.bark[3]);
  img.vline(14, 1, 14, PAL.bark[1]);
  img.hline(1, 1, 14, PAL.plank[3]);
  img.fillRect(3, 3, 10, 10, PAL.bark[0]);
  const rows = [[3, 6], [7, 10], [11, 13]];
  rows.forEach(([top, bottom], row) => {
    let x = 3;
    let k = row * 3;
    while (x < 13) {
      const w = 2;
      const h = 2 + ((x + row) % 2);
      const c = BOOKS[(k + row * 2) % BOOKS.length];
      img.fillRect(x, bottom - h, w, h, c);
      img.vline(x, bottom - h, h, lit(c, 0.25));
      x += w + (hash2(x, row, 5) < 0.3 ? 1 : 0);
      k += 1;
    }
    img.hline(3, bottom, 10, PAL.plank[2]);
  });
  img.hline(3, 13, 10, PAL.plank[2]);
  img.outline(INK_WARM);
  return img;
}

function rugIcon() {
  const img = new Img(16, 16);
  const X0 = 2;
  const Y0 = 3;
  const W = 12;
  const H = 9;
  for (let y = Y0; y < Y0 + H; y += 1) {
    for (let x = X0; x < X0 + W; x += 1) {
      const d = Math.min(x - X0, X0 + W - 1 - x, y - Y0, Y0 + H - 1 - y);
      let c;
      if (d === 0) c = PAL.clay[1];
      else if (d === 1) c = (x + y) % 2 === 0 ? PAL.clay[2] : PAL.clay[3];
      else if (d === 2) c = LEAF[2];
      else {
        const m = Math.abs(x + 0.5 - 8) / 3.4 + Math.abs(y + 0.5 - 7.5) / 2.2;
        c = m < 0.5 ? PAL.white[2] : m < 1 ? PAL.gold[3] : PAL.gold[2];
      }
      img.set(x, y, c);
    }
  }
  img.outline(INK_WARM);
  // fringe: loose threads at both short ends
  for (let y = Y0 + 1; y < Y0 + H - 1; y += 2) {
    img.set(X0 - 1, y, PAL.white[2]);
    img.set(X0 + W, y, PAL.white[2]);
  }
  return img;
}

function potPlantIcon() {
  const img = new Img(16, 16);
  paintBalls(
    img,
    [
      { x: 8, y: 4.6, r: 3.6, tone: 0.16 },
      { x: 4.8, y: 7.2, r: 3.2, tone: 0.02 },
      { x: 11.2, y: 7.2, r: 3.2, tone: -0.04 },
      { x: 8, y: 7.4, r: 3.6, tone: 0.04 },
    ],
    LEAF,
    77,
  );
  for (const [x, y, c] of [[7, 2, PAL.blossom[2]], [8, 2, PAL.blossom[1]], [11, 5, PAL.sun[2]], [5, 6, PAL.blossom[2]]]) img.set(x, y, c);
  img.fillRect(3, 10, 10, 2, PAL.clay[3]);
  img.hline(3, 10, 10, PAL.clay[4]);
  img.hline(3, 11, 10, PAL.clay[2]);
  for (let y = 12; y < 15; y += 1) {
    const inset = Math.floor((y - 12) / 2) + 1;
    for (let x = 3 + inset; x < 13 - inset; x += 1) img.set(x, y, x < 6 ? PAL.clay[3] : x < 10 ? PAL.clay[2] : PAL.clay[1]);
  }
  img.hline(6, 14, 4, PAL.clay[0]);
  img.outline(INK_WARM);
  return img;
}

function lanternIcon() {
  const img = new Img(16, 16);
  // the glowing shade: a drum wider at the bottom, a brass cap and rim
  const glow = [ORANGE_GLOW[1], ORANGE_GLOW[2], ORANGE_GLOW[3], [255, 238, 176]];
  for (let y = 1; y < 7; y += 1) {
    const hw = 3 + Math.floor((y - 1) / 2);
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = Math.abs(x + 0.5 - 8) / hw;
      img.set(x, y, rel < 0.34 ? glow[3] : rel < 0.74 ? glow[2] : glow[1]);
    }
  }
  img.hline(5, 1, 6, BRASS[3]);
  img.hline(6, 0, 4, BRASS[4]);
  img.hline(3, 7, 10, BRASS[2]);
  img.hline(3, 7, 3, BRASS[4]);
  img.hline(4, 8, 8, ORANGE_GLOW[2]);
  // the stem and a round foot
  img.fillRect(7, 8, 2, 4, BRASS[2]);
  img.vline(7, 8, 4, BRASS[3]);
  img.vline(8, 8, 4, BRASS[1]);
  img.ellipse(8, 13, 4.2, 1.8, IRON[2]);
  img.hline(5, 12, 3, IRON[4]);
  img.hline(5, 14, 6, IRON[0]);
  img.outline(INK_WARM);
  return img;
}

function armchairIcon() {
  const img = new Img(16, 16);
  const c = PAL.clay;
  for (let y = 1; y < 9; y += 1) {
    const inset = y < 2 ? 2 : y < 3 ? 1 : 0;
    for (let x = 3 + inset; x < 13 - inset; x += 1) {
      const rel = (x - 3) / 10;
      img.set(x, y, rel < 0.2 ? c[4] : rel < 0.44 ? c[3] : rel < 0.8 ? c[2] : c[1]);
    }
  }
  for (const x of [6, 9]) img.vline(x, 2, 6, c[1]);
  for (const x of [5, 8]) img.vline(x, 3, 4, c[4]);
  img.hline(3, 7, 10, c[1]);
  for (const x0 of [0, 12]) {
    img.fillRect(x0, 6, 4, 8, c[2]);
    img.vline(x0, 7, 7, x0 === 0 ? c[3] : c[2]);
    img.vline(x0 + 3, 7, 7, c[1]);
    img.hline(x0 + 1, 6, 2, c[4]);
    img.hline(x0, 13, 4, c[0]);
  }
  img.fillRect(3, 8, 10, 3, c[3]);
  img.hline(3, 8, 10, c[4]);
  img.fillRect(3, 11, 10, 2, c[2]);
  img.hline(3, 12, 10, c[0]);
  img.hline(3, 11, 10, c[1]);
  for (const x of [1, 13]) {
    img.fillRect(x, 14, 2, 1, PAL.bark[2]);
    img.set(x + 1, 14, PAL.bark[0]);
  }
  img.outline(INK_WARM);
  return img;
}

function wardrobeIcon() {
  const img = new Img(16, 16);
  img.fillRect(3, 1, 10, 13, WALNUT[2]);
  img.vline(3, 1, 13, WALNUT[3]);
  img.vline(12, 1, 13, WALNUT[1]);
  img.hline(2, 1, 12, WALNUT[4]);
  img.fillRect(2, 1, 12, 2, WALNUT[3]);
  img.hline(2, 1, 12, WALNUT[4]);
  img.hline(2, 3, 12, WALNUT[0]);
  for (const x0 of [4, 8]) {
    img.fillRect(x0, 4, 4, 9, WALNUT[2]);
    img.hline(x0, 4, 4, WALNUT[3]);
    img.vline(x0, 4, 9, WALNUT[3]);
    img.hline(x0, 12, 4, WALNUT[0]);
    img.vline(x0 + 3, 5, 8, WALNUT[1]);
    img.fillRect(x0 + 1, 5, 2, 3, WALNUT[1]);
    img.hline(x0 + 1, 5, 2, WALNUT[0]);
    img.fillRect(x0 + 1, 9, 2, 2, WALNUT[1]);
  }
  img.vline(8, 4, 9, WALNUT[0]);
  img.set(7, 8, BRASS[4]);
  img.set(7, 9, BRASS[2]);
  img.set(9, 8, BRASS[4]);
  img.set(9, 9, BRASS[2]);
  for (const x of [3, 11]) img.fillRect(x, 14, 2, 1, WALNUT[2]);
  img.outline(INK_WARM);
  return img;
}

function vaseIcon() {
  const img = new Img(16, 16);
  const glaze = ramp(mix(BRAND.riverBlue, [70, 96, 150], 0.35), 5, { dark: 0.5, light: 0.4 });
  for (const [tx, ty] of [[3, 4], [8, 2], [12, 4], [5, 5], [11, 6]]) {
    const n = 8 - ty;
    for (let i = 0; i <= n; i += 1) img.set(Math.round(8 + ((tx - 8) * i) / n), 8 - i, LEAF[1]);
  }
  for (const [x, y] of [[6, 7], [10, 8], [4, 7]]) img.set(x, y, LEAF[3]);
  const bloom = (cx, cy, colors) => {
    img.fillRect(cx - 1, cy - 1, 3, 3, colors[2]);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) img.set(cx + dx, cy + dy, colors[1]);
    img.set(cx, cy, colors[4]);
    img.set(cx - 1, cy, colors[3]);
  };
  bloom(3, 3, ramp(DERIVED.berry, 5));
  bloom(8, 2, ramp(DERIVED.sun, 5));
  bloom(12, 3, ramp(DERIVED.blossom, 5));
  bloom(5, 6, ramp(DERIVED.cream, 5, { dark: 0.2, light: 0.1 }));
  bloom(11, 6, ramp(mix(BRAND.riverBlue, [120, 140, 230], 0.5), 5));
  lathe(img, 8, 8, [2, 2, 3, 4, 4, 3, 3], glaze);
  img.hline(6, 8, 4, glaze[4]);
  img.hline(4, 12, 8, PAL.white[2]);
  img.hline(5, 14, 6, glaze[0]);
  img.outline(INK_WARM);
  return img;
}

function clockIcon() {
  const img = new Img(16, 16);
  // the hood and dial
  img.hline(6, 0, 4, WALNUT[3]);
  img.fillRect(4, 1, 8, 6, WALNUT[2]);
  img.vline(4, 1, 6, WALNUT[3]);
  img.vline(11, 1, 6, WALNUT[1]);
  img.ellipse(8, 4, 3, 2.8, BRASS[2]);
  img.ellipse(8, 4, 2.4, 2.2, PAL.white[2]);
  img.set(8, 4, WALNUT[0]);
  img.set(8, 3, WALNUT[0]);
  img.set(9, 4, WALNUT[0]);
  img.set(8, 2, WALNUT[1]);
  // the waist with a glazed door and a brass pendulum
  img.fillRect(5, 7, 6, 5, WALNUT[2]);
  img.vline(5, 7, 5, WALNUT[3]);
  img.vline(10, 7, 5, WALNUT[1]);
  img.fillRect(6, 8, 4, 3, WALNUT[0]);
  img.ellipse(8, 10, 1.4, 1.2, BRASS[2]);
  img.set(7, 9, BRASS[4]);
  img.vline(8, 8, 1, BRASS[3]);
  // the plinth
  img.fillRect(4, 12, 8, 3, WALNUT[2]);
  img.hline(4, 12, 8, WALNUT[4]);
  img.vline(4, 12, 3, WALNUT[3]);
  img.hline(4, 14, 8, WALNUT[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ artifacts

const FIRED = ramp([188, 118, 78], 5, { dark: 0.5, light: 0.4 });

function clayPot() {
  const img = new Img(16, 16);
  // a round ancient jar: a flared lip, a short neck, a wide belly, a narrow foot
  lathe(img, 8, 2, [4, 3, 3, 4, 5, 6, 6, 6, 5, 5, 4, 3, 3], FIRED);
  img.hline(4, 2, 8, FIRED[4]);
  img.hline(6, 3, 4, FIRED[0]); // the dark mouth
  // a painted zigzag band round the shoulder
  for (let x = 3; x < 13; x += 1) {
    const y = 7 + (x % 2);
    img.set(x, y, PAL.bark[1]);
  }
  img.hline(3, 9, 10, mix(FIRED[2], PAL.bark[1], 0.5));
  for (const x of [5, 9]) img.set(x, 11, PAL.bark[2]);
  // a long crack down the front, and a chip out of the rim
  for (const [x, y] of [[9, 4], [9, 5], [10, 6], [9, 7], [9, 8], [8, 9], [8, 10], [7, 11], [7, 12]]) img.set(x, y, PAL.bark[0]);
  img.set(10, 5, FIRED[1]);
  img.set(8, 8, FIRED[1]);
  img.set(11, 2, [0, 0, 0], 0);
  img.set(10, 2, [0, 0, 0], 0);
  img.set(11, 3, FIRED[1]);
  img.hline(5, 14, 6, FIRED[0]);
  img.outline(INK_WARM);
  return img;
}

const FLINT = ramp([160, 150, 136], 5, { dark: 0.5, light: 0.35 });

function arrowhead() {
  const img = new Img(16, 16);
  // a flaked stone point: a leaf-shaped blade, two notched barbs and a short stem, leaning a little to the right
  const rows = [
    [1, 7, 8], [2, 7, 8], [3, 6, 9], [4, 6, 9], [5, 5, 10], [6, 5, 10], [7, 4, 11], [8, 4, 11], [9, 3, 12], [10, 2, 13], [11, 3, 12],
  ];
  const lean = (y) => Math.round((8 - y) * 0.14);
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x <= x1; x += 1) {
      const rel = (x - x0) / Math.max(1, x1 - x0);
      let c = rel < 0.34 ? FLINT[3] : rel < 0.66 ? FLINT[2] : FLINT[1];
      if (hash2(x, y, 41) < 0.14) c = mix(c, FLINT[4], 0.7);
      img.set(x + lean(y), y, c);
    }
  }
  // the notches cut up into the base, then the stem
  for (const [y, x0, x1] of [[12, 5, 6], [12, 9, 10], [13, 6, 9], [14, 6, 9]]) {
    for (let x = x0; x <= x1; x += 1) img.set(x + lean(y), y, x < 7 ? FLINT[2] : FLINT[1]);
  }
  img.set(7 + lean(12), 12, FLINT[2]);
  img.set(8 + lean(12), 12, FLINT[1]);
  // the median ridge down the blade and flake scars along both edges
  for (let y = 3; y < 13; y += 1) img.set(8 + lean(y), y, FLINT[4]);
  for (const [x, y] of [[6, 5], [9, 5], [5, 7], [10, 8], [4, 9], [11, 10], [7, 13], [7, 10], [9, 11]]) img.set(x + lean(y), y, FLINT[0]);
  for (const [x, y] of [[6, 6], [10, 7], [3, 10], [12, 9]]) img.set(x + lean(y), y, FLINT[4]);
  img.set(12 + lean(10), 10, [0, 0, 0], 0); // a chip knocked off a barb
  img.outline(INK);
  return img;
}

const OLD_GOLD = ramp([196, 150, 72], 5, { dark: 0.5, light: 0.4 });

function oldCoin() {
  const img = new Img(16, 16);
  img.ellipse(8, 8, 6.2, 6.2, OLD_GOLD[1]);
  img.ellipse(7.8, 7.8, 5.6, 5.6, OLD_GOLD[3]);
  img.ellipse(8.2, 8.2, 4.6, 4.6, OLD_GOLD[2]);
  // the raised rim catches the light on its upper left and falls into shadow below and to the right
  for (let a = 0; a < 40; a += 1) {
    const t = (a / 40) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(t) * 4.7);
    const y = Math.round(7.5 + Math.sin(t) * 4.7);
    img.set(x, y, Math.cos(t) + Math.sin(t) < -0.4 ? OLD_GOLD[4] : Math.cos(t) + Math.sin(t) > 0.6 ? OLD_GOLD[1] : OLD_GOLD[3]);
  }
  // a worn crest in the middle: a crowned head, mostly rubbed away
  for (const [x, y] of [[8, 5], [7, 6], [8, 6], [9, 6], [7, 7], [8, 7], [9, 7], [8, 8], [7, 9], [9, 9], [8, 10]]) img.set(x, y, OLD_GOLD[1]);
  for (const [x, y] of [[7, 5], [9, 5], [8, 4]]) img.set(x, y, OLD_GOLD[4]);
  // green-brown tarnish in the hollows and one chip out of the edge
  for (const [x, y] of [[5, 10], [10, 5], [11, 9], [6, 5], [10, 11]]) img.set(x, y, mix(OLD_GOLD[1], [96, 128, 92], 0.6));
  img.set(11, 11, OLD_GOLD[0]);
  img.set(3, 6, [0, 0, 0], 0);
  img.outline(INK_WARM);
  return img;
}

const SHALE = ramp([140, 134, 126], 5, { dark: 0.5, light: 0.3 });
const SHELL = ramp([232, 218, 186], 5, { dark: 0.4, light: 0.18 });

function fossil() {
  const img = new Img(16, 16);
  // a slab of grey stone with a rough edge
  for (let y = 1; y < 15; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = (x + 0.5 - 8) / 7.7;
      const dy = (y + 0.5 - 8) / 6.8;
      const wob = 1 + (hash2(x >> 1, y >> 1, 12) - 0.5) * 0.22;
      if (Math.abs(dx) ** 3.2 + Math.abs(dy) ** 3.2 > wob) continue;
      const lit = -0.5 * dx - 0.8 * dy + (hash2(x, y, 9) - 0.5) * 0.2;
      img.set(x, y, lit > 0.5 ? SHALE[4] : lit > 0.1 ? SHALE[3] : lit > -0.4 ? SHALE[2] : SHALE[1]);
    }
  }
  // the shell: a coiled ammonite, pale against the slab; ridge and groove wind out from the middle
  const cx = 7.6;
  const cy = 7.8;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r > 5.4) continue;
      const turn = r / 1.85 - Math.atan2(dy, dx) / (Math.PI * 2);
      const f = turn - Math.floor(turn);
      const lit = (-0.55 * dx - 0.75 * dy) / 6;
      let c = f < 0.5 ? SHELL[lit > 0.25 ? 4 : 3] : SHELL[lit > 0.3 ? 2 : 1];
      if (r > 4.7) c = SHELL[1];
      if (r < 0.9) c = SHELL[2];
      img.set(x, y, c);
    }
  }
  // a shadow of the shell cast on the slab, lower right
  for (let a = 0; a < 18; a += 1) {
    const t = 0.1 + (a / 18) * 1.7;
    img.set(Math.round(cx + Math.cos(t) * 5.9), Math.round(cy + Math.sin(t) * 5.9), SHALE[0]);
  }
  img.outline(INK);
  return img;
}

const RUSTY = ramp([166, 94, 58], 5, { dark: 0.5, light: 0.35 });

function rustyKey() {
  const img = new Img(16, 16);
  // a ring bow at the top left
  img.ellipse(4.4, 4.4, 3.6, 3.6, RUSTY[2]);
  img.ellipse(4.2, 4.2, 1.7, 1.7, [0, 0, 0], 0);
  for (const [x, y] of [[2, 2], [3, 1], [4, 1]]) img.set(x, y, RUSTY[4]);
  for (const [x, y] of [[7, 5], [7, 4], [6, 7]]) img.set(x, y, RUSTY[1]);
  // the shaft: a thick diagonal, lit above
  for (let i = 0; i < 7; i += 1) {
    img.set(6 + i, 6 + i, RUSTY[3]);
    img.set(7 + i, 6 + i, RUSTY[2]);
    img.set(6 + i, 7 + i, RUSTY[1]);
  }
  // a collar, then the bit: two blocky teeth on the lower-left side of the shaft end
  img.fillRect(8, 8, 2, 2, IRON[3]);
  img.set(8, 8, IRON[4]);
  img.fillRect(8, 12, 3, 2, RUSTY[2]);
  img.set(8, 12, RUSTY[3]);
  img.fillRect(10, 13, 3, 2, RUSTY[1]);
  img.fillRect(12, 9, 2, 3, RUSTY[2]);
  img.set(12, 9, RUSTY[3]);
  img.set(13, 11, RUSTY[1]);
  // rust blooms and pits
  for (const [x, y] of [[8, 10], [10, 11], [12, 12], [5, 6], [3, 5], [9, 13]]) img.set(x, y, [214, 124, 52]);
  for (const [x, y] of [[9, 9], [11, 10], [6, 8]]) img.set(x, y, RUSTY[0]);
  img.outline(INK);
  return img;
}

const BEAD_DEEP = [28, 84, 140];
const BEAD_MID = [48, 148, 164];
const BEAD_LIGHT = [118, 214, 202];
const BEAD_PALE = [214, 248, 240];

function glassBead() {
  const img = new Img(16, 16);
  // a glass sphere with swirls of deep blue, teal and pale green running through it
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = (x + 0.5 - 8) / 6.4;
      const dy = (y + 0.5 - 8) / 6.4;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const swirl = Math.sin((x * 0.95 + y * 0.55) + 2.1 * Math.sin(y * 0.55 + 0.6) + 1.2 * Math.cos(x * 0.5));
      let c = swirl > 0.55 ? BEAD_LIGHT : swirl > -0.15 ? BEAD_MID : BEAD_DEEP;
      const lit = -0.55 * dx - 0.75 * dy;
      if (lit < -0.55) c = mix(c, [10, 30, 70], 0.4);
      if (lit > 0.55 && c !== BEAD_DEEP) c = lit > 0.8 ? BEAD_PALE : mix(c, BEAD_PALE, 0.5);
      img.set(x, y, c);
    }
  }
  // the string hole, seen end-on
  img.ellipse(8, 8, 1.6, 1.5, [10, 24, 44]);
  img.set(7, 7, [30, 70, 100]);
  img.set(9, 9, [120, 200, 210]);
  // specular highlight
  img.set(4, 4, [255, 255, 255]);
  img.set(5, 4, BEAD_PALE);
  img.set(4, 5, BEAD_PALE);
  img.set(11, 11, mix(BEAD_LIGHT, [255, 255, 255], 0.4));
  img.outline(INK_WARM);
  return img;
}

/** @param {Map<string, Img>} frames */
export function buildIcons5(frames) {
  frames.set('item/chair', chairIcon());
  frames.set('item/table', tableIcon());
  frames.set('item/bookshelf', bookshelfIcon());
  frames.set('item/rug', rugIcon());
  frames.set('item/pot_plant', potPlantIcon());
  frames.set('item/lantern', lanternIcon());
  frames.set('item/armchair', armchairIcon());
  frames.set('item/wardrobe', wardrobeIcon());
  frames.set('item/vase', vaseIcon());
  frames.set('item/clock', clockIcon());
  frames.set('item/clay_pot', clayPot());
  frames.set('item/arrowhead', arrowhead());
  frames.set('item/old_coin', oldCoin());
  frames.set('item/fossil', fossil());
  frames.set('item/rusty_key', rustyKey());
  frames.set('item/glass_bead', glassBead());
}

void STONE;
void STEEL;
void shade;
void INK;
