import { Container, Sprite } from 'pixi.js';
import type { MapFarm } from '../engine/farming/farm';
import { TILE_SIZE } from '../engine/math/coords';
import type { CropDef } from '../engine/farming/types';
import type { Atlas } from './atlas';

/**
 * Draws the growing crops. They join the depth-sorted layer, so the farmer walks behind a tall sunflower and in
 * front of a seedling. Like the soil, they are rebuilt only when the farm changes.
 */
export class CropLayer {
  private readonly sprites = new Map<number, Sprite>();
  private farm: MapFarm | undefined;
  private seenVersion = -1;

  constructor(
    private readonly atlas: Atlas,
    private readonly parent: Container,
    private readonly crops: (id: string) => CropDef | undefined,
  ) {}

  update(farm: MapFarm): void {
    if (farm === this.farm && farm.version === this.seenVersion) return;
    if (farm !== this.farm) this.clear();
    this.farm = farm;
    this.seenVersion = farm.version;

    const live = new Set<number>();
    for (const crop of farm.crops.values()) {
      const def = this.crops(crop.crop);
      const frame = def?.frames[crop.stage];
      if (frame === undefined) continue;
      const key = crop.y * farm.width + crop.x;
      live.add(key);
      const texture = this.atlas.texture(frame);
      let sprite = this.sprites.get(key);
      if (sprite === undefined) {
        sprite = new Sprite(texture);
        this.sprites.set(key, sprite);
        this.parent.addChild(sprite);
      } else {
        sprite.texture = texture;
      }
      // The picture's bottom edge sits on the bottom of its cell: tall plants grow upwards into the cells above.
      sprite.position.set(crop.x * TILE_SIZE, (crop.y + 1) * TILE_SIZE - texture.height);
      // Sorted a little above the middle of the cell: a farmer standing in the lower half is in front.
      sprite.zIndex = crop.y * TILE_SIZE + 10;
    }
    for (const [key, sprite] of this.sprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.sprites.delete(key);
    }
  }

  private clear(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  destroy(): void {
    this.clear();
  }
}
