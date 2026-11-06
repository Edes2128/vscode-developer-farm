import { describe, expect, it } from 'vitest';
import { canonicalMask as generatorCanonicalMask, CANONICAL_MASKS as generatorMasks } from '../../../assets/src/sprites/terrain.mjs';
import { CANONICAL_MASKS, canonicalMask, connectMask, E, FENCE_E, FENCE_N, FENCE_S, FENCE_W, N, NE, S, terrainMask, W } from './autotile';

describe('autotile', () => {
  it('has exactly the 47 distinct shapes of an 8-neighbour tile', () => {
    expect(CANONICAL_MASKS).toHaveLength(47);
  });

  it('ignores a diagonal unless both edges beside it are set', () => {
    expect(canonicalMask(N | NE)).toBe(N);
    expect(canonicalMask(N | E | NE)).toBe(N | E | NE);
    expect(canonicalMask(255)).toBe(255);
    expect(canonicalMask(0)).toBe(0);
  });

  it('agrees with the art generator for every possible mask', () => {
    for (let mask = 0; mask < 256; mask += 1) expect(canonicalMask(mask)).toBe(generatorCanonicalMask(mask));
    expect([...CANONICAL_MASKS]).toEqual(generatorMasks);
  });

  it('builds a terrain mask from neighbours and treats the map edge as connected', () => {
    // 3x3 map where only the centre column is the terrain: the centre cell connects north and south.
    const same = (x: number): boolean => x === 1;
    expect(terrainMask(1, 1, 3, 3, same)).toBe(N | S);
    // At the top edge the cell connects off the map: north counts as set.
    expect(terrainMask(1, 0, 3, 3, same) & N).toBe(N);
    // A lone cell in the middle of a bigger map has no neighbours.
    expect(terrainMask(2, 2, 5, 5, (x, y) => x === 2 && y === 2)).toBe(0);
    expect(terrainMask(0, 2, 5, 5, (x) => x === 0) & W).toBe(W);
  });

  it('builds a fence mask from its four neighbours', () => {
    const at = new Set(['1,0', '0,1']);
    const mask = connectMask(1, 1, (x, y) => at.has(`${x},${y}`));
    expect(mask).toBe(FENCE_N | FENCE_W);
    expect(connectMask(0, 0, (x, y) => at.has(`${x},${y}`))).toBe(FENCE_E | FENCE_S);
  });
});
