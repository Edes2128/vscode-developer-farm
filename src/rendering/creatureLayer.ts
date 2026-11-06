import { Container, Sprite } from 'pixi.js';
import type { CreaturePlacement } from '../engine/creatures/types';
import { TILE_SIZE } from '../engine/math/coords';
import type { Atlas } from './atlas';

/** How long each of a creature's two idle pictures shows, in seconds. */
const IDLE_SECONDS = 0.7;

/**
 * The rare creatures standing on the map being shown: a two-picture idle each, turned towards the player. The game decides which
 * are about and where; this only draws them. They share the depth-sorted layer with objects and the farmer, so one can stand
 * behind a tree. (Reduced motion: still, on the first picture.)
 */
export class CreatureLayer {
  private readonly sprites = new Map<string, Sprite>();
  private entities: Container | undefined;

  constructor(private readonly atlas: Atlas) {}

  /** Moves the creatures into the depth-sorted layer of the map now showing. */
  attach(entities: Container): void {
    this.entities = entities;
    for (const sprite of this.sprites.values()) entities.addChild(sprite);
  }

  /**
   * @param here the creatures about  @param stems the atlas stem of each creature id  @param player the player's feet, in world pixels
   * @param seconds the animation clock  @param animate false for reduced motion
   */
  update(here: readonly CreaturePlacement[], stems: (id: string) => string | undefined, player: { x: number; y: number }, seconds: number, animate: boolean): void {
    const wanted = new Set<string>();
    for (const placement of here) {
      const stem = stems(placement.creature);
      if (stem === undefined) continue;
      wanted.add(placement.creature);
      const picture = animate ? Math.floor(seconds / IDLE_SECONDS + placement.x) % 2 : 0;
      const texture = this.atlas.texture(`creature/${stem}_${picture}`);
      let sprite = this.sprites.get(placement.creature);
      if (sprite === undefined) {
        sprite = new Sprite(texture);
        this.sprites.set(placement.creature, sprite);
        this.entities?.addChild(sprite);
      } else {
        sprite.texture = texture;
      }
      sprite.zIndex = (placement.y + 1) * TILE_SIZE;
      // Drawn facing right: mirrored when the player is on its left.
      const faceLeft = player.x < placement.x * TILE_SIZE + TILE_SIZE / 2;
      sprite.scale.x = faceLeft ? -1 : 1;
      sprite.position.set(placement.x * TILE_SIZE + (faceLeft ? TILE_SIZE : 0), placement.y * TILE_SIZE);
    }
    for (const [id, sprite] of this.sprites) {
      if (wanted.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}
