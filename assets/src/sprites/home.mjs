// Phase 5 homestead art: the greenhouse, glass and marble tiles, the larger furniture, the rain barrel.
//
// Frame names (the contract with src/data/terrain.ts and src/data/objects.ts):
//   terrain/{greenhouse_floor_v0-1, glass_wall_v0-1, marble_floor_v0-3}      16 x 16, seamless
//   object/{kitchen 48x24, workbench 32x24, wardrobe 32x40, armchair 16x20, lantern 16x28, vase 16x20,
//           clock 16x32, rain_barrel 16x24}
// Standing objects are outlined, lit from the top left, and rest on the bottom edge of their footprint.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2, rng } from '../rng.mjs';
import { cellMap, IRON, BRASS, ORANGE_GLOW, RED, scatter } from './interior.mjs';
import { LEAF, STONE } from './objects.mjs';
import { halo, INK_WARM, lathe, lit, shade, wrap } from './draw5.mjs';

export const COPPER = ramp([224, 122, 56], 5, { dark: 0.45, light: 0.4 });
export const CERAMIC = ramp([232, 236, 232], 5, { dark: 0.3, light: 0.12 });
export const WALNUT = ramp(mix(DERIVED.wood, DERIVED.woodDark, 0.4), 5, { dark: 0.5, light: 0.35 });
const ZINC = ramp([150, 170, 168], 5, { dark: 0.45, light: 0.3 });
export const STEEL = ramp([176, 184, 192], 5, { dark: 0.42, light: 0.3 });

// ------------------------------------------------------------------------------------------ terrain

const EARTH = ramp(mix(mix(DERIVED.parchment, BRAND.wheatGold, 0.3), BRAND.terracotta, 0.16), 5, { dark: 0.38, light: 0.3 });
const PEBBLE = ramp(mix(DERIVED.stone, DERIVED.cream, 0.3), 5, { dark: 0.45, light: 0.3 });

/** Pale packed earth with a few pebbles; soil is drawn over it, so it stays calm and light. */
function greenhouseFloor(variant) {
  const img = new Img(16, 16);
  const seed = 7100 + variant * 61;
  const r = rng(seed);
  const owner = cellMap(scatter(r, 5, 5));
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = owner[y * 16 + x];
      const n = hash2(x, y, seed + 3);
      let c = id % 3 === 0 ? mix(EARTH[2], EARTH[3], 0.4) : id % 3 === 1 ? EARTH[2] : mix(EARTH[2], EARTH[1], 0.4);
      if (n < 0.07) c = mix(c, EARTH[1], 0.7);
      else if (n > 0.94) c = EARTH[3];
      img.set(x, y, c);
    }
  }
  // Tamped streaks: short pale scuffs where feet have packed the earth.
  for (let i = 0; i < 3; i += 1) {
    const sx = r.int(0, 15);
    const sy = r.int(0, 15);
    for (let k = 0; k < r.int(3, 5); k += 1) img.set(wrap(sx + k), sy, EARTH[3]);
  }
  // Pebbles, lit from the top left, each with a hint of shadow.
  const stones = variant === 0 ? [[3, 4, 3], [11, 11, 2]] : [[12, 2, 2], [5, 10, 3]];
  for (const [px, py, size] of stones) {
    img.set(wrap(px + 1), wrap(py + 2), EARTH[1]);
    img.set(wrap(px + 2), wrap(py + 1), EARTH[1]);
    for (let dy = 0; dy < size - 1; dy += 1) {
      for (let dx = 0; dx < size; dx += 1) img.set(wrap(px + dx), wrap(py + dy), dy === 0 && dx === 0 ? PEBBLE[4] : dx === size - 1 ? PEBBLE[1] : PEBBLE[3]);
    }
    img.set(wrap(px + size - 1), wrap(py + size - 2), PEBBLE[1]);
    for (let dx = 0; dx < size; dx += 1) img.set(wrap(px + dx), wrap(py + size - 1), PEBBLE[1]);
    img.set(wrap(px), wrap(py + size - 1), PEBBLE[2]);
  }
  return img;
}

export const GLASS = ramp([150, 208, 204], 5, { dark: 0.42, light: 0.3 });
export const TIMBER = ramp(mix(mix(DERIVED.cream, BRAND.sageGreen, 0.3), [250, 252, 244], 0.25), 5, { dark: 0.42, light: 0.2 });

/** A glasshouse wall: tall panes in a pale timber frame. Mullion down the left, rail along the top, so tiles stack. */
function glassWall(variant) {
  const img = new Img(16, 16);
  for (let y = 0; y < 16; y += 1) {
    const t = y / 15;
    for (let x = 0; x < 16; x += 1) {
      // a pale top, deepening towards the foot; a faint dither keeps it looking translucent
      let c = t < 0.34 ? GLASS[3] : t < 0.7 ? GLASS[2] : GLASS[1];
      if (t >= 0.34 && t < 0.4 && (x + y) % 2 === 0) c = GLASS[3];
      if (t >= 0.7 && t < 0.78 && (x + y) % 2 === 0) c = GLASS[2];
      img.set(x, y, c);
    }
  }
  if (variant === 1) {
    // a leafy plant growing behind the glass: darker, bluer shapes that read as seen through the pane
    const leaf = (x, y, w, h) => {
      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) {
          const edge = (dx === 0 || dx === w - 1) && (dy === 0 || dy === h - 1);
          if (!edge) img.set(x + dx, y + dy, mix(GLASS[2], LEAF[1], dy < h / 2 ? 0.62 : 0.78));
        }
      }
    };
    img.vline(12, 8, 8, mix(GLASS[2], LEAF[0], 0.55));
    leaf(10, 8, 3, 2);
    leaf(13, 10, 3, 2);
    leaf(9, 12, 3, 2);
    leaf(5, 12, 4, 2);
    img.set(6, 10, mix(GLASS[2], PAL.blossom[1], 0.55));
    img.set(7, 11, mix(GLASS[2], PAL.blossom[1], 0.55));
    img.vline(6, 11, 4, mix(GLASS[2], LEAF[0], 0.5));
  }
  // glints: two slanted bands of light across each pane
  const glint = (x0, y0, len, strong) => {
    for (let i = 0; i < len; i += 1) {
      img.set(x0 + i, y0 - i, strong ? GLASS[4] : GLASS[3]);
      if (strong) img.set(x0 + i + 1, y0 - i, lit(GLASS[4], 0.45));
    }
  };
  if (variant === 0) {
    glint(3, 11, 6, true);
    glint(11, 13, 4, false);
    glint(10, 7, 3, true);
  } else {
    glint(3, 8, 4, true);
    glint(13, 6, 3, false);
  }
  img.set(variant === 0 ? 5 : 4, 4, [250, 255, 252]);
  // condensation drip
  img.vline(variant === 0 ? 14 : 8, 9, 3, GLASS[4]);
  // glazing bar down the middle of the pane, a mullion at the left, a rail along the top
  img.vline(9, 2, 14, TIMBER[2]);
  img.vline(10, 2, 14, GLASS[1]);
  img.vline(8, 2, 14, TIMBER[3]);
  img.hline(2, 2, 14, GLASS[1]);
  for (let y = 0; y < 16; y += 1) {
    img.set(0, y, TIMBER[4]);
    img.set(1, y, TIMBER[3]);
    img.set(2, y, y < 2 ? TIMBER[2] : GLASS[1]);
  }
  for (let x = 0; x < 16; x += 1) {
    img.set(x, 0, TIMBER[4]);
    img.set(x, 1, x < 2 ? TIMBER[3] : TIMBER[2]);
  }
  img.set(0, 1, TIMBER[4]);
  // a cool shadow line under the rail
  for (let x = 3; x < 16; x += 1) img.set(x, 2, x === 9 ? GLASS[0] : GLASS[1]);
  return img;
}

const MARBLE_CREAM = ramp([240, 230, 208], 5, { dark: 0.3, light: 0.18 });
const MARBLE_GREY = ramp([188, 187, 192], 5, { dark: 0.35, light: 0.25 });

/** Cream and grey marble in a soft checker. Every variant shares one checker phase so any mix of them tiles. */
function marbleFloor(variant) {
  const img = new Img(16, 16);
  const seed = 7800 + variant * 47;
  for (let sq = 0; sq < 4; sq += 1) {
    const sx = (sq % 2) * 8;
    const sy = Math.floor(sq / 2) * 8;
    const cream = sq === 0 || sq === 3;
    const c = cream ? MARBLE_CREAM : MARBLE_GREY;
    const r = rng(seed + sq * 13);
    for (let dy = 0; dy < 8; dy += 1) {
      for (let dx = 0; dx < 8; dx += 1) {
        // soft cloudy mottling: 2 x 2 patches nudged half a tone, a rare brighter speck
        const patch = hash2((sx + dx) >> 1, (sy + dy) >> 1, seed);
        let color = patch < 0.22 ? mix(c[2], c[1], 0.45) : patch > 0.8 ? mix(c[2], c[3], 0.5) : c[2];
        if (hash2(sx + dx, sy + dy, seed + 9) > 0.965) color = c[3];
        // a lit upper-left edge and a cool grout line below and to the right
        if (dy === 0 || dx === 0) color = mix(c[3], c[4], 0.45);
        if (dy === 7 || dx === 7) color = mix(c[1], c[0], 0.5);
        if (dx === 7 && dy === 7) color = c[0];
        img.set(sx + dx, sy + dy, color);
      }
    }
    // one meandering vein, soft and thin, always inside the square
    const vein = cream ? mix(c[2], MARBLE_GREY[1], 0.42) : mix(c[2], MARBLE_GREY[0], 0.32);
    const branch = cream ? mix(c[2], MARBLE_GREY[2], 0.42) : mix(c[2], MARBLE_GREY[1], 0.4);
    if ((sq + variant) % 2 === 0) {
      let x = r.int(1, 2);
      let y = r.int(2, 6);
      let dir = r() < 0.5 ? 1 : -1;
      const steps = r.int(5, 7);
      for (let k = 0; k < steps; k += 1) {
        const px = Math.min(6, Math.max(1, x));
        const py = Math.min(6, Math.max(1, y));
        img.set(sx + px, sy + py, vein);
        if (k % 3 === 1) img.set(sx + px, sy + Math.min(6, py + 1), branch);
        x += 1;
        if (r() < 0.5) y += dir;
        if (r() < 0.25) dir = -dir;
      }
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ kitchen

function kitchen() {
  const img = new Img(48, 24);
  const wood = PAL.plank;
  const dark = PAL.bark;
  // the worktop: butcher-block boards, lit along the back edge
  img.fillRect(0, 9, 48, 5, wood[3]);
  img.hline(0, 9, 48, wood[4]);
  img.hline(0, 13, 48, wood[1]);
  for (const x of [13, 26, 40]) img.vline(x, 10, 3, wood[2]);
  for (const x of [8, 31, 44]) img.set(x, 11, wood[2]);
  // the sink: a deep ceramic basin let into the top, a rim all round, water in the bottom
  img.fillRect(4, 8, 17, 6, CERAMIC[3]);
  img.hline(4, 8, 17, CERAMIC[4]);
  img.vline(4, 8, 6, CERAMIC[4]);
  img.hline(4, 13, 17, CERAMIC[1]);
  img.vline(20, 9, 5, CERAMIC[2]);
  img.fillRect(6, 9, 13, 4, PAL.water[1]);
  img.fillRect(6, 9, 13, 2, PAL.water[2]);
  img.hline(6, 9, 13, PAL.water[3]);
  img.set(8, 10, PAL.water[4]);
  img.set(9, 10, PAL.water[4]);
  img.set(15, 11, PAL.water[3]);
  img.hline(6, 12, 13, PAL.water[0]);
  // the tap: a brass gooseneck over the back of the basin
  img.vline(12, 4, 5, BRASS[2]);
  img.vline(13, 4, 5, BRASS[1]);
  img.hline(12, 3, 4, BRASS[3]);
  img.hline(12, 4, 4, BRASS[2]);
  img.set(12, 3, BRASS[4]);
  img.vline(15, 5, 2, BRASS[2]);
  img.set(15, 7, PAL.water[4]);
  img.fillRect(10, 7, 2, 2, BRASS[3]);
  img.fillRect(14, 8, 2, 1, BRASS[3]);
  img.set(10, 7, BRASS[4]);
  // a hanging rack of copper pots: a bar on two brackets, S-hooks, pots of three sizes and a ladle
  img.hline(23, 0, 24, IRON[4]);
  img.hline(23, 1, 24, IRON[2]);
  img.vline(23, 0, 3, IRON[3]);
  img.vline(46, 0, 3, IRON[1]);
  const pot = (cx, hw, top, rows, { knob = false, ear = false } = {}) => {
    img.set(cx, 2, IRON[3]);
    if (knob) {
      img.set(cx, 3, COPPER[4]);
      img.set(cx - 1, 3, COPPER[2]);
      img.set(cx, 4, COPPER[3]);
    }
    for (let i = 0; i < rows; i += 1) {
      const y = top + i;
      const w = i === rows - 1 ? hw - 1 : hw;
      for (let k = -w; k < w; k += 1) {
        const rel = (k + w + 0.5) / (w * 2);
        let t = rel < 0.22 ? 4 : rel < 0.5 ? 3 : rel < 0.78 ? 2 : 1;
        if (i === rows - 1) t = Math.max(0, t - 2);
        if (i === 0) t = Math.min(4, t + 1);
        img.set(cx + k, y, COPPER[t]);
      }
    }
    img.hline(cx - hw, top + 1, hw * 2, COPPER[1]); // a dark band under the rim
    img.set(cx - hw + 1, top + 1, COPPER[3]);
    img.set(cx - hw + 1, top + 2, COPPER[4]);
    if (ear) {
      img.set(cx - hw - 1, top + 1, COPPER[0]);
      img.set(cx + hw, top + 1, COPPER[0]);
    }
  };
  pot(27, 3, 3, 5, { ear: true });
  pot(35, 2, 4, 4, { knob: true });
  pot(43, 3, 3, 5, { ear: true });
  // a ladle between the pots
  img.vline(39, 2, 4, IRON[3]);
  img.set(39, 2, IRON[4]);
  img.fillRect(38, 6, 3, 2, IRON[2]);
  img.hline(38, 7, 3, IRON[0]);
  img.set(38, 6, IRON[4]);
  // the loaf on a board, with a bread knife beside it
  img.fillRect(28, 12, 14, 2, wood[4]);
  img.hline(28, 13, 14, wood[2]);
  const loaf = ramp([196, 118, 50], 5, { dark: 0.55, light: 0.45 });
  img.ellipse(34, 10.6, 5.4, 2.8, loaf[0]);
  img.ellipse(34, 10.2, 5, 2.4, loaf[1]);
  img.ellipse(33.4, 9.9, 4.2, 1.9, loaf[2]);
  img.ellipse(32.4, 9.2, 3, 1, loaf[3]);
  for (const x of [31, 34, 37]) {
    img.set(x, 9, PAL.sand[3]);
    img.set(x + 1, 10, PAL.sand[2]);
    img.set(x, 10, loaf[3]);
  }
  img.hline(30, 12, 9, loaf[0]);
  img.set(30, 11, loaf[1]);
  img.hline(43, 12, 4, IRON[4]);
  img.hline(43, 13, 3, IRON[2]);
  img.fillRect(42, 12, 2, 2, dark[2]);
  img.set(42, 12, dark[3]);
  // the cabinet: a gingham curtain under the sink, then a drawer and doors with brass pulls
  img.fillRect(0, 14, 48, 9, wood[2]);
  img.hline(0, 14, 48, wood[3]);
  img.fillRect(2, 16, 15, 6, dark[0]);
  for (let y = 16; y < 22; y += 1) {
    for (let x = 2; x < 17; x += 1) {
      const a = Math.floor((x - 2) / 2) % 2 === 0;
      const b = Math.floor((y - 16) / 2) % 2 === 0;
      img.set(x, y, a && b ? RED[2] : a !== b ? mix(RED[3], PAL.white[2], 0.55) : PAL.white[2]);
    }
  }
  img.hline(2, 16, 15, RED[1]);
  img.hline(2, 21, 15, PAL.white[1]);
  img.hline(1, 15, 17, IRON[3]);
  for (const x0 of [19, 33]) {
    img.fillRect(x0, 16, 13, 6, wood[1]);
    img.hline(x0, 16, 13, dark[1]);
    img.vline(x0, 16, 6, dark[1]);
    img.hline(x0 + 1, 21, 12, wood[3]);
    img.vline(x0 + 12, 17, 5, wood[3]);
  }
  img.hline(19, 18, 13, dark[1]);
  img.hline(19, 19, 13, wood[3]);
  img.fillRect(24, 16, 3, 1, BRASS[3]);
  img.fillRect(24, 20, 2, 1, BRASS[3]);
  img.set(24, 20, BRASS[4]);
  img.vline(40, 17, 4, dark[1]);
  img.fillRect(37, 18, 2, 2, BRASS[3]);
  img.fillRect(42, 18, 2, 2, BRASS[3]);
  img.set(37, 18, BRASS[4]);
  img.set(42, 18, BRASS[4]);
  img.fillRect(0, 22, 48, 2, dark[1]);
  img.hline(0, 23, 48, dark[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ workbench

function workbench() {
  const img = new Img(32, 24);
  const wood = PAL.plank;
  const dark = PAL.bark;
  // legs and a low shelf
  for (const x of [1, 27]) {
    img.fillRect(x, 16, 4, 8, dark[2]);
    img.vline(x, 16, 8, dark[3]);
    img.vline(x + 3, 16, 8, dark[1]);
    img.hline(x, 23, 4, dark[0]);
  }
  img.fillRect(5, 20, 22, 2, wood[2]);
  img.hline(5, 20, 22, wood[3]);
  img.hline(5, 21, 22, dark[0]);
  // planks stacked on the shelf, and a tin of nails
  img.fillRect(7, 18, 10, 2, wood[3]);
  img.hline(7, 18, 10, wood[4]);
  img.hline(7, 19, 10, wood[1]);
  img.fillRect(9, 16, 8, 2, wood[2]);
  img.hline(9, 16, 8, wood[3]);
  img.hline(9, 17, 8, dark[1]);
  img.fillRect(20, 17, 5, 3, IRON[2]);
  img.hline(20, 17, 5, IRON[4]);
  img.vline(24, 17, 3, IRON[1]);
  img.set(21, 18, BRASS[3]);
  // the top: thick boards, lit along the back, with a heavy front beam
  img.fillRect(0, 6, 32, 7, wood[3]);
  img.hline(0, 6, 32, wood[4]);
  img.hline(0, 12, 32, wood[1]);
  for (const x of [12, 24]) img.vline(x, 7, 5, wood[2]);
  img.hline(13, 8, 6, wood[2]);
  img.hline(2, 8, 3, wood[2]);
  img.fillRect(0, 13, 32, 3, wood[2]);
  img.hline(0, 13, 32, wood[3]);
  img.hline(0, 15, 32, dark[1]);
  img.set(3, 14, dark[0]);
  img.set(28, 14, dark[0]);
  // the vice, bolted to the left end: a plate, two cast-iron jaws with a gap, and a screw with a bar handle
  img.fillRect(1, 10, 11, 3, IRON[2]);
  img.hline(1, 10, 11, IRON[4]);
  img.hline(1, 12, 11, IRON[0]);
  img.fillRect(2, 3, 4, 8, IRON[2]);
  img.vline(2, 3, 8, IRON[4]);
  img.vline(3, 4, 7, IRON[3]);
  img.vline(5, 3, 8, IRON[1]);
  img.hline(2, 3, 4, IRON[4]);
  img.fillRect(7, 4, 4, 7, IRON[2]);
  img.vline(7, 4, 7, IRON[4]);
  img.vline(8, 5, 6, IRON[3]);
  img.vline(10, 4, 7, IRON[1]);
  img.hline(7, 4, 4, IRON[4]);
  img.vline(6, 3, 5, IRON[0]);
  img.fillRect(5, 8, 3, 2, STEEL[3]);
  img.hline(5, 8, 3, STEEL[4]);
  img.hline(11, 8, 4, STEEL[3]);
  img.hline(11, 9, 4, STEEL[1]);
  img.fillRect(14, 6, 2, 5, STEEL[3]);
  img.vline(14, 6, 5, STEEL[4]);
  img.vline(15, 6, 5, STEEL[1]);
  // a handsaw lying along the front: dark wooden grip at the left, bright toothed blade tapering to the right
  img.fillRect(14, 8, 6, 4, WALNUT[2]);
  img.hline(14, 8, 6, WALNUT[4]);
  img.hline(14, 11, 6, WALNUT[0]);
  img.vline(14, 8, 4, WALNUT[3]);
  img.fillRect(16, 9, 2, 2, wood[4]);
  for (let x = 20; x < 30; x += 1) {
    const h = x < 24 ? 3 : x < 27 ? 2 : 1;
    for (let k = 0; k < h; k += 1) img.set(x, 10 - k + (x < 24 ? 0 : 0), k === h - 1 ? STEEL[4] : STEEL[3]);
    if (x % 2 === 0) img.set(x, 11, STEEL[1]);
  }
  img.hline(20, 10, 10, STEEL[2]);
  // a hammer at the back, a dark head on a pale haft, and a few bright nails by the vice
  img.hline(17, 6, 8, WALNUT[3]);
  img.hline(17, 7, 8, WALNUT[1]);
  img.fillRect(25, 3, 4, 5, STEEL[2]);
  img.hline(25, 3, 4, STEEL[4]);
  img.vline(25, 3, 5, STEEL[3]);
  img.vline(28, 3, 5, STEEL[1]);
  img.hline(25, 7, 4, STEEL[0]);
  img.set(29, 4, STEEL[1]);
  img.set(29, 5, STEEL[3]);
  img.set(29, 6, STEEL[1]);
  for (const [x, y] of [[17, 8], [19, 7]]) {
    img.set(x, y, STEEL[4]);
    img.set(x + 1, y, STEEL[2]);
  }
  img.set(30, 9, STEEL[4]);
  img.set(31, 9, STEEL[2]);
  // wood shavings curled on the top, the shelf and the floor
  const shaving = (x, y, len) => {
    for (let k = 0; k < len; k += 1) img.set(x + k, y + (k % 2 === 0 ? 0 : -1), k % 3 === 0 ? PAL.sand[4] : PAL.sand[3]);
    img.set(x + len - 1, y - 1, PAL.sand[2]);
  };
  shaving(11, 11, 3);
  shaving(30, 12, 2);
  shaving(5, 23, 4);
  shaving(18, 23, 5);
  shaving(24, 22, 3);
  img.set(9, 22, PAL.sand[4]);
  img.set(15, 22, PAL.sand[3]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ wardrobe

function wardrobe() {
  const img = new Img(32, 40);
  // the carcass
  img.fillRect(0, 4, 32, 34, WALNUT[2]);
  img.vline(0, 4, 34, WALNUT[3]);
  img.vline(31, 4, 34, WALNUT[1]);
  // a heavy cornice with a lit top edge and a dark underside
  img.fillRect(0, 0, 32, 5, WALNUT[3]);
  img.hline(0, 0, 32, WALNUT[4]);
  img.hline(0, 1, 32, lit(WALNUT[3], 0.2));
  img.hline(0, 3, 32, WALNUT[2]);
  img.hline(0, 4, 32, WALNUT[0]);
  for (let x = 2; x < 31; x += 4) img.set(x, 2, WALNUT[4]);
  // two tall doors, each with an upper and a lower raised panel
  const door = (x0, left) => {
    img.fillRect(x0, 6, 14, 29, WALNUT[2]);
    img.hline(x0, 6, 14, WALNUT[3]);
    img.vline(x0, 6, 29, WALNUT[3]);
    img.vline(x0 + 13, 6, 29, WALNUT[1]);
    // upper panel
    img.fillRect(x0 + 2, 8, 10, 14, WALNUT[1]);
    img.hline(x0 + 2, 8, 10, WALNUT[0]);
    img.vline(x0 + 2, 8, 14, WALNUT[0]);
    img.hline(x0 + 3, 21, 9, WALNUT[3]);
    img.vline(x0 + 11, 9, 13, WALNUT[3]);
    // a carved diamond
    for (const [dx, dy] of [[6, 12], [5, 13], [6, 13], [7, 13], [6, 14]]) img.set(x0 + dx, dy, WALNUT[3]);
    img.set(x0 + 6, 13, WALNUT[4]);
    // lower panel
    img.fillRect(x0 + 2, 24, 10, 9, WALNUT[1]);
    img.hline(x0 + 2, 24, 10, WALNUT[0]);
    img.vline(x0 + 2, 24, 9, WALNUT[0]);
    img.hline(x0 + 3, 32, 9, WALNUT[3]);
    img.vline(x0 + 11, 25, 8, WALNUT[3]);
    // a brass knob near the middle gap
    const kx = left ? x0 + 11 : x0 + 2;
    img.fillRect(kx, 20, 2, 3, BRASS[3]);
    img.set(kx, 20, BRASS[4]);
    img.set(kx + 1, 22, BRASS[1]);
  };
  door(1, true);
  door(17, false);
  img.vline(15, 6, 29, WALNUT[0]);
  img.vline(16, 6, 29, WALNUT[0]);
  // plinth and feet
  img.fillRect(0, 35, 32, 3, WALNUT[3]);
  img.hline(0, 35, 32, WALNUT[4]);
  img.hline(0, 37, 32, WALNUT[0]);
  for (const x of [1, 26]) {
    img.fillRect(x, 38, 5, 2, WALNUT[2]);
    img.vline(x, 38, 2, WALNUT[3]);
    img.hline(x, 39, 5, WALNUT[0]);
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ armchair

function armchair() {
  const img = new Img(16, 20);
  const c = PAL.clay;
  // the back: a rounded cushion
  for (let y = 1; y < 12; y += 1) {
    const inset = y < 2 ? 3 : y < 3 ? 2 : y < 4 ? 1 : 0;
    for (let x = 2 + inset; x < 14 - inset; x += 1) {
      const rel = (x - 2) / 12;
      img.set(x, y, rel < 0.18 ? c[4] : rel < 0.4 ? c[3] : rel < 0.78 ? c[2] : c[1]);
    }
  }
  img.hline(5, 1, 6, c[4]);
  // tufting: buttons with pleats running away from them
  for (const [x, y] of [[5, 4], [10, 4], [7, 6], [8, 6], [5, 8], [10, 8]]) img.set(x, y, c[0]);
  for (const [x, y] of [[6, 5], [9, 5], [6, 7], [9, 7]]) img.set(x, y, c[1]);
  img.set(5, 3, c[4]);
  // the arms: two rolled cylinders, lit on top
  for (const x0 of [0, 12]) {
    img.fillRect(x0, 8, 4, 9, c[2]);
    img.vline(x0, 9, 8, x0 === 0 ? c[3] : c[2]);
    img.vline(x0 + 3, 9, 8, c[1]);
    img.hline(x0 + 1, 8, 2, c[4]);
    img.hline(x0, 9, 4, c[3]);
    img.set(x0, 8, c[0]);
    img.set(x0 + 3, 8, c[0]);
    img.hline(x0, 16, 4, c[0]);
  }
  img.hline(1, 9, 2, c[4]);
  // the seat: a plump cushion with a welted edge
  img.fillRect(3, 11, 10, 4, c[3]);
  img.hline(3, 11, 10, c[4]);
  img.fillRect(3, 15, 10, 2, c[2]);
  img.hline(3, 16, 10, c[0]);
  img.hline(3, 14, 10, c[2]);
  img.set(3, 14, c[1]);
  img.set(12, 14, c[1]);
  img.vline(8, 15, 2, c[1]);
  // a cream cushion tucked in the corner
  img.fillRect(9, 9, 3, 3, PAL.white[2]);
  img.set(9, 9, PAL.white[1]);
  img.hline(9, 11, 3, PAL.parchment[1]);
  img.set(10, 10, PAL.gold[3]);
  // short wooden legs
  for (const x of [1, 13]) {
    img.fillRect(x, 17, 2, 3, PAL.bark[2]);
    img.vline(x, 17, 3, PAL.bark[3]);
    img.set(x + 1, 19, PAL.bark[0]);
  }
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ floor lamp

function lantern() {
  const img = new Img(16, 28);
  // the weighted foot
  img.ellipse(8, 25.2, 5.4, 2.4, IRON[1]);
  img.ellipse(8, 24.8, 4.8, 2, IRON[2]);
  img.ellipse(7.4, 24.4, 3, 1.1, IRON[3]);
  img.set(6, 24, IRON[4]);
  img.hline(4, 27, 8, IRON[0]);
  img.hline(5, 26, 6, IRON[0]);
  // the stem, with a ring half-way up
  img.fillRect(7, 14, 2, 10, BRASS[2]);
  img.vline(7, 14, 10, BRASS[3]);
  img.vline(8, 14, 10, BRASS[1]);
  img.fillRect(6, 18, 4, 2, BRASS[3]);
  img.hline(6, 18, 4, BRASS[4]);
  img.hline(6, 19, 4, BRASS[1]);
  img.fillRect(6, 23, 4, 1, BRASS[1]);
  // the shade: a wide drum, glowing from within, with a brass cap and rim
  const glow = [ORANGE_GLOW[2], ORANGE_GLOW[3], ORANGE_GLOW[4], [255, 238, 176]];
  for (let y = 3; y < 13; y += 1) {
    const hw = 4 + Math.round(((y - 3) / 9) * 2);
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = Math.abs(x + 0.5 - 8) / hw;
      const t = (y - 3) / 9;
      let c = rel < 0.35 ? glow[3] : rel < 0.72 ? glow[2] : glow[1];
      if (t > 0.8) c = rel < 0.5 ? glow[2] : glow[1];
      if (rel > 0.88) c = ORANGE_GLOW[1];
      img.set(x, y, c);
    }
  }
  // pleats in the shade
  for (const x of [5, 8, 11]) {
    for (let y = 5; y < 12; y += 1) if (img.alphaAt(x, y) > 0) img.set(x, y, mix(img.colorAt(x, y), ORANGE_GLOW[0], 0.35));
  }
  img.hline(4, 3, 8, BRASS[3]);
  img.hline(5, 2, 6, BRASS[2]);
  img.hline(6, 2, 3, BRASS[4]);
  img.fillRect(7, 0, 2, 2, BRASS[2]);
  img.set(7, 0, BRASS[4]);
  img.hline(1, 13, 14, BRASS[1]);
  img.hline(2, 12, 12, BRASS[3]);
  img.hline(2, 12, 3, BRASS[4]);
  img.hline(3, 14, 10, ORANGE_GLOW[2]); // the lit underside of the shade
  img.set(8, 14, [255, 238, 176]);
  img.outline(INK_WARM);
  halo(img, 8, 9, 8, [255, 206, 110]);
  return img;
}

// ------------------------------------------------------------------------------------------ vase of flowers

function vase() {
  const img = new Img(16, 20);
  const glaze = ramp(mix(BRAND.riverBlue, [70, 96, 150], 0.35), 5, { dark: 0.5, light: 0.4 });
  // stems and leaves first, so the flowers sit on top
  const stems = [[8, 11, 4, 3], [8, 11, 8, 2], [8, 11, 12, 4], [8, 11, 6, 6], [8, 11, 10, 6]];
  for (const [sx, sy, tx, ty] of stems) {
    const n = sy - ty;
    for (let i = 0; i <= n; i += 1) img.set(Math.round(sx + ((tx - sx) * i) / n), sy - i, LEAF[1]);
  }
  for (const [x, y] of [[5, 8], [11, 8], [6, 10], [10, 10], [9, 7], [7, 6]]) {
    img.set(x, y, LEAF[2]);
    img.set(x + (x < 8 ? -1 : 1), y - 1, LEAF[3]);
  }
  const bloom = (cx, cy, colors, hearts) => {
    img.ellipse(cx, cy, 2.2, 2, colors[2]);
    img.set(cx - 1, cy - 1, colors[3]);
    img.set(cx + 1, cy + 1, colors[1]);
    img.set(cx, cy, hearts);
  };
  bloom(4, 3, ramp(DERIVED.berry, 5), PAL.sun[2]);
  bloom(8, 2, ramp(DERIVED.sun, 5), PAL.bark[2]);
  bloom(12, 4, ramp(DERIVED.blossom, 5), PAL.sun[2]);
  bloom(6, 6, ramp(DERIVED.cream, 5, { dark: 0.2, light: 0.1 }), PAL.sun[2]);
  bloom(10, 6, ramp(mix(BRAND.riverBlue, [120, 140, 230], 0.5), 5), PAL.white[2]);
  // the vase: a flared lip, a swelling body, a narrow foot
  lathe(img, 8, 10, [3, 2, 2, 3, 4, 5, 5, 5, 4, 3], glaze);
  img.hline(5, 10, 6, glaze[4]);
  img.hline(6, 9, 4, PAL.plank[1]); // the dark mouth, with the stems going in
  // a cream band with a little leaf pattern
  img.hline(3, 14, 10, PAL.white[2]);
  img.hline(3, 15, 10, PAL.parchment[1]);
  for (const x of [4, 6, 8, 10]) img.set(x, 14, LEAF[2]);
  img.set(6, 12, PAL.white[2]);
  img.set(6, 13, PAL.white[1]);
  img.hline(5, 19, 6, glaze[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ grandfather clock

function clock() {
  const img = new Img(16, 32);
  // the hood: a pedimented crown over a round dial
  img.hline(5, 0, 6, WALNUT[3]);
  img.hline(4, 1, 8, WALNUT[3]);
  img.hline(6, 0, 3, WALNUT[4]);
  img.hline(3, 2, 10, WALNUT[3]);
  img.hline(2, 3, 12, WALNUT[2]);
  img.hline(2, 3, 12, WALNUT[3]);
  img.fillRect(2, 4, 12, 10, WALNUT[2]);
  img.vline(2, 4, 10, WALNUT[3]);
  img.vline(13, 4, 10, WALNUT[1]);
  img.set(8, 0, BRASS[4]);
  img.set(8, 1, BRASS[2]);
  // the dial: a brass bezel round a cream face with ticks and two hands
  img.ellipse(8, 8.8, 5, 4.6, BRASS[2]);
  img.ellipse(7.6, 8.4, 4.4, 4, BRASS[3]);
  img.ellipse(8, 8.8, 4, 3.7, PAL.white[2]);
  img.ellipse(7.4, 8.2, 2.6, 2.2, PAL.white[3] ?? PAL.white[2]);
  for (const [x, y] of [[8, 5], [8, 12], [4, 9], [11, 9]]) img.set(x, y, WALNUT[0]);
  for (const [x, y] of [[8, 9], [8, 8], [8, 7], [9, 9], [10, 10]]) img.set(x, y, WALNUT[0]);
  img.set(7, 6, WALNUT[0]);
  img.set(8, 9, BRASS[3]);
  // the waist: a long glazed door onto the pendulum
  img.fillRect(4, 14, 8, 12, WALNUT[2]);
  img.vline(4, 14, 12, WALNUT[3]);
  img.vline(11, 14, 12, WALNUT[1]);
  img.fillRect(5, 15, 6, 10, WALNUT[0]);
  img.fillRect(5, 15, 6, 10, mix(WALNUT[0], PAL.water[0], 0.25));
  img.vline(8, 15, 6, BRASS[3]);
  img.vline(7, 15, 6, BRASS[1]);
  img.ellipse(8, 22.2, 2.6, 2.4, BRASS[2]);
  img.ellipse(7.4, 21.6, 1.6, 1.4, BRASS[3]);
  img.set(7, 21, BRASS[4]);
  img.set(9, 23, BRASS[1]);
  for (const [x, y] of [[5, 19], [6, 18], [7, 17]]) img.set(x, y, mix(PAL.sky[2], [255, 255, 255], 0.25)); // a glint on the glass
  img.set(10, 17, PAL.sky[1]);
  // the plinth
  img.fillRect(2, 26, 12, 6, WALNUT[2]);
  img.hline(2, 26, 12, WALNUT[4]);
  img.vline(2, 26, 6, WALNUT[3]);
  img.vline(13, 26, 6, WALNUT[1]);
  img.fillRect(4, 28, 8, 3, WALNUT[1]);
  img.hline(4, 28, 8, WALNUT[0]);
  img.hline(5, 30, 7, WALNUT[3]);
  img.hline(2, 31, 12, WALNUT[0]);
  img.outline(INK_WARM);
  return img;
}

// ------------------------------------------------------------------------------------------ rain barrel

function rainBarrel() {
  const img = new Img(16, 24);
  const half = (y) => (y < 11 ? 6 : y < 17 ? 7 : y < 21 ? 6 : 5);
  // the barrel body: staves lit from the left
  for (let y = 9; y < 24; y += 1) {
    const hw = half(y);
    for (let x = 8 - hw; x < 8 + hw; x += 1) {
      const rel = (x - (8 - hw)) / (hw * 2);
      const stave = (x - (8 - hw)) % 3 === 2;
      img.set(x, y, stave ? PAL.bark[1] : rel < 0.28 ? PAL.plank[3] : rel < 0.68 ? PAL.plank[2] : PAL.plank[1]);
    }
  }
  // the rim and the water right up at the brim
  img.ellipse(8, 9.6, 6.8, 3, PAL.plank[3]);
  img.ellipse(8, 9.8, 5.8, 2.4, PAL.bark[1]);
  img.ellipse(8, 9.8, 5.2, 2, PAL.water[2]);
  img.ellipse(7.2, 9.2, 3.2, 1.1, PAL.water[3]);
  img.set(5, 9, PAL.water[4]);
  img.set(6, 9, PAL.water[4]);
  img.hline(9, 11, 4, PAL.water[1]);
  img.hline(4, 7, 3, PAL.plank[4]);
  // iron hoops
  for (const y of [14, 20]) {
    const hw = half(y);
    img.hline(8 - hw, y, hw * 2, IRON[2]);
    img.hline(8 - hw, y, 3, IRON[4]);
    img.hline(8 - hw, y + 1, hw * 2, IRON[0]);
  }
  img.hline(4, 23, 8, PAL.bark[0]);
  // the downpipe: a slim zinc pipe from above, an elbow, and a spout over the water
  img.fillRect(12, 0, 2, 6, ZINC[2]);
  img.vline(12, 0, 6, ZINC[3]);
  img.vline(13, 0, 6, ZINC[1]);
  img.hline(11, 2, 4, ZINC[1]);
  img.hline(11, 3, 4, ZINC[3]);
  img.fillRect(9, 6, 5, 2, ZINC[2]);
  img.hline(9, 6, 5, ZINC[4]);
  img.hline(9, 7, 5, ZINC[0]);
  img.set(8, 7, ZINC[1]);
  img.set(8, 6, ZINC[0]);
  img.outline(INK_WARM);
  // water falling from the spout, thin enough to need no outline
  img.set(8, 8, PAL.water[4]);
  img.set(8, 9, PAL.water[3]);
  return img;
}

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildHome(frames) {
  for (let v = 0; v < 2; v += 1) frames.set(`terrain/greenhouse_floor_v${v}`, greenhouseFloor(v));
  for (let v = 0; v < 2; v += 1) frames.set(`terrain/glass_wall_v${v}`, glassWall(v));
  for (let v = 0; v < 4; v += 1) frames.set(`terrain/marble_floor_v${v}`, marbleFloor(v));
  frames.set('object/kitchen', kitchen());
  frames.set('object/workbench', workbench());
  frames.set('object/wardrobe', wardrobe());
  frames.set('object/armchair', armchair());
  frames.set('object/lantern', lantern());
  frames.set('object/vase', vase());
  frames.set('object/clock', clock());
  frames.set('object/rain_barrel', rainBarrel());
}

void BRAND;
void STONE;
void shade;
