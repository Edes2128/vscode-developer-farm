import { Container, Sprite, type Texture } from 'pixi.js';
import { TILE_SIZE, type Rect } from '../engine/math/coords';
import { autotileFrame, baseFrame } from '../engine/world/frames';
import type { GameMap, PlacedObject } from '../engine/world/gameMap';
import type { Atlas } from './atlas';

/** Cells per chunk edge. A chunk is built when it first comes into view and freed when far out of sight. */
export const CHUNK_CELLS = 16;
const CHUNK_PIXELS = CHUNK_CELLS * TILE_SIZE;

/** Built chunks kept alive beyond the ones in view. Past this the least recently seen are freed. */
const MAX_BUILT_CHUNKS = 48;

interface AnimatedTile {
  readonly sprite: Sprite;
  readonly frames: readonly Texture[];
  readonly fps: number;
  /** Offsets this tile's cycle so a whole lake does not pulse in unison. */
  readonly phase: number;
  /** The last animation tick drawn, so a texture is only swapped when the picture actually changes. */
  lastTick: number;
}

interface Chunk {
  readonly container: Container;
  readonly animated: AnimatedTile[];
  lastSeen: number;
}

/**
 * Draws the ground: grass, autotiled paths and water, and decals. The map is cut into chunks; only
 * the chunks near the camera exist as sprites, and chunks out of view are hidden.
 */
export class TerrainLayer {
  readonly container = new Container({ label: 'terrain' });

  private readonly chunks = new Map<number, Chunk>();
  private readonly chunksAcross: number;
  private readonly chunksDown: number;
  private readonly decalsByChunk = new Map<number, PlacedObject[]>();

  /** Counters for the debug overlay. */
  visibleChunks = 0;

  constructor(
    private readonly map: GameMap,
    private readonly atlas: Atlas,
  ) {
    this.chunksAcross = Math.ceil(map.width / CHUNK_CELLS);
    this.chunksDown = Math.ceil(map.height / CHUNK_CELLS);
    for (const object of map.objects) {
      if (object.def.layer !== 'ground') continue;
      const key = this.chunkKey(Math.floor(object.x / CHUNK_CELLS), Math.floor(object.y / CHUNK_CELLS));
      const list = this.decalsByChunk.get(key);
      if (list === undefined) this.decalsByChunk.set(key, [object]);
      else list.push(object);
    }
  }

  get builtChunks(): number {
    return this.chunks.size;
  }

  /** @param view the visible part of the world in pixels  @param seconds animation clock  @param now frame counter */
  update(view: Rect, seconds: number, now: number): void {
    const x0 = Math.max(0, Math.floor((view.x - TILE_SIZE) / CHUNK_PIXELS));
    const y0 = Math.max(0, Math.floor((view.y - TILE_SIZE) / CHUNK_PIXELS));
    const x1 = Math.min(this.chunksAcross - 1, Math.floor((view.x + view.w + TILE_SIZE) / CHUNK_PIXELS));
    const y1 = Math.min(this.chunksDown - 1, Math.floor((view.y + view.h + TILE_SIZE) / CHUNK_PIXELS));

    const visible = new Set<number>();
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) {
        const key = this.chunkKey(cx, cy);
        visible.add(key);
        const chunk = this.chunks.get(key) ?? this.build(cx, cy);
        chunk.lastSeen = now;
        chunk.container.visible = true;
        this.animate(chunk, seconds);
      }
    }
    for (const [key, chunk] of this.chunks) if (!visible.has(key)) chunk.container.visible = false;
    this.visibleChunks = visible.size;
    this.evict(visible);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.chunks.clear();
  }

  private chunkKey(cx: number, cy: number): number {
    return cy * this.chunksAcross + cx;
  }

  private build(cx: number, cy: number): Chunk {
    const { map, atlas } = this;
    const container = new Container({ label: `chunk ${cx},${cy}` });
    // A render group caches the chunk's draw commands: while nothing in it changes it costs almost nothing.
    container.isRenderGroup = true;
    container.position.set(0, 0);
    const animated: AnimatedTile[] = [];
    const grass = map.terrainList[0];
    if (grass === undefined) throw new Error('The content has no terrain');

    const tx0 = cx * CHUNK_CELLS;
    const ty0 = cy * CHUNK_CELLS;
    for (let ty = ty0; ty < Math.min(map.height, ty0 + CHUNK_CELLS); ty += 1) {
      for (let tx = tx0; tx < Math.min(map.width, tx0 + CHUNK_CELLS); tx += 1) {
        const def = map.terrainAt(tx, ty);
        if (def === undefined) continue;
        const place = (sprite: Sprite): Sprite => {
          sprite.position.set(tx * TILE_SIZE, ty * TILE_SIZE);
          container.addChild(sprite);
          return sprite;
        };

        if (def.render === 'base') {
          place(new Sprite(atlas.texture(baseFrame(def, tx, ty))));
          continue;
        }

        const mask = map.autotileMask(tx, ty);
        // Where the overlay fills the cell completely there is no need to draw grass underneath it.
        if (!(def.opaque && mask === 255)) place(new Sprite(atlas.texture(baseFrame(grass, tx, ty))));
        if (def.animationFrames > 1) {
          const frames = Array.from({ length: def.animationFrames }, (_, f) => atlas.texture(autotileFrame(def, mask, tx, ty, f)));
          const sprite = place(new Sprite(frames[0]));
          animated.push({ sprite, frames, fps: def.animationFps, phase: (tx * 7 + ty * 13) % def.animationFrames, lastTick: -1 });
        } else {
          place(new Sprite(atlas.texture(autotileFrame(def, mask, tx, ty, 0))));
        }
      }
    }

    for (const decal of this.decalsByChunk.get(this.chunkKey(cx, cy)) ?? []) {
      const sprite = new Sprite(atlas.texture(decal.frame));
      sprite.position.set(decal.spriteX, decal.spriteY);
      container.addChild(sprite);
    }

    this.container.addChild(container);
    const chunk: Chunk = { container, animated, lastSeen: 0 };
    this.chunks.set(this.chunkKey(cx, cy), chunk);
    return chunk;
  }

  /** Advances animated terrain. Each kind ticks at its own frame rate; each tile adds an offset of its own. */
  private animate(chunk: Chunk, seconds: number): void {
    for (const tile of chunk.animated) {
      const tick = Math.floor(seconds * tile.fps);
      if (tick === tile.lastTick) continue;
      tile.lastTick = tick;
      tile.sprite.texture = tile.frames[(tick + tile.phase) % tile.frames.length] as Texture;
    }
  }

  /** Frees the chunks seen least recently once too many are alive. */
  private evict(visible: ReadonlySet<number>): void {
    if (this.chunks.size <= MAX_BUILT_CHUNKS) return;
    const candidates = [...this.chunks.entries()].filter(([key]) => !visible.has(key)).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (const [key, chunk] of candidates) {
      if (this.chunks.size <= MAX_BUILT_CHUNKS) break;
      chunk.container.destroy({ children: true });
      this.chunks.delete(key);
    }
  }
}
