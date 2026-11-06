// People: a 16x24 sprite with four facing directions, an idle pose and a four-frame walk cycle, drawn from a style
// (colours, hat or hair, beard). The farmer and every villager come from the same drawing, so they walk alike.
// Feet touch the bottom edge; the renderer anchors the sprite at bottom centre.
//
// Frame names: char/<id>/{down|up|left|right}_{idle|walk}_{frame}
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';

// ---------------------------------------------------------------------------------- styles

const hairOf = (hex) => ramp(hex, 3, { dark: 0.35, light: 0.3 });

/** The teal of the merchant's coat; his cart's awning (market.mjs) is the same colour. */
export const MERCHANT_TEAL = ramp([46, 134, 134], 5, { dark: 0.5, light: 0.4 });

export const STYLES = {
  player: {
    hat: 'straw',
    hair: PAL.hair,
    skin: PAL.skin,
    shirt: PAL.forest,
    bib: PAL.water,
    pants: PAL.water,
    boots: PAL.bark,
    band: PAL.clay,
  },
  willa: {
    hat: 'none',
    hair: hairOf([142, 78, 52]),
    skin: ramp([240, 196, 160], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 }),
    bib: PAL.forest,
    pants: ramp(mix(DERIVED.wood, DERIVED.woodDark, 0.3), 5),
    boots: PAL.bark,
    bun: true,
  },
  tobias: {
    hat: 'cap',
    hair: hairOf([214, 212, 206]),
    skin: ramp([226, 176, 140], 3, { dark: 0.3, light: 0.2 }),
    shirt: PAL.clay,
    bib: ramp(DERIVED.wood, 5),
    pants: ramp(mix(DERIVED.stone, DERIVED.wood, 0.3), 5),
    boots: ramp(DERIVED.woodDark, 5),
    cap: ramp(mix(BRAND.riverBlue, [70, 80, 100], 0.5), 5),
    beard: hairOf([226, 224, 218]),
  },
  // The shopkeeper: thinning brown hair, a brown moustache, a cream shirt under a dark-red apron.
  hollis: {
    hat: 'thin',
    hair: hairOf([116, 78, 54]),
    skin: ramp([232, 184, 148], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp(DERIVED.cream, 5, { dark: 0.3, light: 0.2 }),
    bib: ramp([150, 48, 52], 5, { dark: 0.5, light: 0.35 }),
    pants: ramp([200, 164, 114], 5, { dark: 0.45, light: 0.3 }),
    boots: ramp(DERIVED.woodDark, 5),
    moustache: hairOf([96, 62, 42]),
    apron: true,
    button: ramp([150, 48, 52], 5, { dark: 0.5, light: 0.35 })[2],
  },
  // The angler: green bucket hat, long auburn braid, ochre raincoat, dark-blue trousers, wellington boots.
  june: {
    hat: 'bucket',
    hair: hairOf([170, 76, 42]),
    skin: ramp([240, 196, 158], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp([216, 162, 50], 5, { dark: 0.5, light: 0.35 }),
    bib: ramp([216, 162, 50], 5, { dark: 0.5, light: 0.35 }),
    pants: ramp([50, 64, 112], 5, { dark: 0.5, light: 0.3 }),
    boots: ramp([58, 104, 70], 5, { dark: 0.55, light: 0.4 }),
    hatColor: ramp([84, 128, 78], 5, { dark: 0.5, light: 0.4 }),
    band: ramp([186, 60, 56], 5),
    braid: true,
    coat: true,
    tallBoots: true,
    button: PAL.bark[1],
  },
  // The carpenter: a flat tweed cap, a thick brown beard, a faded blue work shirt with the sleeves rolled up,
  // a leather apron and tool belt, sawdust-brown trousers and heavy boots. Broad and sturdy.
  bram: {
    hat: 'flat',
    hair: hairOf([96, 62, 40]),
    skin: ramp([224, 168, 126], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp([118, 146, 170], 5, { dark: 0.45, light: 0.3 }),
    bib: ramp([142, 92, 52], 5, { dark: 0.5, light: 0.35 }),
    pants: ramp([190, 152, 102], 5, { dark: 0.45, light: 0.3 }),
    boots: ramp([66, 46, 34], 5, { dark: 0.5, light: 0.4 }),
    cap: ramp([146, 114, 76], 5, { dark: 0.5, light: 0.38 }),
    beard: hairOf([90, 58, 36]),
    band: ramp([100, 64, 38], 5, { dark: 0.5, light: 0.35 }),
    button: ramp([214, 164, 64], 5)[3],
    apron: true,
    belt: true,
    broad: true,
    fullBeard: true,
    rolledSleeves: true,
    tallBoots: true,
  },
  // The museum curator: grey hair in a high bun, round pale-framed spectacles, a long plum cardigan over a cream
  // blouse, a dark skirt and neat shoes. Slim and upright.
  ines: {
    hat: 'bun',
    hair: hairOf([192, 192, 202]),
    skin: ramp([244, 212, 182], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp([128, 64, 104], 5, { dark: 0.5, light: 0.35 }),
    bib: ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 }),
    pants: ramp([62, 56, 78], 5, { dark: 0.5, light: 0.3 }),
    boots: ramp([44, 38, 46], 5, { dark: 0.5, light: 0.4 }),
    button: PAL.parchment[1],
    glasses: { frame: [226, 218, 182], lens: [212, 236, 240] },
    longCardigan: true,
    narrowBlouse: true,
  },
  // The travelling merchant: a wide-brimmed mustard felt hat, a short red scarf, a long teal travelling coat with brass
  // buttons, a leather satchel on a strap across the chest, cream-and-navy striped trousers tucked into turned-cuff
  // boots. Tall and lean (a slim body under a tall hat), clean-shaven with a weathered, friendly face.
  rowan: {
    hat: 'felt',
    hair: hairOf([112, 80, 58]),
    skin: ramp([216, 160, 120], 3, { dark: 0.3, light: 0.2 }),
    shirt: MERCHANT_TEAL,
    bib: ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 }),
    pants: ramp([54, 58, 84], 5, { dark: 0.5, light: 0.3 }),
    stripe: ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 }),
    boots: ramp([96, 60, 38], 5, { dark: 0.5, light: 0.4 }),
    hatColor: ramp([206, 156, 48], 5, { dark: 0.5, light: 0.4 }),
    band: ramp([118, 74, 42], 5, { dark: 0.5, light: 0.35 }),
    scarf: ramp([200, 58, 54], 5, { dark: 0.5, light: 0.4 }),
    button: ramp([214, 164, 64], 5)[3],
    travelCoat: true,
    stripes: true,
    weathered: true,
    tallBoots: true,
  },
  // The naturalist: bare head with a long dark-red braid over one shoulder, a round freckled face, an olive field jacket with
  // big pockets, a mustard scarf, a leather binocular strap across the chest, dark trousers tucked into green rubber boots,
  // and a little notebook in one hand.
  fern: {
    hat: 'fern',
    hair: hairOf([150, 38, 44]),
    skin: ramp([244, 204, 170], 3, { dark: 0.3, light: 0.2 }),
    shirt: ramp([126, 138, 62], 5, { dark: 0.38, light: 0.3 }),
    bib: ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 }),
    pants: ramp([46, 50, 68], 5, { dark: 0.5, light: 0.3 }),
    boots: ramp([62, 152, 96], 5, { dark: 0.5, light: 0.4 }),
    scarf: ramp([218, 164, 44], 5, { dark: 0.5, light: 0.4 }),
    band: ramp([134, 86, 46], 5, { dark: 0.5, light: 0.35 }),
    button: ramp([218, 164, 44], 5)[3],
    fieldJacket: true,
    scarfWrap: true,
    freckles: true,
    shoulderBraid: true,
    notebook: true,
    tallBoots: true,
  },
};

const keyOf = (s) => ({
  h: PAL.gold[4], m: PAL.gold[3], d: PAL.gold[1], b: (s.band ?? PAL.clay)[2], B: (s.band ?? PAL.clay)[1],
  s: s.skin[1], x: s.skin[0], e: PAL.ink,
  r: s.hair[1], R: s.hair[0], i: s.hair[2],
  u: s.shirt[3], t: s.shirt[2], T: s.shirt[1],
  q: s.bib[3], p: s.bib[2], P: s.bib[1],
  n: s.pants[2], N: s.pants[1],
  y: s.button ?? PAL.gold[4], a: s.skin[1], k: s.boots[2], K: s.boots[0], o: s.boots[3],
  c: (s.cap ?? PAL.stone)[3], C: (s.cap ?? PAL.stone)[1], v: (s.cap ?? PAL.stone)[2],
  w: s.beard ? s.beard[2] : s.skin[1], W: s.beard ? s.beard[1] : s.skin[0],
  l: s.skin[2], z: (s.moustache ?? s.hair)[1],
  g: (s.hatColor ?? PAL.forest)[3], G: (s.hatColor ?? PAL.forest)[2], D: (s.hatColor ?? PAL.forest)[1],
  f: s.glasses ? s.glasses.frame : PAL.stone[2], L: s.glasses ? s.glasses.lens : PAL.stone[3],
  // the merchant: scarf (S Z U), felt-hat extremes (H E), leather extremes (A M), trouser stripe (j J)
  S: (s.scarf ?? PAL.berry)[2], Z: (s.scarf ?? PAL.berry)[1], U: (s.scarf ?? PAL.berry)[3],
  H: (s.hatColor ?? PAL.forest)[4], E: (s.hatColor ?? PAL.forest)[0],
  A: (s.band ?? PAL.clay)[3], M: (s.band ?? PAL.clay)[0],
  j: (s.stripe ?? s.pants)[2], J: (s.stripe ?? s.pants)[1],
  Q: mix(s.skin[1], [96, 44, 32], 0.4),
  // the naturalist: freckles (F), binocular barrels (O) and their lens glints (V), notebook cover (X) and pages (Y)
  F: mix(s.skin[1], [168, 88, 52], 0.55),
  O: PAL.stone[0], V: PAL.stone[4],
  X: ramp([112, 70, 44], 5, { dark: 0.5, light: 0.35 })[1], Y: PAL.parchment[3],
});

const paint = (img, key, rows, x0, y0) => {
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== '.') img.set(x0 + dx, y0 + dy, key[ch]);
    });
  });
};

// ---------------------------------------------------------------------------------- head gear

const FRONT_HAT = {
  straw: ['.....hhhhhh.....', '....hhmmmmmd....', '....hmmmmmmd....', '....bbbbbbbB....', '.hhmmmmmmmmmmmd.', '..dddddddddddd..'],
  cap: ['................', '................', '....vvvvvvvv....', '...vvccvvvvvv...', '...CCCCCCCCCC...', '..CCCCCCCCCCCC..'],
  none: ['.....rrrrrr.....', '....rrrrrrrr....', '...rrirrrrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrr...', '....rrrrrrrr....'],
  // thinning hair: a high forehead and bald crown, hair kept at the sides and a thin fringe on top
  thin: ['.....rrrrrr.....', '....rrrllrrr....', '...rrrssssrrr...', '...rrssssssrr...', '...rrssssssrr...', '....rssssssr....'],
  // a floppy bucket hat: a crown that flares into a drooping brim
  bucket: ['................', '....gGGGGGGD....', '....gGGGGGGD....', '...gGGGGGGGGD...', '..gGGGGGGGGGGD..', '..DDDDDDDDDDDD..'],
  // a flat tweed cap: a low, wide crown flecked with light and dark, a short stiff peak
  flat: ['................', '................', '.....vvvvvv.....', '....vcvvvcvv....', '...vvvCvvvvcvC..', '...CCCCCCCCCC...'],
  // grey hair swept up into a high round bun on a neat crown
  bun: ['......irrr......', '.....irrrrR.....', '......RRRR......', '....rrrirrrr....', '...rrrrrrrrrr...', '....rrrrrrrr....'],
  // a tall felt hat with a pinched crown, a leather band and brass buckle, and a wide brim that droops at the ends
  felt: ['......gHGD......', '.....gGDGGD.....', '....gGGDGGGD....', '....gGGDGGGD....', '....BBBByyBB....', '..gGGGGGGGGGGD..', '.DDDDDDDDDDDDDD.'],
  // full, wavy hair that frames a round face (the fringe and the locks at the sides are added by `fernHairFront`)
  fern: ['.....rrrrrr.....', '....rrriirrr....', '...rrrrrrrrrr...', '...rrRrrrrrrr...', '...rrrrrrrrRr...', '....RrrrrrrR....'],
};
const BACK_HAT = {
  thin: ['.....rrrrrr.....', '....rrrllrrr....', '...rrrrssrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrr...', '....rrrrrrrr....'],
  flat: ['................', '................', '.....vvvvvv.....', '....vcvvvcvv....', '...vvvCvvvvcvC..', '...vvcvvvvvvCv..'],
  bun: ['......irrr......', '.....irrrrR.....', '......RRRR......', '....rrrrrrrr....', '...rrrrrrrirr...', '....rrrrrrrr....'],
  felt: ['......gHGD......', '.....gGGGGD.....', '....gGGGDGGD....', '....gGGGDGGD....', '....BBBBBBBB....', '..gGGGGGGGGGGD..', '.DDDDDDDDDDDDDD.'],
  fern: ['.....rrrrrr.....', '....rrriirrr....', '...rrrrrrrrrr...', '...rrRrrrrrrr...', '...rrrrrRrrrr...', '....RrrrrrrR....'],
};
const SIDE_HAT = {
  straw: ['.....hhhhhh.....', '....hhmmmmmd....', '....hmmmmmmd....', '....bbbbbbbB....', 'hhmmmmmmmmmmd...', '.dddddddddddd...'],
  cap: ['................', '................', '....vvvvvvvv....', '...vvccvvvvv....', '..CCCCCCCCCC....', '.CCCCCCCCCCC....'],
  none: ['.....rrrrrr.....', '....rrrrrrrr....', '....rirrrrrr....', '....rrrrrrrr....', '....rrrrrrrr....', '....rrrrrrrr....'],
  thin: ['.....rrrrrr.....', '....rlrrrrrr....', '....sssrrrrr....', '....sssssrrr....', '....sssssrrr....', '....sssssrrr....'],
  bucket: ['................', '....gGGGGGGD....', '....gGGGGGGD....', '...gGGGGGGGGD...', '.gGGGGGGGGGGD...', '.DDDDDDDDDDDD...'],
  flat: ['................', '................', '....vvvvvv......', '...vcvvvcvvv....', '.CCvvvCvvvvcv...', '.CCCCCCCCCCC....'],
  bun: ['........irr.....', '.......irrrR....', '........RRR.....', '....rrrrrrrr....', '....rirrrrrr....', '....rrrrrrrr....'],
  felt: ['......gHGD......', '.....gGGGGGD....', '....gGGGGGGD....', '....gGGGGGGD....', '....ByBBBBBB....', 'gGGGGGGGGGGGGD..', 'DDDDDDDDDDDDDD..'],
  fern: ['.....rrrrrr.....', '....rrriirrr....', '....rrrrrrrrr...', '....rrrrRrrrrr..', '....rrrrrrrrrR..', '....rrrrrrrrR...'],
};

const FRONT_HEAD = ['....rrssssrr....', '....rssssssr....', '....ssessess....', '....ssessess....', '....ssssssss....', '.....xssssx.....'];
const BACK_HEAD = ['....rrrrrrrr....', '....rrrrrrrr....', '....rrrrrrrr....', '....rrrrrrrr....', '....RrrrrrrR....', '.....xssssx.....'];
const SIDE_HEAD = ['....sssssrrr....', '....sssssrrr....', '....sesssrrr....', '...ssssssrrR....', '....ssssssx.....', '.....xxxx.......'];

const FRONT_TORSO = ['...uttttttttT...', '...ttqppppqTT...', '...ttpyppypTT...', '...aapppppp aa..'.replace(' ', '')];
const BACK_TORSO = ['...uttttttttT...', '...ttqttttqTT...', '...ttttttttTT...', '...aattttttaa...'];

// ---------------------------------------------------------------------------------- front and back

/**
 * Left and right legs; `raise` lifts the boot off the ground by that many pixels. `stripes` paints the trousers in
 * alternating dark and light columns (the merchant's); `top` is the first row of leg (a long coat starts it higher).
 */
function legs(img, key, back, raiseLeft, raiseRight, tall = false, stripes = false, top = 18) {
  const leg = (x0, raise) => {
    const bottom = 22 - raise;
    for (let y = top; y < bottom - 1; y += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        if (stripes) img.set(x0 + dx, y, key[(x0 + dx) % 2 === 1 ? 'j' : 'n']);
        else img.set(x0 + dx, y, key[back ? 'T' : dx === 2 && x0 === 5 ? 'N' : 'n']);
      }
    }
    if (tall) img.fillRect(x0, bottom - 2, 3, 1, key.o); // the turned-over cuff of a wellington
    img.fillRect(x0 - 1, bottom - 1, 4, 1, key.k);
    img.fillRect(x0 - 1, bottom, 4, 1, key.K);
  };
  leg(5, raiseLeft);
  leg(8, raiseRight);
}

function frontBack(style, key, back, frame) {
  const img = new Img(16, 24);
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  // a style with a body of its own (a long coat, a field jacket) draws it instead of the shirt, the bib and the swinging sleeves
  const ownBody = style.travelCoat === true || style.fieldJacket === true;
  legs(img, key, back, frame === 3 ? 1 : 0, frame === 1 ? 1 : 0, style.tallBoots, style.stripes, style.travelCoat ? 17 : 18);
  if (!ownBody) paint(img, key, back ? BACK_TORSO : FRONT_TORSO, 0, 13 - bob);
  if (style.rolledSleeves) {
    // sleeves pushed up past the elbow: a light rolled cuff, then bare forearms
    img.set(3, 14 - bob, key.u);
    img.set(4, 14 - bob, key.u);
    img.set(11, 14 - bob, key.t);
    img.set(12, 14 - bob, key.t);
    for (const x of [3, 4, 11, 12]) img.set(x, 15 - bob, key.a);
  }
  if (style.broad) {
    // a wider chest and shoulders: one more pixel of arm on each side
    img.set(2, 13 - bob, key.u);
    img.set(2, 14 - bob, key.u);
    img.set(2, 15 - bob, key.a);
    img.set(2, 16 - bob, key.a);
    img.set(13, 13 - bob, key.T);
    img.set(13, 14 - bob, key.t);
    img.set(13, 15 - bob, key.a);
    img.set(13, 16 - bob, key.a);
  }
  if (style.narrowBlouse) {
    // an open cardigan: plum panels either side of a narrow cream blouse (plain plum from behind)
    for (const y of back ? [14] : [14, 15, 16]) {
      img.set(5, y - bob, key.t);
      img.set(10, y - bob, key.T);
    }
  }
  if (!ownBody) img.fillRect(5, 17 - bob, 6, 2, key[back ? 't' : 'n']);
  if (style.apron && !back) {
    img.fillRect(5, 17 - bob, 6, 3, key.p);
    img.hline(5, 19 - bob, 6, key.P);
    img.vline(5, 17 - bob, 2, key.q);
  }
  if (style.belt) {
    // a leather tool belt with a brass buckle, a pouch on each hip
    img.hline(3, 17 - bob, 10, key.B);
    if (!back) {
      img.set(7, 17 - bob, key.y);
      img.set(8, 17 - bob, key.y);
    }
    for (const x of [3, 11]) {
      img.fillRect(x, 18 - bob, 2, 2, key.b);
      img.hline(x, 19 - bob, 2, key.B);
    }
  }
  if (style.longCardigan) {
    // a dark skirt flaring below the hem of a long cardigan
    for (let x = 4; x < 12; x += 1) img.set(x, 19, key.n);
    for (let x = 3; x < 13; x += 1) img.set(x, 20, x < 8 ? key.n : key.N);
    img.set(3, 20, key.n);
    for (let y = 17; y <= 19; y += 1) {
      const yy = y - bob;
      const hem = y === 19;
      const gap = !back && y >= 17;
      for (let x = 4; x < 12; x += 1) {
        if (gap && (x === 7 || x === 8)) {
          img.set(x, yy, y === 17 ? key.p : key.n);
          continue;
        }
        img.set(x, yy, hem ? key.T : x < 8 ? key.t : key.T);
      }
      if (hem) {
        img.set(3, yy, key.T);
        img.set(12, yy, key.T);
      }
    }
    img.set(4, 17 - bob, key.u);
  }
  if (style.coat) {
    // a hip-length raincoat that flares a little at the hem
    img.fillRect(4, 17 - bob, 8, 1, key.t);
    img.set(4, 17 - bob, key.u);
    img.set(11, 17 - bob, key.T);
    img.fillRect(3, 18 - bob, 10, 1, key.T);
    img.set(3, 18 - bob, key.t);
  }
  if (style.travelCoat) travelCoatFrontBack(img, key, back, frame, bob);
  if (style.fieldJacket) fieldJacketFrontBack(img, key, back, frame, bob);
  paint(img, key, back ? BACK_HEAD : FRONT_HEAD, 0, 7 - bob);
  if (style.hat === 'fern') fernHairFront(img, key, back, bob);
  if (style.freckles && !back) for (const [x, y] of [[4, 10], [5, 11], [7, 11], [8, 11], [10, 11], [11, 10]]) img.set(x, y - bob, key.F);
  if (style.weathered && !back) weatheredFront(img, key, bob);
  if (style.scarf) scarfFrontBack(img, key, back, bob, style.scarfWrap === true);
  if (style.beard && !back) {
    // Cheeks, a moustache either side of the mouth, and the chin.
    for (const [x, y] of [[4, 10], [11, 10], [4, 11], [5, 11], [6, 11], [9, 11], [10, 11], [11, 11], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12]]) img.set(x, y - bob, key.w);
  }
  if (style.fullBeard && !back) {
    // a thick beard: sideburns, a shadowed mouth, and a tuft hanging down over the chest
    for (const [x, y] of [[4, 9], [11, 9], [5, 10], [10, 10], [6, 13], [7, 13], [8, 13], [9, 13]]) img.set(x, y - bob, key.w);
    for (const [x, y] of [[7, 11], [8, 11], [7, 13], [8, 13], [5, 12], [10, 12]]) img.set(x, y - bob, key.W);
  }
  if (style.glasses && !back) {
    // round spectacles: a pale ring round each eye, joined at the bridge, glinting lenses
    for (const cx of [6, 9]) {
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) img.set(cx + dx, 9 + dy - bob, key.f);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) img.set(cx + dx, 9 + dy - bob, key.L);
      img.set(cx, 9 - bob, key.e);
    }
  }
  if (style.moustache && !back) {
    for (const x of [5, 6, 7, 8, 9, 10]) img.set(x, 11 - bob, key.z);
    img.set(5, 12 - bob, key.z);
    img.set(10, 12 - bob, key.z);
  }
  paint(img, key, (back ? BACK_HAT[style.hat] : undefined) ?? FRONT_HAT[style.hat], 0, 1 - bob);
  if (style.shoulderBraid) shoulderBraidFrontBack(img, key, back, bob);
  if (style.bun && back) img.fillRect(6, 0 - bob, 4, 2, key.r);
  if (style.braid && back) {
    // a long plait down the back, tied off with a ribbon
    for (let y = 12; y <= 19; y += 1) {
      const even = (y - 12) % 2 === 0;
      img.set(7, y - bob, even ? key.r : key.R);
      img.set(8, y - bob, even ? key.R : key.r);
    }
    img.set(7, 13 - bob, key.i);
    img.set(7, 15 - bob, key.i);
    img.fillRect(7, 18 - bob, 2, 1, key.b);
    img.set(7, 19 - bob, key.R);
    img.set(8, 19 - bob, key.R);
  }
  const sleeve = style.rolledSleeves ? key.a : key.t;
  if (frame === 1 && !ownBody) {
    img.set(3, 16 - bob, sleeve);
    img.set(12, 15 - bob, sleeve);
  }
  if (frame === 3 && !ownBody) {
    img.set(3, 15 - bob, sleeve);
    img.set(12, 16 - bob, sleeve);
  }
  img.outline(PAL.inkWarm);
  return img;
}

// ---------------------------------------------------------------------------------- the travelling merchant

/** A one-pixel diagonal strap and the satchel it carries, painted by letter. `rows` start at (x, y). */
function stamp(img, key, rows, x, y) {
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== '.') img.set(x + dx, y + dy, key[ch]);
    });
  });
}

/**
 * Rowan's long teal coat from the front or back: a slim body (one-pixel sleeves), brass buttons down the front,
 * a flared skirt split at the centre to show his striped trousers, a leather strap across the chest and the big
 * satchel on his hip (on the left of the picture from behind, the right from the front).
 */
function travelCoatFrontBack(img, key, back, frame, bob) {
  const Y = (y) => y - bob;
  // body: sleeves at x 4 and 11, torso x 5..10
  for (let y = 13; y <= 16; y += 1) {
    for (let x = 5; x <= 10; x += 1) img.set(x, Y(y), x >= 9 ? key.T : key.t);
  }
  // a centre seam (the front placket, or the back seam) with the buttons set into it
  for (let y = 14; y <= 17; y += 1) img.set(7, Y(y), key.T);
  if (!back) for (const y of [14, 16]) img.set(7, Y(y), key.y);
  // skirt: flares from the waist to the hem; the centre stays open on the trousers behind it
  for (let y = 17; y <= 19; y += 1) {
    const x0 = y === 17 ? 4 : 3;
    const x1 = y === 17 ? 11 : 12;
    for (let x = x0; x <= x1; x += 1) {
      if ((y === 18 || y === 19) && x >= 6 && x <= 9) continue;
      img.set(x, Y(y), x >= 9 ? key.T : y === 19 ? key.T : key.t);
    }
  }
  img.set(3, Y(19), key.t);
  if (back) {
    img.set(7, Y(17), key.T);
    img.set(8, Y(17), key.T);
  }
  // the strap, then the satchel on the hip
  const strap = back ? [[10, 13], [9, 14], [8, 15], [7, 15], [6, 16], [5, 17]] : [[5, 13], [6, 14], [7, 15], [8, 15], [9, 16], [10, 17]];
  for (const [x, y] of strap) img.set(x, Y(y), key.b);
  const FRONT_BAG = ['AAAAb', 'bbbbB', 'BByBB', 'bbbbB', 'BBBBM'];
  const BACK_BAG = ['bbbbB', 'bbbbB', 'bbbbB', 'bbbbB', 'BBBBM'];
  if (back) stamp(img, key, BACK_BAG, 1, Y(17));
  else stamp(img, key, FRONT_BAG, 10, Y(17));
  // arms: one pixel wide, a hand at the end, swinging a pixel with the stride
  const lower = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const hands = [16 + lower, 16 - lower];
  [4, 11].forEach((x, i) => {
    for (let y = 13; y < hands[i]; y += 1) img.set(x, Y(y), i === 0 ? (y === 13 ? key.u : key.t) : key.T);
    img.set(x, Y(hands[i]), key.a);
  });
}

/** A red scarf wrapped round the neck, one end hanging down the chest (and a loose end from behind). */
function scarfFrontBack(img, key, back, bob, wrap = false) {
  const Y = (y) => y - bob;
  for (let x = 5; x <= 10; x += 1) img.set(x, Y(13), x === 5 ? key.U : x >= 9 ? key.Z : key.S);
  img.set(4, Y(13), key.S);
  if (wrap) {
    // a thick wrap rather than a hanging end: one more pixel of collar, and a V of scarf on the chest from the front
    img.set(11, Y(13), key.Z);
    if (!back) for (const [x, y] of [[6, 14], [7, 14], [8, 14], [9, 14]]) img.set(x, Y(y), x === 6 ? key.U : x === 9 ? key.Z : key.S);
  } else if (!back) {
    img.set(9, Y(14), key.S);
    img.set(10, Y(14), key.Z);
    img.set(9, Y(15), key.Z);
    img.set(10, Y(15), key.Z);
  } else {
    img.set(5, Y(14), key.S);
    img.set(5, Y(15), key.Z);
  }
}

/** Laughter lines and a faint smile on a clean-shaven, sun-browned face. */
function weatheredFront(img, key, bob) {
  for (const [x, y] of [[5, 10], [10, 10], [6, 11], [9, 11]]) img.set(x, y - bob, key.Q);
}

// ---------------------------------------------------------------------------------- side (faces left)

function side(style, key, frame) {
  const img = new Img(16, 24);
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const ownBody = style.travelCoat === true || style.fieldJacket === true;
  const leg = (x0, raise, color) => {
    const bottom = 22 - raise;
    for (let y = style.travelCoat ? 17 : 18; y < bottom - 1; y += 1) {
      img.fillRect(x0, y, 3, 1, color);
      if (style.stripes) img.set(x0 + 1, y, color === key.N ? key.J : key.j);
    }
    if (style.tallBoots) img.fillRect(x0, bottom - 2, 3, 1, key.o);
    img.fillRect(x0 - 1, bottom - 1, 5, 1, key.k);
    img.fillRect(x0 - 1, bottom, 5, 1, key.K);
  };
  const front = frame === 1 ? 3 : frame === 3 ? 7 : 5;
  const rear = frame === 1 ? 8 : frame === 3 ? 4 : 6;
  leg(rear, frame === 1 ? 1 : 0, key.N);
  leg(front, frame === 3 ? 1 : 0, key.n);
  if (!ownBody) img.fillRect(5, 17 - bob, 6, 2, key.n);
  if (style.apron) {
    img.fillRect(4, 17 - bob, 5, 3, key.p);
    img.hline(4, 19 - bob, 5, key.P);
  }
  if (style.belt) {
    img.hline(4, 17 - bob, 7, key.B);
    img.fillRect(5, 18 - bob, 3, 2, key.b);
    img.hline(5, 19 - bob, 3, key.B);
  }
  if (style.longCardigan) {
    for (let x = 4; x < 12; x += 1) img.set(x, 19, key.n);
    for (let x = 3; x < 12; x += 1) img.set(x, 20, x < 7 ? key.n : key.N);
    img.set(4, 17 - bob, key.u);
    for (let x = 5; x < 10; x += 1) img.set(x, 17 - bob, key.t);
    img.set(10, 17 - bob, key.T);
    img.set(4, 18 - bob, key.t);
    for (let x = 5; x < 12; x += 1) img.set(x, 18 - bob, key.T);
    for (let x = 4; x < 12; x += 1) img.set(x, 19 - bob, key.T);
  }
  if (style.coat) {
    img.fillRect(4, 17 - bob, 7, 1, key.t);
    img.set(4, 17 - bob, key.u);
    img.set(10, 17 - bob, key.T);
    img.fillRect(4, 18 - bob, 8, 1, key.T);
    img.set(4, 18 - bob, key.t);
  }
  if (style.travelCoat) travelCoatSide(img, key, frame, bob);
  else if (style.fieldJacket) fieldJacketSide(img, key, frame, bob);
  else paint(img, key, ['....uttttTT.....', '....tqpppTT.....', '....tpyppTT.....', '....tpppppT.....'], 0, 13 - bob);
  if (style.narrowBlouse) {
    // the cardigan wraps round the side: only a cream collar shows at the front
    img.set(5, 14 - bob, key.p);
    img.set(5, 15 - bob, key.t);
    for (let x = 5; x < 10; x += 1) img.set(x, 16 - bob, x < 8 ? key.t : key.T);
  }
  if (style.broad) {
    // a deeper chest and back
    img.set(3, 13 - bob, key.u);
    for (const y of [14, 15, 16]) img.set(3, y - bob, key.t);
    for (const y of [13, 14, 15, 16]) img.set(11, y - bob, key.T);
  }
  const armShift = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  img.fillRect(6 + armShift, 13 - bob, 3, 3, key.u);
  img.vline(8 + armShift, 13 - bob, 3, key.T);
  img.fillRect(6 + armShift, 16 - bob, 2, 1, key.a);
  if (style.rolledSleeves) {
    // sleeves rolled up: a light cuff, then a bare forearm
    img.fillRect(6 + armShift, 14 - bob, 3, 1, key.u);
    img.fillRect(6 + armShift, 15 - bob, 3, 1, key.a);
    img.set(8 + armShift, 15 - bob, key.x);
  }
  if (style.notebook) {
    // the notebook is held out in front of the chest (facing left), the page edge towards the hand
    stamp(img, key, ['YYX', 'YYX', 'YYX', 'XXX'], 3 + armShift, 15 - bob);
  }
  paint(img, key, SIDE_HEAD, 0, 7 - bob);
  if (style.freckles) for (const [x, y] of [[4, 10], [6, 10], [5, 11], [7, 11]]) img.set(x, y - bob, key.F);
  if (style.weathered) weatheredSide(img, key, bob);
  if (style.scarf) scarfSide(img, key, frame, bob, style.scarfWrap === true);
  if (style.beard) for (const [x, y] of [[3, 10], [4, 10], [4, 11], [5, 11], [6, 11], [5, 12], [6, 12], [7, 12]]) img.set(x, y - bob, key.w);
  if (style.fullBeard) {
    for (const [x, y] of [[3, 11], [7, 11], [4, 12], [7, 10], [4, 13], [5, 13], [6, 13]]) img.set(x, y - bob, key.w);
    for (const [x, y] of [[3, 12], [5, 13]]) img.set(x, y - bob, key.W);
  }
  if (style.glasses) {
    // a round lens by the eye and a thin arm running back to the ear
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) img.set(5 + dx, 9 + dy - bob, key.f);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) img.set(5 + dx, 9 + dy - bob, key.L);
    img.set(5, 9 - bob, key.e);
    img.set(7, 9 - bob, key.f);
    img.set(8, 9 - bob, key.f);
  }
  if (style.moustache) for (const [x, y] of [[3, 11], [4, 11], [5, 11]]) img.set(x, y - bob, key.z);
  paint(img, key, SIDE_HAT[style.hat], 0, 1 - bob);
  if (style.shoulderBraid) shoulderBraidSide(img, key, frame, bob);
  if (style.bun) img.fillRect(11, 3 - bob, 3, 3, key.r);
  if (style.braid) {
    // the plait hangs behind the back and swings a little with the stride
    const sway = frame === 1 ? 1 : 0;
    for (let y = 11; y <= 19; y += 1) {
      const even = (y - 11) % 2 === 0;
      const x = 11 + (y > 15 ? sway : 0);
      img.set(x, y - bob, even ? key.r : key.R);
      img.set(x + 1, y - bob, even ? key.R : key.r);
    }
    img.set(11, 13 - bob, key.i);
    img.set(11, 15 - bob, key.i);
    img.fillRect(11 + sway, 18 - bob, 2, 1, key.b);
    img.set(11 + sway, 19 - bob, key.R);
    img.set(12 + sway, 19 - bob, key.R);
  }
  img.outline(PAL.inkWarm);
  return img;
}

/** The same coat seen from the side (facing left): buttons along the front edge, the satchel swinging at the hip. */
function travelCoatSide(img, key, frame, bob) {
  const Y = (y) => y - bob;
  stamp(img, key, ['uttttTT', 'yttttTT', 'tttttTT', 'yttttTT'], 4, Y(13));
  stamp(img, key, ['tttttTTT', 'tttttTTT'], 4, Y(17));
  stamp(img, key, ['tTTTTTT'], 6, Y(19));
  // the strap runs from the shoulder, behind the arm, down to the satchel
  for (const [x, y] of [[5, 13], [5, 14], [6, 15], [7, 16]]) img.set(x, Y(y), key.b);
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  stamp(img, key, ['AAAAb', 'bbbbB', 'BByBB', 'bbbbB', 'BBBBM'], 8 + swing, Y(16));
}

/** The scarf from the side: a thick collar round the neck and the loose end blown a little behind. */
function scarfSide(img, key, frame, bob, wrap = false) {
  const Y = (y) => y - bob;
  for (let x = 5; x <= 9; x += 1) img.set(x, Y(13), x === 5 ? key.U : x >= 8 ? key.Z : key.S);
  if (wrap) {
    // a thick wrap round the neck, a fold of it in front of the throat; no loose end
    img.set(4, Y(13), key.U);
    img.set(10, Y(13), key.Z);
    img.set(5, Y(14), key.S);
    img.set(6, Y(14), key.Z);
    return;
  }
  const sway = frame === 1 ? 1 : 0;
  img.set(9 + sway, Y(14), key.S);
  img.set(10 + sway, Y(14), key.Z);
  img.set(10 + sway, Y(15), key.Z);
  img.set(11 + sway, Y(15), key.Z);
}

function weatheredSide(img, key, bob) {
  for (const [x, y] of [[5, 10], [6, 11]]) img.set(x, y - bob, key.Q);
}

// ---------------------------------------------------------------------------------- the naturalist

/**
 * Fern's olive field jacket from the front or back: a zip down the middle, two big patch pockets, a leather strap over one
 * shoulder and across the chest to a pair of binoculars at the hip, and a little notebook held out in one hand (the same
 * hand and hip, her right, from every side).
 */
function fieldJacketFrontBack(img, key, back, frame, bob) {
  const Y = (y) => y - bob;
  // torso x 5..10, a hem a pixel wider each side
  for (let y = 13; y <= 16; y += 1) for (let x = 5; x <= 10; x += 1) img.set(x, Y(y), x === 10 ? key.T : key.t);
  img.set(4, Y(17), key.t);
  for (let x = 5; x <= 11; x += 1) img.set(x, Y(17), key.T);
  for (let y = 14; y <= 17; y += 1) img.set(7, Y(y), key.T);
  // arms: sleeves two wide, a hand at the end, swinging a pixel with the stride
  const lower = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const hands = [16 + lower, 16 - lower];
  [3, 11].forEach((x0, i) => {
    for (let y = 13; y < hands[i]; y += 1) {
      img.set(x0, Y(y), i === 0 ? (y === 13 ? key.u : key.t) : key.T);
      img.set(x0 + 1, Y(y), i === 0 ? key.t : key.T);
    }
    img.fillRect(x0, Y(hands[i]), 2, 1, key.a);
  });
  if (!back) {
    img.set(7, Y(14), key.y); // the zip pull
    // two big patch pockets: a light flap over a dark pouch
    for (const x0 of [5, 8]) {
      img.hline(x0, Y(15), 2, key.u);
      img.hline(x0, Y(16), 2, key.T);
    }
    // strap from the right shoulder down to the binoculars on the left hip (hers: she wears them on her right)
    for (const [x, y] of [[9, 14], [8, 15], [7, 16], [6, 17]]) img.set(x, Y(y), key.b);
    stamp(img, key, ['OOOO', 'OVOV'], 4, Y(17));
    // the notebook, cover to us, page edge on the right, held in the left-hand (the picture's left) hand
    stamp(img, key, ['XYY', 'XYY', 'XYY', 'XXX'], 1, Y(hands[0]));
    img.set(4, Y(hands[0]), key.a);
  } else {
    img.hline(5, Y(14), 6, key.T); // a yoke seam across the shoulders
    for (const [x, y] of [[5, 13], [6, 14], [7, 15], [8, 16], [9, 17]]) img.set(x, Y(y), key.b);
    stamp(img, key, ['OOO', 'OOO'], 10, Y(17));
    stamp(img, key, ['XX', 'XX', 'XX', 'YY'], 13, Y(hands[1]));
  }
}

/** The jacket from the side (facing left): the strap runs from the shoulder behind the arm, the binoculars swing at the hip. */
function fieldJacketSide(img, key, frame, bob) {
  const Y = (y) => y - bob;
  stamp(img, key, ['uttttTT', 'tttttTT', 'tttttTT', 'tttttTT'], 4, Y(13));
  stamp(img, key, ['tTTTTTT'], 4, Y(17));
  img.set(4, Y(14), key.T);
  for (const [x, y] of [[5, 13], [5, 14], [6, 15], [7, 16]]) img.set(x, Y(y), key.b);
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  stamp(img, key, ['OOOO', 'OVOO'], 5 + swing, Y(17));
}

/** Loose locks of hair at either side of the face, and a fringe swept across the forehead. */
function fernHairFront(img, key, back, bob) {
  const Y = (y) => y - bob;
  for (let y = 7; y <= 9; y += 1) {
    img.set(3, Y(y), y === 9 ? key.R : key.r);
    img.set(12, Y(y), y === 9 ? key.R : key.r);
  }
  if (back) return;
  for (const x of [6, 7, 8, 9]) img.set(x, Y(7), key.r);
  img.set(5, Y(8), key.r);
  img.set(6, Y(8), key.R);
}

/** A thick dark-red plait, two pixels wide, in alternating light and dark twists, tied off with a mustard ribbon. */
function plait(img, key, cells, bob) {
  cells.forEach(([x, y], i) => {
    const even = i % 2 === 0;
    img.set(x, y - bob, even ? key.r : key.R);
    img.set(x + 1, y - bob, even ? key.R : key.r);
    if (i === 2) img.set(x, y - bob, key.i);
  });
}

/** Over her left shoulder and down the front (from behind, only the top of it shows by the shoulder). */
function shoulderBraidFrontBack(img, key, back, bob) {
  if (back) {
    plait(img, key, [[4, 12], [4, 13], [4, 14], [3, 15]], bob);
    return;
  }
  plait(img, key, [[12, 10], [12, 11], [11, 12], [10, 13], [10, 14], [10, 15], [10, 16]], bob);
  img.fillRect(10, 17 - bob, 2, 1, key.S);
  img.set(10, 18 - bob, key.R);
  img.set(11, 18 - bob, key.r);
}

/** Seen from the side the plait lies along her back, over the shoulder blade, and swings a little with the stride. */
function shoulderBraidSide(img, key, frame, bob) {
  const sway = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  plait(img, key, [[10, 11], [10, 12], [10, 13], [10, 14], [10 + (sway > 0 ? 1 : 0), 15], [10 + sway, 16]], bob);
  img.fillRect(10 + sway, 17 - bob, 2, 1, key.S);
  img.set(10 + sway, 18 - bob, key.R);
  img.set(11 + sway, 18 - bob, key.r);
}

// ---------------------------------------------------------------------------------- build

export const PLAYER_ANIM = { idleFrames: 1, walkFrames: 4 };

/** @param {Map<string, Img>} frames @param {string} id @param {keyof typeof STYLES} styleName */
function buildCharacter(frames, id, styleName) {
  const style = STYLES[styleName];
  const key = keyOf(style);
  for (let f = 0; f < 4; f += 1) {
    frames.set(`char/${id}/down_walk_${f}`, frontBack(style, key, false, f));
    frames.set(`char/${id}/up_walk_${f}`, frontBack(style, key, true, f));
    const left = side(style, key, f);
    frames.set(`char/${id}/left_walk_${f}`, left);
    frames.set(`char/${id}/right_walk_${f}`, left.flipH());
  }
  for (const dir of ['down', 'up', 'left', 'right']) frames.set(`char/${id}/${dir}_idle_0`, frames.get(`char/${id}/${dir}_walk_0`));
}

/** @param {Map<string, Img>} frames */
export function buildCharacters(frames) {
  buildCharacter(frames, 'player', 'player');
  buildCharacter(frames, 'willa', 'willa');
  buildCharacter(frames, 'tobias', 'tobias');
  buildCharacter(frames, 'hollis', 'hollis');
  buildCharacter(frames, 'june', 'june');
  buildCharacter(frames, 'bram', 'bram');
  buildCharacter(frames, 'ines', 'ines');
  buildCharacter(frames, 'rowan', 'rowan');
  buildCharacter(frames, 'fern', 'fern');
}
