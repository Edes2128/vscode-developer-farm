import { clamp, TILE_SIZE, type Rect } from '../math/coords';

/**
 * The view onto the world. `x`/`y` are the world pixel at the viewport's top-left; the view is
 * `viewWidth` x `viewHeight` world pixels (the viewport in screen pixels divided by the zoom).
 */
export class Camera {
  x = 0;
  y = 0;
  viewWidth = 320;
  viewHeight = 240;
  zoom = 3;

  /** How quickly the camera catches up with its target: higher is snappier. */
  smoothing = 9;

  setViewport(screenWidth: number, screenHeight: number, zoom: number): void {
    this.zoom = zoom;
    this.viewWidth = screenWidth / zoom;
    this.viewHeight = screenHeight / zoom;
  }

  /** Moves towards a target point (the player) and keeps the view inside the map. */
  follow(targetX: number, targetY: number, mapWidthTiles: number, mapHeightTiles: number, dt: number): void {
    const goalX = this.clampAxis(targetX - this.viewWidth / 2, mapWidthTiles * TILE_SIZE, this.viewWidth);
    const goalY = this.clampAxis(targetY - this.viewHeight / 2, mapHeightTiles * TILE_SIZE, this.viewHeight);
    // Frame-rate independent exponential smoothing.
    const t = 1 - Math.exp(-this.smoothing * dt);
    this.x += (goalX - this.x) * t;
    this.y += (goalY - this.y) * t;
  }

  /** Jumps straight to the target with no easing (at start-up, after a teleport, after a resize). */
  snapTo(targetX: number, targetY: number, mapWidthTiles: number, mapHeightTiles: number): void {
    this.x = this.clampAxis(targetX - this.viewWidth / 2, mapWidthTiles * TILE_SIZE, this.viewWidth);
    this.y = this.clampAxis(targetY - this.viewHeight / 2, mapHeightTiles * TILE_SIZE, this.viewHeight);
  }

  /** Re-applies the map bounds, for when the viewport or zoom changed. */
  clampTo(mapWidthTiles: number, mapHeightTiles: number): void {
    this.x = this.clampAxis(this.x, mapWidthTiles * TILE_SIZE, this.viewWidth);
    this.y = this.clampAxis(this.y, mapHeightTiles * TILE_SIZE, this.viewHeight);
  }

  /** The visible part of the world. */
  bounds(): Rect {
    return { x: this.x, y: this.y, w: this.viewWidth, h: this.viewHeight };
  }

  /** A map smaller than the view is centred; a larger one is clamped so no empty space shows. */
  private clampAxis(value: number, mapSize: number, viewSize: number): number {
    if (mapSize <= viewSize) return (mapSize - viewSize) / 2;
    return clamp(value, 0, mapSize - viewSize);
  }
}
