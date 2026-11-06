import { describe, expect, it } from 'vitest';
import { clamp, rectsOverlap, screenToWorld, tileRect, TILE_SIZE, tileToWorld, worldToScreen, worldToTile } from './coords';

describe('coordinates', () => {
  it('converts between tiles and world pixels', () => {
    expect(tileToWorld(3)).toBe(3 * TILE_SIZE);
    expect(worldToTile(0)).toBe(0);
    expect(worldToTile(TILE_SIZE - 0.01)).toBe(0);
    expect(worldToTile(TILE_SIZE)).toBe(1);
  });

  it('floors negative positions instead of truncating them', () => {
    expect(worldToTile(-0.5)).toBe(-1);
    expect(worldToTile(-TILE_SIZE)).toBe(-1);
    expect(worldToTile(-TILE_SIZE - 1)).toBe(-2);
  });

  it('round-trips world and screen positions at any zoom', () => {
    const camera = { x: 37.5, y: 12 };
    for (const zoom of [1, 2, 3, 5]) {
      const screen = worldToScreen({ x: 100, y: 80 }, camera, zoom);
      const back = screenToWorld(screen, camera, zoom);
      expect(back.x).toBeCloseTo(100);
      expect(back.y).toBeCloseTo(80);
    }
  });

  it('puts the camera origin at the top-left of the screen', () => {
    expect(worldToScreen({ x: 50, y: 40 }, { x: 50, y: 40 }, 3)).toEqual({ x: 0, y: 0 });
  });

  it('detects overlapping rectangles, and not merely touching ones', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(tileRect(2, 3)).toEqual({ x: 32, y: 48, w: 16, h: 16 });
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
