/**
 * The museum: what has been put on display, and which of the curator's rewards have been handed over. The def says what
 * it wants (data); this remembers what it has. The caller moves the items and the rewards, this only keeps the book.
 */
import type { MuseumDef, MuseumMilestone, MuseumSave, MuseumSection } from './types';

export class Museum {
  /** Bumps on every change, so the HUD knows when to redraw. */
  version = 0;

  /** What each wanted item is for. An item listed twice in the data counts once, under its first section. */
  private readonly sectionOf = new Map<string, MuseumSection>();
  private readonly donated = new Set<string>();
  private readonly claimed = new Set<number>();

  constructor(
    readonly def: MuseumDef,
    saved?: MuseumSave,
  ) {
    for (const slot of def.slots) if (!this.sectionOf.has(slot.item)) this.sectionOf.set(slot.item, slot.section);
    if (saved === undefined) return;

    // A save may mention items the game no longer wants, or repeat itself: keep only what the def still asks for, once.
    for (const item of saved.donated) if (this.sectionOf.has(item)) this.donated.add(item);
    // Claims are saved by the count that earned them, not by position, so reordering or adding milestones never makes a paid
    // reward claimable again. A reward can only have been handed over if it was earned, so a claim for a count with no
    // milestone, or one not yet reached, is junk and is dropped rather than trusted.
    for (const count of saved.claimed) {
      const index = def.milestones.findIndex((m) => m.count === count);
      if (index >= 0 && count <= this.count) this.claimed.add(index);
    }
  }

  /** Is this on display? */
  has(item: string): boolean {
    return this.donated.has(item);
  }

  /** How many different things are on display. */
  get count(): number {
    return this.donated.size;
  }

  canDonate(item: string): 'ok' | 'already' | 'not-wanted' {
    if (!this.sectionOf.has(item)) return 'not-wanted';
    return this.donated.has(item) ? 'already' : 'ok';
  }

  /** Puts an item on display. False if the museum did not take it (not wanted, or already there). */
  donate(item: string): boolean {
    if (this.canDonate(item) !== 'ok') return false;
    this.donated.add(item);
    this.version += 1;
    return true;
  }

  /** How many of a section's things are on display, out of how many it wants. */
  progress(section: MuseumSection): { have: number; total: number } {
    let have = 0;
    let total = 0;
    for (const [item, itemSection] of this.sectionOf) {
      if (itemSection !== section) continue;
      total += 1;
      if (this.donated.has(item)) have += 1;
    }
    return { have, total };
  }

  /** Milestones whose count is reached and whose reward has not been handed over yet, in order. */
  claimable(): { readonly index: number; readonly milestone: MuseumMilestone }[] {
    const ready: { readonly index: number; readonly milestone: MuseumMilestone }[] = [];
    this.def.milestones.forEach((milestone, index) => {
      if (milestone.count <= this.count && !this.claimed.has(index)) ready.push({ index, milestone });
    });
    return ready;
  }

  /** Marks a claimable milestone as handed over and returns it, or undefined if it was not claimable. The caller gives the reward. */
  claim(index: number): MuseumMilestone | undefined {
    const found = this.claimable().find((entry) => entry.index === index);
    if (found === undefined) return undefined;
    this.claimed.add(index);
    this.version += 1;
    return found.milestone;
  }

  /** The first milestone not yet reached: what the curator is waiting to see next. */
  nextMilestone(): MuseumMilestone | undefined {
    return this.def.milestones.find((milestone) => milestone.count > this.count);
  }

  /** Donations in the def's slot order (not the order they happened in), claims ascending: the same museum always saves the same. */
  toSave(): MuseumSave {
    return {
      donated: [...this.sectionOf.keys()].filter((item) => this.donated.has(item)),
      claimed: [...this.claimed].map((index) => (this.def.milestones[index] as MuseumMilestone).count).sort((a, b) => a - b),
    };
  }
}
