import { targetOf, type Objective, type QuestDef, type QuestReward } from './types';

/** Names the journal can use. The game supplies them from content; unknown ids fall back to the id. */
export interface QuestNames {
  item(id: string): string | undefined;
  /** The display name of a building (optional: falls back to the id). */
  building?(id: string): string | undefined;
  npc(id: string): string | undefined;
  map(id: string): string | undefined;
  animal(kind: string): string | undefined;
}

const plural = (count: number, one: string, many = `${one}s`): string => (count === 1 ? one : many);

/** One line of the journal: what to do, and how far along it is ("Pick 5 Radish (2/5)"). */
export function describeObjective(objective: Objective, progress: number, names: QuestNames): { readonly text: string; readonly done: boolean } {
  const target = targetOf(objective);
  const done = progress >= target;
  const have = `${Math.min(progress, target)}/${target}`;
  const item = 'item' in objective ? (names.item(objective.item) ?? objective.item) : '';
  switch (objective.kind) {
    case 'ship':
      return { text: `Ship ${objective.count} ${item} (${have})`, done };
    case 'harvest':
      return { text: `Pick ${objective.count} ${item} (${have})`, done };
    case 'deliver':
      return { text: `Give ${objective.count} ${item} to ${names.npc(objective.to) ?? objective.to} (${have})`, done };
    case 'collect':
      return { text: `Collect ${objective.count} ${item} from the coop (${have})`, done };
    case 'feed':
      return { text: `Feed your animals ${objective.count} ${plural(objective.count, 'time')} (${have})`, done };
    case 'visit':
      return { text: `Visit ${names.map(objective.map) ?? objective.map}`, done };
    case 'catch':
      return { text: objective.item === undefined ? `Catch ${objective.count} ${plural(objective.count, 'fish', 'fish')} (${have})` : `Catch ${objective.count} ${item} (${have})`, done };
    case 'mine':
      return { text: `Dig up ${objective.count} ${item} in the mine (${have})`, done };
    case 'craft':
      return { text: objective.item === undefined ? `Make ${objective.count} ${plural(objective.count, 'thing')} (${have})` : `Make ${objective.count} ${item} (${have})`, done };
    case 'place':
      return { text: `Put ${objective.count} ${plural(objective.count, 'piece')} of furniture in the farmhouse (${have})`, done };
    case 'build':
      return { text: `Have the ${names.building?.(objective.building) ?? objective.building} built`, done };
    case 'donate':
      return { text: `Give the museum ${objective.count} ${plural(objective.count, 'thing')} (${have})`, done };
    case 'dig':
      return { text: `Dig up ${objective.count} ${plural(objective.count, 'buried thing')} (${have})`, done };
    case 'see':
      return { text: `See ${objective.count} rare ${plural(objective.count, 'creature')} (${have})`, done };
    case 'befriend':
      return { text: `Befriend ${objective.count} rare ${plural(objective.count, 'creature')} (${have})`, done };
    case 'friendship':
      return { text: `Reach ${objective.hearts} ${plural(objective.hearts, 'heart')} with ${names.npc(objective.npc) ?? objective.npc}`, done };
  }
}

/** What a quest pays, in words: "120 gold, 5 Radish seeds and a chicken". */
export function describeReward(reward: QuestReward, names: QuestNames): string {
  const parts: string[] = [];
  if (reward.money !== undefined && reward.money > 0) parts.push(`${reward.money} gold`);
  for (const i of reward.items ?? []) parts.push(`${i.count} ${names.item(i.id) ?? i.id}`);
  if (reward.animal !== undefined) parts.push(`a ${(names.animal(reward.animal) ?? reward.animal).toLowerCase()}`);
  if (reward.friendship !== undefined) parts.push(`${names.npc(reward.friendship.npc) ?? reward.friendship.npc}'s friendship`);
  if (parts.length === 0) return 'Nothing but thanks';
  return parts.length === 1 ? (parts[0] as string) : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] as string}`;
}

export interface QuestLine {
  readonly id: string;
  readonly title: string;
  readonly giver: string;
  readonly summary: string;
  readonly status: 'active' | 'ready' | 'done';
  readonly objectives: readonly { readonly text: string; readonly done: boolean }[];
  readonly reward: string;
}

/** Everything the journal shows about one quest. */
export function describeQuest(def: QuestDef, status: QuestLine['status'], progress: readonly number[], names: QuestNames): QuestLine {
  return {
    id: def.id,
    title: def.title,
    giver: names.npc(def.giver) ?? def.giver,
    summary: def.summary,
    status,
    objectives: def.objectives.map((o, i) => describeObjective(o, status === 'done' ? targetOf(o) : (progress[i] ?? 0), names)),
    reward: describeReward(def.rewards, names),
  };
}
