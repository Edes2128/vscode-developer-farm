import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { Game } from './game';
import { InputState } from './input/actions';
import { makeMap, makeOpenGame, makeWorld, run } from './testing';
import { World } from './world/world';

const farm = (saved?: ConstructorParameters<typeof Game>[2]): Game => new Game(new World(CONTENT), new InputState(), saved);

describe('Game', () => {
  it('starts on the start map at the spawn point', () => {
    const game = farm();
    expect(game.map.id).toBe('willowbrook.home_farm');
    expect(game.player.facing).toBe('up');
    expect(game.regionName).toBe('Willowbrook Valley');
    expect(game.isPaused).toBe(false);
  });

  it('moves the player when keys are held, and not when none are', () => {
    const game = makeOpenGame();
    const x0 = game.player.x;
    run(game, 0.5);
    expect(game.player.x).toBe(x0);
    game.input.press('KeyD');
    run(game, 0.5);
    expect(game.player.x).toBeGreaterThan(x0 + 25);
    expect(game.player.moving).toBe(true);
    game.input.release('KeyD');
    run(game, 0.1);
    expect(game.player.moving).toBe(false);
  });

  it('moves the same distance at any frame rate', () => {
    const results = [30, 60, 120, 144, 240].map((fps) => {
      const game = makeOpenGame();
      game.input.press('KeyD');
      run(game, 2, fps);
      return game.player.x;
    });
    for (const x of results) expect(Math.abs(x - (results[0] as number))).toBeLessThan(2);
  });

  it('stops the world while paused, and does not count paused time as play time', () => {
    const game = makeOpenGame();
    game.input.press('KeyD');
    run(game, 0.5);
    const { x } = game.player;
    const played = game.playTimeMs;
    game.setPaused('menu', true);
    run(game, 2);
    expect(game.player.x).toBe(x);
    expect(game.playTimeMs).toBe(played);
    game.setPaused('menu', false);
    run(game, 0.5);
    expect(game.player.x).toBeGreaterThan(x);
  });

  it('stays paused until every reason is cleared, and says so once per change', () => {
    const game = makeOpenGame();
    const changes: boolean[] = [];
    game.events.on('pausedChanged', (paused) => changes.push(paused));
    game.setPaused('blur', true);
    game.setPaused('menu', true);
    game.setPaused('blur', false);
    expect(game.isPaused).toBe(true);
    game.setPaused('menu', false);
    expect(game.isPaused).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('forgets presses made while paused instead of acting on them when play resumes', () => {
    const game = farm();
    run(game, 0.2);
    game.setPaused('blur', true);
    game.input.press('KeyE');
    game.setPaused('blur', false);
    run(game, 0.2);
    expect(game.dialog).toBeUndefined();
  });

  it('lets you read what is in front of you, page by page, and then carry on', () => {
    // Beside the bed inside the farmhouse, facing it: two pages, the last with a choice.
    const game = farm({ ...farm().toSaveState(), mapId: 'willowbrook.farmhouse', player: { x: 3 * 16 + 8, y: 3 * 16 + 14, facing: 'left' } });
    const seen: (string | undefined)[] = [];
    game.events.on('dialogChanged', (dialog) => seen.push(dialog === undefined ? undefined : `${dialog.title}:${dialog.page}`));
    run(game, 0.1);
    expect(game.prompt?.name).toBe('Your bed');

    game.input.press('KeyE');
    run(game, 0.05);
    game.input.release('KeyE');
    expect(game.dialog?.title).toBe('Your bed');
    expect(game.dialog?.page).toBe(0);

    // While the box is open the player cannot walk away.
    const { x, y } = game.player;
    game.input.press('KeyS');
    run(game, 0.3);
    game.input.release('KeyS');
    expect(game.player.x).toBe(x);
    expect(game.player.y).toBe(y);

    game.input.press('Enter');
    run(game, 0.05);
    game.input.release('Enter');
    expect(game.dialog?.page).toBe(1);
    // The last page asks whether to turn in; "Not yet" is the second option.
    expect(game.dialog?.options.map((o) => o.label)).toEqual(['Go to bed', 'Not yet']);
    game.input.press('KeyS');
    run(game, 0.05);
    game.input.release('KeyS');
    game.input.press('Enter');
    run(game, 0.05);
    game.input.release('Enter');
    expect(game.dialog).toBeUndefined();
    expect(game.clock.day).toBe(1); // still the same day
    expect(seen).toContain('Your bed:0');
    expect(seen).toContain('Your bed:1');
    expect(seen.at(-1)).toBeUndefined();
  });

  it('only offers something to interact with when you are facing it', () => {
    const game = farm({ ...farm().toSaveState(), mapId: 'willowbrook.farmhouse', player: { x: 3 * 16 + 8, y: 3 * 16 + 14, facing: 'left' } });
    run(game, 0.1);
    expect(game.prompt?.name).toBe('Your bed');
    game.input.press('KeyD'); // turn away from the bed
    run(game, 0.05);
    game.input.release('KeyD');
    expect(game.prompt?.name).not.toBe('Your bed');
  });

  it('saves and restores where the player is and how long they have played', () => {
    const game = makeOpenGame();
    game.input.press('KeyA');
    run(game, 1);
    game.input.release('KeyA');
    const saved = game.toSaveState();
    const restored = makeOpenGame(saved);
    expect(restored.player.x).toBeCloseTo(game.player.x);
    expect(restored.player.y).toBeCloseTo(game.player.y);
    expect(restored.player.facing).toBe('left');
    expect(restored.playTimeMs).toBe(saved.playTimeMs);
    expect(saved.playTimeMs).toBeGreaterThan(900);
  });

  it('rescues a saved position that has become solid (the map changed since)', () => {
    const rows = Array.from({ length: 8 }, (_, y) => (y === 3 ? '..~.....' : '........'));
    const map = makeMap(rows, [], { spawn: { x: 0, y: 0, facing: 'down' } });
    const world = makeWorld(map);
    const base = new Game(world, new InputState()).toSaveState();
    const game = new Game(world, new InputState(), { ...base, mapId: 'test.map', player: { x: 2 * 16 + 8, y: 3 * 16 + 14, facing: 'up' }, playTimeMs: 5000 });
    expect(game.map.collision.boxHitsSolid({ x: game.player.x - 5, y: game.player.y - 6, w: 10, h: 6 })).toBe(false);
    expect(game.player.facing).toBe('up');
    expect(game.playTimeMs).toBe(5000);
  });

  it('starts at the spawn if the saved map no longer exists', () => {
    const game = farm({ ...farm().toSaveState(), mapId: 'removed.map', player: { x: 5, y: 5, facing: 'left' }, playTimeMs: 9999 });
    expect(game.map.id).toBe('willowbrook.home_farm');
    expect(game.player.facing).toBe('up');
    expect(game.playTimeMs).toBe(9999); // the time played is the player's, whatever happened to the map
  });

  it('draws the player between steps so motion is smooth', () => {
    const game = makeOpenGame();
    game.input.press('KeyD');
    game.frame(1 / 60 + 1 / 120); // one step and half of the next
    const alpha = game.frame(0);
    const at = game.renderPosition(alpha);
    expect(at.x).toBeLessThanOrEqual(game.player.x);
  });

  it('keeps the camera on the player and inside the map', () => {
    const game = makeOpenGame();
    game.setViewport(480, 320, 3);
    game.input.press('KeyD');
    run(game, 6);
    const bounds = game.camera.bounds();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(game.map.width * 16 + 1e-6);
  });
});
