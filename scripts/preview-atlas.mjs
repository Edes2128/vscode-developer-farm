// Developer tool: renders frames whose name starts with a prefix onto a scaled-up contact sheet so the
// pixel art can be reviewed. Usage: node scripts/preview-atlas.mjs <out.png> <scale> <prefix> [<prefix>...]
import { readFileSync, writeFileSync } from 'node:fs';
import { Img } from '../assets/src/canvas.mjs';
import { encodePng } from '../assets/src/png.mjs';

const [out, scaleArg, ...prefixes] = process.argv.slice(2);
const scale = Number(scaleArg);
const dir = new URL('../src/assets/generated/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('world.json', dir), 'utf8'));
const sheetPng = readFileSync(new URL('world.png', dir));

// Decode our own (unfiltered, RGBA) PNG: find IDAT, inflate, strip filter bytes.
import { inflateSync } from 'node:zlib';
function decode(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
    } else if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const img = new Img(width, height);
  for (let y = 0; y < height; y += 1) {
    raw.copy(Buffer.from(img.data.buffer), y * width * 4, y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1));
  }
  return img;
}
const atlas = decode(sheetPng);

const names = Object.keys(manifest.frames).filter((name) => prefixes.some((p) => name.startsWith(p)));
if (names.length === 0) throw new Error(`No frames match ${prefixes.join(', ')}`);

const pad = 2;
const maxRowWidth = 1400;
let x = pad;
let y = pad;
let rowHeight = 0;
const placed = [];
for (const name of names) {
  const f = manifest.frames[name];
  const w = f.w * scale;
  const h = f.h * scale;
  if (x + w + pad > maxRowWidth) {
    x = pad;
    y += rowHeight + pad;
    rowHeight = 0;
  }
  placed.push({ name, f, x, y });
  x += w + pad;
  rowHeight = Math.max(rowHeight, h);
}
const sheet = new Img(maxRowWidth, y + rowHeight + pad);
sheet.fill([60, 60, 70]);
for (const { f, x: px, y: py } of placed) {
  sheet.blit(atlas.crop(f.x, f.y, f.w, f.h).scaled(scale), px, py);
}
writeFileSync(out, encodePng(sheet.w, sheet.h, sheet.data));
console.log(`${names.length} frames -> ${out}`);
