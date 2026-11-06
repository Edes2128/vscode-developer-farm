/**
 * The data model of the world: what terrain, objects, maps and regions look like as plain data.
 *
 * Nothing here holds behaviour. Content packs (src/data) export values of these types, the engine
 * turns them into running maps, and the renderer turns frame names into sprites. Adding a region or an
 * object means adding data, not changing systems.
 */
import type { CropDef } from '../farming/types';
import type { Season } from '../time/calendar';
import type { BuildingDef, BuildSite } from '../buildings/types';
import type { RecipeDef, Station } from '../crafting/types';
import type { CreatureDef } from '../creatures/types';
import type { FestivalDef } from '../festivals/types';
import type { RequestPool } from '../requests/types';
import type { MuseumDef } from '../museum/types';
import type { FishDef, FishingZone } from '../fishing/types';
import type { NodeDef, NodeSpawn } from '../nodes/types';
import type { QuestDef } from '../quests/types';
import type { AnimalDef, RanchConfig } from '../ranch/types';
import type { Condition, NpcDef } from '../social/types';
import type { ShopDef } from '../economy/types';
import type { ItemDef } from '../items/types';
import type { Direction } from '../math/coords';

// ------------------------------------------------------------------------------------------ terrain

export type TerrainId = string;

export interface TerrainDef {
  readonly id: TerrainId;
  readonly name: string;
  /** The single character that stands for this terrain in a map's ASCII layout. */
  readonly glyph: string;
  /**
   * `base` terrain fills the whole cell and picks one of `variants` by cell hash.
   * `autotile` terrain is drawn over the base and shapes itself to its neighbours.
   */
  readonly render: 'base' | 'autotile';
  /** Atlas frame stem: `terrain/<frames>_...`. */
  readonly frames: string;
  readonly variants: number;
  /** 1 means a still image. */
  readonly animationFrames: number;
  readonly animationFps: number;
  /** The player cannot walk here (water). Objects can open a way over it (a bridge). */
  readonly solid: boolean;
  /** An autotile whose centre tile covers the base completely, so the base need not be drawn under it. */
  readonly opaque: boolean;
  /** The watering can can be refilled from here (a river, a pond). */
  readonly waterSource?: boolean;
  /** What a footstep on it sounds like. Anything not given sounds like grass. */
  readonly footstep?: 'step_dirt' | 'step_wood' | 'step_stone';
}

// ------------------------------------------------------------------------------------------ objects

/**
 * One cell an object occupies, relative to its anchor cell.
 * `solid` blocks the player; `open` makes a cell walkable even where the terrain is not (a bridge).
 */
export interface FootprintCell {
  readonly dx: number;
  readonly dy: number;
  readonly mode: 'solid' | 'open';
}

/** What interacting does beyond showing a message. */
export type InteractAction =
  /** Offers to turn in for the night. */
  | { readonly kind: 'sleep' }
  /** Opens a stall's offers (`ShopDef.id`). */
  | { readonly kind: 'shop'; readonly shop: string }
  /** Ships the selected stack. Payment arrives in the morning. */
  | { readonly kind: 'ship' }
  /** The coop: see the animals and collect the eggs. */
  | { readonly kind: 'coop' }
  /** The trough: pour in feed. */
  | { readonly kind: 'trough' }
  /** A kitchen or workbench: make things from what the pockets hold. */
  | { readonly kind: 'craft'; readonly station: Station }
  /** A display case: give the museum something for its collection. */
  | { readonly kind: 'museum' }
  /** A bed: turn in for the night. */
  | { readonly kind: 'bed' }
  /** The notice board: today's requests. */
  | { readonly kind: 'board' };

export interface InteractDef {
  /** The verb shown on the prompt: "Inspect", "Read". */
  readonly verb: string;
  /** Heading of the message box. */
  readonly title: string;
  /** Message pages, shown one after another. */
  readonly lines: readonly string[];
  /** Cells (relative to the anchor) that can be interacted with. Defaults to every solid footprint cell. */
  readonly cells?: readonly { readonly dx: number; readonly dy: number }[];
  readonly action?: InteractAction;
}

export interface ShadowDef {
  readonly frame: string;
  /** Offset of the shadow sprite's top-left from the anchor cell's top-left, in pixels. */
  readonly x: number;
  readonly y: number;
}

export interface SmokeEmitterDef {
  /** Where the smoke leaves, from the anchor cell's top-left, in pixels. */
  readonly x: number;
  readonly y: number;
}

export interface ObjectDef {
  readonly id: string;
  readonly name: string;
  /**
   * `ground` objects are decals painted onto the terrain; `floor` objects lie on the ground under everything
   * that stands (a bridge); `standing` objects are depth-sorted with the player, so you can walk behind them.
   */
  readonly layer: 'ground' | 'floor' | 'standing';
  /** One frame for every placement, or several to choose from by cell hash. */
  readonly frames?: readonly string[];
  /** Frames to draw instead in a season (an oak turning in autumn); the same size and anchor as `frames`. Any season not listed uses `frames`. */
  readonly seasonal?: Partial<Record<Season, readonly string[]>>;
  /** For fences and walls: the frame is `<framePrefix><mask>`, picked from the 4 neighbours in the same group. */
  readonly connect?: { readonly group: string; readonly framePrefix: string };
  /** Pixel offset of the anchor cell's top-left inside the sprite. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly footprint: readonly FootprintCell[];
  readonly shadow?: ShadowDef;
  readonly interact?: InteractDef;
  readonly smoke?: SmokeEmitterDef;
  /** The watering can can be refilled from this object's footprint (a well). */
  readonly waterSource?: boolean;
  /** A sprinkler: every night it waters the tilled soil within this many cells of it (all around, diagonals too). */
  readonly sprinkles?: number;
}

// ------------------------------------------------------------------------------------------ maps

export interface MapObjectPlacement {
  readonly def: string;
  /** Anchor cell. */
  readonly x: number;
  readonly y: number;
}

/** Sprinkles decals over matching terrain. Deterministic: the same seed gives the same meadow. */
export interface ScatterRule {
  /** Object ids (layer `ground`) to choose from. */
  readonly defs: readonly string[];
  /** Chance per eligible cell, 0 to 1. */
  readonly density: number;
  /** Terrain ids the decals may sit on. */
  readonly on: readonly TerrainId[];
  readonly seed: number;
  /** Limits the rule to a rectangle of cells. */
  readonly area?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface SpawnPoint {
  /** Tile the player stands on. */
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

export interface MapDef {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** `height` strings of `width` terrain glyphs. */
  readonly terrain: readonly string[];
  /** `height` strings of `width` prop glyphs (see `propLegend`); `.` is empty. */
  readonly props: readonly string[];
  /** Prop glyph -> object id. Multi-cell objects sit on their anchor cell. */
  readonly propLegend: Readonly<Record<string, string>>;
  /** Extra placements by anchor cell, for anything that is awkward to draw in ASCII. */
  readonly objects?: readonly MapObjectPlacement[];
  readonly scatter: readonly ScatterRule[];
  readonly spawn: SpawnPoint;
  /** Rectangles of cells where the soil can be worked. Decals are never scattered here. */
  readonly tillable?: readonly CellRect[];
  /** Ways off this map: stepping on one takes the player (and villagers) to another map. */
  readonly exits?: readonly ExitDef[];
  /** Where this map keeps farm animals. */
  readonly ranch?: RanchConfig;
  /**
   * What the light is like: `outdoor` follows the time of day, `indoor` is a steady warm lamp light, `cave` is dim and cool.
   * Defaults to `outdoor`.
   */
  readonly ambient?: 'outdoor' | 'indoor' | 'cave';
  /** Nodes (rocks, ore) the map starts with. A pickaxe breaks them; the map comes back whole the next morning. */
  readonly nodes?: readonly NodeSpawn[];
  /** Stretches of water where a fishing rod can be cast. */
  readonly fishing?: readonly FishingZone[];
  /** Under glass or a roof of its own: crops here ignore the seasons and never wither. */
  readonly sheltered?: boolean;
  /** Furniture can be placed here (and picked up again): the farmhouse. */
  readonly decorate?: boolean;
  /** Where buildings can be put up on this map. */
  readonly sites?: readonly BuildSite[];
  /** Dig spots: each morning a few cells in these areas hold something buried, which the hoe uncovers. */
  readonly dig?: DigConfig;
}

/** Where, how many and what: part of `MapDef`. */
export interface DigConfig {
  /** The areas (cells) spots may appear in. Only open ground with nothing standing on it is used. */
  readonly areas: readonly CellRect[];
  /** How many spots there are each day. */
  readonly count: number;
  /** What a spot can hold, by weight (`ItemDef.id`, artifacts). */
  readonly artifacts: readonly { readonly item: string; readonly weight: number }[];
}

/** A strip of cells that leads to another map. Arrival cells are never inside an exit, so nobody bounces back. */
export interface ExitDef extends CellRect {
  readonly to: { readonly map: string; readonly x: number; readonly y: number; readonly facing: Direction };
}

export interface CellRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// ------------------------------------------------------------------------------------------ regions

/**
 * How a region becomes reachable. `conditions` are the same conditions dialogue uses (a quest done, hearts, a flag...);
 * until they all hold, an exit into the region turns the player back with `message`.
 */
export type UnlockRequirement =
  | { readonly kind: 'always' }
  | { readonly kind: 'conditions'; readonly all: readonly Condition[]; readonly message: string };

export interface RegionDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly biome: string;
  readonly unlock: UnlockRequirement;
  readonly startMap: string;
}

/** What a new game starts with. */
export interface NewGameDef {
  readonly money: number;
  /** Items in the order they are placed in the inventory. */
  readonly items: readonly { readonly id: string; readonly count: number }[];
}

/** Everything a content pack provides. */
export interface Content {
  readonly terrains: readonly TerrainDef[];
  readonly objects: readonly ObjectDef[];
  readonly items: readonly ItemDef[];
  readonly crops: readonly CropDef[];
  readonly shops: readonly ShopDef[];
  readonly npcs: readonly NpcDef[];
  readonly animals: readonly AnimalDef[];
  readonly quests: readonly QuestDef[];
  readonly nodes: readonly NodeDef[];
  readonly fish: readonly FishDef[];
  readonly recipes: readonly RecipeDef[];
  readonly buildings: readonly BuildingDef[];
  /** The village museum, if the pack has one. */
  readonly museum?: MuseumDef;
  /** The festivals on the calendar, and what the notice board might ask for. */
  readonly festivals: readonly FestivalDef[];
  readonly requests: RequestPool;
  /** The rare creatures of the wild, and where and when they can be met. */
  readonly creatures: readonly CreatureDef[];
  readonly regions: readonly RegionDef[];
  readonly maps: readonly MapDef[];
  /** The map a new game starts on. */
  readonly startMap: string;
  readonly newGame: NewGameDef;
}
