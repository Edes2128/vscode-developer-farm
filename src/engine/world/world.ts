import { generateMineFloor } from '../mine/generator';
import { MINE_FLOORS, parseMineFloor } from '../mine/surface';
import { ContentIndex } from './content';
import { GameMap } from './gameMap';
import type { Content, MapDef, RegionDef } from './types';

/**
 * How many generated floors stay built at once: all of them, so a floor's broken rocks stay broken for the rest of the day
 * however far down the player goes. Each is a small map; they are all forgotten every morning.
 */
const MAX_GENERATED = MINE_FLOORS;

/**
 * Maps whose definition is made by code, not written out: the mine's floors. `owns` says whether an id is one of
 * theirs (cheap, no building), and `define` makes the definition.
 */
interface MapGenerator {
  owns(id: string): boolean;
  define(id: string): MapDef;
}

const MINE: MapGenerator = {
  owns: (id) => parseMineFloor(id) !== undefined,
  define: (id) => generateMineFloor(parseMineFloor(id) as number),
};

/** True for the id of a map the game generates (so content may point at it before it exists). */
export const isGeneratedMapId = (id: string): boolean => MINE.owns(id);

/** The loaded content pack and the maps built from it. Maps are built on first use and kept; generated ones are kept until the morning. */
export class World {
  readonly index: ContentIndex;
  private readonly maps = new Map<string, GameMap>();
  /** Generated floors, least recently used first. They are built whole again after `resetGenerated`. */
  private readonly generated = new Map<string, GameMap>();
  private readonly generatedDefs = new Map<string, MapDef>();

  constructor(content: Content) {
    this.index = new ContentIndex(content);
    if (!this.index.mapById.has(content.startMap)) throw new Error(`Start map "${content.startMap}" does not exist`);
  }

  get startMapId(): string {
    return this.index.content.startMap;
  }

  hasMap(id: string): boolean {
    return this.index.mapById.has(id) || MINE.owns(id);
  }

  /** A map's definition, written or generated. Cheap for generated maps after the first time. */
  mapDef(id: string): MapDef | undefined {
    const written = this.index.mapById.get(id);
    if (written !== undefined) return written;
    if (!MINE.owns(id)) return undefined;
    let def = this.generatedDefs.get(id);
    if (def === undefined) {
      def = MINE.define(id);
      this.generatedDefs.set(id, def);
    }
    return def;
  }

  region(id: string): RegionDef | undefined {
    return this.index.regionById.get(id);
  }

  map(id: string): GameMap {
    const cached = this.maps.get(id) ?? this.generated.get(id);
    if (cached !== undefined) {
      if (this.generated.has(id)) {
        this.generated.delete(id); // most recently used goes last
        this.generated.set(id, cached);
      }
      return cached;
    }
    const def = this.mapDef(id);
    if (def === undefined) throw new Error(`Unknown map "${id}"`);
    const built = GameMap.build(def, this.index);
    if (MINE.owns(id)) {
      this.generated.set(id, built);
      for (const key of [...this.generated.keys()]) {
        if (this.generated.size <= MAX_GENERATED) break;
        if (key !== id) this.generated.delete(key);
      }
    } else {
      this.maps.set(id, built);
    }
    return built;
  }

  /**
   * Forgets every built generated floor, so the next visit finds its rocks whole again. Called each morning. The caller must
   * not still be standing on one (the game wakes the player at home first).
   */
  resetGenerated(): void {
    this.generated.clear();
  }

  /** A new morning for the written maps that have rocks: every rock is whole again. */
  restoreNodes(): void {
    for (const map of this.maps.values()) map.restoreNodes();
  }
}
