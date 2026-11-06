/**
 * The bestiary: which creatures the player has seen, and which have become friends. The defs say what exists (data); this
 * remembers what the player has met. The caller moves the gift and the keepsake, this only keeps the book.
 */
import type { BestiarySave, CreatureDef } from './types';

export class Bestiary {
  /** Bumps on every change, so the HUD knows when to redraw. Loading a save is not a change. */
  version = 0;

  /** Every creature the game has, once each, in `defs` order: the order a save is written in. */
  private readonly known: string[];
  private readonly seen = new Set<string>();
  private readonly friends = new Set<string>();

  constructor(defs: readonly CreatureDef[], saved?: BestiarySave) {
    this.known = [...new Set(defs.map((def) => def.id))];
    if (saved === undefined) return;

    // A save may mention creatures the game no longer has, or repeat itself: keep only what the defs still have, once.
    const knownSet = new Set(this.known);
    for (const id of saved.seen) if (knownSet.has(id)) this.seen.add(id);
    // You can only befriend what you have seen, so a friend that is missing from `seen` is junk (a hand-edited or damaged
    // save) and is dropped rather than trusted. It is not quietly promoted to "seen" either: the book never claims more than it was told.
    for (const id of saved.friends) if (this.seen.has(id)) this.friends.add(id);
  }

  hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  isFriend(id: string): boolean {
    return this.friends.has(id);
  }

  get seenCount(): number {
    return this.seen.size;
  }

  get friendCount(): number {
    return this.friends.size;
  }

  /** Writes a creature in the book. True only the first time, and only for a creature the game has. */
  see(id: string): boolean {
    if (!this.known.includes(id) || this.seen.has(id)) return false;
    this.seen.add(id);
    this.version += 1;
    return true;
  }

  /** Makes a seen creature a friend. True only if it is known, has been seen and was not a friend yet. */
  befriend(id: string): boolean {
    if (!this.seen.has(id) || this.friends.has(id)) return false;
    this.friends.add(id);
    this.version += 1;
    return true;
  }

  /** Ids in the defs' order (not the order they happened in), as fresh arrays: the same book always saves the same. */
  toSave(): BestiarySave {
    return {
      seen: this.known.filter((id) => this.seen.has(id)),
      friends: this.known.filter((id) => this.friends.has(id)),
    };
  }
}
