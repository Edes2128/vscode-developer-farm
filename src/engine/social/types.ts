import type { Direction } from '../math/coords';
import type { Season } from '../time/calendar';

/**
 * Villagers as data. A villager is a name, a home, a daily routine, a way of talking, and tastes in gifts; everything
 * about them is in these types, so adding a villager is adding data, not engine code.
 */

/** Whether a quest is not started, in progress, finished but not yet reported, or reported. */
export type QuestStatus = 'none' | 'active' | 'ready' | 'done';

/** A fact about the world that a line of dialogue (or a quest) can depend on. */
export type Condition =
  /** Friendship with `npc` (default: the one speaking) of at least this many hearts. */
  | { readonly kind: 'friendship'; readonly atLeast: number; readonly npc?: string }
  | { readonly kind: 'season'; readonly is: readonly Season[] }
  /** Minutes since midnight, from (inclusive) to (exclusive). */
  | { readonly kind: 'time'; readonly from: number; readonly to: number }
  | { readonly kind: 'flag'; readonly name: string; readonly value?: boolean }
  | { readonly kind: 'quest'; readonly id: string; readonly status: QuestStatus }
  /** The player has not spoken with this villager before. */
  | { readonly kind: 'firstMeeting' }
  /** Today is the villager's birthday. */
  | { readonly kind: 'birthday' }
  | { readonly kind: 'not'; readonly condition: Condition };

/** Where a villager is from a time of day until the next entry starts. */
export interface ScheduleEntry {
  /** Minutes since midnight when they set off for this place. */
  readonly from: number;
  readonly map: string;
  /** The cell they stand on. */
  readonly x: number;
  readonly y: number;
  readonly facing?: Direction;
  /** The shop they are minding while they stand here (`ShopDef.id`). */
  readonly serves?: string;
  /** Only on days like this: `rain` (rain or a storm) or `dry` (any other weather). The first entry of a schedule must have no condition. */
  readonly when?: 'rain' | 'dry';
  /** Only on these weekdays (0 is Monday, 6 is Sunday). */
  readonly days?: readonly number[];
}

/** A schedule map that means "not in the valley today": the villager is on no map at all. */
export const AWAY = 'away';

/** What a villager thinks of each gift. Items not listed are "neutral". */
export interface GiftTastes {
  readonly loves: readonly string[];
  readonly likes: readonly string[];
  readonly dislikes: readonly string[];
  readonly hates: readonly string[];
}

/** One thing a villager might say. The first rule whose conditions all hold is used. */
export interface DialogueRule {
  readonly id: string;
  readonly when?: readonly Condition[];
  /** Pages of speech. */
  readonly lines: readonly string[];
  /** If set, the rule is used only once (the first time its conditions hold). */
  readonly once?: boolean;
}

export interface GiftReactions {
  readonly loved: readonly string[];
  readonly liked: readonly string[];
  readonly neutral: readonly string[];
  readonly disliked: readonly string[];
  readonly hated: readonly string[];
}

/** Something the villager gives the player at a friendship level, once. */
export interface FriendshipReward {
  readonly hearts: number;
  readonly message: string;
  readonly items?: readonly { readonly id: string; readonly count: number }[];
  readonly money?: number;
}

export interface NpcDef {
  readonly id: string;
  /** Builds things for the player: the menu offers buildings. */
  readonly carpenter?: boolean;
  readonly name: string;
  /** What they do: "Seed seller". */
  readonly role: string;
  /** A line or two of who they are. */
  readonly about: string;
  /** Atlas stem of their pictures: `char/<sprite>/<direction>_<idle|walk>_<frame>`. */
  readonly sprite: string;
  /** The map their home is on. */
  readonly home: string;
  readonly birthday: { readonly season: Season; readonly day: number };
  /** Ordered by `from`; the first entry is where they start the day. */
  readonly schedule: readonly ScheduleEntry[];
  readonly tastes: GiftTastes;
  /** What they say when you walk up (a greeting), best match first. */
  readonly greetings: readonly DialogueRule[];
  /** What they say when you choose to chat, best match first. */
  readonly chats: readonly DialogueRule[];
  readonly reactions: GiftReactions;
  /** Birthday lines when given a gift on their birthday. */
  readonly birthdayThanks: readonly string[];
  readonly rewards: readonly FriendshipReward[];
  /** Quests they can hand out (`QuestDef.id`). */
  readonly quests: readonly string[];
}
