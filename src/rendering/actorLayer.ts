import { Container, Sprite } from 'pixi.js';
import type { Game } from '../engine/game';
import { walkFrame } from '../engine/player/player';
import { animalFrame, characterFrame, type AnimalPose } from '../engine/world/frames';
import type { Atlas } from './atlas';
import { SHADOW_PLAYER_FRAME, SHADOW_SMALL_FRAME } from './frameNames';

interface ActorView {
  readonly body: Sprite;
  readonly shadow: Sprite;
}

/** How fast a hen's legs and beak move, in pictures per second. */
const WALK_FPS = 6;
const PECK_FPS = 3;

/**
 * The villagers and animals on the map being shown. Sprites are made when someone arrives and dropped when they leave
 * or the player goes elsewhere. They share the depth-sorted layer with objects and the farmer, so people walk
 * behind a tree and in front of a fence.
 */
export class ActorLayer {
  private readonly villagers = new Map<string, ActorView>();
  private readonly animals = new Map<string, ActorView>();
  private entities: Container | undefined;
  private shadows: Container | undefined;

  constructor(private readonly atlas: Atlas) {}

  /** Moves everyone into the layers of the map now showing. */
  attach(entities: Container, shadows: Container): void {
    this.entities = entities;
    this.shadows = shadows;
    for (const view of [...this.villagers.values(), ...this.animals.values()]) {
      entities.addChild(view.body);
      shadows.addChild(view.shadow);
    }
  }

  /** @param seconds the animation clock */
  update(game: Game, seconds: number): void {
    this.updateVillagers(game);
    this.updateAnimals(game, seconds);
  }

  private updateVillagers(game: Game): void {
    const here = game.villagersHere();
    const present = new Set<string>();
    for (const state of here) {
      const def = game.villagers.def(state.id);
      if (def === undefined) continue;
      present.add(state.id);
      const view = this.villagers.get(state.id) ?? this.add(this.villagers, state.id, characterFrame(def.sprite, state.facing, false, 0), SHADOW_PLAYER_FRAME);
      view.body.texture = this.atlas.texture(characterFrame(def.sprite, state.facing, state.moving, walkFrame(state.stride)));
      const x = Math.round(state.x);
      const y = Math.round(state.y);
      view.body.position.set(x, y);
      view.body.zIndex = y;
      view.shadow.position.set(x, y - 2);
    }
    this.drop(this.villagers, present);
  }

  private updateAnimals(game: Game, seconds: number): void {
    const ranch = game.ranchHere();
    const present = new Set<string>();
    for (const animal of ranch?.animals ?? []) {
      const stem = game.world.index.animalById.get(animal.kind)?.sprite;
      if (stem === undefined) continue;
      present.add(animal.id);
      const view = this.animals.get(animal.id) ?? this.add(this.animals, animal.id, animalFrame(stem, 'idle'), SHADOW_SMALL_FRAME);
      const pose: AnimalPose =
        animal.mode === 'walk' ? (Math.floor(seconds * WALK_FPS) % 2 === 0 ? 'walk_0' : 'walk_1')
        : animal.mode === 'peck' ? (Math.floor(seconds * PECK_FPS) % 2 === 0 ? 'peck_0' : 'peck_1')
        : 'idle';
      view.body.texture = this.atlas.texture(animalFrame(stem, pose));
      // The pictures face right; mirror them to face left.
      view.body.scale.x = animal.facing === 'left' ? -1 : 1;
      const x = Math.round(animal.x);
      const y = Math.round(animal.y);
      view.body.position.set(x, y);
      view.body.zIndex = y;
      view.shadow.position.set(x, y - 1);
    }
    this.drop(this.animals, present);
  }

  private add(into: Map<string, ActorView>, id: string, frame: string, shadowFrame: string): ActorView {
    const body = new Sprite(this.atlas.texture(frame));
    body.anchor.set(0.5, 1);
    const shadow = new Sprite(this.atlas.texture(shadowFrame));
    shadow.anchor.set(0.5, 0.5);
    this.entities?.addChild(body);
    this.shadows?.addChild(shadow);
    const view: ActorView = { body, shadow };
    into.set(id, view);
    return view;
  }

  private drop(from: Map<string, ActorView>, keep: ReadonlySet<string>): void {
    for (const [id, view] of from) {
      if (keep.has(id)) continue;
      view.body.destroy();
      view.shadow.destroy();
      from.delete(id);
    }
  }

  destroy(): void {
    for (const view of [...this.villagers.values(), ...this.animals.values()]) {
      view.body.destroy();
      view.shadow.destroy();
    }
    this.villagers.clear();
    this.animals.clear();
  }
}
