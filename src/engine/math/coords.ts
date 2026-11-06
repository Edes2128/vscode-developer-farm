/**
 * Coordinate spaces used by the game.
 *
 *  - **tile** coordinates: integer cell indices (`tx`, `ty`), origin at the map's top-left cell.
 *  - **world** coordinates: pixels at 1x (`x`, `y`, may be fractional), `world = tile * TILE_SIZE`.
 *    Everything in the simulation (movement, collision, interaction) lives in world pixels.
 *  - **screen** coordinates: logical (CSS) pixels in the viewport, `screen = (world - camera) * zoom`.
 *    Only the renderer and the HUD use these.
 */

/** Edge length of one map tile in world pixels. The art is drawn on a 16 px grid. */
export const TILE_SIZE = 16;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const isDirection = (value: unknown): value is Direction =>
  value === 'up' || value === 'down' || value === 'left' || value === 'right';

/** Unit vector of a direction, in world axes (y grows downwards). */
export const DIRECTION_VECTORS: Readonly<Record<Direction, Vec2>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const tileToWorld = (tile: number): number => tile * TILE_SIZE;

export const worldToTile = (world: number): number => Math.floor(world / TILE_SIZE);

export const tileRect = (tx: number, ty: number): Rect => ({
  x: tx * TILE_SIZE,
  y: ty * TILE_SIZE,
  w: TILE_SIZE,
  h: TILE_SIZE,
});

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Cell index into a row-major grid. Callers must have checked bounds. */
export const cellIndex = (tx: number, ty: number, width: number): number => ty * width + tx;

/** World pixel to logical screen pixel. */
export const worldToScreen = (world: Vec2, camera: Vec2, zoom: number): Vec2 => ({
  x: (world.x - camera.x) * zoom,
  y: (world.y - camera.y) * zoom,
});

/** Logical screen pixel to world pixel. */
export const screenToWorld = (screen: Vec2, camera: Vec2, zoom: number): Vec2 => ({
  x: screen.x / zoom + camera.x,
  y: screen.y / zoom + camera.y,
});

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;
