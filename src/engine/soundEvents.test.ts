import { describe, expect, it } from 'vitest';
import type { SoundId } from './audio/types';
import { Game } from './game';
import { farmGameAt, run } from './testing';

/** The game asks for sounds by id; the webview makes them. These tests pin down when the game asks. */

const FARM = 'willowbrook.home_farm';
const HOUSE = 'willowbrook.farmhouse';
const SHALLOWS = 'marlow.shallows';
type Facing = 'up' | 'down' | 'left' | 'right';
const at = (mapId: string, x: number, y: number, facing: Facing, patch: Parameters<typeof farmGameAt>[2] = {}): Game =>
  farmGameAt({ x: 0, y: 0 }, 'up', { mapId, player: { x: x * 16 + 8, y: y * 16 + 14, facing }, time: { day: 3, minutes: 10 * 60 }, ...patch });
const sounds = (game: Game): SoundId[] => {
  const seen: SoundId[] = [];
  game.events.on('sound', ({ id }) => seen.push(id));
  return seen;
};
const walk = (game: Game, code: string, seconds: number): void => {
  game.input.press(code);
  run(game, seconds);
  game.input.release(code);
  run(game, 0.05);
};

describe('footsteps', () => {
  it('step on grass outside, as often as feet land, and on nothing when standing still', () => {
    const game = at(FARM, 20, 30, 'right');
    const seen = sounds(game);
    run(game, 0.5);
    expect(seen).toEqual([]);
    walk(game, 'KeyD', 1);
    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(seen.every((id) => id === 'step_grass' || id === 'step_dirt')).toBe(true);
    expect(seen).toContain('step_grass');
  });

  it('step on wood indoors, and on boardwalk planks over a marsh', () => {
    const inside = at(HOUSE, 3, 6, 'right');
    const indoors = sounds(inside);
    walk(inside, 'KeyD', 0.6);
    expect(indoors.length).toBeGreaterThan(0);
    expect(new Set(indoors)).toEqual(new Set(['step_wood']));
    const boardwalk = at(SHALLOWS, 22, 9, 'down', { time: { day: 3, minutes: 10 * 60 } });
    const planks = sounds(boardwalk);
    walk(boardwalk, 'KeyS', 0.6);
    expect(planks.length).toBeGreaterThan(0);
    expect(new Set(planks)).toEqual(new Set(['step_wood']));
  });

  it('are quiet while a dialog or the game is paused', () => {
    const game = at(FARM, 20, 30, 'right');
    const seen = sounds(game);
    game.setPaused('menu', true);
    walk(game, 'KeyD', 0.6);
    expect(seen).toEqual([]);
  });
});

describe('other sounds', () => {
  it('a coin when money comes in, and none when it is spent', () => {
    const game = at(FARM, 20, 30, 'right', { money: 100 });
    run(game, 0.1);
    const seen = sounds(game);
    game.money += 50;
    game.syncStatus();
    expect(seen).toEqual(['coin']);
    game.money -= 30;
    game.syncStatus();
    expect(seen).toEqual(['coin']);
  });

  it('a lullaby when the day ends, and the morning pay is a coin', () => {
    const game = at(FARM, 20, 30, 'right', { money: 0, bin: [{ id: 'radish', count: 3, quality: 0 }] });
    const seen = sounds(game);
    game.endDay('slept');
    expect(seen).toContain('sleep');
    game.dismissSummary(); // the morning report is closed, the day begins, and the pay is counted
    run(game, 0.1);
    expect(seen).toContain('coin');
  });

  it('a prize fanfare when a festival prize is collected, but not when it is refused', () => {
    const day = 13;
    const game = at('willowbrook.village_green', 3, 14, 'right', { time: { day, minutes: 10 * 60 }, festival: { day, score: 8, found: [], entered: false, talked: [], claimed: false } });
    const seen = sounds(game);
    expect(game.claimFestival()).toMatchObject({ ok: true });
    expect(seen).toContain('prize');
    seen.length = 0;
    expect(game.claimFestival()).toMatchObject({ ok: false });
    expect(seen).not.toContain('prize');
  });
});
