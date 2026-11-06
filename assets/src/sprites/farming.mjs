// Farming art: tilled soil, crops by growth stage, item and tool icons, the placement cursor, small icons.
//
// Frame names (the contract with src/data/crops.ts, src/data/items.ts and src/rendering/frameNames.ts):
//   soil/{dry,wet}_m{mask}        tilled soil, 47 neighbour masks
//   crop/{id}_{stage}             16 x 16 (radish, strawberry, pumpkin) or 16 x 32 (tomato, sunflower), feet at the bottom
//   item/*, tool/*                16 x 16 icons
//   fx/cursor_ok, fx/cursor_no    16 x 16 placement cursor
//   icon/coin, icon/water_drop    small HUD icons
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { CANONICAL_MASKS, shapeDistance, TILE } from './terrain.mjs';

const INK = PAL.ink;
const INK_WARM = PAL.inkWarm;
const LEAF = ramp(mix(BRAND.forestGreen, BRAND.sageGreen, 0.3), 5, { dark: 0.55, light: 0.45 });
const SOIL = ramp(mix(DERIVED.woodDark, BRAND.terracotta, 0.3), 5, { dark: 0.5, light: 0.4 });
const WET = ramp(mix(SOIL[1], [40, 46, 66], 0.3), 5, { dark: 0.5, light: 0.4 });
const RED = ramp([214, 70, 56], 5);
const RADISH = ramp(mix(DERIVED.berry, DERIVED.blossom, 0.35), 5);
const ORANGE = ramp([228, 134, 48], 5);
const TOMATO_GREEN = ramp([128, 168, 84], 5);
const STEEL = ramp([156, 164, 172], 5, { dark: 0.45, light: 0.35 });

// ------------------------------------------------------------------------------------------ soil

function soilTile(mask, wet) {
  const c = wet ? WET : SOIL;
  const img = new Img(TILE, TILE);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const d = shapeDistance(mask, x, y, 4);
      if (d < 0) continue;
      let color;
      if (d < 1) color = c[0];
      else if (d < 2) color = c[1];
      else {
        // Furrows: a dark groove, a lit ridge above it, every four rows.
        const row = y % 4;
        color = row === 1 ? c[1] : row === 0 ? c[3] : c[2];
        const speck = hash2(x, y, wet ? 77 : 33);
        if (speck < 0.07) color = c[row === 1 ? 0 : 3];
        else if (wet && speck > 0.96) color = WET[4];
      }
      img.set(x, y, color);
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ plant drawing

/** A curved blade rising from (x, y), `len` pixels tall, leaning by `lean`. */
function blade(img, x, y, len, lean, colors = LEAF) {
  for (let t = 0; t < len; t += 1) {
    const px = x + Math.round((lean * t * t) / Math.max(1, len * len) * 4);
    img.set(px, y - t, t === len - 1 ? colors[4] : t % 2 === 0 ? colors[2] : colors[3]);
  }
}

/** A round leaf-clump centred on (cx, cy). */
function clump(img, cx, cy, r, colors = LEAF) {
  img.ellipse(cx, cy, r, r * 0.8, colors[2]);
  img.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.55, r * 0.4, colors[3]);
  img.set(Math.round(cx - r * 0.3), Math.round(cy - r * 0.4), colors[4]);
}

const sprout = (img, base) => {
  img.vline(8, base - 3, 3, LEAF[1]);
  img.set(7, base - 4, LEAF[3]);
  img.set(9, base - 4, LEAF[3]);
  img.set(6, base - 3, LEAF[2]);
  img.set(10, base - 3, LEAF[2]);
};

function radish(stage) {
  const img = new Img(16, 16);
  const base = 14;
  if (stage === 0) sprout(img, base);
  else {
    const spread = [0, 3, 5, 6][stage];
    const len = [0, 5, 7, 8][stage];
    for (const lean of [-2, -1, 0, 1, 2]) blade(img, 8 + Math.round(lean * (spread / 5)), base, len - Math.abs(lean), lean);
  }
  if (stage === 3) {
    img.ellipse(8, base - 1, 3.2, 2.6, RADISH[2]);
    img.ellipse(7.2, base - 1.8, 1.6, 1.2, RADISH[3]);
    img.set(8, base + 1, PAL.white[1]);
  }
  img.outline(INK);
  return img;
}

function strawberry(stage) {
  const img = new Img(16, 16);
  const base = 14;
  if (stage === 0) sprout(img, base);
  else {
    const r = [0, 3, 4.6, 5.4, 5.6][stage];
    clump(img, 8, base - r * 0.6, r);
    if (stage >= 2) for (const [x, y] of [[5, 9], [11, 8], [8, 6]].slice(0, stage === 2 ? 2 : 3)) img.set(x, y, PAL.white[2]);
    if (stage === 3) for (const [x, y] of [[6, 11], [10, 11]]) img.set(x, y, TOMATO_GREEN[2]);
    if (stage === 4) {
      for (const [x, y] of [[5, 11], [10, 10], [8, 12], [11, 12]]) {
        img.set(x, y, RED[2]);
        img.set(x, y + 1, RED[1]);
        img.set(x - 1, y, RED[2]);
        img.set(x, y - 1, LEAF[3]);
      }
      img.set(5, 11, RED[2]);
    }
  }
  img.outline(INK);
  return img;
}

function tomato(stage) {
  const img = new Img(16, 32);
  const base = 30;
  if (stage === 0) {
    sprout(img, base);
  } else {
    const height = [0, 8, 16, 20, 22][stage];
    // stake
    img.vline(8, base - height - 2, height + 3, PAL.bark[2]);
    img.vline(7, base - height - 2, height + 3, PAL.bark[3]);
    // leafy clusters up the vine
    for (let i = 0, y = base - 3; y > base - height; i += 1, y -= 4) {
      const side = i % 2 === 0 ? -1 : 1;
      clump(img, 8 + side * 3, y, 2.8);
    }
    clump(img, 8, base - height, 2.6);
    const fruit = (x, y, colors) => {
      img.ellipse(x, y, 2, 2, colors[2]);
      img.set(x - 1, y - 1, colors[3]);
      img.set(x, y - 2, LEAF[1]);
    };
    if (stage === 3) for (const [x, y] of [[5, base - 8], [11, base - 13], [5, base - 16]]) fruit(x, y, TOMATO_GREEN);
    if (stage === 4) for (const [x, y] of [[5, base - 8], [11, base - 13], [5, base - 16], [11, base - 5]]) fruit(x, y, RED);
  }
  img.outline(INK);
  return img;
}

function sunflower(stage) {
  const img = new Img(16, 32);
  const base = 30;
  if (stage === 0) sprout(img, base);
  else {
    const height = [0, 8, 15, 21, 22][stage];
    img.vline(8, base - height, height, LEAF[1]);
    img.vline(9, base - height, height, LEAF[0]);
    for (const [y, side] of [[base - 5, -1], [base - 9, 1], [base - 14, -1]]) {
      if (base - y < height) {
        img.hline(side < 0 ? 4 : 9, y, 4, LEAF[2]);
        img.hline(side < 0 ? 5 : 10, y - 1, 3, LEAF[3]);
      }
    }
    if (stage === 3) {
      img.ellipse(8.5, base - height - 1, 3, 3, LEAF[1]);
      img.ellipse(8, base - height - 2, 2, 2, LEAF[2]);
    }
    if (stage === 4) {
      const cy = base - height - 2;
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        img.ellipse(8 + Math.cos(a) * 4.6, cy + Math.sin(a) * 4.6, 1.8, 1.8, i % 2 === 0 ? PAL.sun[2] : PAL.sun[1]);
      }
      img.ellipse(8, cy, 3.4, 3.4, PAL.bark[1]);
      img.set(7, cy - 1, PAL.bark[3]);
      img.set(9, cy + 1, PAL.bark[0]);
    }
  }
  img.outline(INK);
  return img;
}

function pumpkin(stage) {
  const img = new Img(16, 16);
  const base = 14;
  if (stage === 0) sprout(img, base);
  else {
    // trailing vine and broad leaves
    const reach = [0, 4, 6, 7, 7][stage];
    img.hline(8 - reach, base - 1, reach * 2, LEAF[1]);
    for (const side of [-1, 1]) {
      const lx = 8 + side * (reach - 1);
      img.ellipse(lx, base - 3, Math.min(3.4, 1 + stage), 2.2, LEAF[2]);
      img.set(lx - 1, base - 4, LEAF[4]);
    }
    if (stage >= 2) clump(img, 8, base - 4, 3.4);
    if (stage === 3) img.ellipse(8, base - 1, 2.4, 2, TOMATO_GREEN[2]);
    if (stage === 4) {
      img.ellipse(8, base - 3, 6, 5, ORANGE[2]);
      img.ellipse(6, base - 4.5, 3.4, 3.2, ORANGE[3]);
      for (const x of [5, 8, 11]) img.vline(x, base - 7, 8, ORANGE[1]);
      img.set(5, base - 6, ORANGE[4]);
      img.fillRect(8, base - 9, 2, 2, LEAF[1]);
      img.set(10, base - 9, LEAF[2]);
    }
  }
  img.outline(INK);
  return img;
}

// ------------------------------------------------------------------------------------------ items

function packet(label, accent) {
  const img = new Img(16, 16);
  img.fillRect(3, 3, 10, 11, PAL.white[2]);
  img.hline(3, 3, 10, PAL.parchment[1]);
  img.fillRect(3, 3, 10, 2, accent[1]);
  img.hline(3, 5, 10, accent[0]);
  img.vline(12, 6, 8, PAL.parchment[0]);
  img.hline(3, 13, 10, PAL.parchment[0]);
  label(img);
  img.outline(INK_WARM);
  return img;
}

function seedLabel(colors) {
  return (img) => {
    img.vline(8, 10, 3, LEAF[1]);
    img.set(7, 9, LEAF[3]);
    img.set(9, 9, LEAF[3]);
    img.ellipse(8, 8, 1.5, 1.4, colors[2]);
  };
}

function produceIcon(kind) {
  const img = new Img(16, 16);
  if (kind === 'radish') {
    img.ellipse(8, 10.5, 4.2, 3.8, RADISH[2]);
    img.ellipse(7, 9.4, 2.2, 1.8, RADISH[3]);
    img.vline(8, 13, 2, PAL.white[1]);
    for (const lean of [-2, 0, 2]) blade(img, 8, 7, 5 - Math.abs(lean) / 2, lean);
  } else if (kind === 'strawberry') {
    img.ellipse(8, 9.5, 4.2, 4.6, RED[2]);
    img.ellipse(7, 8.2, 2, 2, RED[2]);
    img.fillRect(6, 13, 4, 1, RED[1]);
    for (const [x, y] of [[6, 8], [9, 9], [7, 11], [10, 12]]) img.set(x, y, PAL.sun[2]);
    clump(img, 8, 4.4, 2.6);
  } else if (kind === 'tomato') {
    img.ellipse(8, 9.8, 5, 4.4, RED[2]);
    img.ellipse(6.4, 8.2, 2.2, 1.6, RED[2]);
    img.set(5, 8, PAL.white[2]);
    img.fillRect(7, 13, 3, 1, RED[1]);
    clump(img, 8, 5, 2.4);
  } else if (kind === 'sunflower') {
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      img.ellipse(8 + Math.cos(a) * 4.8, 8 + Math.sin(a) * 4.8, 1.8, 1.8, i % 2 === 0 ? PAL.sun[2] : PAL.sun[1]);
    }
    img.ellipse(8, 8, 3.2, 3.2, PAL.bark[1]);
    img.set(7, 7, PAL.bark[3]);
  } else {
    img.ellipse(8, 9.4, 6, 5, ORANGE[2]);
    img.ellipse(6.2, 8, 3.2, 3, ORANGE[3]);
    for (const x of [5, 8, 11]) img.vline(x, 5, 9, ORANGE[1]);
    img.fillRect(8, 3, 2, 3, LEAF[1]);
  }
  img.outline(INK);
  return img;
}

function hoeIcon() {
  const img = new Img(16, 16);
  // handle running from the lower left to the upper right, blade at the top
  for (let i = 0; i < 12; i += 1) {
    img.set(2 + i, 13 - i, PAL.plank[2]);
    img.set(3 + i, 13 - i, PAL.plank[1]);
    if (i % 3 === 0) img.set(2 + i, 12 - i, PAL.plank[3]);
  }
  // blade
  img.fillRect(10, 1, 5, 4, STEEL[2]);
  img.fillRect(10, 1, 5, 1, STEEL[4]);
  img.fillRect(13, 3, 2, 3, STEEL[2]);
  img.vline(14, 2, 4, STEEL[1]);
  img.outline(INK_WARM);
  return img;
}

function canIcon() {
  const img = new Img(16, 16);
  const body = ramp(BRAND.riverBlue, 5);
  img.fillRect(3, 6, 8, 7, body[2]);
  img.fillRect(3, 6, 8, 2, body[3]);
  img.hline(3, 12, 8, body[1]);
  img.vline(10, 7, 6, body[1]);
  img.hline(3, 5, 8, STEEL[3]);
  // handle
  img.vline(11, 5, 6, STEEL[2]);
  img.hline(9, 4, 3, STEEL[2]);
  // spout
  for (let i = 0; i < 4; i += 1) img.set(2 - i, 8 - i, STEEL[2]);
  img.fillRect(-1, 3, 3, 2, STEEL[3]);
  img.set(1, 3, STEEL[4]);
  img.outline(INK);
  return img;
}

function egg() {
  const img = new Img(16, 16);
  img.ellipse(8, 9, 4.2, 5, PAL.white[2]);
  img.ellipse(6.8, 7.2, 1.8, 2.2, PAL.white[1]);
  img.set(6, 6, PAL.white[2]);
  img.hline(6, 13, 5, PAL.parchment[1]);
  img.outline(INK_WARM);
  return img;
}

function feedSack() {
  const img = new Img(16, 16);
  img.fillRect(4, 5, 8, 9, PAL.plank[2]);
  img.hline(4, 5, 8, PAL.plank[4]);
  img.fillRect(3, 7, 10, 7, PAL.plank[2]);
  img.hline(3, 13, 10, PAL.plank[0]);
  img.vline(3, 7, 7, PAL.plank[3]);
  img.vline(12, 7, 7, PAL.plank[1]);
  // tied neck and a spill of grain on top
  img.fillRect(6, 3, 4, 2, PAL.plank[1]);
  img.hline(5, 5, 6, PAL.bark[1]);
  for (const x of [5, 7, 9, 10]) img.set(x, 2, PAL.sun[2]);
  // label
  img.fillRect(6, 8, 4, 3, PAL.white[2]);
  img.set(7, 9, PAL.sun[1]);
  img.set(8, 9, PAL.sun[2]);
  img.outline(INK_WARM);
  return img;
}

function coin() {
  const img = new Img(10, 10);
  img.ellipse(5, 5, 4, 4, PAL.gold[2]);
  img.ellipse(4.4, 4.4, 2.4, 2.4, PAL.gold[3]);
  img.vline(5, 3, 4, PAL.gold[1]);
  img.set(3, 3, PAL.gold[4]);
  img.outline(INK_WARM);
  return img;
}

function waterDrop() {
  const img = new Img(9, 11);
  img.ellipse(4.5, 6.6, 3, 3, PAL.water[2]);
  for (let i = 0; i < 4; i += 1) img.hline(4 - Math.floor(i / 2), 2 + i, 1 + Math.floor(i / 2) * 2, PAL.water[3]);
  img.set(3, 6, PAL.water[4]);
  img.outline(INK);
  return img;
}

function cursor(ok) {
  const img = new Img(16, 16);
  const color = ok ? PAL.white[2] : PAL.berry[2];
  const shade = ok ? PAL.sun[2] : PAL.berry[0];
  img.fillRect(1, 1, 14, 14, ok ? PAL.white[2] : PAL.berry[2], ok ? 34 : 48);
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
    for (let i = 0; i < 4; i += 1) {
      img.set(x + dx * i, y, color);
      img.set(x, y + dy * i, color);
    }
    img.set(x + dx, y + dy, shade);
  }
  return img;
}

// ------------------------------------------------------------------------------------------ build

export const SEED_ACCENTS = {
  radish: RADISH,
  strawberry: RED,
  tomato: ramp([232, 96, 52], 5),
  sunflower: ramp(DERIVED.sun, 5),
  pumpkin: ramp([228, 134, 48], 5),
};

/** @param {Map<string, Img>} frames */
export function buildFarming(frames) {
  for (const mask of CANONICAL_MASKS) {
    frames.set(`soil/dry_m${mask}`, soilTile(mask, false));
    frames.set(`soil/wet_m${mask}`, soilTile(mask, true));
  }

  const makers = { radish, strawberry, tomato, sunflower, pumpkin };
  const stages = { radish: 4, strawberry: 5, tomato: 5, sunflower: 5, pumpkin: 5 };
  for (const [id, make] of Object.entries(makers)) {
    for (let stage = 0; stage < stages[id]; stage += 1) frames.set(`crop/${id}_${stage}`, make(stage));
    frames.set(`item/seeds_${id}`, packet(seedLabel(SEED_ACCENTS[id]), SEED_ACCENTS[id]));
    frames.set(`item/${id}`, produceIcon(id));
  }

  frames.set('item/hoe', hoeIcon());
  frames.set('item/watering_can', canIcon());
  frames.set('tool/hoe', hoeIcon());
  frames.set('tool/watering_can', canIcon());
  frames.set('fx/cursor_ok', cursor(true));
  frames.set('fx/cursor_no', cursor(false));
  frames.set('item/egg', egg());
  frames.set('item/chicken_feed', feedSack());
  frames.set('icon/coin', coin());
  frames.set('icon/water_drop', waterDrop());
}
