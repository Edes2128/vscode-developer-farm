import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../engine/math/coords';
import type { GameMap } from '../engine/world/gameMap';
import type { Atlas } from './atlas';

/**
 * Draws the rocks and ore standing on a map. They join the depth-sorted layer (so the farmer walks behind a tall crystal) and
 * are looked at again only when the map says a node was hit or broken (`nodeVersion`).
 */
export class NodeLayer {
  private readonly sprites = new Map<number, Sprite>();
  private seenVersion = -1;

  constructor(
    private readonly atlas: Atlas,
    private readonly parent: Container,
    private readonly map: GameMap,
  ) {}

  update(): void {
    if (this.map.nodeVersion === this.seenVersion) return;
    this.seenVersion = this.map.nodeVersion;

    const live = new Set<number>();
    for (const [key, node] of this.map.nodes) {
      live.add(key);
      let sprite = this.sprites.get(key);
      if (sprite === undefined) {
        sprite = new Sprite(this.atlas.texture(node.def.frame));
        sprite.position.set(node.x * TILE_SIZE, node.y * TILE_SIZE);
        // Sorted a little above the middle of the cell, like crops: someone standing below it is in front.
        sprite.zIndex = node.def.solid === false ? node.y * TILE_SIZE : node.y * TILE_SIZE + 10;
        this.sprites.set(key, sprite);
        this.parent.addChild(sprite);
      }
      // A node that has taken a hit shivers by a pixel, so a swing visibly lands.
      sprite.x = node.x * TILE_SIZE + (node.hits < node.def.hits && node.hits % 2 === 0 ? 1 : 0);
    }
    for (const [key, sprite] of this.sprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.sprites.delete(key);
    }
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}
