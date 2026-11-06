import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('Camera', () => {
  it('derives the view size from the viewport and zoom', () => {
    const camera = new Camera();
    camera.setViewport(960, 540, 3);
    expect(camera.viewWidth).toBe(320);
    expect(camera.viewHeight).toBe(180);
    expect(camera.bounds()).toEqual({ x: camera.x, y: camera.y, w: 320, h: 180 });
  });

  it('centres on its target', () => {
    const camera = new Camera();
    camera.setViewport(320, 160, 1);
    camera.snapTo(500, 300, 100, 100);
    expect(camera.x).toBe(340);
    expect(camera.y).toBe(220);
  });

  it('never shows anything outside the map', () => {
    const camera = new Camera();
    camera.setViewport(320, 160, 1);
    camera.snapTo(-100, -100, 100, 100);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    camera.snapTo(99999, 99999, 100, 100);
    expect(camera.x).toBe(100 * 16 - 320);
    expect(camera.y).toBe(100 * 16 - 160);
  });

  it('centres a map that is smaller than the view', () => {
    const camera = new Camera();
    camera.setViewport(800, 600, 1);
    camera.snapTo(0, 0, 10, 10); // 160x160 map in an 800x600 view
    expect(camera.x).toBe((160 - 800) / 2);
    expect(camera.y).toBe((160 - 600) / 2);
  });

  it('eases towards a moving target and settles on it', () => {
    const camera = new Camera();
    camera.setViewport(320, 160, 1);
    camera.snapTo(200, 200, 100, 100);
    const start = camera.x;
    camera.follow(400, 200, 100, 100, 1 / 60);
    expect(camera.x).toBeGreaterThan(start);
    expect(camera.x).toBeLessThan(400 - 160); // not there in one frame
    for (let i = 0; i < 600; i += 1) camera.follow(400, 200, 100, 100, 1 / 60);
    expect(camera.x).toBeCloseTo(400 - 160, 3);
  });

  it('eases the same way at any frame rate', () => {
    const a = new Camera();
    const b = new Camera();
    for (const camera of [a, b]) {
      camera.setViewport(320, 160, 1);
      camera.snapTo(200, 200, 100, 100);
    }
    for (let i = 0; i < 30; i += 1) a.follow(400, 200, 100, 100, 1 / 30);
    for (let i = 0; i < 120; i += 1) b.follow(400, 200, 100, 100, 1 / 120);
    expect(a.x).toBeCloseTo(b.x, 3);
  });

  it('stays inside the map after the viewport grows', () => {
    const camera = new Camera();
    camera.setViewport(320, 160, 1);
    camera.snapTo(1550, 750, 100, 50);
    camera.setViewport(960, 480, 1);
    camera.clampTo(100, 50);
    expect(camera.x + camera.viewWidth).toBeLessThanOrEqual(1600);
    expect(camera.y + camera.viewHeight).toBeLessThanOrEqual(800);
  });
});
