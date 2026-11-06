import { Container } from 'pixi.js';
import type { MapFarm } from '../engine/farming/farm';
import type { CropDef } from '../engine/farming/types';
import type { Rect } from '../engine/math/coords';
import type { Season } from '../engine/time/calendar';
import type { GameMap } from '../engine/world/gameMap';
import type { Atlas } from './atlas';
import { CropLayer } from './cropLayer';
import { ExtrasLayer } from './extrasLayer';
import { NodeLayer } from './nodeLayer';
import { ObjectLayer } from './objectLayer';
import { SoilLayer } from './soilLayer';
import { TerrainLayer } from './terrainLayer';

/**
 * Everything that draws one map: its ground, soil, objects and crops, stacked in drawing order under one root.
 * The renderer keeps a few of these and shows one at a time; actors (the farmer, villagers, animals) are moved
 * into the layers of whichever map is showing.
 */
export class MapView {
  readonly root: Container;
  readonly terrain: TerrainLayer;
  readonly objects: ObjectLayer;
  private readonly soil: SoilLayer;
  private readonly crops: CropLayer;
  private readonly nodes: NodeLayer;
  private readonly extras: ExtrasLayer;

  constructor(
    readonly map: GameMap,
    atlas: Atlas,
    crops: (id: string) => CropDef | undefined,
    season: Season = 'spring',
  ) {
    this.root = new Container({ label: map.id });
    this.terrain = new TerrainLayer(map, atlas);
    this.objects = new ObjectLayer(map, atlas, season);
    this.soil = new SoilLayer(atlas);
    this.crops = new CropLayer(atlas, this.objects.entities, crops);
    this.nodes = new NodeLayer(atlas, this.objects.entities, map);
    this.extras = new ExtrasLayer(atlas, this.objects, map);
    this.root.addChild(this.terrain.container, this.soil.container, this.objects.floor, this.objects.shadows, this.objects.entities, this.objects.effects);
  }

  /** @param view the visible part of the world  @param seconds the animation clock  @param frame the frame counter  @param dt seconds since the last frame */
  update(farm: MapFarm, view: Rect, seconds: number, frame: number, dt: number, animate: boolean): void {
    this.terrain.update(view, seconds, frame);
    this.soil.update(farm);
    this.crops.update(farm);
    this.nodes.update();
    this.extras.update();
    this.objects.update(view, dt, animate);
  }

  destroy(): void {
    this.terrain.destroy();
    this.soil.destroy();
    this.crops.destroy();
    this.nodes.destroy();
    this.extras.destroy();
    this.objects.destroy();
    this.root.destroy();
  }
}
