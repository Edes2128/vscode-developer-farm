// Phase 7 creatures: six wild animals, each a two-picture idle.
//
// Frame names (the contract with src/data/creatures.ts):
//   creature/{heron,kingfisher,moth,hare,owl,stag}_{0,1}   16 x 16, drawn facing right (the renderer mirrors it for left)
//
// Each is outlined like animal/chicken_* with a soft shadow baked into the same 16 x 16 (a flattened dark-green ellipse
// on the clear pixels under the feet, like item/festival_egg). idle_0 and idle_1 differ in more than a pixel so the pair
// reads at 1x: the heron turns its head, the kingfisher dips its head and flicks its tail, the moth opens its wings, the
// hare lays its ears back, the owl shuts its eyes, the stag lowers its head to graze.
//
// The pictures are written as ASCII (interior colours only, '.' is clear); the outline and the shadow are added after.
import { Img } from '../canvas.mjs';
import { PAL } from '../color.mjs';

const INK_WARM = PAL.inkWarm;

/** Paints an ASCII picture with `key` and returns the image (no outline yet). */
function paint(rows, key) {
  if (rows.length !== 16) throw new Error(`creature picture needs 16 rows, got ${rows.length}`);
  return Img.fromAscii(
    rows.map((row) => row.padEnd(16, '.').slice(0, 16)),
    key,
  );
}

/** Outline, then a soft shadow ellipse on whatever is still clear: centred at (cx, cy) with radii (rx, ry). */
function finish(img, cx, cy, rx, ry, alpha = 104) {
  img.outline(INK_WARM);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (img.alphaAt(x, y) > 0) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) img.set(x, y, [30, 48, 36], d < 0.5 ? alpha : Math.round(alpha * 0.58));
    }
  }
  return img;
}

// ------------------------------------------------------------------------------------------ heron

const HERON = {
  W: [238, 242, 248], // head and neck
  w: [196, 208, 224], // neck shade
  k: [44, 52, 74], // crest, wing tips
  g: [172, 190, 212], // lit back
  G: [136, 158, 188], // mid
  d: [96, 116, 150], // shade
  D: [64, 80, 112], // deepest
  y: [240, 180, 72], // bill
  Y: [206, 134, 48], // bill shade
  e: [16, 20, 30], // eye
  l: [196, 168, 92], // leg
  L: [140, 114, 62], // leg shade
};

const HERON_0 = [
  '................',
  '.......kWWeY....',
  '......kkWWWyyyY.',
  '.........wW.....',
  '........wW......',
  '........wW......',
  '........wWW.....',
  '.......wWWW.....',
  '...kgggggWWWd...',
  '..kkGGGGGGGGGd..',
  '...kdGGGGGGdd...',
  '.......dWd......',
  '.......l........',
  '.......l........',
  '......LlLL......',
  '................',
];
// idle_1: the head turned right round over the shoulder, the bill pointing back along the neck
const HERON_1 = [
  '................',
  '.......YeWWk....',
  '......YyyWWWkk..',
  '.........wW.....',
  '........wW......',
  '........wW......',
  '........wWW.....',
  '.......wWWW.....',
  '...kgggggWWWd...',
  '..kkGGGGGGGGGd..',
  '...kdGGGGGGdd...',
  '.......dWd......',
  '.......l........',
  '.......l........',
  '......LlLL......',
  '................',
];

// ------------------------------------------------------------------------------------------ kingfisher

const KING = {
  B: [30, 150, 214], // bright blue back
  b: [86, 196, 238], // lit blue
  n: [18, 98, 164], // deep blue
  O: [236, 128, 48], // orange breast
  o: [252, 176, 84], // lit orange
  r: [190, 88, 40], // orange shade
  W: [244, 244, 236], // white throat
  k: [28, 28, 40], // bill
  e: [14, 14, 22], // eye
  K: [66, 56, 60], // bill base
  t: [138, 98, 62], // perch
  T: [96, 66, 44], // perch shade
  s: [176, 132, 88], // perch lit
  F: [150, 100, 70], // feet
};

const KING_0 = [
  '................',
  '................',
  '...........nnn..',
  '..........nBbbk.',
  '.........nBbWekk',
  '.....nnnBBBbWWkK',
  '....nBBBBBBBOOO.',
  '....nBBBBBBOOoO.',
  '.....nnBBBBOOOr.',
  '......nnBBBOOrr.',
  '.....F.F.rr.....',
  '..sssssssssss...',
  '..tttttttttttT..',
  '......Tt........',
  '......Tt........',
  '......TT........',
];
// idle_1: the head dipped and the bill tipped down, the tail flicked up
const KING_1 = [
  '................',
  '................',
  '................',
  '..........nnn...',
  '.........nBBbk..',
  '....nn..nBbbWek.',
  '...nBBnnBBBbWWkk',
  '...nBBBBBBBOOOkK',
  '....nBBBBBBOOoO.',
  '.....nnBBBBOOOr.',
  '......nnBBOOrr..',
  '..sssFsFsssss...',
  '..tttttttttttT..',
  '......Tt........',
  '......Tt........',
  '......TT........',
];

// ------------------------------------------------------------------------------------------ moth

const MOTH = {
  W: [240, 250, 236], // pale wing
  w: [212, 232, 206], // wing mid
  v: [170, 206, 176], // wing shade
  V: [126, 170, 146], // wing edge
  e: [88, 70, 120], // eyespot violet
  E: [236, 214, 120], // eyespot gold
  b: [236, 226, 206], // furry body
  B: [190, 176, 150], // body shade
  k: [60, 54, 60], // eye, antenna
  a: [120, 104, 92], // antenna
};

// idle_0: wings folded up over the back, the long tail streamer trailing
const MOTH_0 = [
  '................',
  '......WW........',
  '.....WWWw.......',
  '....WWEeWw......',
  '....WWeeWwv.....',
  '....WWWWwwv..a..',
  '....WWWwwvvb.a..',
  '.....WWwwvbbbka.',
  '.....WwwvvbbbbB.',
  '......wvvVbbB...',
  '.....vvV.bBB....',
  '....vvV.........',
  '...vvV..........',
  '..vVV...........',
  '................',
  '................',
];
// idle_1: the wings spread wide, forewing swept up and back, hindwing down with its tail
const MOTH_1 = [
  '................',
  '..WW............',
  '.WWWWw..........',
  'WWWEeWw.........',
  'WWWeeWWw....a...',
  '.WWWWWWwv...a...',
  '..WWWWwwvbbka...',
  '...wwwwwvbbbB...',
  '..WWWWwwvbbbB...',
  '.WWEeWwwvvbB....',
  '.WWeeWwvvV......',
  '..WWwwvvV.......',
  '...wwvvV........',
  '..vVvV..........',
  '.vV.............',
  '................',
];

// ------------------------------------------------------------------------------------------ hare

const HARE = {
  W: [240, 240, 246], // white fur
  w: [212, 214, 226], // fur shade
  g: [172, 176, 196], // grey-blue shade
  G: [132, 138, 164], // deep shade
  k: [48, 48, 60], // ear tips, eye
  p: [226, 160, 170], // inner ear and nose
  n: [200, 120, 130], // nose
  e: [24, 22, 30],
};

const HARE_0 = [
  '...........kk...',
  '........kk.pW...',
  '........Wp.pW...',
  '........Wp.pW...',
  '........wW.WW...',
  '.........WWWW...',
  '......WWWWWWWW..',
  '.....WWWWWWeWWn.',
  '...wWWWWWWWWWWnn',
  '..wWWWWWWgWWWw..',
  '.wWWWWWWgWWWwg..',
  '.wWWWWWgWWWwGWg.',
  '..WWWWWgWWGWWWw.',
  '..wWWWggWWgWWWw.',
  '..ggWWWWWWWWWWWw',
  '................',
];
// idle_1: the ears laid back along the neck, the head a touch lower
const HARE_1 = [
  '................',
  '................',
  '................',
  '................',
  '.......kkkkkk...',
  '.......wWWWWWk..',
  '......WWWWpppW..',
  '.....WWWWWWeWWn.',
  '...wWWWWWWWWWWnn',
  '..wWWWWWWgWWWw..',
  '.wWWWWWWgWWWwg..',
  '.wWWWWWgWWWwGWg.',
  '..WWWWWgWWGWWWw.',
  '..wWWWggWWgWWWw.',
  '..ggWWWWWWWWWWWw',
  '................',
];

// ------------------------------------------------------------------------------------------ owl

const OWL = {
  B: [138, 98, 64], // brown back
  b: [168, 124, 82], // lit brown
  d: [92, 64, 44], // deep brown
  D: [62, 44, 34], // darkest, bars
  C: [238, 220, 182], // cream face and chest
  c: [208, 184, 142], // cream shade
  s: [150, 112, 76], // chest speckles
  Y: [248, 200, 56], // eye ring
  y: [232, 160, 40], // eye shade
  e: [20, 18, 24], // pupil
  k: [236, 170, 70], // beak
  f: [196, 164, 96], // feet
  L: [108, 80, 52], // closed eyelid line
};

const OWL_0 = [
  '................',
  '...BB......BB...',
  '..BbBBBBBBBdBB..',
  '..BBCCCCCCCCdB..',
  '..BCCYYCCYYCCd..',
  '..BCYeYCCYeYCd..',
  '..BCCYYCkCYYCd..',
  '..BBCCCCkCCCdd..',
  '..BbBCcCCcCBdd..',
  '.dBBCCsCCsCCBd..',
  '.dBBCsCCsCCCBd..',
  '.DdBBCCsCCCBdD..',
  '.DdBBBCCCBBBdD..',
  '..DddBBBBBBdD...',
  '...DDdBBBBdD....',
  '....ff....ff....',
];
// idle_1: the eyes shut, a dark lid line where each eye was
const OWL_1 = [
  '................',
  '...BB......BB...',
  '..BbBBBBBBBdBB..',
  '..BBCCCCCCCCdB..',
  '..BCCCCCCCCCCd..',
  '..BCLLLCCLLLCd..',
  '..BCCCCCkCCCCd..',
  '..BBCCCCkCCCdd..',
  '..BbBCcCCcCBdd..',
  '.dBBCCsCCsCCBd..',
  '.dBBCsCCsCCCBd..',
  '.DdBBCCsCCCBdD..',
  '.DdBBBCCCBBBdD..',
  '..DddBBBBBBdD...',
  '...DDdBBBBdD....',
  '....ff....ff....',
];

// ------------------------------------------------------------------------------------------ stag

const STAG = {
  W: [240, 242, 248], // white coat
  w: [212, 218, 232], // shade
  g: [168, 178, 202], // deeper shade
  G: [128, 140, 172], // underside
  A: [244, 214, 132], // antlers, lit
  a: [210, 170, 92], // antlers, shaded
  k: [44, 44, 58], // eye, nose
  h: [96, 84, 88], // hooves
  p: [226, 170, 176], // inner ear
  e: [24, 22, 32], // eye
};

const STAG_0 = [
  '.........A...A..',
  '........Aa...aA.',
  '.........a...a..',
  '..........AWA...',
  '.........wWWWW..',
  '..........WWeWk.',
  '.........wWWWW..',
  '........wWWW....',
  '...WWWWWWWWw....',
  '..WWWWWWWWWWw...',
  '..WWWWWWWWWwg...',
  '...WWWWWWWwgG...',
  '...W.g...W.g....',
  '...W.g...W.g....',
  '...h.h...h.h....',
  '................',
];
// idle_1: the head lowered to graze, the antlers swept forward over it
const STAG_1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...........A..A.',
  '..........aAAaA.',
  '...WWWWWWWwaAa..',
  '..WWWWWWWWWWWWw.',
  '..WWWWWWWWWWeWk.',
  '...WWWWWWWwWWWk.',
  '...W.g...W.gW...',
  '...W.g...W.g....',
  '...h.h...h.h....',
  '................',
];

// ------------------------------------------------------------------------------------------ build

/** @param {Map<string, Img>} frames */
export function buildExpansionCreatures(frames) {
  frames.set('creature/heron_0', finish(paint(HERON_0, HERON), 8, 14.6, 5.6, 1.5));
  frames.set('creature/heron_1', finish(paint(HERON_1, HERON), 8, 14.6, 5.6, 1.5));
  frames.set('creature/kingfisher_0', finish(paint(KING_0, KING), 8, 14.8, 5.0, 1.2));
  frames.set('creature/kingfisher_1', finish(paint(KING_1, KING), 8, 14.8, 5.0, 1.2));
  frames.set('creature/moth_0', finish(paint(MOTH_0, MOTH), 8, 14.6, 4.8, 1.3, 70));
  frames.set('creature/moth_1', finish(paint(MOTH_1, MOTH), 8, 14.6, 5.6, 1.3, 70));
  frames.set('creature/hare_0', finish(paint(HARE_0, HARE), 8, 14.4, 6.6, 1.8));
  frames.set('creature/hare_1', finish(paint(HARE_1, HARE), 8, 14.4, 6.6, 1.8));
  frames.set('creature/owl_0', finish(paint(OWL_0, OWL), 8, 14.6, 5.4, 1.5));
  frames.set('creature/owl_1', finish(paint(OWL_1, OWL), 8, 14.6, 5.4, 1.5));
  frames.set('creature/stag_0', finish(paint(STAG_0, STAG), 8, 14.6, 6.6, 1.5));
  frames.set('creature/stag_1', finish(paint(STAG_1, STAG), 8, 14.6, 6.6, 1.5));
}
