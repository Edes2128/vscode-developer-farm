import { DIRECTION_VECTORS, TILE_SIZE, type Direction, type Rect, type Vec2 } from '../math/coords';
import { moveBox } from '../world/collision';
import type { GameMap } from '../world/gameMap';

/** The player's collision box covers their feet, so they can walk "behind" tall things like trees. */
export const PLAYER_BOX_W = 10;
export const PLAYER_BOX_H = 6;

/** Pixels per second. */
export const WALK_SPEED = 64;
export const RUN_SPEED = 104;

/** Distance walked per walk-cycle frame, in pixels. Tying the animation to distance stops feet from sliding. */
export const STRIDE_PIXELS = 5;

export interface PlayerState {
  /** Feet position: horizontal centre, bottom of the collision box. World pixels. */
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  running: boolean;
  /** Distance walked in the current walk, for animation. Reset when the player stops. */
  stride: number;
}

export interface MoveIntent {
  readonly move: Vec2;
  readonly run: boolean;
  /** The direction the player asked to face, if any (the most recently pressed movement key). */
  readonly facing?: Direction | undefined;
}

export function createPlayerAt(tx: number, ty: number, facing: Direction): PlayerState {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    // Stand near the bottom of the cell so the box lies inside it.
    y: ty * TILE_SIZE + TILE_SIZE - 2,
    facing,
    moving: false,
    running: false,
    stride: 0,
  };
}

export const playerBox = (player: Pick<PlayerState, 'x' | 'y'>): Rect => ({
  x: player.x - PLAYER_BOX_W / 2,
  y: player.y - PLAYER_BOX_H,
  w: PLAYER_BOX_W,
  h: PLAYER_BOX_H,
});

/** The player's walk-cycle frame (0-3) for the current stride. */
export const walkFrame = (stride: number): number => Math.floor(stride / STRIDE_PIXELS) % 4;

function facingOf(move: Vec2, previous: Direction): Direction {
  if (move.x === 0 && move.y === 0) return previous;
  if (Math.abs(move.x) > Math.abs(move.y)) return move.x > 0 ? 'right' : 'left';
  if (Math.abs(move.y) > Math.abs(move.x)) return move.y > 0 ? 'down' : 'up';
  return previous;
}

/** Advances the player by `dt` seconds of intended movement, resolving collisions against the map. */
export function updatePlayer(player: PlayerState, map: GameMap, intent: MoveIntent, dt: number): void {
  const wants = intent.move.x !== 0 || intent.move.y !== 0;
  if (wants) player.facing = intent.facing ?? facingOf(intent.move, player.facing);

  const speed = intent.run ? RUN_SPEED : WALK_SPEED;
  const box = playerBox(player);
  const result = wants
    ? moveBox(map.collision, box, intent.move.x * speed * dt, intent.move.y * speed * dt)
    : { x: box.x, y: box.y, blockedX: false, blockedY: false };

  const travelled = Math.hypot(result.x - box.x, result.y - box.y);
  player.x = result.x + PLAYER_BOX_W / 2;
  player.y = result.y + PLAYER_BOX_H;
  player.running = intent.run && wants;
  // Count as moving only if the player actually went somewhere: walking into a wall is standing still.
  player.moving = wants && travelled > 1e-4;
  player.stride = player.moving ? player.stride + travelled : 0;
}

/** The point a few pixels in front of the player, used to find what they are facing. */
export function probePoint(player: PlayerState, distance: number): Vec2 {
  const v = DIRECTION_VECTORS[player.facing];
  return { x: player.x + v.x * distance, y: player.y - PLAYER_BOX_H / 2 + v.y * distance };
}
