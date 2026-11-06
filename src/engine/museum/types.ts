export type MuseumSection = 'fish' | 'mineral' | 'artifact';

/** One thing the museum wants, once. */
export interface MuseumSlot {
  /** `ItemDef.id` */
  readonly item: string;
  readonly section: MuseumSection;
}

/** A reward the curator gives when this many different things have been donated. */
export interface MuseumMilestone {
  readonly count: number;
  readonly message: string;
  readonly reward: { readonly money?: number; readonly items?: readonly { readonly id: string; readonly count: number }[] };
}

/** The museum: what it collects and what it pays. Data lives in src/data/museum.ts. */
export interface MuseumDef {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly MuseumSlot[];
  /** In increasing order of `count`. */
  readonly milestones: readonly MuseumMilestone[];
}

/** What the museum remembers, as saved: which items are on display, and which milestone rewards have been handed over. */
export interface MuseumSave {
  readonly donated: readonly string[];
  /** Each reward already handed over, named by the number of things on display that earned it (not by its place in the list). */
  readonly claimed: readonly number[];
}
