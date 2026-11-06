import type { BuildingDef } from '../buildings/types';
import type { RecipeDef } from '../crafting/types';
import type { ShopDef } from '../economy/types';
import type { CreatureDef } from '../creatures/types';
import type { CropDef } from '../farming/types';
import type { FestivalDef } from '../festivals/types';
import type { FishDef } from '../fishing/types';
import type { ItemDef } from '../items/types';
import type { NodeDef } from '../nodes/types';
import type { QuestDef } from '../quests/types';
import type { AnimalDef } from '../ranch/types';
import type { NpcDef } from '../social/types';
import type { Content, MapDef, ObjectDef, RegionDef, TerrainDef } from './types';

/** Lookup tables over a content pack. Building one also rejects duplicate ids and glyphs. */
export class ContentIndex {
  readonly terrainById = new Map<string, TerrainDef>();
  readonly terrainByGlyph = new Map<string, TerrainDef>();
  readonly objectById = new Map<string, ObjectDef>();
  readonly itemById = new Map<string, ItemDef>();
  readonly cropById = new Map<string, CropDef>();
  readonly shopById = new Map<string, ShopDef>();
  readonly npcById = new Map<string, NpcDef>();
  readonly animalById = new Map<string, AnimalDef>();
  readonly questById = new Map<string, QuestDef>();
  readonly nodeById = new Map<string, NodeDef>();
  readonly festivalById = new Map<string, FestivalDef>();
  readonly creatureById = new Map<string, CreatureDef>();
  readonly buildingById = new Map<string, BuildingDef>();
  readonly recipeById = new Map<string, RecipeDef>();
  readonly fishById = new Map<string, FishDef>();
  readonly regionById = new Map<string, RegionDef>();
  readonly mapById = new Map<string, MapDef>();

  constructor(readonly content: Content) {
    for (const terrain of content.terrains) {
      unique(this.terrainById, terrain.id, terrain, 'terrain');
      unique(this.terrainByGlyph, terrain.glyph, terrain, 'terrain glyph');
    }
    for (const object of content.objects) unique(this.objectById, object.id, object, 'object');
    for (const item of content.items) unique(this.itemById, item.id, item, 'item');
    for (const crop of content.crops) unique(this.cropById, crop.id, crop, 'crop');
    for (const shop of content.shops) unique(this.shopById, shop.id, shop, 'shop');
    for (const npc of content.npcs) unique(this.npcById, npc.id, npc, 'villager');
    for (const animal of content.animals) unique(this.animalById, animal.id, animal, 'animal');
    for (const quest of content.quests) unique(this.questById, quest.id, quest, 'quest');
    for (const node of content.nodes) unique(this.nodeById, node.id, node, 'node');
    for (const building of content.buildings) unique(this.buildingById, building.id, building, 'building');
    for (const recipe of content.recipes) unique(this.recipeById, recipe.id, recipe, 'recipe');
    for (const festival of content.festivals) unique(this.festivalById, festival.id, festival, 'festival');
    for (const creature of content.creatures) unique(this.creatureById, creature.id, creature, 'creature');
    for (const fish of content.fish) unique(this.fishById, fish.id, fish, 'fish');
    for (const region of content.regions) unique(this.regionById, region.id, region, 'region');
    for (const map of content.maps) unique(this.mapById, map.id, map, 'map');
  }
}

function unique<T>(table: Map<string, T>, key: string, value: T, what: string): void {
  if (table.has(key)) throw new Error(`Duplicate ${what} "${key}" in content`);
  table.set(key, value);
}
