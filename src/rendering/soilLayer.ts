import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../engine/math/coords';
import type { MapFarm } from '../engine/farming/farm';
import { terrainMask } from '../engine/world/autotile';
import type { Atlas } from './atlas';
import { soilFrame } from './frameNames';

const FERTILIZED_TINT = 0xc9b08e;

/**
 * Draws the tilled soil. It is rebuilt from the farm whenever the farm says it changed (`version`), and not
 * otherwise, so an idle field costs nothing. Soil joins up with its neighbours like terrain does, and is darker
 * where it has been watered.
 */
export class SoilLayer {
  readonly container = new Container({ label: 'soil' });
  private readonly sprites = new Map<number, Sprite>();
  private farm: MapFarm | undefined;
  private seenVersion = -1;

  constructor(private readonly atlas: Atlas) {}

  update(farm: MapFarm): void {
    if (farm === this.farm && farm.version === this.seenVersion) return;
    if (farm !== this.farm) this.clear();
    this.farm = farm;
    this.seenVersion = farm.version;

    const live = new Set<number>();
    for (const cell of farm.soil.values()) {
      const key = cell.y * farm.width + cell.x;
      live.add(key);
      const mask = terrainMask(cell.x, cell.y, farm.width, farm.height, (x, y) => farm.isTilled(x, y));
      const texture = this.atlas.texture(soilFrame(cell.watered ? 'wet' : 'dry', mask));
      let sprite = this.sprites.get(key);
      if (sprite === undefined) {
        sprite = new Sprite(texture);
        sprite.position.set(cell.x * TILE_SIZE, cell.y * TILE_SIZE);
        this.sprites.set(key, sprite);
        this.container.addChild(sprite);
      } else {
        sprite.texture = texture;
      }
      // Fertilized soil is richer: a little darker and warmer than plain earth.
      sprite.tint = cell.fertilized ? FERTILIZED_TINT : 0xffffff;
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
    this.container.destroy({ children: true });
    this.sprites.clear();
  }
}
