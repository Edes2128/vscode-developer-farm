// The marsh lodge: a small stilted timber house with a reed-thatch roof, standing in the shallows.
//
// Frame name (the contract with src/data/objects.ts):
//   object/lodge   96 x 80   like object/cottage_green: 6 cells across, anchor pixel (0, 64), the top row of cells is roof
//                            you can walk behind, the third cell of the bottom row is the open door
//
// Vertical layout (pixels): thatch roof 5..44, chimney 1..30, log walls 44..62, the deck's front edge 63..66, then
// 13 rows of stilts and under-floor shade to the last row (79), which is art, not outline, exactly like the cottages.
// The door cell is x 32..47 of the bottom row (y 64..79): in it there is the door's lower end (y 64..66) and the
// flight of steps from the deck down to the ground (y 67..79, stepping out to x 29..50 at the foot, like the
// cottage's stone step) and nothing else: no stilt, window, shutter, lantern or prop touches x 32..47 below y 63.
// Lit from the top left, 1px dark outline on the sides and top.
import { Img } from '../canvas.mjs';
import { DERIVED, mix, PAL, ramp } from '../color.mjs';
import { hash2 } from '../rng.mjs';
import { INK_WARM, line } from './draw5.mjs';
import { LEAF, STONE } from './objects.mjs';

const W = 96;
const H = 80;

/** Reed thatch: golden straw, weathered a little towards grey so it does not shout against the cottages. */
const REED = ramp([202, 166, 88], 5, { dark: 0.55, light: 0.22 });
const STRAW_GREY = ramp([184, 158, 98], 5, { dark: 0.55, light: 0.2 });
/** Log walls: warm timber silvered by weather. */
const LOG = ramp(mix(DERIVED.wood, DERIVED.stone, 0.2), 5, { dark: 0.5, light: 0.32 });
const DECK = PAL.plank;
const SHUTTER = ramp([84, 128, 118], 5, { dark: 0.5, light: 0.35 });
const UNDER = mix(DERIVED.woodDark, [26, 22, 30], 0.45);
const UNDER_LIGHT = mix(DERIVED.woodDark, [26, 22, 30], 0.2);
const LANTERN_GLOW = ramp([252, 196, 92], 5, { dark: 0.45, light: 0.4 });

// ------------------------------------------------------------------------------------------ roof

const ROOF_TOP = 7;
const ROOF_BOTTOM = 42;

function roofInset(y) {
  // a steep trapezoid, rounded off at the eaves
  const base = Math.round(((ROOF_BOTTOM - y) / (ROOF_BOTTOM - ROOF_TOP)) * 11);
  const round = y >= 41 ? 2 : y >= 39 ? 1 : 0;
  return base + round;
}

function thatchRoof(img) {
  for (let y = ROOF_TOP; y <= ROOF_BOTTOM + 2; y += 1) {
    const inset = roofInset(Math.min(y, ROOF_BOTTOM));
    for (let x = 1 + inset; x < W - 1 - inset; x += 1) {
      // the ragged hem: each little bundle of reed ends at its own length
      if (y > ROOF_BOTTOM - 1) {
        const hem = ROOF_BOTTOM + 1 + Math.floor(hash2(Math.floor(x / 3), 4, 9101) * 3);
        if (y > hem) continue;
      }
      // Reed is laid in overlapping bands, five rows each; every strand ends a little shorter or longer than its
      // neighbour, which scallops the lower edge of the band into the shadowed top of the next.
      const band = Math.floor((y - ROOF_TOP) / 5);
      const by = (y - ROOF_TOP) % 5;
      const edge = 4 - (hash2(Math.floor(x / 2), band, 9107) < 0.4 ? 1 : 0);
      const strand = hash2(x, band, 9108);
      let t = 2;
      if (by === 0) t = 3;
      else if (by === edge) t = 1;
      else if (by > edge) t = 0;
      else {
        if (strand < 0.26) t = 1;
        else if (strand > 0.84 && by < 3) t = 3;
        if (by === edge - 1 && t > 1) t -= 1;
      }
      const n = hash2(x, y, 9102);
      if (n < 0.08) t = Math.max(0, t - 1);
      else if (n > 0.95 && t >= 2) t = Math.min(3, t + 1);
      // lit from the top left, shaded towards the lower right
      const lean = (x - 48) / 48 + (y - 24) / 60;
      if (lean > 0.5) t = Math.max(0, t - 1);
      else if (lean < -0.6 && t >= 2) t = Math.min(4, t + 1);
      const patch = hash2(Math.floor(x / 7), Math.floor(y / 5), 9103) < 0.18 ? STRAW_GREY : REED;
      img.set(x, y, patch[t]);
    }
  }
  // the hem casts a dark line on its own lowest strands
  for (let x = 1; x < W - 1; x += 1) {
    for (let y = ROOF_BOTTOM + 3; y >= ROOF_BOTTOM - 1; y -= 1) {
      if (img.alphaAt(x, y) > 0) {
        img.set(x, y, REED[0]);
        if (img.alphaAt(x, y - 1) > 0) img.set(x, y - 1, REED[1]);
        break;
      }
    }
  }
  // moss gathering in the damp lower corners of the thatch, in soft blotches
  for (let y = 26; y <= 41; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      if (img.alphaAt(x, y) === 0) continue;
      const cell = hash2(Math.floor(x / 5), Math.floor(y / 4), 9104);
      const near = Math.abs(x - 48) > 26 || y > 36;
      if (cell < 0.2 && near) {
        const n = hash2(x, y, 9105);
        if (n < 0.75) img.set(x, y, n < 0.3 ? LEAF[1] : n < 0.62 ? LEAF[2] : LEAF[3]);
      }
    }
  }
  // the ridge: a rolled cap bound with crossed ties
  const ridge0 = 12;
  const ridge1 = W - 12;
  for (let x = ridge0; x < ridge1; x += 1) {
    img.set(x, 5, REED[4]);
    img.set(x, 6, REED[3]);
    img.set(x, 7, REED[2]);
    img.set(x, 8, REED[1]);
    if (x % 8 === 4) {
      img.set(x, 6, PAL.bark[1]);
      img.set(x, 7, PAL.bark[0]);
      img.set(x + 1, 7, PAL.bark[1]);
    }
  }
  // crossed gable sticks at either end of the ridge
  for (const cx of [ridge0, ridge1 - 1]) {
    line(img, cx, 5, cx - 3, 1, PAL.bark[2]);
    line(img, cx, 5, cx + 3, 1, PAL.bark[1]);
    img.set(cx, 4, PAL.bark[3]);
  }
}

// ------------------------------------------------------------------------------------------ walls

const WALL_TOP = 44;
const WALL_BOTTOM = 62;
const DECK_TOP = 63;

function logWalls(img) {
  // courses of round logs, each a few pixels tall: lit above, shaded below
  for (let course = 0; course < 4; course += 1) {
    const y0 = WALL_TOP + course * 5;
    const overhang = course % 2 === 0 ? 1 : 3;
    const x0 = overhang;
    const x1 = W - 1 - overhang;
    for (let y = y0; y < y0 + 5 && y <= WALL_BOTTOM; y += 1) {
      const ry = y - y0;
      for (let x = x0; x <= x1; x += 1) {
        let t = ry === 0 ? 3 : ry === 1 ? 3 : ry === 2 ? 2 : ry === 3 ? 1 : 0;
        const grain = hash2(Math.floor(x / 3) + course * 7, ry, 9201);
        if (grain < 0.12 && ry < 4) t = Math.max(0, t - 1);
        else if (grain > 0.92 && ry < 3) t = Math.min(4, t + 1);
        // a rim of light on the topmost row of the log, shade at the right-hand end
        if (ry === 0 && x < x0 + 40) t = 4;
        if (x > x1 - 4) t = Math.max(0, t - 1);
        img.set(x, y, LOG[t]);
      }
      // the rounded cut end of the log at each corner: a pale ring
      if (ry >= 1 && ry <= 3) {
        img.set(x0, y, LOG[4]);
        img.set(x0 + 1, y, ry === 2 ? LOG[3] : LOG[2]);
        img.set(x1, y, LOG[1]);
        img.set(x1 - 1, y, LOG[1]);
      }
    }
  }
  // the thatch's shadow across the top of the wall
  for (let y = WALL_TOP; y <= WALL_TOP + 2; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      if (img.alphaAt(x, y) === 0) continue;
      const c = img.colorAt(x, y);
      img.set(x, y, mix(c, [40, 30, 34], y === WALL_TOP ? 0.62 : y === WALL_TOP + 1 ? 0.42 : 0.2));
    }
  }
}

function windowAt(img, x, y) {
  // frame, sky glass with a glint, a mullion, shutters left and right, a sill
  img.fillRect(x - 2, y - 2, 14, 13, PAL.bark[0]);
  img.fillRect(x, y, 10, 9, PAL.sky[1]);
  img.fillRect(x, y, 10, 3, PAL.sky[2]);
  img.set(x + 1, y + 1, PAL.white[2]);
  img.set(x + 2, y + 2, PAL.white[2]);
  img.vline(x + 5, y, 9, PAL.bark[1]);
  img.hline(x, y + 4, 10, PAL.bark[1]);
  img.fillRect(x - 5, y - 1, 3, 11, SHUTTER[2]);
  img.fillRect(x + 12, y - 1, 3, 11, SHUTTER[1]);
  for (let i = 1; i < 11; i += 3) {
    img.hline(x - 5, y - 1 + i, 3, SHUTTER[3]);
    img.hline(x + 12, y - 1 + i, 3, SHUTTER[2]);
  }
  // the sill, with a pot of herbs
  img.fillRect(x - 3, y + 9, 16, 2, DECK[2]);
  img.hline(x - 3, y + 9, 16, DECK[4]);
  img.fillRect(x + 1, y + 7, 3, 2, PAL.clay[2]);
  img.set(x + 1, y + 6, LEAF[3]);
  img.set(x + 2, y + 5, LEAF[2]);
  img.set(x + 3, y + 6, LEAF[3]);
  img.set(x + 7, y + 6, LEAF[2]);
  img.set(x + 8, y + 7, LEAF[3]);
}

function door(img) {
  // lintel, frame and leaf of vertical boards, with a latch; the leaf runs down to the deck at y 66
  img.fillRect(32, 44, 16, 3, PAL.bark[1]);
  img.hline(32, 44, 16, PAL.bark[3]);
  img.fillRect(32, 47, 16, 20, PAL.bark[0]);
  img.fillRect(34, 47, 12, 20, DECK[2]);
  for (let x = 34; x < 46; x += 3) img.vline(x + 2, 47, 20, PAL.bark[1]);
  img.hline(34, 47, 12, DECK[4]);
  img.vline(34, 48, 19, DECK[3]);
  img.vline(37, 48, 19, DECK[3]);
  // iron strap hinges and a wooden latch
  for (const y of [51, 60]) {
    img.hline(34, y, 5, PAL.bark[0]);
    img.set(38, y, STONE[3]);
  }
  img.fillRect(43, 57, 2, 2, PAL.sun[1]);
  img.set(43, 57, PAL.sun[2]);
  // the door's shadow on the frame's left jamb
  img.vline(33, 47, 20, PAL.bark[0]);
}

function lantern(img, x, y) {
  // an iron bracket, a little cage and a warm flame
  img.hline(x - 3, y - 4, 4, PAL.bark[0]);
  img.vline(x, y - 3, 2, PAL.bark[0]);
  img.fillRect(x - 1, y - 1, 3, 5, PAL.bark[0]);
  img.fillRect(x, y, 1, 3, LANTERN_GLOW[3]);
  img.set(x, y + 1, LANTERN_GLOW[4]);
  img.set(x - 1, y + 3, PAL.bark[1]);
  // a soft glow on the wall round it
  for (const [dx, dy, a] of [[-2, 1, 46], [2, 1, 46], [-2, 2, 30], [2, 2, 30], [0, 5, 40], [0, -1, 40]]) {
    img.over(x + dx, y + dy, LANTERN_GLOW[3], a);
  }
}

function barrel(img, x, y) {
  // a rain barrel on the deck: staves, two iron hoops, a lid
  const w = 10;
  const h = 11;
  for (let yy = y; yy < y + h; yy += 1) {
    const bulge = yy === y || yy === y + h - 1 ? 1 : 0;
    for (let xx = x + bulge; xx < x + w - bulge; xx += 1) {
      const rel = (xx - x) / w;
      img.set(xx, yy, rel < 0.25 ? DECK[3] : rel < 0.6 ? DECK[2] : rel < 0.85 ? DECK[1] : DECK[0]);
    }
  }
  for (let xx = x + 3; xx < x + w - 1; xx += 3) img.vline(xx, y + 1, h - 2, DECK[0]);
  for (const hy of [y + 2, y + h - 3]) {
    img.hline(x, hy, w, STONE[1]);
    img.hline(x, hy, 4, STONE[3]);
  }
  img.hline(x + 1, y, w - 2, DECK[4]);
  img.hline(x + 2, y + 1, 3, PAL.water[1]);
  img.hline(x + 5, y + 1, 3, PAL.water[2]);
}

// ------------------------------------------------------------------------------------------ deck and stilts

function deckAndStilts(img) {
  // the deck's front edge: planks standing on end, a bright top, a dark beam below
  for (let x = 3; x < W - 3; x += 1) {
    if (x >= 32 && x <= 47) continue; // the door and the steps take over here
    img.set(x, DECK_TOP, DECK[4]);
    const joint = x % 8 === 0;
    img.set(x, DECK_TOP + 1, joint ? DECK[0] : DECK[3]);
    img.set(x, DECK_TOP + 2, joint ? DECK[0] : DECK[2]);
    img.set(x, DECK_TOP + 3, PAL.bark[1]);
  }
  // under the floor: dark shade with crossed braces between the stilts
  const posts = [7, 22, 53, 70, 86];
  for (let y = DECK_TOP + 4; y < H; y += 1) {
    for (let x = 5; x < W - 5; x += 1) img.set(x, y, UNDER);
  }
  // a lighter slat pattern: faint horizontal rails and diagonal braces so the shade has structure
  for (let k = 0; k < posts.length - 1; k += 1) {
    const a = posts[k] + 5;
    const b = posts[k + 1];
    if (a > 28 && b < 52) continue; // the steps' bay: nothing but the steps
    if (b - a < 4) continue;
    line(img, a, DECK_TOP + 5, b - 1, H - 3, UNDER_LIGHT);
    line(img, b - 1, DECK_TOP + 5, a, H - 3, UNDER_LIGHT);
  }
  img.hline(5, DECK_TOP + 5, 24, PAL.bark[1]);
  img.hline(51, DECK_TOP + 5, 40, PAL.bark[1]);
  // (the rail under the deck stops short of the steps' bay)
  // the stilts themselves: round posts, lit on the left, down to the last row, each on a stone footing
  for (const px of posts) {
    for (let y = DECK_TOP + 4; y < H; y += 1) {
      img.set(px, y, PAL.bark[3]);
      img.set(px + 1, y, PAL.bark[2]);
      img.set(px + 2, y, PAL.bark[2]);
      img.set(px + 3, y, PAL.bark[1]);
      img.set(px + 4, y, PAL.bark[0]);
    }
    // damp stain and a green fringe where the post meets the water line
    for (let y = H - 5; y < H; y += 1) {
      img.set(px + 2, y, y < H - 2 ? PAL.bark[1] : LEAF[1]);
    }
    img.hline(px - 1, H - 3, 7, STONE[2]);
    img.hline(px - 1, H - 3, 3, STONE[3]);
    img.hline(px - 1, H - 2, 7, STONE[1]);
    img.hline(px - 1, H - 1, 7, STONE[2]);
    img.set(px, H - 1, LEAF[2]);
    img.set(px + 3, H - 1, LEAF[1]);
  }
}

function steps(img) {
  // a flight of four plank steps from the deck's level down to the ground, widening towards the foot
  const treads = [
    { y: 67, x0: 31, x1: 48 },
    { y: 70, x0: 30, x1: 49 },
    { y: 73, x0: 29, x1: 50 },
    { y: 76, x0: 29, x1: 50 },
  ];
  // the stringers (side boards)
  for (let y = 67; y < H; y += 1) {
    const x0 = y < 70 ? 31 : y < 73 ? 30 : 29;
    const x1 = y < 70 ? 48 : y < 73 ? 49 : 50;
    img.set(x0, y, PAL.bark[1]);
    img.set(x1, y, PAL.bark[0]);
  }
  for (const { y, x0, x1 } of treads) {
    const last = y === 76;
    img.hline(x0 + 1, y, x1 - x0 - 1, DECK[4]);
    img.hline(x0 + 1, y + 1, x1 - x0 - 1, DECK[3]);
    img.hline(x0 + 1, y + 2, x1 - x0 - 1, last ? DECK[2] : DECK[1]);
    if (last) img.hline(x0 + 1, y + 3, x1 - x0 - 1, DECK[1]);
    // the tread's nails and the shadow under it
    img.set(x0 + 3, y + 1, PAL.bark[0]);
    img.set(x1 - 3, y + 1, PAL.bark[0]);
    img.hline(x0 + 1, y + 2, x1 - x0 - 1, last ? DECK[2] : mix(DECK[1], UNDER, 0.35));
  }
  // the bottom tread rests on a flat stone slab, like the cottage's step
  img.hline(28, H - 1, 24, STONE[1]);
  img.hline(28, H - 2, 24, STONE[2]);
  img.hline(28, H - 2, 6, STONE[3]);
}

// ------------------------------------------------------------------------------------------ chimney

function chimney(img) {
  const cx = 66;
  img.fillRect(cx, 2, 12, 28, STONE[2]);
  img.vline(cx, 2, 28, STONE[3]);
  img.vline(cx + 11, 2, 28, STONE[1]);
  for (let y = 6; y < 30; y += 4) img.hline(cx, y, 12, STONE[1]);
  for (let y = 4; y < 30; y += 4) img.vline(cx + 4 + ((y / 4) % 2) * 3, y, 3, STONE[1]);
  img.fillRect(cx - 1, 1, 14, 3, STONE[3]);
  img.hline(cx - 1, 3, 14, STONE[1]);
  img.hline(cx - 1, 1, 14, STONE[4]);
  // soot at the mouth and a darker foot where it meets the thatch
  img.hline(cx + 1, 1, 10, STONE[0]);
  for (let x = cx; x < cx + 12; x += 1) img.set(x, 29, STONE[0]);
}

// ------------------------------------------------------------------------------------------ assemble

function lodge() {
  const img = new Img(W, H);
  logWalls(img);
  door(img);
  windowAt(img, 11, 49);
  windowAt(img, 63, 49);
  lantern(img, 53, 53);
  barrel(img, 82, 52);
  deckAndStilts(img);
  steps(img);
  thatchRoof(img);
  chimney(img);
  img.outline(INK_WARM);
  return img;
}

/** @param {Map<string, Img>} frames */
export function buildExpansionLodge(frames) {
  frames.set('object/lodge', lodge());
}
