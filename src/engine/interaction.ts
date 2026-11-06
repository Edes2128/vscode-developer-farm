import type { Station } from './crafting/types';
import { DIRECTION_VECTORS, worldToTile } from './math/coords';
import { PLAYER_BOX_H, type PlayerState } from './player/player';
import type { GameMap, Interactable } from './world/gameMap';

/**
 * The cell in front of the player: the cell the player stands in, one step in the direction they face.
 *
 * Everything the player does "to the thing in front of them" (read a sign, swing a hoe, pick a crop) uses this one
 * rule, so where inside a cell they happen to stand never matters, and the green or red cursor always shows exactly
 * the cell the action will land on.
 */
export function facingCell(player: PlayerState): { x: number; y: number } {
  const step = DIRECTION_VECTORS[player.facing];
  return {
    x: worldToTile(player.x) + step.x,
    y: worldToTile(player.y - PLAYER_BOX_H / 2) + step.y,
  };
}

/** What the player is facing and could interact with right now. */
export function findInteractionTarget(player: PlayerState, map: GameMap): Interactable | undefined {
  const cell = facingCell(player);
  return map.interactableAt(cell.x, cell.y);
}

export interface DialogOption {
  /** What happens when it is chosen (`sleep:yes`, `buy:2`, `leave`). */
  readonly id: string;
  readonly label: string;
  /** A greyed-out option cannot be chosen (too expensive, no room). */
  readonly enabled: boolean;
}

/** What a dialog's options belong to, so they can be rebuilt after something happens. */
export type DialogContext =
  | { readonly kind: 'sleep' }
  | { readonly kind: 'shop'; readonly shop: string; readonly npc?: string }
  | { readonly kind: 'npc'; readonly npc: string }
  | { readonly kind: 'quest'; readonly npc: string; readonly quest: string }
  | { readonly kind: 'coop' }
  | { readonly kind: 'trough' }
  | { readonly kind: 'craft'; readonly station: Station }
  | { readonly kind: 'museum' }
  | { readonly kind: 'build'; readonly npc: string }
  | { readonly kind: 'board' }
  | { readonly kind: 'festival'; readonly npc: string };

/** Who is speaking, for the portrait and the hearts. */
export interface DialogSpeaker {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  /** Atlas stem of their pictures. */
  readonly sprite: string;
  /** Friendship, 0 to 10 hearts. */
  readonly hearts: number;
}

/** The message box being shown: pages of text, and on the last page perhaps a few choices. */
export interface DialogState {
  readonly title: string;
  readonly lines: readonly string[];
  readonly page: number;
  /** Empty for a plain message. */
  readonly options: readonly DialogOption[];
  readonly selected: number;
  /** What just happened ("Bought 5 Radish seeds"), shown under the options. */
  readonly note: string | undefined;
  readonly context: DialogContext | undefined;
  /** A villager talking, if it is one. */
  readonly speaker: DialogSpeaker | undefined;
}

export function openDialog(
  title: string,
  lines: readonly string[],
  options: readonly DialogOption[] = [],
  context?: DialogContext,
  speaker?: DialogSpeaker,
): DialogState {
  return { title, lines, page: 0, options, selected: firstEnabled(options), note: undefined, context, speaker };
}

/** Choices are shown on the last page only. */
export const isChoosing = (dialog: DialogState): boolean => dialog.options.length > 0 && dialog.page + 1 >= dialog.lines.length;

/** Turns to the next page, or returns undefined when the last page was read (the dialog closes). */
export function nextPage(dialog: DialogState): DialogState | undefined {
  return dialog.page + 1 < dialog.lines.length ? { ...dialog, page: dialog.page + 1 } : undefined;
}

function firstEnabled(options: readonly DialogOption[]): number {
  const at = options.findIndex((o) => o.enabled);
  return at < 0 ? 0 : at;
}

/** Moves the highlight to the next (or previous) option that can be chosen, wrapping round. */
export function moveSelection(dialog: DialogState, direction: 1 | -1): DialogState {
  const count = dialog.options.length;
  if (count === 0) return dialog;
  for (let step = 1; step <= count; step += 1) {
    const at = (dialog.selected + direction * step + count * step) % count;
    if (dialog.options[at]?.enabled) return { ...dialog, selected: at };
  }
  return dialog;
}

/** The same dialog with fresh options and a feedback line (after a purchase). Keeps the highlight where it was if it still can be. */
export function withOptions(dialog: DialogState, options: readonly DialogOption[], note: string | undefined): DialogState {
  const selected = options[dialog.selected]?.enabled ? dialog.selected : firstEnabled(options);
  return { ...dialog, options, selected, note };
}
