import { DIRECTION_VECTORS, type Direction, type Vec2 } from '../math/coords';

/**
 * Everything the player can ask for. Input devices are mapped to these actions through a keymap, so
 * the game never reads raw keys and remapping controls only means swapping the map.
 */
export const ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'run',
  'interact',
  'use',
  'hotbarPrev',
  'hotbarNext',
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
  'slot7',
  'slot8',
  'slot9',
  'slot10',
  'menu',
  'zoomIn',
  'zoomOut',
  'toggleHud',
  'toggleDebug',
  'journal',
] as const;

export type Action = (typeof ACTIONS)[number];

/** Actions the simulation itself reads. The rest belong to the UI shell. */
export const GAMEPLAY_ACTIONS: readonly Action[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'run',
  'interact',
  'use',
  'hotbarPrev',
  'hotbarNext',
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
  'slot7',
  'slot8',
  'slot9',
  'slot10',
];

/** The number-key actions, in slot order. */
export const SLOT_ACTIONS: readonly Action[] = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9', 'slot10'];

/**
 * Maps each action to the input codes that trigger it. Codes are `KeyboardEvent.code` values, plus `Mouse0`
 * (the primary button) and `WheelUp` / `WheelDown`, which the page feeds in as if they were keys.
 */
export type Keymap = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_KEYMAP: Keymap = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  use: ['Space', 'Mouse0'],
  hotbarPrev: ['KeyQ', 'WheelUp'],
  hotbarNext: ['KeyR', 'WheelDown'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  slot6: ['Digit6'],
  slot7: ['Digit7'],
  slot8: ['Digit8'],
  slot9: ['Digit9'],
  slot10: ['Digit0'],
  menu: ['Escape'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
  toggleHud: ['KeyH'],
  toggleDebug: ['F3'],
  journal: ['KeyJ'],
};

const MOVE_ACTIONS: readonly (readonly [Action, Direction])[] = [
  ['moveUp', 'up'],
  ['moveDown', 'down'],
  ['moveLeft', 'left'],
  ['moveRight', 'right'],
];

/**
 * The current state of the player's input. Platform code (the DOM) feeds it raw key codes; the game
 * reads actions from it. It has no dependency on the DOM, so it is tested in plain Node.
 */
export class InputState {
  private readonly codesDown = new Set<string>();
  private readonly codeToAction = new Map<string, Action>();
  private readonly pending = new Set<Action>();
  /** Move directions currently held, oldest first. The newest decides which way the player faces. */
  private readonly heldMoves: Direction[] = [];

  constructor(private keymap: Keymap = DEFAULT_KEYMAP) {
    this.applyKeymap(keymap);
  }

  setKeymap(keymap: Keymap): void {
    this.keymap = keymap;
    this.applyKeymap(keymap);
    this.releaseAll();
  }

  /** The keymap in use (for the controls screen). */
  getKeymap(): Keymap {
    return this.keymap;
  }

  /** Returns the action a code is bound to, if any, so the caller can decide to swallow the key. */
  actionFor(code: string): Action | undefined {
    return this.codeToAction.get(code);
  }

  press(code: string, repeat = false): Action | undefined {
    const action = this.codeToAction.get(code);
    if (action === undefined) return undefined;
    if (repeat || this.codesDown.has(code)) return action;
    this.codesDown.add(code);
    this.pending.add(action);
    const move = MOVE_ACTIONS.find(([name]) => name === action);
    if (move !== undefined) {
      this.removeHeld(move[1]);
      this.heldMoves.push(move[1]);
    }
    return action;
  }

  release(code: string): void {
    if (!this.codesDown.delete(code)) return;
    const action = this.codeToAction.get(code);
    if (action === undefined) return;
    // Another key bound to the same action may still be held.
    if (this.isDown(action)) return;
    const move = MOVE_ACTIONS.find(([name]) => name === action);
    if (move !== undefined) this.removeHeld(move[1]);
  }

  /** Forgets every held key. Call when the window loses focus so nothing stays "stuck". */
  releaseAll(): void {
    this.codesDown.clear();
    this.pending.clear();
    this.heldMoves.length = 0;
  }

  isDown(action: Action): boolean {
    for (const code of this.keymap[action]) if (this.codesDown.has(code)) return true;
    return false;
  }

  /** True once per press. A press that is never read is kept until it is. */
  consumePressed(action: Action): boolean {
    return this.pending.delete(action);
  }

  /** Throws away unread presses of the given actions (for example the gameplay ones while a menu is open). */
  discardPressed(actions: readonly Action[]): void {
    for (const action of actions) this.pending.delete(action);
  }

  /** Movement intent: a vector of length 0, 1 (cardinal) or 1 (normalised diagonal). */
  moveVector(): Vec2 {
    let x = 0;
    let y = 0;
    if (this.isDown('moveLeft')) x -= 1;
    if (this.isDown('moveRight')) x += 1;
    if (this.isDown('moveUp')) y -= 1;
    if (this.isDown('moveDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      return { x: x * inv, y: y * inv };
    }
    return { x, y };
  }

  /** The direction of the most recently pressed movement key that is still held. */
  facingIntent(): Direction | undefined {
    return this.heldMoves[this.heldMoves.length - 1];
  }

  private removeHeld(direction: Direction): void {
    const at = this.heldMoves.indexOf(direction);
    if (at >= 0) this.heldMoves.splice(at, 1);
  }

  private applyKeymap(keymap: Keymap): void {
    this.codeToAction.clear();
    for (const action of ACTIONS) for (const code of keymap[action]) this.codeToAction.set(code, action);
  }
}

/** Convenience for tests and tools. */
export const vectorOf = (direction: Direction): Vec2 => DIRECTION_VECTORS[direction];
