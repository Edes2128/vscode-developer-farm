import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../engine/math/coords';
import type { GameMap, PlacedObject } from '../engine/world/gameMap';
import type { Atlas } from './atlas';

interface ExtraView {
  readonly sprite: Sprite;
  readonly shadow: Sprite | undefined;
}

/**
 * Draws what was put on a map after it was built: furniture, a finished building, its scaffolding. They are few, so they are
 * simply kept in step with the map's list whenever it says something changed (`objectsVersion`). Standing things join the
 * depth-sorted layer, a rug lies on the floor, and a shadow goes under whatever has one.
 */
export class ExtrasLayer {
  private readonly views = new Map<number, ExtraView>();
  private seenVersion = -1;

  constructor(
    private readonly atlas: Atlas,
    private readonly layers: { readonly entities: Container; readonly floor: Container; readonly shadows: Container },
    private readonly map: GameMap,
  ) {}

  update(): void {
    if (this.map.objectsVersion === this.seenVersion) return;
    this.seenVersion = this.map.objectsVersion;
    for (const [uid, object] of this.map.extras) if (!this.views.has(uid)) this.views.set(uid, this.build(object));
    for (const [uid, view] of this.views) {
      if (this.map.extras.has(uid)) continue;
      view.sprite.destroy();
      view.shadow?.destroy();
      this.views.delete(uid);
    }
  }

  private build(object: PlacedObject): ExtraView {
    const sprite = new Sprite(this.atlas.texture(object.frame));
    sprite.position.set(object.spriteX, object.spriteY);
    if (object.def.layer === 'floor') {
      this.layers.floor.addChild(sprite);
    } else {
      sprite.zIndex = object.sortY;
      this.layers.entities.addChild(sprite);
    }
    let shadow: Sprite | undefined;
    const def = object.def.shadow;
    if (def !== undefined) {
      shadow = new Sprite(this.atlas.texture(def.frame));
      shadow.position.set(object.x * TILE_SIZE + def.x, object.y * TILE_SIZE + def.y);
      this.layers.shadows.addChild(shadow);
    }
    return { sprite, shadow };
  }

  destroy(): void {
    for (const view of this.views.values()) {
      view.sprite.destroy();
      view.shadow?.destroy();
    }
    this.views.clear();
  }
}
