import type { Keymap } from '../engine/input/actions';

const NAMES: Readonly<Record<string, string>> = {
  Mouse0: 'Click',
  WheelUp: 'Wheel',
  WheelDown: 'Wheel',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  Equal: '+',
  Minus: '−',
  NumpadAdd: '+',
  NumpadSubtract: '−',
};

/** A short, readable name for a `KeyboardEvent.code`. */
export function keyLabel(code: string): string {
  const known = NAMES[code];
  if (known !== undefined) return known;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/** The keys for an action as short names, without duplicates: ["W", "↑"]. */
export function keysFor(keymap: Keymap, action: keyof Keymap): string[] {
  return [...new Set(keymap[action].map(keyLabel))];
}

/** The labels the HUD shows, keyed by what they are for. Built from the active keymap, so remapping updates the hints. */
export function hudKeyLabels(keymap: Keymap): Record<string, string> {
  const move = [...keysFor(keymap, 'moveUp'), ...keysFor(keymap, 'moveLeft'), ...keysFor(keymap, 'moveDown'), ...keysFor(keymap, 'moveRight')];
  const wasd = move.filter((k) => k.length === 1 && /[A-Z]/.test(k)).join('');
  const arrows = move.filter((k) => /[←↑↓→]/.test(k)).join('');
  return {
    move: [wasd, arrows].filter((part) => part.length > 0).join(' / '),
    run: keysFor(keymap, 'run').join(' / '),
    interact: keysFor(keymap, 'interact').slice(0, 2).join(' / '),
    use: [...new Set([...keymap.use.filter((code) => !code.startsWith('Mouse')).map(keyLabel), ...(keymap.use.some((code) => code.startsWith('Mouse')) ? ['Click'] : [])])].join(' / '),
    hotbar: `${keysFor(keymap, 'slot1')[0] ?? '1'}–${keysFor(keymap, 'slot10')[0] ?? '0'} · ${keysFor(keymap, 'hotbarPrev')[0] ?? 'Q'} ${keysFor(keymap, 'hotbarNext')[0] ?? 'R'}`,
    interactPrimary: keysFor(keymap, 'interact')[0] ?? 'E',
    menu: keysFor(keymap, 'menu').join(' / '),
    zoom: `${keysFor(keymap, 'zoomOut')[0] ?? '−'} / ${keysFor(keymap, 'zoomIn')[0] ?? '+'}`,
    hud: keysFor(keymap, 'toggleHud').join(' / '),
    debug: keysFor(keymap, 'toggleDebug').join(' / '),
    journal: keysFor(keymap, 'journal').join(' / '),
  };
}
