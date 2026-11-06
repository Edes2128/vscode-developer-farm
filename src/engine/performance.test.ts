import { describe, expect, it } from 'vitest';
import { farmGameAt, run } from './testing';

/**
 * A guard, not a benchmark: the simulation costs a few microseconds a frame (measured at about 0.005 ms on the busiest maps), so a budget
 * of half a millisecond leaves a hundredfold of room for a slow machine. If this fails, something that used to be cached is being worked out
 * again every frame (the creatures, the eggs, the notice board, a path) and it is worth finding before it reaches the renderer.
 */

const BUDGET_MS_PER_FRAME = 0.5;
const FRAMES = 1800;

const busy: readonly [string, number, number, { day: number; minutes: number }][] = [
  ['willowbrook.home_farm', 20, 30, { day: 3, minutes: 10 * 60 }],
  ['willowbrook.village_green', 21, 14, { day: 13, minutes: 10 * 60 }], // the Egg Hunt: eggs, villagers gathered
  ['willowbrook.village_green', 21, 14, { day: 109, minutes: 19 * 60 }], // Lantern Night: lanterns and a crowd
  ['marlow.fen', 5, 16, { day: 5, minutes: 8 * 60 }], // a creature, reeds, water
  ['windcrest.meadow', 30, 30, { day: 85, minutes: 8 * 60 }], // snow and a hare
];

describe('the simulation stays cheap', () => {
  for (const [mapId, x, y, time] of busy) {
    it(`on ${mapId} at day ${time.day}: under ${BUDGET_MS_PER_FRAME} ms a frame while walking about`, () => {
      const game = farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: x * 16 + 8, y: y * 16 + 14, facing: 'right' }, time });
      run(game, 1); // build the map, place the villagers, lay out the day
      const start = performance.now();
      game.input.press('KeyD');
      for (let i = 0; i < FRAMES; i += 1) {
        game.frame(1 / 60);
        if (i === FRAMES / 2) {
          game.input.release('KeyD');
          game.input.press('KeyA');
        }
      }
      const perFrame = (performance.now() - start) / FRAMES;
      expect(perFrame).toBeLessThan(BUDGET_MS_PER_FRAME);
    });
  }

  it('starts a new game in well under a second', () => {
    const start = performance.now();
    farmGameAt({ x: 10, y: 10 }, 'down');
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
