// Interior and cave art for Phase 4: floors and walls, furniture, the shop, the mine's ladders.
//
// Terrain tiles are seamless 16x16 squares (variants are chosen by cell hash). Furniture is outlined, lit from the
// top left, and stands with its bottom edge on the bottom of its footprint. Rugs and ladders lie flat on the floor.
//
// Frame names (the contract with src/data/terrain.ts and src/data/objects.ts):
//   terrain/{wood_floor_v0-3, plaster_wall_v0-1, cave_floor_v0-3, cave_wall_v0-3}
//   object/{store, bed, table, chair, bookshelf, counter, stove, barrel, crate, pot_plant, shelf_goods, rug,
//           ladder_down, ladder_up}
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { houseBody, LEAF, paintBalls } from './objects.mjs';

const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;
const wrap = (v) => ((v % 16) + 16) % 16;

// Shared interior colours.
const FLOOR = ramp(mix(DERIVED.woodLight, BRAND.wheatGold, 0.3), 5, { dark: 0.5, light: 0.35 });
const PLASTER = ramp(mix(DERIVED.cream, BRAND.wheatGold, 0.52), 5, { dark: 0.3, light: 0.22 });
const CAVE = ramp([110, 99, 92], 5, { dark: 0.5, light: 0.38 });
const ROCK = ramp([76, 69, 77], 5, { dark: 0.5, light: 0.32 });
// The cave wall is much darker than the floor so the two separate clearly in dim cave light.
const WALL = [[20, 19, 30], [30, 28, 40], [42, 39, 52], [64, 60, 72], [100, 94, 96]];
const IRON = ramp([84, 82, 96], 5, { dark: 0.55, light: 0.35 });
const BRASS = ramp([214, 164, 64], 5, { dark: 0.5, light: 0.4 });
const RED = ramp([196, 64, 58], 5, { dark: 0.5, light: 0.4 });
const CLOTH = ramp(mix(BRAND.riverBlue, [90, 100, 150], 0.3), 5);
const BURLAP = ramp([196, 160, 108], 5, { dark: 0.45, light: 0.3 });
const CREAM = ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.1 });
const ORANGE_GLOW = ramp([246, 172, 70], 5, { dark: 0.4, light: 0.45 });

// ------------------------------------------------------------------------------------------ terrain

function woodFloor(variant) {
  const img = new Img(16, 16);
  const r = rng(4100 + variant * 53);
  for (let plank = 0; plank < 4; plank += 1) {
    const y0 = plank * 4;
    const roll = r();
    const body = roll < 0.34 ? FLOOR[2] : roll < 0.67 ? mix(FLOOR[2], FLOOR[3], 0.45) : mix(FLOOR[2], FLOOR[1], 0.4);
    for (let dy = 0; dy < 4; dy += 1) {
      for (let x = 0; x < 16; x += 1) {
        img.set(x, y0 + dy, dy === 0 ? mix(body, FLOOR[4], 0.3) : dy === 3 ? mix(FLOOR[0], FLOOR[1], 0.45) : body);
      }
    }
    // Grain: short darker or lighter streaks along the board.
    for (let i = 0; i < 2; i += 1) {
      const gx = r.int(0, 15);
      const gy = y0 + r.int(1, 2);
      const len = r.int(3, 6);
      const streak = r() < 0.6 ? mix(body, FLOOR[1], 0.5) : mix(body, FLOOR[3], 0.5);
      for (let k = 0; k < len; k += 1) img.set(wrap(gx + k), gy, streak);
    }
    // One butt joint per plank, most of the time, with a nail either side of it.
    if (r() < 0.5) {
      const j = r.int(1, 14);
      for (let dy = 0; dy < 4; dy += 1) img.set(j, y0 + dy, dy === 3 ? FLOOR[0] : mix(FLOOR[0], FLOOR[1], 0.35));
      img.set(wrap(j + 1), y0, FLOOR[4]);
      const nail = mix(FLOOR[0], [150, 140, 130], 0.35);
      img.set(wrap(j - 3), y0 + 1, nail);
      img.set(wrap(j + 3), y0 + 1, nail);
    }
    // A knot or two.
    if ((variant + plank) % 3 === 1 && r() < 0.8) {
      const kx = r.int(2, 12);
      img.set(kx, y0 + 1, FLOOR[0]);
      img.set(kx + 1, y0 + 1, FLOOR[1]);
      img.set(kx, y0 + 2, FLOOR[1]);
      img.set(kx - 1, y0 + 1, FLOOR[1]);
    }
  }
  return img;
}

function plasterWall(variant) {
  const img = new Img(16, 16);
  const seed = 4400 + variant * 17;
  for (let y = 0; y < 11; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = hash2(x, y, seed);
      img.set(x, y, n < 0.07 ? PLASTER[1] : n > 0.94 ? PLASTER[3] : y === 0 ? mix(PLASTER[2], PLASTER[3], 0.4) : PLASTER[2]);
    }
  }
  // Soft trowel marks.
  const r = rng(seed);
  for (let i = 0; i < 3; i += 1) {
    const sx = r.int(0, 11);
    const sy = r.int(2, 8);
    for (let k = 0; k < r.int(3, 5); k += 1) img.set(wrap(sx + k), sy, mix(PLASTER[2], PLASTER[3], 0.55));
  }
  if (variant === 0) {
    // a hairline crack
    for (const [x, y] of [[10, 1], [10, 2], [11, 3], [11, 4], [12, 5], [11, 6], [12, 7]]) img.set(x, y, PLASTER[1]);
    img.set(9, 2, PLASTER[3]);
    img.set(10, 4, PLASTER[3]);
  } else {
    // a damp stain and a chip
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4], [5, 4], [4, 5]]) img.set(x, y, mix(PLASTER[2], PLASTER[1], 0.55));
    img.set(11, 5, PLASTER[1]);
    img.set(12, 5, PLASTER[3]);
    img.set(11, 6, PLASTER[0]);
  }
  img.hline(0, 10, 16, PLASTER[1]); // contact shadow above the board
  // Timber baseboard.
  const wood = PAL.bark;
  img.hline(0, 11, 16, wood[3]);
  img.fillRect(0, 12, 16, 3, wood[2]);
  img.hline(0, 14, 16, wood[1]);
  img.hline(0, 15, 16, wood[0]);
  for (let i = 0; i < 4; i += 1) img.set(r.int(0, 15), r.int(12, 13), wood[1]);
  for (let i = 0; i < 2; i += 1) img.set(r.int(0, 15), 12, wood[3]);
  if (variant === 0) {
    img.vline(11, 12, 3, wood[0]);
  } else {
    img.vline(5, 12, 3, wood[0]);
    img.set(2, 13, mix(wood[0], [150, 140, 130], 0.35));
    img.set(8, 13, mix(wood[0], [150, 140, 130], 0.35));
  }
  return img;
}

/** `count` scattered points on a 16x16 torus, no two closer than `minDist` (pixels). */
function scatter(r, count, minDist) {
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard < 400) {
    guard += 1;
    const p = { x: r.int(0, 15), y: r.int(0, 15) };
    const ok = pts.every((q) => Math.hypot(Math.min(Math.abs(p.x - q.x), 16 - Math.abs(p.x - q.x)), Math.min(Math.abs(p.y - q.y), 16 - Math.abs(p.y - q.y))) >= minDist);
    if (ok) pts.push(p);
  }
  return pts;
}

/** For each pixel, which scattered point is nearest (the tile wraps, so the cells do too). */
function cellMap(points) {
  const owner = new Int8Array(256);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      let best = 0;
      let bestD = Infinity;
      points.forEach((p, i) => {
        const dx = Math.min(Math.abs(x - p.x), 16 - Math.abs(x - p.x));
        const dy = Math.min(Math.abs(y - p.y), 16 - Math.abs(y - p.y));
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      owner[y * 16 + x] = best;
    }
  }
  return owner;
}

function caveFloor(variant) {
  const img = new Img(16, 16);
  const seed = 5200 + variant * 71;
  const r = rng(seed);
  const points = scatter(r, 6, 4.4);
  const owner = cellMap(points);
  const at = (x, y) => owner[wrap(y) * 16 + wrap(x)];
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = at(x, y);
      let c = id % 3 === 0 ? mix(CAVE[2], CAVE[3], 0.3) : id % 3 === 1 ? CAVE[2] : mix(CAVE[2], CAVE[1], 0.5);
      const edge = hash2(x, y, seed);
      const crack = (at(x + 1, y) !== id || at(x, y + 1) !== id) && edge < 0.62;
      const lit = (at(x - 1, y) !== id || at(x, y - 1) !== id) && hash2(x, y, seed + 5) < 0.4;
      if (crack) c = edge < 0.22 ? CAVE[0] : CAVE[1];
      else if (lit) c = CAVE[3];
      img.set(x, y, c);
    }
  }
  // Pebbles lit from the top left, and fine grit.
  for (let i = 0; i < 3; i += 1) {
    const px = r.int(1, 13);
    const py = r.int(1, 13);
    img.set(px, py, CAVE[4]);
    img.set(px + 1, py, CAVE[3]);
    img.set(px, py + 1, CAVE[2]);
    img.set(px + 1, py + 1, CAVE[0]);
  }
  for (let i = 0; i < 9; i += 1) img.set(r.int(0, 15), r.int(0, 15), r() < 0.55 ? CAVE[1] : CAVE[3]);
  return img;
}

function caveWall(variant) {
  const img = new Img(16, 16);
  const seed = 5600 + variant * 83;
  const r = rng(seed);
  const points = scatter(r, 5, 5.2);
  const owner = cellMap(points);
  const at = (x, y) => owner[wrap(y) * 16 + wrap(x)];
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = at(x, y);
      let c = id % 3 === 0 ? WALL[2] : id % 3 === 1 ? mix(WALL[1], WALL[2], 0.5) : WALL[1];
      const edge = hash2(x, y, seed);
      const crack = (at(x + 1, y) !== id || at(x, y + 1) !== id) && edge < 0.8;
      if (crack) c = edge < 0.4 ? WALL[0] : mix(WALL[0], WALL[1], 0.5);
      else if ((at(x - 1, y) !== id || at(x, y - 1) !== id) && hash2(x, y, seed + 9) < 0.3) c = mix(WALL[2], WALL[3], 0.5);
      img.set(x, y, c);
    }
  }
  for (let i = 0; i < 10; i += 1) img.set(r.int(0, 15), r.int(0, 15), r() < 0.6 ? WALL[0] : WALL[3]);
  // The lip: the top edge catches the light, a little deeper in places.
  for (let x = 0; x < 16; x += 1) {
    img.set(x, 0, mix(WALL[3], WALL[4], 0.5));
    if (hash2(x, variant, 31) < 0.45) img.set(x, 1, mix(WALL[2], WALL[3], 0.7));
  }
  // The foot of the tile sinks into shadow, so stacked walls read as blocks of rock.
  for (let x = 0; x < 16; x += 1) if (hash2(x, variant, 57) < 0.7) img.set(x, 15, WALL[0]);
  return img;
}

// ------------------------------------------------------------------------------------------ furniture

function barrel() {
  const img = new Img(16, 16);
  const half = (y) => (y < 5 ? 5 : y < 9 ? 6 : y < 13 ? 6 : 5);
  for (let y = 3; y < 15; y += 1) {
    const hw = half(y);
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      const stave = (x - (8 - hw)) % 3 === 2;
      img.set(x, y, stave ? PAL.bark[1] : rel < 0.3 ? PAL.plank[3] : rel < 0.68 ? PAL.plank[2] : PAL.plank[1]);
    }
  }
  img.ellipse(8, 3.6, 5.4, 2.5, PAL.plank[3]);
  img.ellipse(8, 3.6, 3.6, 1.5, PAL.plank[2]);
  img.hline(6, 3, 3, PAL.plank[4]);
  for (const y of [6, 11]) {
    const hw = half(y);
    img.hline(8 - hw, y, hw * 2, IRON[2]);
    img.hline(8 - hw, y, 3, IRON[4]);
    img.hline(8 - hw, y + 1, hw * 2, IRON[0]);
  }
  img.hline(4, 14, 8, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function crate() {
  const img = new Img(16, 16);
  // lid (top face)
  img.fillRect(1, 2, 14, 4, PAL.plank[3]);
  img.hline(1, 2, 14, PAL.plank[4]);
  img.hline(1, 4, 14, PAL.plank[2]);
  img.hline(1, 5, 14, PAL.plank[1]);
  // front: boards with a frame and a diagonal brace
  img.fillRect(1, 6, 14, 9, PAL.plank[2]);
  img.hline(1, 9, 14, PAL.bark[1]);
  img.hline(1, 12, 14, PAL.bark[1]);
  img.fillRect(1, 6, 2, 9, PAL.plank[3]);
  img.fillRect(13, 6, 2, 9, PAL.plank[1]);
  img.hline(1, 6, 14, PAL.plank[3]);
  for (let i = 0; i < 9; i += 1) {
    const x = 2 + Math.round((i * 11) / 8);
    img.set(x, 14 - i, PAL.plank[3]);
    img.set(x + 1, 14 - i, PAL.plank[1]);
  }
  img.hline(1, 14, 14, PAL.bark[0]);
  img.set(3, 7, IRON[3]);
  img.set(12, 7, IRON[3]);
  img.outline(INK_WARM);
  return img;
}

function potPlant() {
  const img = new Img(16, 20);
  // the plant
  paintBalls(
    img,
    [
      { x: 8, y: 5.5, r: 4.4, tone: 0.16 },
      { x: 4.4, y: 8.6, r: 3.6, tone: 0.02 },
      { x: 11.6, y: 8.6, r: 3.6, tone: -0.04 },
      { x: 8, y: 9.4, r: 4.2, tone: 0.04 },
    ],
    LEAF,
    77,
  );
  for (const [x, y, c] of [[7, 3, PAL.blossom[2]], [8, 3, PAL.blossom[1]], [5, 7, PAL.sun[2]], [11, 6, PAL.blossom[2]], [12, 6, PAL.blossom[1]]]) img.set(x, y, c);
  // the pot: wide rim, tapering body
  img.fillRect(3, 12, 10, 2, PAL.clay[3]);
  img.hline(3, 12, 10, PAL.clay[4]);
  img.hline(3, 13, 10, PAL.clay[2]);
  for (let y = 14; y < 19; y += 1) {
    const inset = Math.floor((y - 14) / 2) + 1;
    for (let x = 3 + inset; x < 13 - inset; x += 1) {
      img.set(x, y, x < 6 ? PAL.clay[3] : x < 10 ? PAL.clay[2] : PAL.clay[1]);
    }
  }
  img.hline(6, 18, 4, PAL.clay[0]);
  img.hline(4, 12, 2, PAL.clay[0]);
  img.hline(4, 12, 0, PAL.clay[0]);
  img.outline(INK_WARM);
  return img;
}

function stove() {
  const img = new Img(16, 24);
  // stovepipe with a collar
  img.fillRect(10, 0, 3, 9, IRON[2]);
  img.vline(10, 0, 9, IRON[3]);
  img.vline(12, 0, 9, IRON[1]);
  img.fillRect(9, 2, 5, 1, IRON[1]);
  img.fillRect(9, 7, 5, 2, IRON[3]);
  img.hline(9, 8, 5, IRON[1]);
  // body: a lit top plate, a front with a firebox door
  img.fillRect(2, 9, 12, 3, IRON[3]);
  img.hline(2, 9, 12, IRON[4]);
  img.hline(2, 11, 12, IRON[1]);
  img.fillRect(2, 12, 12, 9, IRON[2]);
  img.vline(2, 12, 9, IRON[3]);
  img.vline(13, 12, 9, IRON[1]);
  img.hline(2, 20, 12, IRON[0]);
  img.fillRect(4, 13, 8, 6, IRON[1]);
  img.hline(4, 13, 8, IRON[3]);
  img.vline(4, 13, 6, IRON[3]);
  img.fillRect(5, 14, 6, 4, ORANGE_GLOW[1]);
  img.fillRect(5, 14, 6, 2, ORANGE_GLOW[2]);
  img.fillRect(6, 15, 4, 2, ORANGE_GLOW[3]);
  img.set(7, 14, ORANGE_GLOW[4]);
  img.vline(8, 14, 4, IRON[0]);
  img.set(11, 16, BRASS[3]);
  // vents and legs
  img.hline(5, 19, 6, IRON[0]);
  for (const x of [2, 12]) {
    img.fillRect(x, 21, 2, 2, IRON[1]);
    img.set(x, 21, IRON[2]);
  }
  img.outline(INK_WARM);
  return img;
}

function chair() {
  const img = new Img(16, 20);
  // backrest: two posts, a top rail, and slats
  for (const x of [3, 11]) {
    img.fillRect(x, 1, 2, 12, PAL.bark[2]);
    img.vline(x, 1, 12, PAL.bark[3]);
  }
  img.fillRect(3, 1, 10, 3, PAL.plank[3]);
  img.hline(3, 1, 10, PAL.plank[4]);
  img.hline(3, 3, 10, PAL.plank[1]);
  for (const x of [6, 9]) {
    img.fillRect(x, 4, 1, 6, PAL.plank[2]);
    img.vline(x + 1, 4, 6, PAL.bark[1]);
  }
  img.hline(5, 9, 6, PAL.plank[1]);
  // seat: a lit top and a front edge
  img.fillRect(2, 10, 12, 4, PAL.plank[3]);
  img.hline(2, 10, 12, PAL.plank[4]);
  img.fillRect(2, 14, 12, 2, PAL.plank[2]);
  img.hline(2, 15, 12, PAL.plank[1]);
  // front legs
  for (const x of [3, 11]) {
    img.fillRect(x, 16, 2, 4, PAL.bark[2]);
    img.vline(x, 16, 4, PAL.bark[3]);
    img.set(x + 1, 19, PAL.bark[0]);
  }
  img.outline(INK_WARM);
  return img;
}

function table() {
  const img = new Img(32, 24);
  // top: lit boards, front edge
  img.fillRect(0, 3, 32, 11, PAL.plank[3]);
  img.hline(0, 3, 32, PAL.plank[4]);
  for (const y of [6, 9, 12]) img.hline(1, y, 30, PAL.plank[2]);
  img.hline(0, 13, 32, PAL.plank[1]);
  for (const x of [9, 23]) img.set(x, 4, PAL.plank[2]);
  img.fillRect(0, 14, 32, 3, PAL.plank[2]);
  img.hline(0, 14, 32, PAL.plank[3]);
  img.hline(0, 16, 32, PAL.bark[1]);
  // a cloth runner, with terracotta ends
  img.fillRect(7, 5, 18, 7, PAL.white[2]);
  img.hline(7, 5, 18, PAL.white[1]);
  img.hline(7, 11, 18, PAL.parchment[1]);
  for (const x of [7, 8, 23, 24]) img.vline(x, 5, 7, PAL.clay[2]);
  for (let x = 12; x < 22; x += 3) img.set(x, 8, PAL.clay[3]);
  // legs
  for (const x of [2, 27]) {
    img.fillRect(x, 17, 3, 7, PAL.bark[2]);
    img.vline(x, 17, 7, PAL.bark[3]);
    img.vline(x + 2, 17, 7, PAL.bark[1]);
  }
  img.outline(INK_WARM);
  return img;
}

function bed() {
  const img = new Img(32, 32);
  // headboard with two taller posts and an arched middle
  img.fillRect(1, 2, 30, 8, PAL.bark[2]);
  img.fillRect(1, 0, 4, 11, PAL.bark[2]);
  img.fillRect(27, 0, 4, 11, PAL.bark[2]);
  img.vline(1, 0, 11, PAL.bark[3]);
  img.vline(27, 0, 11, PAL.bark[3]);
  img.hline(1, 0, 4, PAL.plank[2]);
  img.hline(27, 0, 4, PAL.plank[2]);
  img.hline(5, 2, 22, PAL.bark[3]);
  for (let x = 6; x < 27; x += 4) img.vline(x, 4, 5, PAL.bark[1]);
  img.hline(5, 9, 22, PAL.bark[1]);
  // pillow
  img.fillRect(5, 9, 22, 6, PAL.white[2]);
  img.hline(5, 9, 22, PAL.white[1]);
  img.hline(6, 10, 20, PAL.white[1]);
  img.hline(5, 14, 22, PAL.parchment[1]);
  img.vline(26, 10, 5, PAL.parchment[1]);
  img.vline(15, 10, 5, PAL.parchment[1]);
  img.set(8, 11, PAL.white[1]);
  // folded sheet and quilt
  img.fillRect(3, 15, 26, 3, PAL.white[2]);
  img.hline(3, 15, 26, PAL.white[1]);
  img.hline(3, 17, 26, PAL.parchment[1]);
  const patch = [PAL.clay[2], LEAF[2], PAL.gold[2], CLOTH[2]];
  const edge = [PAL.clay[1], LEAF[1], PAL.gold[1], CLOTH[1]];
  for (let y = 18; y < 28; y += 1) {
    for (let x = 3; x < 29; x += 1) {
      const cell = (Math.floor((x - 3) / 5) + Math.floor((y - 18) / 5)) % 4;
      const seam = (x - 3) % 5 === 4 || (y - 18) % 5 === 4;
      const lit = (x - 3) % 5 === 0 || (y - 18) % 5 === 0;
      img.set(x, y, seam ? edge[cell] : lit ? mix(patch[cell], [255, 240, 176], 0.22) : patch[cell]);
    }
  }
  for (let x = 3; x < 29; x += 2) img.set(x, 21, PAL.white[1]); // stitching
  img.vline(3, 18, 10, PAL.clay[1]);
  img.vline(28, 18, 10, PAL.clay[1]);
  // footboard
  img.fillRect(1, 26, 30, 5, PAL.bark[2]);
  img.hline(1, 26, 30, PAL.bark[3]);
  img.hline(1, 30, 30, PAL.bark[0]);
  img.fillRect(1, 24, 4, 8, PAL.bark[2]);
  img.fillRect(27, 24, 4, 8, PAL.bark[2]);
  img.vline(1, 24, 8, PAL.bark[3]);
  img.vline(27, 24, 8, PAL.bark[3]);
  img.hline(1, 24, 4, PAL.plank[2]);
  img.hline(27, 24, 4, PAL.plank[2]);
  img.vline(4, 24, 8, PAL.bark[1]);
  img.vline(30, 24, 8, PAL.bark[1]);
  img.outline(INK_WARM);
  return img;
}

const BOOKS = [LEAF[2], PAL.clay[2], PAL.water[2], PAL.gold[2], PAL.berry[2], PAL.violet[2], PAL.white[2], LEAF[1], PAL.clay[3], PAL.water[1]];

function bookshelf() {
  const img = new Img(32, 40);
  // carcass
  img.fillRect(0, 0, 32, 40, PAL.bark[2]);
  img.vline(0, 0, 40, PAL.bark[3]);
  img.vline(31, 0, 40, PAL.bark[1]);
  img.fillRect(0, 0, 32, 3, PAL.plank[2]);
  img.hline(0, 0, 32, PAL.plank[4]);
  img.hline(0, 2, 32, PAL.bark[1]);
  img.fillRect(3, 3, 26, 33, PAL.bark[0]);
  const r = rng(808);
  const shelfTops = [3, 13, 24];
  const shelfBottoms = [12, 23, 34];
  shelfTops.forEach((top, row) => {
    const bottom = shelfBottoms[row];
    let x = 4;
    while (x < 27) {
      const roll = r();
      if (roll < 0.1 && row === 1 && x < 18) {
        // a small jar and a candle stub instead of books
        img.fillRect(x, bottom - 4, 4, 4, PAL.sky[1]);
        img.hline(x, bottom - 5, 4, PAL.clay[2]);
        img.fillRect(x + 1, bottom - 3, 2, 2, PAL.sun[2]);
        x += 5;
        continue;
      }
      const w = r.int(2, 3);
      const h = r.int(5, bottom - top - 2);
      const color = BOOKS[r.int(0, BOOKS.length - 1)];
      if (r() < 0.12 && x < 23) {
        // a book leaning on its neighbours
        for (let k = 0; k < h - 1; k += 1) img.fillRect(x + Math.floor(k / 3), bottom - 1 - k, w, 1, color);
        x += w + 3;
        continue;
      }
      img.fillRect(x, bottom - h, w, h, color);
      img.vline(x, bottom - h, h, mix(color, [255, 240, 176], 0.25));
      img.vline(x + w - 1, bottom - h, h, mix(color, [40, 44, 84], 0.3));
      if (r() < 0.6) img.hline(x, bottom - h + 2, w, PAL.gold[3]);
      x += w;
      if (x > 26) break;
    }
    // the shelf board
    img.fillRect(3, bottom, 26, 2, PAL.plank[2]);
    img.hline(3, bottom, 26, PAL.plank[3]);
    img.hline(3, bottom + 1, 26, PAL.bark[1]);
  });
  // plinth and feet
  img.fillRect(0, 36, 32, 4, PAL.bark[1]);
  img.hline(0, 36, 32, PAL.bark[3]);
  img.hline(0, 39, 32, PAL.bark[0]);
  img.outline(INK_WARM);
  return img;
}

function counter() {
  const img = new Img(48, 24);
  // top surface
  img.fillRect(0, 9, 48, 5, PAL.plank[3]);
  img.hline(0, 9, 48, PAL.plank[4]);
  img.hline(0, 13, 48, PAL.plank[1]);
  for (const x of [11, 27, 39]) img.set(x, 11, PAL.plank[2]);
  // front: three recessed panels
  img.fillRect(0, 14, 48, 9, PAL.plank[2]);
  img.hline(0, 14, 48, PAL.plank[3]);
  for (const x0 of [2, 17, 32]) {
    img.fillRect(x0, 16, 14, 6, PAL.plank[1]);
    img.hline(x0, 16, 14, PAL.bark[1]);
    img.vline(x0, 16, 6, PAL.bark[1]);
    img.hline(x0 + 1, 21, 13, PAL.plank[3]);
    img.vline(x0 + 13, 17, 5, PAL.plank[3]);
  }
  img.fillRect(0, 22, 48, 2, PAL.bark[1]);
  img.hline(0, 23, 48, PAL.bark[0]);
  // brass scale: base, post, beam, strings and two pans
  img.fillRect(7, 7, 10, 2, BRASS[2]);
  img.hline(7, 7, 10, BRASS[4]);
  img.fillRect(11, 2, 2, 6, BRASS[2]);
  img.vline(11, 2, 6, BRASS[3]);
  img.hline(3, 2, 18, BRASS[3]);
  img.hline(3, 3, 18, BRASS[1]);
  img.set(11, 0, BRASS[4]);
  img.set(12, 0, BRASS[2]);
  img.set(11, 1, BRASS[3]);
  img.set(12, 1, BRASS[2]);
  for (const [px, hang] of [[3, 0], [20, 0]]) {
    img.set(px + hang, 4, PAL.white[1]);
    img.set(px + hang, 5, PAL.white[1]);
    img.hline(px - 2, 6, 5, BRASS[2]);
    img.hline(px - 1, 7, 3, BRASS[1]);
    img.set(px - 2, 6, BRASS[4]);
  }
  img.set(3, 5, PAL.sun[2]); // something small in the pan
  img.set(2, 5, PAL.sun[1]);
  // cash box: iron, with a brass lock and a handle
  img.fillRect(33, 4, 11, 6, IRON[2]);
  img.hline(33, 4, 11, IRON[4]);
  img.hline(33, 5, 11, IRON[3]);
  img.vline(33, 4, 6, IRON[3]);
  img.vline(43, 4, 6, IRON[1]);
  img.hline(33, 9, 11, IRON[0]);
  img.fillRect(37, 7, 3, 2, BRASS[2]);
  img.set(37, 7, BRASS[4]);
  img.hline(36, 3, 5, IRON[1]);
  img.hline(37, 2, 3, IRON[3]);
  // a few coins beside it
  img.fillRect(28, 8, 3, 1, PAL.gold[3]);
  img.set(29, 7, PAL.gold[4]);
  img.set(28, 8, PAL.gold[2]);
  img.outline(INK_WARM);
  return img;
}

function shelfGoods() {
  const img = new Img(32, 32);
  // carcass and back panel
  img.fillRect(0, 0, 32, 32, PAL.bark[2]);
  img.vline(0, 0, 32, PAL.bark[3]);
  img.vline(31, 0, 32, PAL.bark[1]);
  img.fillRect(0, 0, 32, 2, PAL.plank[2]);
  img.hline(0, 0, 32, PAL.plank[4]);
  img.fillRect(2, 2, 28, 28, PAL.bark[0]);
  img.fillRect(2, 2, 28, 28, mix(PAL.bark[0], PAL.bark[1], 0.4));
  // shelf boards at y = 10, 20, 30
  const board = (y) => {
    img.fillRect(2, y, 28, 2, PAL.plank[2]);
    img.hline(2, y, 28, PAL.plank[3]);
    img.hline(2, y + 1, 28, PAL.bark[1]);
  };
  [10, 20].forEach(board);
  img.fillRect(0, 30, 32, 2, PAL.bark[1]);
  img.hline(0, 31, 32, PAL.bark[0]);
  // top shelf: three jars (jam, honey, pickles)
  const jar = (x, contents) => {
    img.fillRect(x, 3, 6, 7, mix(PAL.sky[1], [255, 255, 255], 0.2));
    img.fillRect(x + 1, 5, 4, 5, contents[1]);
    img.hline(x + 1, 5, 4, contents[2]);
    img.vline(x, 4, 6, PAL.white[2]);
    img.fillRect(x + 1, 2, 4, 2, PAL.clay[2]);
    img.hline(x + 1, 2, 4, PAL.clay[3]);
    img.set(x + 4, 7, contents[0]);
  };
  jar(4, PAL.berry);
  jar(13, PAL.sun);
  jar(22, [LEAF[1], LEAF[2], LEAF[3]]);
  // middle shelf: folded cloth stacks and a small jar
  const stack = (x, colors) => {
    colors.forEach((c, i) => {
      const y = 19 - (i + 1) * 3 + 3;
      img.fillRect(x, y, 9, 3, c);
      img.hline(x, y, 9, mix(c, [255, 240, 176], 0.25));
      img.hline(x, y + 2, 9, mix(c, [40, 44, 84], 0.3));
      img.vline(x + 8, y, 3, mix(c, [40, 44, 84], 0.2));
    });
  };
  stack(4, [CLOTH[2], PAL.white[2], PAL.clay[2]]);
  stack(15, [LEAF[2], PAL.gold[2], CLOTH[2]]);
  img.fillRect(26, 14, 3, 5, PAL.sky[1]);
  img.fillRect(26, 16, 3, 3, PAL.sun[2]);
  img.hline(26, 13, 3, PAL.clay[2]);
  // bottom shelf: two sacks of grain and a flour bag
  const sack = (x, y, w, h, tie) => {
    for (let yy = 0; yy < h; yy += 1) {
      const inset = yy < 2 ? 1 : 0;
      for (let xx = inset; xx < w - inset; xx += 1) {
        img.set(x + xx, y + yy, xx < 2 ? BURLAP[3] : xx > w - 3 ? BURLAP[1] : BURLAP[2]);
      }
    }
    img.hline(x + 1, y + 2, w - 2, tie);
    img.hline(x, y + h - 1, w, BURLAP[0]);
    for (let xx = 2; xx < w - 2; xx += 2) img.set(x + xx, y + 3 + (xx % 3), BURLAP[1]);
    img.set(x + Math.floor(w / 2), y - 1, BURLAP[3]);
  };
  sack(3, 22, 10, 8, PAL.clay[1]);
  sack(14, 23, 9, 7, PAL.bark[1]);
  img.fillRect(24, 24, 6, 6, PAL.white[2]);
  img.hline(24, 24, 6, PAL.white[1]);
  img.hline(24, 29, 6, PAL.parchment[1]);
  img.fillRect(25, 26, 4, 2, PAL.clay[2]);
  img.outline(INK_WARM);
  return img;
}

function rug() {
  const img = new Img(48, 32);
  const X0 = 3;
  const Y0 = 1;
  const W = 42;
  const H = 30;
  const cx = X0 + W / 2;
  const cy = Y0 + H / 2;
  for (let y = Y0; y < Y0 + H; y += 1) {
    for (let x = X0; x < X0 + W; x += 1) {
      const d = Math.min(x - X0, X0 + W - 1 - x, y - Y0, Y0 + H - 1 - y);
      let c;
      if (d === 0) c = PAL.clay[1];
      else if (d <= 2) c = (x + y) % 4 < 2 ? PAL.clay[2] : PAL.clay[3];
      else if (d === 3) c = PAL.gold[3];
      else if (d <= 5) c = (x + y) % 6 === 0 ? PAL.gold[3] : LEAF[2];
      else if (d === 6) c = PAL.gold[3];
      else {
        const m = Math.abs(x + 0.5 - cx) / 11 + Math.abs(y + 0.5 - cy) / 6.4;
        if (m < 0.34) c = (x + y) % 2 === 0 ? PAL.white[2] : PAL.gold[3];
        else if (m < 0.62) c = LEAF[2];
        else if (m < 1) c = PAL.clay[2];
        else c = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? PAL.gold[2] : mix(PAL.gold[2], PAL.gold[3], 0.5);
        if (m >= 1 && m < 1.12) c = PAL.clay[1];
      }
      img.set(x, y, c);
    }
  }
  img.outline(INK_WARM);
  // fringe: loose threads at both short ends
  for (let y = Y0 + 1; y < Y0 + H - 1; y += 1) {
    if (y % 2 === 0) continue;
    const len = 2 + (y % 4 === 1 ? 0 : 0);
    for (let k = 0; k < len; k += 1) {
      img.set(X0 - 1 - k, y, k === len - 1 ? PAL.parchment[1] : PAL.white[2]);
      img.set(X0 + W + k, y, k === len - 1 ? PAL.parchment[1] : PAL.white[2]);
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ ladders

function ladderDown() {
  const img = new Img(16, 16);
  // a broken rim of rock around a dark hole, lit on its upper edge
  img.ellipse(8, 10.8, 7.6, 5.2, CAVE[2]);
  img.ellipse(8, 10.4, 7.4, 4.9, CAVE[3]);
  img.ellipse(8, 11.2, 7.4, 4.8, CAVE[2]);
  img.ellipse(8, 11.4, 6.6, 4.2, CAVE[1]);
  img.ellipse(8, 11.5, 6.0, 3.8, ROCK[0]);
  img.ellipse(8, 11.8, 5.2, 3.2, [10, 12, 18]);
  for (const [x, y] of [[2, 9], [13, 8], [14, 12], [3, 14], [6, 15], [11, 15]]) img.set(x, y, CAVE[1]);
  for (const [x, y] of [[4, 7], [10, 6], [12, 9]]) img.set(x, y, CAVE[4]);
  // the ladder: rails climbing out of the hole, with rungs
  for (const x of [5, 9]) {
    img.fillRect(x, 2, 2, 12, PAL.plank[2]);
    img.vline(x, 2, 12, PAL.plank[4]);
    img.vline(x + 1, 2, 12, PAL.plank[1]);
    img.hline(x, 2, 2, PAL.plank[4]);
  }
  for (const y of [4, 7, 10]) {
    img.hline(7, y, 2, PAL.plank[3]);
    img.set(7, y + 1, PAL.bark[1]);
    img.set(8, y + 1, PAL.bark[1]);
  }
  for (const x of [5, 9]) img.fillRect(x, 12, 2, 2, mix(PAL.plank[1], [10, 12, 18], 0.55)); // sinking into the dark
  img.set(11, 7, ROCK[0], 0);
  for (const y of [4, 5, 6]) img.over(11, y, INK, 60); // the ladder's shadow on the rim
  img.outline(ROCK[0]);
  return img;
}

function ladderUp() {
  const img = new Img(16, 16);
  // the rock face, with a bright opening where the ladder leads to daylight
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = hash2(x, y, 6200);
      img.set(x, y, y < 11 ? (n < 0.2 ? WALL[0] : n > 0.85 ? WALL[3] : WALL[2]) : n < 0.15 ? CAVE[1] : n > 0.9 ? CAVE[3] : CAVE[2]);
    }
  }
  img.hline(0, 0, 16, mix(WALL[3], WALL[4], 0.5));
  img.hline(0, 11, 16, CAVE[3]);
  img.hline(0, 10, 16, WALL[0]);
  // the patch of daylight
  img.ellipse(8, 3.8, 5.4, 3.6, WALL[4]);
  img.ellipse(8, 4, 4.6, 3.1, PAL.sun[1]);
  img.ellipse(8, 4, 3.8, 2.5, PAL.sun[2]);
  img.ellipse(7.6, 3.4, 2.4, 1.4, PAL.white[2]);
  img.set(6, 3, PAL.white[2]);
  // ladder rails and rungs running up into the light
  for (const x of [5, 9]) {
    img.fillRect(x, 3, 2, 13, PAL.plank[2]);
    img.vline(x, 3, 13, PAL.plank[4]);
    img.vline(x + 1, 3, 13, PAL.plank[1]);
    img.hline(x, 3, 2, PAL.plank[4]);
  }
  for (const y of [5, 8, 11, 14]) {
    img.hline(7, y, 2, PAL.plank[3]);
    img.hline(7, y + 1, 2, PAL.bark[1]);
  }
  img.fillRect(4, 15, 8, 1, PAL.bark[0]); // where it meets the floor
  img.outline(INK);
  return img;
}

// ------------------------------------------------------------------------------------------ store

/** The General Store: the cottage's proportions, dressed as a shop. Door at x 32..48 of the bottom row. */
function store() {
  const roof = ramp(mix(BRAND.terracotta, DERIVED.berry, 0.2), 5, { dark: 0.55, light: 0.4 });
  const wall = ramp(mix(DERIVED.cream, BRAND.wheatGold, 0.42), 5, { dark: 0.45, light: 0.3 });
  const img = houseBody({ roof, wall, windows: false });

  // shop window on the right: a broad frame, warm glow, goods in silhouette, dark-red shutters
  const wx = 62;
  const wy = 52;
  const ww = 24;
  const wh = 15;
  const shutter = ramp([150, 52, 50], 5, { dark: 0.5, light: 0.35 });
  img.fillRect(wx - 4, wy - 1, 3, wh + 2, shutter[2]);
  img.fillRect(wx + ww + 1, wy - 1, 3, wh + 2, shutter[1]);
  for (let i = 1; i < wh + 2; i += 3) {
    img.hline(wx - 4, wy - 1 + i, 3, shutter[3]);
    img.hline(wx + ww + 1, wy - 1 + i, 3, shutter[2]);
  }
  img.fillRect(wx - 1, wy - 2, ww + 2, wh + 4, PAL.bark[0]);
  for (let y = 0; y < wh; y += 1) {
    const t = y / (wh - 1);
    const glow = t < 0.45 ? mix(ORANGE_GLOW[4], ORANGE_GLOW[3], t / 0.45) : mix(ORANGE_GLOW[3], ORANGE_GLOW[2], (t - 0.45) / 0.55);
    img.hline(wx, wy + y, ww, glow);
  }
  // goods on the sill: jars, a sack, a stack of cloth
  const dark = [168, 98, 40];
  img.fillRect(wx + 2, wy + 7, 3, 7, dark);
  img.fillRect(wx + 6, wy + 9, 3, 5, dark);
  img.fillRect(wx + 10, wy + 6, 4, 8, dark);
  img.fillRect(wx + 11, wy + 4, 2, 2, dark);
  img.fillRect(wx + 16, wy + 9, 6, 5, dark);
  img.hline(wx + 16, wy + 9, 6, [196, 120, 52]);
  img.fillRect(wx + 3, wy + 7, 1, 7, [200, 122, 50]);
  img.vline(wx + 11, wy + 6, 8, [200, 122, 50]);
  // glass bars and shine
  img.vline(wx + 12, wy, wh, PAL.bark[1]);
  img.hline(wx, wy + 5, ww, PAL.bark[1]);
  for (const [x, y] of [[2, 1], [3, 2], [15, 1], [16, 2]]) img.set(wx + x, wy + y, PAL.white[2]);
  // sill
  img.fillRect(wx - 2, wy + wh, ww + 4, 3, PAL.plank[2]);
  img.hline(wx - 2, wy + wh, ww + 4, PAL.plank[4]);
  img.hline(wx - 2, wy + wh + 2, ww + 4, PAL.bark[0]);

  // striped awning over the door: sloped top, scalloped valance
  const stripe = (x) => (Math.floor((x - 26) / 4) % 2 === 0 ? RED : CREAM);
  for (let y = 46; y < 52; y += 1) {
    const grow = Math.round(((y - 46) / 5) * 3);
    for (let x = 29 - grow; x < 51 + grow; x += 1) {
      const s = stripe(x);
      img.set(x, y, y === 46 ? s[4] : y < 49 ? s[3] : s[2]);
    }
  }
  for (let x = 26; x < 54; x += 1) {
    const s = stripe(x);
    const scallop = (x - 26) % 4 === 1 || (x - 26) % 4 === 2 ? 5 : 4;
    img.set(x, 52, s[2]);
    for (let y = 53; y < 52 + scallop; y += 1) img.set(x, y, y === 53 ? s[2] : s[1]);
    img.set(x, 52 + scallop - 1, s[0]);
  }
  // the awning's shadow on the door
  for (let x = 34; x < 46; x += 1) for (let y = 57; y < 59; y += 1) img.over(x, y, INK, 90);

  // wooden sign hung from an iron arm on the left: a burlap sack and a coin
  img.hline(5, 45, 12, IRON[1]);
  img.hline(5, 46, 12, IRON[3]);
  img.set(5, 47, IRON[2]);
  img.set(6, 46, IRON[4]);
  img.vline(7, 47, 2, IRON[3]);
  img.vline(14, 47, 2, IRON[3]);
  img.fillRect(5, 49, 12, 10, PAL.bark[1]);
  img.fillRect(6, 50, 10, 8, PAL.plank[2]);
  img.hline(6, 50, 10, PAL.plank[4]);
  img.hline(6, 57, 10, PAL.plank[1]);
  img.vline(6, 50, 8, PAL.plank[3]);
  // a sack of grain
  img.fillRect(8, 54, 4, 3, BURLAP[2]);
  img.fillRect(9, 52, 2, 2, BURLAP[2]);
  img.set(9, 52, BURLAP[4]);
  img.hline(8, 54, 4, BURLAP[3]);
  img.hline(8, 56, 4, BURLAP[1]);
  img.hline(9, 53, 2, PAL.clay[1]);
  // and a gold coin
  img.ellipse(13.5, 54.5, 1.9, 1.9, PAL.gold[2]);
  img.set(13, 53, PAL.gold[4]);
  img.set(14, 55, PAL.gold[1]);

  // crates and a barrel at the front-left corner
  const crateAt = (x, y, w, h) => {
    img.fillRect(x, y, w, h, PAL.plank[2]);
    img.hline(x, y, w, PAL.plank[4]);
    img.hline(x, y + 1, w, PAL.plank[3]);
    img.fillRect(x, y, 2, h, PAL.plank[3]);
    img.fillRect(x + w - 2, y, 2, h, PAL.plank[1]);
    img.hline(x, y + Math.floor(h / 2), w, PAL.bark[1]);
    img.hline(x, y + h - 1, w, PAL.bark[0]);
    img.set(x + 3, y + 3, PAL.bark[0]);
    img.set(x + w - 4, y + h - 4, PAL.bark[0]);
  };
  crateAt(15, 64, 13, 14);
  crateAt(16, 54, 10, 10);
  for (const [x, y] of [[18, 52], [21, 51], [23, 52]]) {
    // apples heaped on the top crate
    img.fillRect(x, y, 2, 2, RED[2]);
    img.set(x, y, RED[4]);
    img.set(x + 1, y + 1, RED[1]);
    img.set(x + 1, y - 1, LEAF[2]);
  }
  img.hline(17, 53, 8, PAL.sun[1]); // a bed of straw under them
  const half = (y) => (y < 66 ? 5 : y < 72 ? 6 : 5);
  for (let y = 62; y < 78; y += 1) {
    const hw = half(y);
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      const stave = (x - (8 - hw)) % 3 === 2;
      img.set(x + 1, y, stave ? PAL.bark[1] : rel < 0.3 ? PAL.plank[3] : rel < 0.68 ? PAL.plank[2] : PAL.plank[1]);
    }
  }
  img.ellipse(9, 62.6, 5.4, 2.4, PAL.plank[3]);
  img.ellipse(9, 62.6, 3.4, 1.4, PAL.plank[1]);
  for (const y of [66, 73]) {
    const hw = half(y);
    img.hline(9 - hw, y, hw * 2, IRON[2]);
    img.hline(9 - hw, y + 1, hw * 2, IRON[0]);
    img.hline(9 - hw, y, 3, IRON[4]);
  }
  img.hline(5, 77, 8, PAL.bark[0]);

  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildInterior(frames) {
  for (let v = 0; v < 4; v += 1) frames.set(`terrain/wood_floor_v${v}`, woodFloor(v));
  for (let v = 0; v < 2; v += 1) frames.set(`terrain/plaster_wall_v${v}`, plasterWall(v));
  for (let v = 0; v < 4; v += 1) frames.set(`terrain/cave_floor_v${v}`, caveFloor(v));
  for (let v = 0; v < 4; v += 1) frames.set(`terrain/cave_wall_v${v}`, caveWall(v));

  frames.set('object/store', store());
  frames.set('object/bed', bed());
  frames.set('object/table', table());
  frames.set('object/chair', chair());
  frames.set('object/bookshelf', bookshelf());
  frames.set('object/counter', counter());
  frames.set('object/stove', stove());
  frames.set('object/barrel', barrel());
  frames.set('object/crate', crate());
  frames.set('object/pot_plant', potPlant());
  frames.set('object/shelf_goods', shelfGoods());
  frames.set('object/rug', rug());
  frames.set('object/ladder_down', ladderDown());
  frames.set('object/ladder_up', ladderUp());
}

// Shared with the later furniture, cooking and museum modules (adding exports changes no frame).
export { BRASS, BURLAP, CLOTH, cellMap, CREAM, FLOOR, IRON, ORANGE_GLOW, PLASTER, RED, scatter };
