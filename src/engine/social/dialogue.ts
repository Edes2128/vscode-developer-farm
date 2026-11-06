import { allHold, type Facts } from './conditions';
import type { NpcRecord } from './friendship';
import type { DialogueRule } from './types';

/**
 * Chooses what a villager says: the first rule whose conditions all hold. A rule marked `once` is skipped if it has
 * already been used. When `consume` is true, using a `once` rule marks it as seen.
 * Returns undefined only if no rule fits (content validation makes sure the last rule always does).
 */
export function pickRule(
  rules: readonly DialogueRule[],
  record: NpcRecord,
  facts: Facts,
  speaker: string,
  consume: boolean,
): DialogueRule | undefined {
  for (const rule of rules) {
    if (rule.once === true && record.seen.includes(rule.id)) continue;
    if (!allHold(rule.when, facts, speaker)) continue;
    if (consume && rule.once === true) record.seen.push(rule.id);
    return rule;
  }
  return undefined;
}
