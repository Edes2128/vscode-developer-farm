import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE, type Rect } from '../engine/math/coords';
import type { GameMap, PlacedObject } from '../engine/world/gameMap';
import type { Atlas } from './atlas';
import type { Season } from '../engine/time/calendar';
import { SMOKE_FRAMES } from './frameNames';

/** Objects within this many pixels of the view still get drawn, so tall sprites never pop at the edge. */
const CULL_MARGIN = 24;

interface ObjectView {
  readonly sprite: Sprite;
  readonly shadow: Sprite | undefined;
  readonly rect: Rect;
}

interface Puff {
  readonly sprite: Sprite;
  age: number;
  alive: boolean;
  /** Where it left the chimney. */
  originX: number;
  originY: number;
}

interface Emitter {
  readonly x: number;
  readonly y: number;
  nextPuff: number;
}

const PUFF_LIFETIME = 3.2;
const PUFF_INTERVAL = 0.7;
const PUFF_RISE = 7; // pixels per second

/**
 * Everything that stands or lies on the ground: floor pieces (a bridge), shadows, depth-sorted
 * objects, and the smoke from chimneys. Only what is in view is drawn.
 */
export class ObjectLayer {
  readonly floor = new Container({ label: 'floor' });
  readonly shadows = new Container({ label: 'shadows' });
  /** Depth-sorted by `zIndex`: the player's sprite is added here too, so they can walk behind things. */
  readonly entities = new Container({ label: 'entities' });
  readonly effects = new Container({ label: 'effects' });

  private readonly views: ObjectView[] = [];
  private readonly emitters: Emitter[] = [];
  private readonly puffs: Puff[] = [];

  /** Counter for the debug overlay. */
  visibleObjects = 0;

  constructor(
    map: GameMap,
    private readonly atlas: Atlas,
    private readonly season: Season = 'spring',
  ) {
    this.entities.sortableChildren = true;
    for (const object of map.objects) {
      if (object.def.layer === 'ground') continue; // decals are painted into the terrain chunks
      this.add(object);
    }
  }

  private add(object: PlacedObject): void {
    // Some things change with the season (an oak turns in autumn): the list is data, the choice among a few frames follows the cell.
    const alt = object.def.seasonal?.[this.season];
    const frame = alt === undefined || alt.length === 0 ? object.frame : (alt[(object.x * 7 + object.y * 13) % alt.length] ?? object.frame);
    const texture = this.atlas.texture(frame);
    const sprite = new Sprite(texture);
    sprite.position.set(object.spriteX, object.spriteY);
    let rect: Rect = { x: object.spriteX, y: object.spriteY, w: texture.width, h: texture.height };

    if (object.def.layer === 'floor') {
      this.floor.addChild(sprite);
    } else {
      sprite.zIndex = object.sortY;
      this.entities.addChild(sprite);
    }

    let shadow: Sprite | undefined;
    const def = object.def.shadow;
    if (def !== undefined) {
      shadow = new Sprite(this.atlas.texture(def.frame));
      shadow.position.set(object.x * TILE_SIZE + def.x, object.y * TILE_SIZE + def.y);
      this.shadows.addChild(shadow);
      // The visible area covers the shadow too.
      const sx = shadow.x;
      const sy = shadow.y;
      const x0 = Math.min(rect.x, sx);
      const y0 = Math.min(rect.y, sy);
      rect = { x: x0, y: y0, w: Math.max(rect.x + rect.w, sx + shadow.width) - x0, h: Math.max(rect.y + rect.h, sy + shadow.height) - y0 };
    }
    this.views.push({ sprite, shadow, rect });

    const smoke = object.def.smoke;
    if (smoke !== undefined) {
      this.emitters.push({ x: object.x * TILE_SIZE + smoke.x, y: object.y * TILE_SIZE + smoke.y, nextPuff: 0 });
    }
  }

  /** @param view the visible part of the world  @param dt seconds since the last frame  @param animate false for reduced motion */
  update(view: Rect, dt: number, animate: boolean): void {
    const left = view.x - CULL_MARGIN;
    const top = view.y - CULL_MARGIN;
    const right = view.x + view.w + CULL_MARGIN;
    const bottom = view.y + view.h + CULL_MARGIN;
    let visible = 0;
    for (const v of this.views) {
      const inView = v.rect.x < right && v.rect.x + v.rect.w > left && v.rect.y < bottom && v.rect.y + v.rect.h > top;
      v.sprite.visible = inView;
      if (v.shadow !== undefined) v.shadow.visible = inView;
      if (inView) visible += 1;
    }
    this.visibleObjects = visible;
    this.updateSmoke(view, dt, animate);
  }

  private updateSmoke(view: Rect, dt: number, animate: boolean): void {
    for (const puff of this.puffs) {
      if (!puff.alive) continue;
      puff.age += dt;
      if (puff.age >= PUFF_LIFETIME) {
        puff.alive = false;
        puff.sprite.visible = false;
        continue;
      }
      const t = puff.age / PUFF_LIFETIME;
      puff.sprite.texture = this.atlas.texture(SMOKE_FRAMES[Math.min(SMOKE_FRAMES.length - 1, Math.floor(t * SMOKE_FRAMES.length))] as string);
      puff.sprite.alpha = 0.85 * (1 - t);
    }
    if (!animate) return;

    for (const emitter of this.emitters) {
      const near = emitter.x > view.x - 40 && emitter.x < view.x + view.w + 40 && emitter.y > view.y - 120 && emitter.y < view.y + view.h + 40;
      if (!near) continue;
      emitter.nextPuff -= dt;
      if (emitter.nextPuff > 0) continue;
      emitter.nextPuff = PUFF_INTERVAL;
      const puff = this.puffs.find((p) => !p.alive) ?? this.newPuff();
      puff.age = 0;
      puff.alive = true;
      puff.sprite.visible = true;
      puff.originX = emitter.x;
      puff.originY = emitter.y;
      puff.sprite.position.set(emitter.x, emitter.y);
    }
    // Rising, swaying drift, snapped to whole pixels so the smoke stays crisp.
    for (const puff of this.puffs) {
      if (!puff.alive) continue;
      puff.sprite.x = Math.round(puff.originX - 4 + Math.sin(puff.age * 1.6) * 3);
      puff.sprite.y = Math.round(puff.originY - 4 - puff.age * PUFF_RISE);
    }
  }

  private newPuff(): Puff {
    const sprite = new Sprite(this.atlas.texture(SMOKE_FRAMES[0] as string));
    sprite.visible = false;
    this.effects.addChild(sprite);
    const puff: Puff = { sprite, age: 0, alive: false, originX: 0, originY: 0 };
    this.puffs.push(puff);
    return puff;
  }

  destroy(): void {
    for (const container of [this.floor, this.shadows, this.entities, this.effects]) container.destroy({ children: true });
  }
}
