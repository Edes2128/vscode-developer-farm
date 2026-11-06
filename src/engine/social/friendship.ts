import { dayOfSeason, seasonOf } from '../time/calendar';
import { isGoods, type ItemDef } from '../items/types';
import type { GiftTastes, NpcDef } from './types';

/** Ten hearts of a hundred points each. */
export const POINTS_PER_HEART = 100;
export const MAX_HEARTS = 10;
export const MAX_FRIENDSHIP = POINTS_PER_HEART * MAX_HEARTS;

/** Friendship gained by the first chat of each day. */
export const CHAT_POINTS = 20;
/** At most this many gifts to one villager in a week, and one in a day. */
export const GIFTS_PER_WEEK = 2;
/** A gift on someone's birthday counts this many times. */
export const BIRTHDAY_MULTIPLIER = 4;

export type Reaction = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';

export const REACTION_POINTS: Readonly<Record<Reaction, number>> = { loved: 80, liked: 45, neutral: 20, disliked: -20, hated: -40 };

/** What a villager knows and feels about the player, as saved. */
export interface NpcRecord {
  friendship: number;
  /** Has spoken with the player. */
  met: boolean;
  /** The day of the last chat and of the last gift. */
  talkedDay: number;
  giftedDay: number;
  /** Gifts given in the current week (weeks count from day 1). */
  giftWeek: number;
  giftsThisWeek: number;
  /** Indexes of friendship rewards already handed over. */
  rewards: number[];
  /** Dialogue rules marked `once` that have been used. */
  seen: string[];
}

export const newRecord = (): NpcRecord => ({ friendship: 0, met: false, talkedDay: 0, giftedDay: 0, giftWeek: -1, giftsThisWeek: 0, rewards: [], seen: [] });

export const heartsOf = (points: number): number => Math.min(MAX_HEARTS, Math.floor(points / POINTS_PER_HEART));

const clamp = (points: number): number => Math.max(0, Math.min(MAX_FRIENDSHIP, points));

export const weekOf = (day: number): number => Math.floor((day - 1) / 7);

export const isBirthday = (npc: NpcDef, day: number): boolean => npc.birthday.season === seasonOf(day) && npc.birthday.day === dayOfSeason(day);

export function reactionTo(tastes: GiftTastes, itemId: string): Reaction {
  if (tastes.loves.includes(itemId)) return 'loved';
  if (tastes.likes.includes(itemId)) return 'liked';
  if (tastes.hates.includes(itemId)) return 'hated';
  if (tastes.dislikes.includes(itemId)) return 'disliked';
  return 'neutral';
}

/** Tools are not gifts. Everything else can be. */
/** Only things grown, caught or dug up can be given: not tools, seeds or feed. */
export const isGiftable = (item: ItemDef): boolean => isGoods(item);

/** Can the player give this villager a gift now? */
export function giftAllowance(record: NpcRecord, day: number): 'ok' | 'today' | 'week' {
  if (record.giftedDay === day) return 'today';
  if (record.giftWeek === weekOf(day) && record.giftsThisWeek >= GIFTS_PER_WEEK) return 'week';
  return 'ok';
}

/** The first chat of the day earns friendship. Returns how much. */
export function chat(record: NpcRecord, day: number): number {
  record.met = true;
  if (record.talkedDay === day) return 0;
  record.talkedDay = day;
  record.friendship = clamp(record.friendship + CHAT_POINTS);
  return CHAT_POINTS;
}

/** Records a gift and returns how the villager felt and how much friendship changed. */
export function gift(record: NpcRecord, npc: NpcDef, itemId: string, day: number): { reaction: Reaction; gained: number; birthday: boolean } {
  const reaction = reactionTo(npc.tastes, itemId);
  const birthday = isBirthday(npc, day);
  const base = REACTION_POINTS[reaction];
  // A birthday multiplies kindness, not unkindness.
  const gained = base > 0 && birthday ? base * BIRTHDAY_MULTIPLIER : base;
  const before = record.friendship;
  record.friendship = clamp(before + gained);
  record.met = true;
  record.giftedDay = day;
  if (record.giftWeek !== weekOf(day)) {
    record.giftWeek = weekOf(day);
    record.giftsThisWeek = 0;
  }
  record.giftsThisWeek += 1;
  return { reaction, gained: record.friendship - before, birthday };
}
