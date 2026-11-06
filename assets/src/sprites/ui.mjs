// UI frames drawn as 9-slice images (used by CSS border-image) in the Developer Farm look:
// dark forest-green framing, wooden panels and golden parchment.
//
// Output: src/assets/generated/ui/{name}.png. The slice size (in source pixels) is part of the contract
// with src/ui/styles/pixel.css.
import { Img } from '../canvas.mjs';
import { BRAND, DERIVED, mix, PAL, ramp } from '../color.mjs';

const WOOD = ramp(DERIVED.wood, 5, { dark: 0.5, light: 0.45 });
const FOREST = ramp(mix(BRAND.forestGreen, DERIVED.deepForest, 0.35), 5, { dark: 0.5, light: 0.45 });
const OUTLINE = DERIVED.nightForest;
const BROWN_OUTLINE = [38, 26, 18];

/** Knocks the four corner pixels out so a frame reads as rounded. */
function roundCorners(img) {
  for (const [x, y] of [[0, 0], [img.w - 1, 0], [0, img.h - 1], [img.w - 1, img.h - 1]]) img.set(x, y, [0, 0, 0], 0);
}

/**
 * A bevelled box: outline, a lit top-left edge, a shaded bottom-right edge, and a fill.
 * `thickness` is the frame width inside the outline.
 */
function bevel(img, { outline, lit, base, shade, inner, fill, thickness = 2 }) {
  const { w, h } = img;
  img.fillRect(0, 0, w, h, outline);
  img.fillRect(1, 1, w - 2, h - 2, base);
  img.hline(1, 1, w - 2, lit);
  img.vline(1, 1, h - 2, lit);
  if (thickness > 1) {
    img.hline(2, 2, w - 4, lit);
    img.vline(2, 2, h - 4, lit);
  }
  img.hline(1, h - 2, w - 2, shade);
  img.vline(w - 2, 1, h - 2, shade);
  if (thickness > 1) {
    img.hline(2, h - 3, w - 4, shade);
    img.vline(w - 3, 2, h - 4, shade);
  }
  const i = 1 + thickness;
  img.fillRect(i, i, w - i * 2, h - i * 2, inner);
  img.fillRect(i + 1, i + 1, w - (i + 1) * 2, h - (i + 1) * 2, fill);
}

function woodPanel() {
  const img = new Img(24, 24);
  bevel(img, {
    outline: BROWN_OUTLINE,
    lit: WOOD[4],
    base: WOOD[2],
    shade: WOOD[0],
    inner: WOOD[0],
    fill: WOOD[1],
  });
  // nails
  for (const [x, y] of [[3, 3], [20, 3], [3, 20], [20, 20]]) img.set(x, y, PAL.gold[3]);
  roundCorners(img);
  return img;
}

function parchmentPanel() {
  const img = new Img(24, 24);
  bevel(img, {
    outline: BROWN_OUTLINE,
    lit: WOOD[4],
    base: WOOD[2],
    shade: WOOD[0],
    inner: PAL.parchment[1],
    fill: PAL.parchment[3],
  });
  for (const [x, y] of [[3, 3], [20, 3], [3, 20], [20, 20]]) img.set(x, y, PAL.gold[3]);
  roundCorners(img);
  return img;
}

function button(state) {
  const img = new Img(16, 16);
  const face = state === 'hover' ? PAL.plank[3] : state === 'down' ? PAL.plank[1] : PAL.plank[2];
  img.fillRect(0, 0, 16, 16, BROWN_OUTLINE);
  img.fillRect(1, 1, 14, 14, face);
  if (state === 'down') {
    img.hline(1, 1, 14, PAL.plank[0]);
    img.vline(1, 1, 14, PAL.plank[0]);
    img.hline(1, 14, 14, PAL.plank[2]);
  } else {
    img.hline(1, 1, 14, PAL.plank[4]);
    img.vline(1, 1, 13, PAL.plank[4]);
    img.hline(1, 13, 14, PAL.plank[0]);
    img.hline(1, 14, 14, PAL.plank[0]);
    img.vline(14, 2, 12, PAL.plank[1]);
  }
  roundCorners(img);
  return img;
}

function frame() {
  const img = new Img(24, 24);
  // A transparent window with a dark forest-green border, a lit inner lip and golden corner studs.
  const { w, h } = img;
  img.fillRect(0, 0, w, h, OUTLINE);
  img.fillRect(1, 1, w - 2, h - 2, FOREST[1]);
  img.fillRect(2, 2, w - 4, h - 4, FOREST[2]);
  img.hline(2, 2, w - 4, FOREST[3]);
  img.vline(2, 2, h - 4, FOREST[3]);
  img.fillRect(5, 5, w - 10, h - 10, FOREST[0]);
  img.fillRect(6, 6, w - 12, h - 12, OUTLINE);
  for (const [x, y] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) {
    img.set(x, y, PAL.gold[3]);
  }
  // punch out the window so the game shows through
  img.fillRect(7, 7, w - 14, h - 14, [0, 0, 0], 0);
  return img;
}

function keycap() {
  const img = new Img(12, 12);
  img.fillRect(0, 0, 12, 12, BROWN_OUTLINE);
  img.fillRect(1, 1, 10, 9, PAL.parchment[3]);
  img.fillRect(1, 10, 10, 1, PAL.parchment[0]);
  img.hline(1, 1, 10, PAL.parchment[4]);
  img.fillRect(1, 9, 10, 1, PAL.parchment[1]);
  roundCorners(img);
  return img;
}

/** A hotbar slot: an inset dark well. `selected` rings it in gold. */
function slot(selected) {
  const img = new Img(12, 12);
  const edge = selected ? PAL.gold[3] : BROWN_OUTLINE;
  img.fillRect(0, 0, 12, 12, edge);
  img.fillRect(1, 1, 10, 10, selected ? PAL.gold[1] : WOOD[0]);
  img.fillRect(2, 2, 8, 8, selected ? WOOD[1] : WOOD[1]);
  img.hline(2, 2, 8, selected ? WOOD[0] : WOOD[0]);
  img.vline(2, 2, 8, selected ? WOOD[0] : WOOD[0]);
  img.hline(2, 9, 8, WOOD[2]);
  roundCorners(img);
  return img;
}

/** @returns {Map<string, Img>} file name (without extension) -> image */
export function buildUi() {
  return new Map([
    ['panel-wood', woodPanel()],
    ['panel-parchment', parchmentPanel()],
    ['button', button('normal')],
    ['button-hover', button('hover')],
    ['button-down', button('down')],
    ['frame', frame()],
    ['keycap', keycap()],
    ['slot', slot(false)],
    ['slot-selected', slot(true)],
  ]);
}
