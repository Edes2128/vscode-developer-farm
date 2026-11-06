import { describe, expect, it } from 'vitest';
import { createRng, hash2, hashIndex } from './random';

describe('random', () => {
  it('repeats exactly for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it('differs between seeds and stays in [0, 1)', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
    const r = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashes a cell to the same value every time', () => {
    expect(hash2(5, 9, 3)).toBe(hash2(5, 9, 3));
    expect(hash2(5, 9, 3)).not.toBe(hash2(9, 5, 3));
  });

  it('picks indexes in range and uses them all', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 40; x += 1) for (let y = 0; y < 40; y += 1) seen.add(hashIndex(x, y, 6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
