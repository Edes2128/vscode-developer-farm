import { hash2, hashIndex } from '../core/random';
import { cellIndex, TILE_SIZE } from '../math/coords';
import { connectMask, terrainMask } from './autotile';
import { CollisionGrid } from './collision';
import type { ContentIndex } from './content';
import type { FishingZone } from '../fishing/types';
import type { NodeDef } from '../nodes/types';
import type { RanchConfig } from '../ranch/types';
import type { BuildSite } from '../buildings/types';
import type { DigConfig, ExitDef, InteractDef, MapDef, ObjectDef, TerrainDef } from './types';

/** An object placed on a map, with everything the renderer needs already worked out. */
export interface PlacedObject {
  /** Unique within the map; stable for a given map definition. */
  readonly uid: number;
  readonly def: ObjectDef;
  /** Anchor cell. */
  readonly x: number;
  readonly y: number;
  /** Atlas frame, with autotiling and variants resolved. */
  readonly frame: string;
  /** Top-left of the sprite in world pixels. */
  readonly spriteX: number;
  readonly spriteY: number;
  /** Depth-sort key: objects with a smaller `sortY` are drawn first (further away). */
  readonly sortY: number;
}

/** Something the player can interact with, found through a map cell. */
export interface Interactable {
  readonly objectUid: number;
  readonly objectId: string;
  readonly name: string;
  readonly interact: InteractDef;
  /** The cell that was interacted with. */
  readonly cellX: number;
  readonly cellY: number;
}

/** A rock or ore vein standing on a cell until a tool breaks it. */
export interface PlacedNode {
  readonly x: number;
  readonly y: number;
  readonly def: NodeDef;
  /** Swings left before it breaks. */
  hits: number;
}

/** What one swing at a node did. */
export interface NodeHit {
  readonly node: PlacedNode;
  readonly broken: boolean;
}

/** A running map: terrain, collision, objects and interaction, built from a `MapDef`. */
export class GameMap {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly spawn: MapDef['spawn'];
  /** Under a roof of its own: crops ignore the seasons here. */
  readonly sheltered: boolean;
  /** Furniture may be placed here. */
  readonly decorate: boolean;
  /** Where buildings can be put up. */
  readonly sites: readonly BuildSite[];
  /** The dig spot rules, if the ground here hides things. */
  readonly dig: DigConfig | undefined;
  /** Ways off this map (the building doors added by the carpenter come on top of the written ones). */
  private readonly exitList: ExitDef[];
  /** Where this map keeps farm animals, if it does. */
  readonly ranch: RanchConfig | undefined;
  /** How the light behaves here. */
  readonly ambient: 'outdoor' | 'indoor' | 'cave';
  /** Stretches of water where a rod can be cast. */
  readonly fishing: readonly FishingZone[];
  /** Nodes still standing, by cell. Breaking one removes it; the map is built again (whole) the next morning. */
  readonly nodes = new Map<number, PlacedNode>();
  /** The rocks a written map starts every day with (a generated mine floor is simply built afresh). */
  private readonly rockSpawns: { x: number; y: number; def: NodeDef }[] = [];
  private floorObjectCells: Set<number> | undefined;
  /** Goes up whenever a node is hit or broken, so the renderer knows to look again. */
  nodeVersion = 0;
  /** Objects put here after the map was built: furniture, buildings. Keyed by uid. */
  readonly extras = new Map<number, PlacedObject>();
  /** Goes up whenever an object is placed or taken away. */
  objectsVersion = 0;
  /** The day the dig spots here were last laid out (0: never). */
  digDay = 0;
  private nextExtraUid = 1_000_000;
  /** The extra object standing on each cell of its footprint. */
  private readonly extraCells = new Map<number, PlacedObject>();
  /** Things that lie on the floor (a rug): they take up no room, so furniture can stand on them. */
  private readonly floorCells = new Map<number, PlacedObject>();
  readonly terrainList: readonly TerrainDef[];
  /** Index into `terrainList` for every cell, row-major. */
  readonly terrainCells: Uint8Array;
  readonly collision: CollisionGrid;
  /** Every placed object, sorted by `sortY` (and then position), so draw order is deterministic. */
  readonly objects: readonly PlacedObject[];

  private readonly interactables = new Map<number, Interactable>();
  private readonly tillable: Uint8Array;
  private readonly solidObjects: Map<number, PlacedObject>;

  private constructor(
    def: MapDef,
    terrainList: readonly TerrainDef[],
    terrainCells: Uint8Array,
    collision: CollisionGrid,
    objects: readonly PlacedObject[],
    interactables: Map<number, Interactable>,
    tillable: Uint8Array,
    solidObjects: Map<number, PlacedObject>,
  ) {
    this.id = def.id;
    this.regionId = def.regionId;
    this.name = def.name;
    this.width = def.width;
    this.height = def.height;
    this.spawn = def.spawn;
    this.exitList = [...(def.exits ?? [])];
    this.sheltered = def.sheltered === true;
    this.decorate = def.decorate === true;
    this.sites = def.sites ?? [];
    this.dig = def.dig;
    this.ranch = def.ranch;
    this.ambient = def.ambient ?? 'outdoor';
    this.fishing = def.fishing ?? [];
    this.terrainList = terrainList;
    this.terrainCells = terrainCells;
    this.collision = collision;
    this.objects = objects;
    this.interactables = interactables;
    this.tillable = tillable;
    this.solidObjects = solidObjects;
  }

  /** Builds a map. Throws on content that cannot be built (validate content first for friendly messages). */
  static build(def: MapDef, index: ContentIndex): GameMap {
    const { width, height } = def;
    const terrainList = index.content.terrains;
    const terrainIndexByGlyph = new Map(terrainList.map((terrain, i) => [terrain.glyph, i]));

    // --- terrain
    const cells = new Uint8Array(width * height);
    const collision = new CollisionGrid(width, height);
    for (let ty = 0; ty < height; ty += 1) {
      const row = def.terrain[ty] ?? '';
      for (let tx = 0; tx < width; tx += 1) {
        const glyph = row[tx] ?? '';
        const terrainIndex = terrainIndexByGlyph.get(glyph);
        if (terrainIndex === undefined) throw new Error(`Map "${def.id}": unknown terrain glyph "${glyph}" at ${tx},${ty}`);
        cells[cellIndex(tx, ty, width)] = terrainIndex;
        collision.setSolid(tx, ty, (terrainList[terrainIndex] as TerrainDef).solid);
      }
    }

    // --- the cells where the soil can be worked
    const tillable = new Uint8Array(width * height);
    for (const rect of def.tillable ?? []) {
      for (let ty = Math.max(0, rect.y); ty < Math.min(height, rect.y + rect.h); ty += 1) {
        for (let tx = Math.max(0, rect.x); tx < Math.min(width, rect.x + rect.w); tx += 1) tillable[cellIndex(tx, ty, width)] = 1;
      }
    }

    // --- placements from the prop layer and the explicit list, in a stable order
    const placements: { def: ObjectDef; x: number; y: number }[] = [];
    for (let ty = 0; ty < height; ty += 1) {
      const row = def.props[ty] ?? '';
      for (let tx = 0; tx < width; tx += 1) {
        const glyph = row[tx] ?? '.';
        if (glyph === '.' || glyph === ' ') continue;
        const objectId = def.propLegend[glyph];
        if (objectId === undefined) throw new Error(`Map "${def.id}": prop glyph "${glyph}" at ${tx},${ty} is not in the legend`);
        placements.push({ def: requireObject(index, objectId, def.id), x: tx, y: ty });
      }
    }
    for (const placement of def.objects ?? []) {
      placements.push({ def: requireObject(index, placement.def, def.id), x: placement.x, y: placement.y });
    }

    // --- footprints: solid first, then openings (a bridge must not open a cell something solid stands on)
    const occupied = new Uint8Array(width * height);
    const objectSolid = new Uint8Array(width * height);
    for (const { def: object, x, y } of placements) {
      for (const cell of object.footprint) {
        const cx = x + cell.dx;
        const cy = y + cell.dy;
        if (!collision.inBounds(cx, cy)) continue;
        occupied[cellIndex(cx, cy, width)] = 1;
        if (cell.mode === 'solid') {
          objectSolid[cellIndex(cx, cy, width)] = 1;
          collision.setSolid(cx, cy, true);
        }
      }
    }
    for (const { def: object, x, y } of placements) {
      for (const cell of object.footprint) {
        const cx = x + cell.dx;
        const cy = y + cell.dy;
        if (cell.mode === 'open' && collision.inBounds(cx, cy) && !objectSolid[cellIndex(cx, cy, width)]) {
          collision.setSolid(cx, cy, false);
        }
      }
    }

    // --- connected objects (fences): which neighbours share a group
    const groupCells = new Map<string, Set<number>>();
    for (const { def: object, x, y } of placements) {
      if (object.connect === undefined) continue;
      let set = groupCells.get(object.connect.group);
      if (set === undefined) {
        set = new Set();
        groupCells.set(object.connect.group, set);
      }
      set.add(cellIndex(x, y, width));
    }

    const placed: PlacedObject[] = [];
    const resolve = (object: ObjectDef, x: number, y: number, offsetX: number, offsetY: number, frameSeed: number): PlacedObject => {
      let frame: string;
      if (object.connect !== undefined) {
        const set = groupCells.get(object.connect.group) as Set<number>;
        const mask = connectMask(x, y, (nx, ny) => nx >= 0 && ny >= 0 && nx < width && ny < height && set.has(cellIndex(nx, ny, width)));
        frame = `${object.connect.framePrefix}${mask}`;
      } else {
        const frames = object.frames ?? [];
        frame = frames[hashIndex(x, y, Math.max(frames.length, 1), frameSeed)] ?? '';
      }
      return {
        uid: placed.length,
        def: object,
        x,
        y,
        frame,
        spriteX: x * TILE_SIZE - object.anchor.x + offsetX,
        spriteY: y * TILE_SIZE - object.anchor.y + offsetY,
        sortY: (y + 1) * TILE_SIZE + offsetY,
      };
    };

    for (const { def: object, x, y } of placements) placed.push(resolve(object, x, y, 0, 0, 5));

    // --- scatter: decals over matching terrain, never under something placed
    for (const rule of def.scatter) {
      const candidates = rule.defs.map((id) => requireObject(index, id, def.id));
      const onTerrain = new Set(rule.on.map((id) => terrainIndexByGlyphOrId(index, id)));
      const area = rule.area ?? { x: 0, y: 0, w: width, h: height };
      for (let ty = Math.max(0, area.y); ty < Math.min(height, area.y + area.h); ty += 1) {
        for (let tx = Math.max(0, area.x); tx < Math.min(width, area.x + area.w); tx += 1) {
          const at = cellIndex(tx, ty, width);
          if (occupied[at] || tillable[at] || !onTerrain.has(cells[at] as number)) continue;
          if (hash2(tx, ty, rule.seed) >= rule.density) continue;
          const object = candidates[hashIndex(tx, ty, candidates.length, rule.seed + 1)];
          if (object === undefined) continue;
          const jitterX = Math.round((hash2(tx, ty, rule.seed + 3) - 0.5) * 6);
          const jitterY = Math.round((hash2(tx, ty, rule.seed + 4) - 0.5) * 6);
          placed.push(resolve(object, tx, ty, jitterX, jitterY, rule.seed + 2));
          occupied[at] = 1;
        }
      }
    }

    // Draw order: far to near; ties broken by position so the order never flickers.
    const objects = [...placed].sort((a, b) => a.sortY - b.sortY || a.x - b.x || a.uid - b.uid);

    // --- interaction cells
    const interactables = new Map<number, Interactable>();
    for (const object of objects) {
      const interact = object.def.interact;
      if (interact === undefined) continue;
      const cellsOf = interact.cells ?? object.def.footprint.filter((cell) => cell.mode === 'solid');
      for (const cell of cellsOf) {
        const cx = object.x + cell.dx;
        const cy = object.y + cell.dy;
        if (!collision.inBounds(cx, cy)) continue;
        interactables.set(cellIndex(cx, cy, width), {
          objectUid: object.uid,
          objectId: object.def.id,
          name: object.def.name,
          interact,
          cellX: cx,
          cellY: cy,
        });
      }
    }

    // --- which object stands on each solid cell (to ask what is there: a well, say)
    const solidObjects = new Map<number, PlacedObject>();
    for (const object of objects) {
      for (const cell of object.def.footprint) {
        if (cell.mode !== 'solid') continue;
        const cx = object.x + cell.dx;
        const cy = object.y + cell.dy;
        if (collision.inBounds(cx, cy)) solidObjects.set(cellIndex(cx, cy, width), object);
      }
    }

    const map = new GameMap(def, terrainList, cells, collision, objects, interactables, tillable, solidObjects);

    // --- nodes: solid until broken
    for (const spawn of def.nodes ?? []) {
      const nodeDef = index.nodeById.get(spawn.def);
      if (nodeDef === undefined) throw new Error(`Map "${def.id}": unknown node "${spawn.def}"`);
      if (!collision.inBounds(spawn.x, spawn.y)) throw new Error(`Map "${def.id}": node "${spawn.def}" at ${spawn.x},${spawn.y} is outside the map`);
      map.nodes.set(cellIndex(spawn.x, spawn.y, width), { x: spawn.x, y: spawn.y, def: nodeDef, hits: nodeDef.hits });
      map.rockSpawns.push({ x: spawn.x, y: spawn.y, def: nodeDef });
      if (nodeDef.solid !== false) collision.setSolid(spawn.x, spawn.y, true);
    }
    return map;
  }

  /** A new morning: every rock this map starts with is whole again, and stands in the way again. */
  restoreNodes(): void {
    let changed = false;
    for (const spawn of this.rockSpawns) {
      const key = cellIndex(spawn.x, spawn.y, this.width);
      const here = this.nodes.get(key);
      if (here !== undefined && here.def === spawn.def) {
        if (here.hits === spawn.def.hits) continue;
        here.hits = spawn.def.hits;
        changed = true;
        continue;
      }
      if (here !== undefined) continue; // something else (a dig spot) is lying there today
      this.nodes.set(key, { x: spawn.x, y: spawn.y, def: spawn.def, hits: spawn.def.hits });
      if (spawn.def.solid !== false) this.collision.setSolid(spawn.x, spawn.y, true);
      changed = true;
    }
    if (changed) this.nodeVersion += 1;
  }

  /**
   * Cells that can be walked on and reached from a cell, counting every rock this map starts with as still in the way, whether or not
   * it has been broken today. Anything that must stand in the same place however much of the day's mining has been done (the
   * creatures, the eggs) is placed from this, so a reload cannot move it.
   */
  reachableFromWithRocks(tx: number, ty: number): Uint8Array {
    const rocks = new Set(this.rockSpawns.map((r) => cellIndex(r.x, r.y, this.width)));
    const ok = (x: number, y: number): boolean => this.isWalkable(x, y) && !rocks.has(cellIndex(x, y, this.width));
    const seen = new Uint8Array(this.width * this.height);
    if (!ok(tx, ty)) return seen;
    const queue: number[] = [cellIndex(tx, ty, this.width)];
    seen[queue[0] as number] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head] as number;
      const x = at % this.width;
      const y = Math.floor(at / this.width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!ok(nx, ny)) continue;
        const next = cellIndex(nx, ny, this.width);
        if (seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    return seen;
  }

  /** Does a floor object (a boardwalk plank, a dock) lie on this cell? Digging is not done on one. */
  isFloorObjectCell(tx: number, ty: number): boolean {
    if (this.floorObjectCells === undefined) {
      const cells = new Set<number>();
      for (const object of this.objects) {
        if (object.def.layer !== 'floor') continue;
        for (const c of object.def.footprint) cells.add(cellIndex(object.x + c.dx, object.y + c.dy, this.width));
      }
      this.floorObjectCells = cells;
    }
    return this.floorObjectCells.has(cellIndex(tx, ty, this.width)) || this.floorCells.has(cellIndex(tx, ty, this.width));
  }

  /** The node standing on a cell, if any. */
  nodeAt(tx: number, ty: number): PlacedNode | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    return this.nodes.get(cellIndex(tx, ty, this.width));
  }

  /** One swing at the node on a cell. It breaks (and stops blocking the way) when its last hit lands. */
  hitNode(tx: number, ty: number): NodeHit | undefined {
    const node = this.nodeAt(tx, ty);
    if (node === undefined) return undefined;
    node.hits -= 1;
    const broken = node.hits <= 0;
    if (broken) {
      this.nodes.delete(cellIndex(tx, ty, this.width));
      if (node.def.solid !== false) this.collision.setSolid(tx, ty, false);
    }
    this.nodeVersion += 1;
    return { node, broken };
  }

  /** Ways off this map. */
  get exits(): readonly ExitDef[] {
    return this.exitList;
  }

  /** Opens a new way off the map (a finished building's door). Adding the same exit twice does nothing. */
  addExit(exit: ExitDef): void {
    if (!this.exitList.some((e) => e.x === exit.x && e.y === exit.y && e.to.map === exit.to.map)) this.exitList.push(exit);
  }

  /** Lays out today's dig spots: the old ones go, the new ones appear (they never block the way). */
  setDigSpots(cells: readonly { x: number; y: number }[], def: NodeDef, day: number): void {
    for (const [key, node] of [...this.nodes]) if (node.def.id === def.id) this.nodes.delete(key);
    for (const cell of cells) {
      const key = cellIndex(cell.x, cell.y, this.width);
      if (!this.nodes.has(key)) this.nodes.set(key, { x: cell.x, y: cell.y, def, hits: def.hits });
    }
    this.digDay = day;
    this.nodeVersion += 1;
  }

  // ------------------------------------------------------------------------------------------ objects placed later

  /** The cells an object would occupy with its anchor at (x, y), or undefined if any is off the map. */
  private cellsFor(def: ObjectDef, x: number, y: number): { x: number; y: number; mode: 'solid' | 'open' }[] | undefined {
    const cells = def.footprint.map((c) => ({ x: x + c.dx, y: y + c.dy, mode: c.mode }));
    return cells.every((c) => this.collision.inBounds(c.x, c.y)) ? cells : undefined;
  }

  /** Could this object stand here? Every cell of its footprint must be open ground with nothing on it (no object, node or way off the map). */
  canPlace(def: ObjectDef, x: number, y: number): boolean {
    const cells = this.cellsFor(def, x, y);
    if (cells === undefined || cells.length === 0) return false;
    const onFloor = def.layer === 'floor';
    return cells.every(
      (c) =>
        !this.collision.isSolid(c.x, c.y) &&
        this.nodeAt(c.x, c.y) === undefined &&
        !this.extraCells.has(cellIndex(c.x, c.y, this.width)) &&
        !(onFloor && this.floorCells.has(cellIndex(c.x, c.y, this.width))) &&
        this.interactableAt(c.x, c.y) === undefined &&
        !this.exitList.some((e) => c.x >= e.x && c.y >= e.y && c.x < e.x + e.w && c.y < e.y + e.h) &&
        !(c.x === this.spawn.x && c.y === this.spawn.y),
    );
  }

  /** Puts an object on the map, if it fits. Returns it, or undefined if the place is taken. */
  addObject(def: ObjectDef, x: number, y: number): PlacedObject | undefined {
    if (!this.canPlace(def, x, y)) return undefined;
    const cells = this.cellsFor(def, x, y) as { x: number; y: number; mode: 'solid' | 'open' }[];
    const frames = def.frames ?? [];
    const placed: PlacedObject = {
      uid: this.nextExtraUid,
      def,
      x,
      y,
      frame: frames[hashIndex(x, y, Math.max(frames.length, 1), 5)] ?? '',
      spriteX: x * TILE_SIZE - def.anchor.x,
      spriteY: y * TILE_SIZE - def.anchor.y,
      sortY: (y + 1) * TILE_SIZE,
    };
    this.nextExtraUid += 1;
    this.extras.set(placed.uid, placed);
    for (const c of cells) {
      const key = cellIndex(c.x, c.y, this.width);
      (def.layer === 'floor' ? this.floorCells : this.extraCells).set(key, placed);
      if (c.mode === 'solid') {
        this.collision.setSolid(c.x, c.y, true);
        this.solidObjects.set(key, placed);
      }
    }
    const interact = def.interact;
    if (interact !== undefined) {
      const interactCells = interact.cells ?? def.footprint.filter((cell) => cell.mode === 'solid');
      for (const cell of interactCells) {
        const cx = x + cell.dx;
        const cy = y + cell.dy;
        this.interactables.set(cellIndex(cx, cy, this.width), { objectUid: placed.uid, objectId: def.id, name: def.name, interact, cellX: cx, cellY: cy });
      }
    }
    this.objectsVersion += 1;
    return placed;
  }

  /** Takes a placed object away again, and frees its cells. Returns it, or undefined if there was no such object. */
  removeObject(uid: number): PlacedObject | undefined {
    const placed = this.extras.get(uid);
    if (placed === undefined) return undefined;
    this.extras.delete(uid);
    for (const c of placed.def.footprint) {
      const key = cellIndex(placed.x + c.dx, placed.y + c.dy, this.width);
      if (this.extraCells.get(key) === placed) this.extraCells.delete(key);
      if (this.floorCells.get(key) === placed) this.floorCells.delete(key);
      this.solidObjects.delete(key);
      this.interactables.delete(key);
      if (c.mode === 'solid') this.collision.setSolid(placed.x + c.dx, placed.y + c.dy, false);
    }
    this.objectsVersion += 1;
    return placed;
  }

  private overhung: { version: number; cells: Set<number> } | undefined;

  /**
   * Is this cell under the drawn top of a tall object (the crown of a tree, the roof of a building) that stands to its south? Something
   * lying on such a cell would be hidden behind the object: nothing that is meant to be seen (an egg, a creature) is put there.
   * Worked out from each object's anchor, which says how far its picture reaches up and to the side of its footprint.
   */
  isOverhung(tx: number, ty: number): boolean {
    if (this.overhung === undefined || this.overhung.version !== this.objectsVersion) {
      const cells = new Set<number>();
      for (const object of [...this.objects, ...this.extras.values()]) {
        if (object.def.layer !== 'standing') continue;
        const rows = Math.ceil(object.def.anchor.y / TILE_SIZE);
        const side = Math.ceil(object.def.anchor.x / TILE_SIZE);
        const reach = Math.max(0, ...object.def.footprint.map((c) => c.dx));
        const base = Math.min(0, ...object.def.footprint.map((c) => c.dy)); // a building's footprint rises above its anchor
        // The picture reaches `rows` above the anchor cell; the footprint's own rows (a building's walls) are solid anyway.
        for (let y = object.y - rows; y < object.y + base; y += 1) {
          for (let x = object.x - side; x <= object.x + reach + side; x += 1) {
            if (this.collision.inBounds(x, y)) cells.add(cellIndex(x, y, this.width));
          }
        }
      }
      this.overhung = { version: this.objectsVersion, cells };
    }
    return this.overhung.cells.has(cellIndex(tx, ty, this.width));
  }

  /** The placed object standing on a cell (any cell of its footprint), if there is one. */
  extraAt(tx: number, ty: number): PlacedObject | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    const key = cellIndex(tx, ty, this.width);
    return this.extraCells.get(key) ?? this.floorCells.get(key);
  }

  /** Removes the node on a cell, if any, without a swing (it was already used up today). */
  clearNode(tx: number, ty: number): void {
    const node = this.nodeAt(tx, ty);
    if (node === undefined) return;
    this.nodes.delete(cellIndex(tx, ty, this.width));
    if (node.def.solid !== false) this.collision.setSolid(tx, ty, false);
    this.nodeVersion += 1;
  }

  /** The fishing zone a rod cast at this cell would fish in, or undefined where fishing is not allowed. */
  fishingZoneAt(tx: number, ty: number): FishingZone | undefined {
    // Open water only: the planks of a dock or bridge over it are not somewhere to cast at.
    if (this.terrainAt(tx, ty)?.waterSource !== true || this.isWalkable(tx, ty)) return undefined;
    return this.fishing.find((zone) => tx >= zone.x && ty >= zone.y && tx < zone.x + zone.w && ty < zone.y + zone.h);
  }

  /** The kind of water a rod cast at this cell would fish in ("river", "pond"), or undefined where fishing is not allowed. */
  fishingWater(tx: number, ty: number): string | undefined {
    return this.fishingZoneAt(tx, ty)?.water;
  }

  terrainAt(tx: number, ty: number): TerrainDef | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    return this.terrainList[this.terrainCells[cellIndex(tx, ty, this.width)] as number];
  }

  /** Neighbour mask for the autotile terrain at a cell: neighbours of the same terrain count as connected. */
  autotileMask(tx: number, ty: number): number {
    const here = this.terrainCells[cellIndex(tx, ty, this.width)];
    return terrainMask(tx, ty, this.width, this.height, (x, y) => this.terrainCells[cellIndex(x, y, this.width)] === here);
  }

  isWalkable(tx: number, ty: number): boolean {
    return !this.collision.isSolid(tx, ty);
  }

  /** Can the soil here be worked? (Inside a tillable zone; whether it is free is a separate question.) */
  isTillable(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height && this.tillable[cellIndex(tx, ty, this.width)] === 1;
  }

  /** The solid object standing on a cell, if any. */
  solidObjectAt(tx: number, ty: number): PlacedObject | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    return this.solidObjects.get(cellIndex(tx, ty, this.width));
  }

  /** Can the watering can be filled from this cell: a pond, a river, a well? */
  isWaterSource(tx: number, ty: number): boolean {
    return this.terrainAt(tx, ty)?.waterSource === true || this.solidObjectAt(tx, ty)?.def.waterSource === true;
  }

  interactableAt(tx: number, ty: number): Interactable | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    return this.interactables.get(cellIndex(tx, ty, this.width));
  }

  /** All interactables, one per interactable cell. */
  allInteractables(): IterableIterator<Interactable> {
    return this.interactables.values();
  }

  /** The closest walkable cell to (tx, ty), searching outwards. Used to rescue a saved position that is no longer valid. */
  nearestWalkable(tx: number, ty: number, maxRadius = 12): { x: number; y: number } | undefined {
    for (let r = 0; r <= maxRadius; r += 1) {
      let best: { x: number; y: number; d: number } | undefined;
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (!this.isWalkable(x, y)) continue;
          const d = dx * dx + dy * dy;
          if (best === undefined || d < best.d) best = { x, y, d };
        }
      }
      if (best !== undefined) return { x: best.x, y: best.y };
    }
    return undefined;
  }

  /** Cells reachable on foot from a starting cell (4-connected). */
  reachableFrom(tx: number, ty: number): Uint8Array {
    const seen = new Uint8Array(this.width * this.height);
    if (!this.isWalkable(tx, ty)) return seen;
    const queue: number[] = [cellIndex(tx, ty, this.width)];
    seen[queue[0] as number] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head] as number;
      const x = at % this.width;
      const y = Math.floor(at / this.width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!this.isWalkable(nx, ny)) continue;
        const next = cellIndex(nx, ny, this.width);
        if (seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    return seen;
  }
}

function requireObject(index: ContentIndex, id: string, mapId: string): ObjectDef {
  const object = index.objectById.get(id);
  if (object === undefined) throw new Error(`Map "${mapId}": unknown object "${id}"`);
  return object;
}

function terrainIndexByGlyphOrId(index: ContentIndex, id: string): number {
  const terrain = index.terrainById.get(id);
  if (terrain === undefined) throw new Error(`Unknown terrain "${id}"`);
  return index.content.terrains.indexOf(terrain);
}
