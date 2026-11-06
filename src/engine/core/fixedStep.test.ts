import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './fixedStep';

describe('FixedStepLoop', () => {
  it('runs one step per step-length of elapsed time, however frames are cut up', () => {
    for (const frame of [1 / 30, 1 / 60, 1 / 144, 1 / 240]) {
      let steps = 0;
      const loop = new FixedStepLoop(() => (steps += 1));
      const frames = Math.round(2 / frame);
      for (let i = 0; i < frames; i += 1) loop.advance(frame);
      // Two seconds of real time is 120 steps (within a step of rounding).
      expect(Math.abs(steps - 120)).toBeLessThanOrEqual(1);
    }
  });

  it('gives each step the same fixed time', () => {
    const seen = new Set<number>();
    const loop = new FixedStepLoop((dt) => seen.add(dt));
    for (let i = 0; i < 50; i += 1) loop.advance(0.013 + (i % 3) * 0.004);
    expect(seen.size).toBe(1);
  });

  it('returns how far into the next step it is', () => {
    const loop = new FixedStepLoop(() => undefined);
    const alpha = loop.advance(1 / 60 + 1 / 120);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('does not try to catch up after a long stall', () => {
    let steps = 0;
    const loop = new FixedStepLoop(() => (steps += 1), 1 / 60, 5);
    loop.advance(60); // a tab that was hidden for a minute
    expect(steps).toBe(5);
    loop.advance(0);
    expect(steps).toBe(5);
  });

  it('ignores negative time and forgets leftovers on reset', () => {
    let steps = 0;
    const loop = new FixedStepLoop(() => (steps += 1));
    loop.advance(-1);
    expect(steps).toBe(0);
    loop.advance(1 / 60 - 0.001);
    loop.reset();
    loop.advance(0.002);
    expect(steps).toBe(0);
  });
});
