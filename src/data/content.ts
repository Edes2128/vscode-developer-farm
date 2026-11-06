import type { Content } from '../engine/world/types';
import { ANIMALS } from './animals';
import { CREATURES } from './creatures';
import { EXPANSION_OBJECTS, EXPANSION_TERRAINS } from './expansion';
import { CROPS } from './crops';
import { ITEMS } from './items';
import { NPCS } from './npcs';
import { OBJECTS } from './objects';
import { QUESTS } from './quests';
import { RECIPES } from './recipes';
import { REQUEST_POOL } from './requests';
import { BUILDINGS } from './buildings';
import { FESTIVALS } from './festivals';
import { FISH } from './fish';
import { MUSEUM } from './museum';
import { NODES } from './nodes';
import { MARLOW_MAPS, MARLOW_REGION } from './regions/marlow';
import { WHISPERING_WOOD } from './regions/whisperingWood/forest';
import { WINDCREST_MAPS, WINDCREST_REGION } from './regions/windcrest';
import { WHISPERING_WOOD_REGION } from './regions/whisperingWood/region';
import { HOME_FARM } from './regions/willowbrook/homeFarm';
import { FARMHOUSE, GENERAL_STORE, GREENHOUSE, MUSEUM_INTERIOR, TOBIAS_COTTAGE, WILLAS_COTTAGE } from './regions/willowbrook/interiors';
import { RIVERBANK } from './regions/willowbrook/riverbank';
import { VILLAGE_GREEN } from './regions/willowbrook/villageGreen';
import { WILLOWBROOK } from './regions/willowbrook/region';
import { ALL_SHOPS } from './shops';
import { TERRAINS } from './terrain';

/**
 * The content pack the game ships with. A new region is a new folder under src/data/regions/ and one line
 * here; no engine code changes. Future packs and expansions export a `Content` of their own.
 */
export const CONTENT: Content = {
  terrains: [...TERRAINS, ...EXPANSION_TERRAINS],
  objects: [...OBJECTS, ...EXPANSION_OBJECTS],
  items: ITEMS,
  crops: CROPS,
  shops: ALL_SHOPS,
  npcs: NPCS,
  animals: ANIMALS,
  quests: QUESTS,
  nodes: NODES,
  fish: FISH,
  recipes: RECIPES,
  buildings: BUILDINGS,
  museum: MUSEUM,
  festivals: FESTIVALS,
  requests: REQUEST_POOL,
  creatures: CREATURES,
  regions: [WILLOWBROOK, WHISPERING_WOOD_REGION, WINDCREST_REGION, MARLOW_REGION],
  maps: [HOME_FARM, VILLAGE_GREEN, FARMHOUSE, GREENHOUSE, MUSEUM_INTERIOR, WILLAS_COTTAGE, TOBIAS_COTTAGE, GENERAL_STORE, RIVERBANK, WHISPERING_WOOD, ...WINDCREST_MAPS, ...MARLOW_MAPS],
  startMap: HOME_FARM.id,
  // What a new farmer arrives with. Saves migrated from version 1 get the same (see migrations.ts).
  newGame: {
    money: 150,
    items: [
      { id: 'hoe', count: 1 },
      { id: 'watering_can', count: 1 },
      { id: 'radish_seeds', count: 5 },
      { id: 'strawberry_seeds', count: 3 },
    ],
  },
};
