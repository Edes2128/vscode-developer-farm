import type { Action, InputState } from '../engine/input/actions';

/** Actions the interface handles itself. Everything else goes to the game's input state. */
export const UI_ACTIONS: ReadonlySet<Action> = new Set<Action>(['menu', 'zoomIn', 'zoomOut', 'toggleHud', 'toggleDebug', 'journal']);

export interface KeyboardHandlers {
  readonly input: InputState;
  /** A UI action was pressed (once per press, never on key repeat). */
  onUiAction(action: Action): void;
  /** Lets the interface take a gameplay key for itself (the morning report uses the interact key). Return true to consume it. */
  intercept?(action: Action): boolean;
  onFocusLost(): void;
  onFocusGained(): void;
  onHidden(hidden: boolean): void;
}

/**
 * Feeds the keyboard into the game. Returns a function that removes the listeners.
 *
 * Keys with Ctrl, Cmd or Alt are left alone so VS Code's own shortcuts keep working. Keys the game uses are
 * swallowed (so Space does not scroll the page); everything else is untouched.
 */
export function attachKeyboard(handlers: KeyboardHandlers): () => void {
  const { input } = handlers;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = input.actionFor(event.code);
    if (action === undefined) return;
    // Inside the pause menu and the journal the game is stopped and the controls need their own keys (arrows on a slider, Enter and
    // Space on a button): only the interface's own actions (Escape, the journal key, zoom) are taken from there.
    if (!UI_ACTIONS.has(action) && event.target instanceof Element && event.target.closest('.df-menu, .df-journal') !== null) return;
    event.preventDefault();
    if (UI_ACTIONS.has(action)) {
      if (!event.repeat) handlers.onUiAction(action);
      return;
    }
    if (!event.repeat && handlers.intercept?.(action) === true) return;
    input.press(event.code, event.repeat);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    input.release(event.code);
  };

  const onBlur = (): void => {
    // Keys released while another window had focus would otherwise stay "held" forever.
    input.releaseAll();
    handlers.onFocusLost();
  };
  const onFocus = (): void => handlers.onFocusGained();
  const onVisibility = (): void => handlers.onHidden(document.visibilityState === 'hidden');

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
