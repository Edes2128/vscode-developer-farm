import type { Condition, QuestStatus } from '../social/types';

/** One thing a quest asks for. */
export type Objective =
  /** Ship this many of an item in the shipping bin (counted when the bin is paid for). */
  | { readonly kind: 'ship'; readonly item: string; readonly count: number }
  /** Pick this many of a crop. */
  | { readonly kind: 'harvest'; readonly item: string; readonly count: number }
  /** Hand this many of an item to a villager. */
  | { readonly kind: 'deliver'; readonly item: string; readonly count: number; readonly to: string }
  /** Collect this many of an item from the coop's basket. */
  | { readonly kind: 'collect'; readonly item: string; readonly count: number }
  /** Feed the animals this many times (once per animal fed in a night). */
  | { readonly kind: 'feed'; readonly count: number }
  /** Go to a map. */
  | { readonly kind: 'visit'; readonly map: string }
  /** Reach this many hearts with a villager. */
  | { readonly kind: 'friendship'; readonly npc: string; readonly hearts: number }
  /** Catch this many fish: any fish, or a particular one (an item id). */
  | { readonly kind: 'catch'; readonly count: number; readonly item?: string }
  /** Break nodes and take this many of an item out of them (stone, copper ore, ...). */
  | { readonly kind: 'mine'; readonly item: string; readonly count: number }
  /** Make this many of an item at a kitchen or workbench (any dish or thing if `item` is not given). */
  | { readonly kind: 'craft'; readonly count: number; readonly item?: string }
  /** Put this many pieces of furniture down in a room. */
  | { readonly kind: 'place'; readonly count: number }
  /** Have a building finished by the carpenter. */
  | { readonly kind: 'build'; readonly building: string }
  /** Give the museum this many things for its collection. */
  | { readonly kind: 'donate'; readonly count: number }
  /** Uncover this many dig spots. */
  | { readonly kind: 'dig'; readonly count: number }
  /** Have seen this many different rare creatures (a level, counted by the bestiary). */
  | { readonly kind: 'see'; readonly count: number }
  /** Be friends with this many rare creatures (a level, counted by the bestiary). */
  | { readonly kind: 'befriend'; readonly count: number };

export interface QuestReward {
  readonly money?: number;
  readonly items?: readonly { readonly id: string; readonly count: number }[];
  /** An animal for the coop (a kind). If the coop is full, `fallbackMoney` is paid instead. */
  readonly animal?: string;
  readonly fallbackMoney?: number;
  readonly friendship?: { readonly npc: string; readonly points: number };
  /** A story flag to set. */
  readonly flag?: string;
}

/** A quest. Data (src/data/quests.ts). Quests are authored, not generated: each is checked to be achievable. */
export interface QuestDef {
  readonly id: string;
  readonly title: string;
  /** The villager who gives it and takes the report. */
  readonly giver: string;
  /** One line for the journal. */
  readonly summary: string;
  /** What the giver says when offering it. */
  readonly offer: readonly string[];
  /** What the giver says when it is accepted. */
  readonly accepted: string;
  /** What the giver says when the player reports it done. */
  readonly done: readonly string[];
  /** When it can be offered. */
  readonly requires?: readonly Condition[];
  readonly objectives: readonly Objective[];
  readonly rewards: QuestReward;
}

/** A quest in progress, as saved. */
export interface QuestSave {
  readonly id: string;
  readonly status: Exclude<QuestStatus, 'none'>;
  /** One number per objective. */
  readonly progress: readonly number[];
}

export type QuestEvent =
  | { readonly kind: 'ship'; readonly item: string; readonly count: number }
  | { readonly kind: 'harvest'; readonly item: string; readonly count: number }
  | { readonly kind: 'deliver'; readonly item: string; readonly count: number; readonly to: string }
  | { readonly kind: 'collect'; readonly item: string; readonly count: number }
  | { readonly kind: 'feed'; readonly count: number }
  | { readonly kind: 'visit'; readonly map: string }
  | { readonly kind: 'friendship'; readonly npc: string; readonly hearts: number }
  | { readonly kind: 'catch'; readonly item: string }
  | { readonly kind: 'mine'; readonly item: string; readonly count: number }
  | { readonly kind: 'craft'; readonly item: string; readonly count: number }
  /** `placed` is how much furniture is out right now: the objective tracks that level, so putting one chair down and picking it up again is not three. */
  | { readonly kind: 'place'; readonly placed: number }
  | { readonly kind: 'build'; readonly building: string }
  | { readonly kind: 'donate' }
  | { readonly kind: 'dig' }
  /** `seen` and `friends` are how many the player has now: these objectives track that level. */
  | { readonly kind: 'see'; readonly seen: number }
  | { readonly kind: 'befriend'; readonly friends: number };

/** How many of an objective is needed. */
export const targetOf = (objective: Objective): number => {
  switch (objective.kind) {
    case 'visit':
    case 'build':
      return 1;
    case 'friendship':
      return objective.hearts;
    default:
      return objective.count;
  }
};
