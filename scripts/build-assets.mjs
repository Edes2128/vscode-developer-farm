// Asset pipeline: generates the pixel-art atlas (and the UI frames) from the sources in assets/src.
//
//   npm run assets
//
// Output (committed, deterministic):
//   src/assets/generated/world.png    the sprite atlas
//   src/assets/generated/world.json   its manifest: frame rectangles and metadata (the contract with the renderer)
//   src/assets/generated/ui/*.png     9-slice UI frames used by CSS border-image
//
// The same manifest format lets hand-drawn art replace any generated frame: see docs/ASSET_PIPELINE in GAME_DESIGN.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Img } from '../assets/src/canvas.mjs';
import { pack } from '../assets/src/packer.mjs';
import { encodePng } from '../assets/src/png.mjs';
import { buildCharacters } from '../assets/src/sprites/characters.mjs';
import { buildAnimals } from '../assets/src/sprites/animals.mjs';
import { buildFarming } from '../assets/src/sprites/farming.mjs';
import { buildFishing } from '../assets/src/sprites/fishing.mjs';
import { buildBuildings } from '../assets/src/sprites/buildings.mjs';
import { buildCooking } from '../assets/src/sprites/cooking.mjs';
import { buildHome } from '../assets/src/sprites/home.mjs';
import { buildIcons5 } from '../assets/src/sprites/icons5.mjs';
import { buildInterior } from '../assets/src/sprites/interior.mjs';
import { buildExpansion } from '../assets/src/sprites/expansion.mjs';
import { buildMarket } from '../assets/src/sprites/market.mjs';
import { buildMining } from '../assets/src/sprites/mining.mjs';
import { buildMuseum } from '../assets/src/sprites/museum.mjs';
import { buildObjects } from '../assets/src/sprites/objects.mjs';
import { buildUi } from '../assets/src/sprites/ui.mjs';
import { BRAND, PAL } from '../assets/src/color.mjs';
import { buildTerrain, CANONICAL_MASKS, TERRAIN_META, TILE } from '../assets/src/sprites/terrain.mjs';

const outDir = fileURLToPath(new URL('../src/assets/generated/', import.meta.url));
mkdirSync(outDir, { recursive: true });

/** @type {Map<string, Img>} */
const frames = new Map();
const meta = { terrain: TERRAIN_META, canonicalMasks: CANONICAL_MASKS };

buildTerrain(frames);
buildObjects(frames);
buildCharacters(frames);
buildFarming(frames);
buildAnimals(frames);
buildInterior(frames);
buildMining(frames);
buildFishing(frames);
buildHome(frames);
buildBuildings(frames);
buildCooking(frames);
buildIcons5(frames);
buildMuseum(frames);
buildMarket(frames);
buildExpansion(frames);

const { sheet, frames: rects } = pack(frames);
writeFileSync(`${outDir}world.png`, encodePng(sheet.w, sheet.h, sheet.data));

const manifest = {
  version: 1,
  image: 'world.png',
  size: { w: sheet.w, h: sheet.h },
  tileSize: TILE,
  frames: Object.fromEntries(Object.entries(rects).sort(([a], [b]) => a.localeCompare(b))),
  meta,
};
writeFileSync(`${outDir}world.json`, `${JSON.stringify(manifest)}\n`);

// UI frames: one PNG per frame, used by CSS border-image.
mkdirSync(`${outDir}ui`, { recursive: true });
const ui = buildUi();
for (const [name, image] of ui) writeFileSync(`${outDir}ui/${name}.png`, encodePng(image.w, image.h, image.data));

// Extension icon: the farmhouse on a meadow, composed from atlas frames.
const icon = new Img(128, 128);
icon.fill(PAL.sky[2]);
icon.fillRect(0, 70, 128, 58, PAL.grass[2]);
icon.fillRect(0, 70, 128, 2, PAL.grass[1]);
icon.blit(frames.get('object/pine_a'), -14, 22);
icon.blit(frames.get('object/oak_a'), 86, 30);
icon.blit(frames.get('object/farmhouse'), 8, 40);
icon.blit(frames.get('object/bush_berry'), 4, 96);
icon.blit(frames.get('decal/flower_yellow_1'), 90, 100);
mkdirSync(fileURLToPath(new URL('../media/', import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL('../media/icon.png', import.meta.url)), encodePng(icon.w, icon.h, icon.data));

// Editor-tab icon: the same scene, box-filtered down to 32x32 (shown at 16 css px, crisp on a 2x screen). A webview tab draws its icon
// as a plain image, so unlike the activity-bar glyph (media/farm.svg, a mask) it must carry its own colours.
{
  const size = 32;
  const step = icon.w / size;
  const tab = new Img(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0];
      for (let dy = 0; dy < step; dy += 1) {
        for (let dx = 0; dx < step; dx += 1) {
          const i = ((y * step + dy) * icon.w + (x * step + dx)) * 4;
          for (let c = 0; c < 3; c += 1) sum[c] += icon.data[i + c] ?? 0;
        }
      }
      tab.set(x, y, sum.map((v) => Math.round(v / (step * step))));
    }
  }
  writeFileSync(fileURLToPath(new URL('../media/farm-tab.png', import.meta.url)), encodePng(tab.w, tab.h, tab.data));
}

void BRAND;
console.log(`atlas: ${frames.size} frames, ${sheet.w}x${sheet.h}; ui: ${ui.size} frames`);
