import { describe, expect, it } from 'vitest';
import { InputState } from '../input/actions';
import { makeMap, makeWorld } from '../testing';
import { createPlayerAt, playerBox, RUN_SPEED, updatePlayer, WALK_SPEED, walkFrame, STRIDE_PIXELS } from './player';

const meadow = (w = 12, h = 12) => makeWorld(makeMap(Array.from({ length: h }, () => '.'.repeat(w)), [], { spawn: { x: 5, y: 5, facing: 'down' } })).map('test.map');

describe('player movement', () => {
  it('starts standing inside its cell, on open ground', () => {
    const map = meadow();
    const player = createPlayerAt(5, 5, 'down');
    expect(map.collision.boxHitsSolid(playerBox(player))).toBe(false);
    expect(player.x).toBe(5 * 16 + 8);
  });

  it('walks at walking speed, and runs faster', () => {
    const map = meadow();
    const walker = createPlayerAt(5, 5, 'down');
    const runner = createPlayerAt(5, 5, 'down');
    for (let i = 0; i < 30; i += 1) {
      updatePlayer(walker, map, { move: { x: 1, y: 0 }, run: false }, 1 / 60);
      updatePlayer(runner, map, { move: { x: 1, y: 0 }, run: true }, 1 / 60);
    }
    expect(walker.x - (5 * 16 + 8)).toBeCloseTo(WALK_SPEED * 0.5);
    expect(runner.x - (5 * 16 + 8)).toBeCloseTo(RUN_SPEED * 0.5);
  });

  it('is no faster diagonally than straight', () => {
    const map = meadow();
    const input = new InputState();
    input.press('KeyD');
    input.press('KeyS');
    const player = createPlayerAt(5, 5, 'down');
    const start = { x: player.x, y: player.y };
    for (let i = 0; i < 30; i += 1) updatePlayer(player, map, { move: input.moveVector(), run: false }, 1 / 60);
    expect(Math.hypot(player.x - start.x, player.y - start.y)).toBeCloseTo(WALK_SPEED * 0.5);
  });

  it('faces the way it moves, and keeps facing that way when it stops', () => {
    const map = meadow();
    const player = createPlayerAt(5, 5, 'down');
    updatePlayer(player, map, { move: { x: -1, y: 0 }, run: false }, 1 / 60);
    expect(player.facing).toBe('left');
    updatePlayer(player, map, { move: { x: 0, y: 0 }, run: false }, 1 / 60);
    expect(player.facing).toBe('left');
    expect(player.moving).toBe(false);
  });

  it('obeys the facing the player asked for when two keys are held', () => {
    const map = meadow();
    const player = createPlayerAt(5, 5, 'down');
    updatePlayer(player, map, { move: { x: 0.7, y: 0.7 }, run: false, facing: 'right' }, 1 / 60);
    expect(player.facing).toBe('right');
  });

  it('cannot walk through walls, and is not "moving" while pushing against one', () => {
    const map = meadow(6, 6);
    const player = createPlayerAt(4, 3, 'right');
    for (let i = 0; i < 120; i += 1) updatePlayer(player, map, { move: { x: 1, y: 0 }, run: false }, 1 / 60);
    expect(player.x + 5).toBeLessThanOrEqual(6 * 16 + 1e-6); // stopped at the map edge
    expect(player.moving).toBe(false);
    expect(player.stride).toBe(0);
  });

  it('cannot walk through a tree trunk but can walk round it', () => {
    const rows = Array.from({ length: 8 }, () => '.'.repeat(8));
    const props = Array.from({ length: 8 }, (_, y) => (y === 4 ? '....T...' : '........'));
    const map = makeWorld(makeMap(rows, props)).map('test.map');
    const player = createPlayerAt(1, 4, 'right');
    for (let i = 0; i < 200; i += 1) updatePlayer(player, map, { move: { x: 1, y: 0 }, run: false }, 1 / 60);
    expect(player.x + 5).toBeLessThanOrEqual(4 * 16 + 1e-6); // held back by the trunk at cell (4, 4)
    for (let i = 0; i < 40; i += 1) updatePlayer(player, map, { move: { x: 0, y: 1 }, run: false }, 1 / 60);
    for (let i = 0; i < 200; i += 1) updatePlayer(player, map, { move: { x: 1, y: 0 }, run: false }, 1 / 60);
    expect(player.x).toBeGreaterThan(5 * 16); // got past on the south side
  });

  it('ties the walk cycle to distance walked', () => {
    expect(walkFrame(0)).toBe(0);
    expect(walkFrame(STRIDE_PIXELS)).toBe(1);
    expect(walkFrame(STRIDE_PIXELS * 4)).toBe(0);
    expect(walkFrame(STRIDE_PIXELS * 7.5)).toBe(3);
  });
});
