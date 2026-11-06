import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../engine/math/coords';
import type { Atlas } from './atlas';
import { TOKEN_FRAME } from './frameNames';

/**
 * Things lying on the ground to be picked up: today's painted eggs at the Egg Hunt. They are drawn where the game says they are
 * and bob a little (still, with reduced motion). The game decides what they are and picks them up when the player steps on one.
 */
export class TokenLayer {
  private readonly sprites = new Map<number, Sprite>();
  private entities: Container | undefined;

  constructor(private readonly atlas: Atlas) {}

  /** Moves the eggs into the depth-sorted layer of the map now showing. */
  attach(entities: Container): void {
    this.entities = entities;
    for (const sprite of this.sprites.values()) entities.addChild(sprite);
  }

  /** @param eggs the cells that have an egg  @param seconds the animation clock  @param animate false for reduced motion */
  update(eggs: readonly { readonly x: number; readonly y: number }[], seconds: number, animate: boolean): void {
    const wanted = new Set<number>();
    for (const egg of eggs) {
      const key = egg.y * 1000 + egg.x;
      wanted.add(key);
      let sprite = this.sprites.get(key);
      if (sprite === undefined) {
        sprite = new Sprite(this.atlas.texture(TOKEN_FRAME));
        sprite.zIndex = egg.y * TILE_SIZE + TILE_SIZE - 1;
        this.sprites.set(key, sprite);
        this.entities?.addChild(sprite);
      }
      const bob = animate ? Math.round(Math.sin(seconds * 3 + egg.x * 1.7 + egg.y) * 0.6) : 0;
      sprite.position.set(egg.x * TILE_SIZE, egg.y * TILE_SIZE + bob);
    }
    for (const [key, sprite] of this.sprites) {
      if (wanted.has(key)) continue;
      sprite.destroy();
      this.sprites.delete(key);
    }
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}
