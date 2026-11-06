import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYMAP, InputState } from './actions';

describe('InputState', () => {
  it('maps keys to actions and ignores unbound keys', () => {
    const input = new InputState();
    expect(input.press('KeyW')).toBe('moveUp');
    expect(input.press('KeyZ')).toBeUndefined();
    expect(input.isDown('moveUp')).toBe(true);
    input.release('KeyW');
    expect(input.isDown('moveUp')).toBe(false);
  });

  it('treats an action as held while any of its keys is held', () => {
    const input = new InputState();
    input.press('KeyW');
    input.press('ArrowUp');
    input.release('KeyW');
    expect(input.isDown('moveUp')).toBe(true);
    input.release('ArrowUp');
    expect(input.isDown('moveUp')).toBe(false);
  });

  it('reports a press once, and keeps it until it is read', () => {
    const input = new InputState();
    input.press('KeyE');
    input.press('KeyE', true); // key repeat must not count again
    expect(input.consumePressed('interact')).toBe(true);
    expect(input.consumePressed('interact')).toBe(false);
    input.release('KeyE');
    input.press('KeyE');
    expect(input.consumePressed('interact')).toBe(true);
  });

  it('moves in the pressed direction and normalises diagonals', () => {
    const input = new InputState();
    input.press('KeyD');
    expect(input.moveVector()).toEqual({ x: 1, y: 0 });
    input.press('KeyS');
    const v = input.moveVector();
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('cancels opposite directions', () => {
    const input = new InputState();
    input.press('KeyA');
    input.press('KeyD');
    expect(input.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('faces the most recently pressed direction that is still held', () => {
    const input = new InputState();
    input.press('KeyA');
    input.press('KeyW');
    expect(input.facingIntent()).toBe('up');
    input.release('KeyW');
    expect(input.facingIntent()).toBe('left');
    input.release('KeyA');
    expect(input.facingIntent()).toBeUndefined();
  });

  it('lets go of everything when the window loses focus', () => {
    const input = new InputState();
    input.press('KeyD');
    input.press('ShiftLeft');
    input.releaseAll();
    expect(input.moveVector()).toEqual({ x: 0, y: 0 });
    expect(input.isDown('run')).toBe(false);
  });

  it('can be remapped without touching the game', () => {
    const input = new InputState();
    input.setKeymap({ ...DEFAULT_KEYMAP, moveUp: ['KeyI'] });
    expect(input.press('KeyW')).toBeUndefined();
    expect(input.press('KeyI')).toBe('moveUp');
  });

  it('can discard unread presses', () => {
    const input = new InputState();
    input.press('KeyE');
    input.discardPressed(['interact']);
    expect(input.consumePressed('interact')).toBe(false);
  });
});
