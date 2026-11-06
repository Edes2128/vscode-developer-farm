// Packs many small images into one atlas sheet with a simple shelf packer.
import { Img } from './canvas.mjs';

const PADDING = 1;

/**
 * @param {Map<string, Img>} images frame name -> image
 * @param {number} width atlas width in pixels
 * @returns {{ sheet: Img, frames: Record<string, {x:number,y:number,w:number,h:number}> }}
 */
export function pack(images, width = 1024) {
  // Tallest first keeps the shelves tight. Ties keep insertion order, so the output is stable.
  const entries = [...images.entries()].sort((a, b) => b[1].h - a[1].h);

  const placements = [];
  let x = PADDING;
  let y = PADDING;
  let shelfHeight = 0;
  for (const [name, image] of entries) {
    if (x + image.w + PADDING > width) {
      x = PADDING;
      y += shelfHeight + PADDING * 2;
      shelfHeight = 0;
    }
    placements.push({ name, image, x, y });
    x += image.w + PADDING * 2;
    shelfHeight = Math.max(shelfHeight, image.h);
  }

  const height = nextPowerOfTwo(y + shelfHeight + PADDING);
  const sheet = new Img(width, height);
  const frames = {};
  for (const { name, image, x: px, y: py } of placements) {
    sheet.blit(image, px, py);
    extrudeEdges(sheet, px, py, image.w, image.h);
    frames[name] = { x: px, y: py, w: image.w, h: image.h };
  }
  return { sheet, frames };
}

/** Copies each frame's border pixels one pixel outwards so a sub-pixel sample never picks up a neighbour. */
function extrudeEdges(sheet, x, y, w, h) {
  const copy = (sx, sy, dx, dy) => {
    const i = (sy * sheet.w + sx) * 4;
    sheet.set(dx, dy, [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]], sheet.data[i + 3]);
  };
  for (let i = 0; i < w; i += 1) {
    copy(x + i, y, x + i, y - 1);
    copy(x + i, y + h - 1, x + i, y + h);
  }
  for (let j = -1; j <= h; j += 1) {
    const sy = Math.min(Math.max(y + j, y), y + h - 1);
    copy(x, sy, x - 1, y + j);
    copy(x + w - 1, sy, x + w, y + j);
  }
}

function nextPowerOfTwo(value) {
  let n = 64;
  while (n < value) n *= 2;
  return n;
}
