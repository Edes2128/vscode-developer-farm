import { seasonOf, dayOfSeason } from '../time/calendar';
import type { NpcDef, Condition, QuestStatus } from './types';

/** Everything a condition can ask about. The game provides it. */
export interface Facts {
  readonly day: number;
  readonly minutes: number;
  readonly flags: ReadonlySet<string>;
  /** Hearts with a villager, 0 to 10. */
  hearts(npc: string): number;
  questStatus(id: string): QuestStatus;
  /** Whether the player has spoken with a villager before. */
  met(npc: string): boolean;
  npc(id: string): NpcDef | undefined;
}

/** Does a condition hold? `speaker` is the villager the condition is being asked on behalf of. */
export function holds(condition: Condition, facts: Facts, speaker: string): boolean {
  switch (condition.kind) {
    case 'friendship':
      return facts.hearts(condition.npc ?? speaker) >= condition.atLeast;
    case 'season':
      return condition.is.includes(seasonOf(facts.day));
    case 'time':
      return facts.minutes >= condition.from && facts.minutes < condition.to;
    case 'flag':
      return facts.flags.has(condition.name) === (condition.value ?? true);
    case 'quest':
      return facts.questStatus(condition.id) === condition.status;
    case 'firstMeeting':
      return !facts.met(speaker);
    case 'birthday': {
      const birthday = facts.npc(speaker)?.birthday;
      return birthday !== undefined && birthday.season === seasonOf(facts.day) && birthday.day === dayOfSeason(facts.day);
    }
    case 'not':
      return !holds(condition.condition, facts, speaker);
  }
}

export const allHold = (conditions: readonly Condition[] | undefined, facts: Facts, speaker: string): boolean =>
  conditions === undefined || conditions.every((c) => holds(c, facts, speaker));
