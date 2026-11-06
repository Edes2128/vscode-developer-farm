import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import { describeObjective, describeQuest, describeReward, type QuestNames } from './describe';

const names: QuestNames = {
  item: (id) => CONTENT.items.find((i) => i.id === id)?.name,
  npc: (id) => CONTENT.npcs.find((n) => n.id === id)?.name,
  map: (id) => CONTENT.maps.find((m) => m.id === id)?.name,
  animal: (kind) => CONTENT.animals.find((a) => a.id === kind)?.name,
};

describe('quest descriptions', () => {
  it('says what each kind of objective asks, with progress', () => {
    expect(describeObjective({ kind: 'harvest', item: 'radish', count: 5 }, 2, names)).toEqual({ text: 'Pick 5 Radish (2/5)', done: false });
    expect(describeObjective({ kind: 'ship', item: 'radish', count: 3 }, 3, names)).toEqual({ text: 'Ship 3 Radish (3/3)', done: true });
    expect(describeObjective({ kind: 'feed', count: 1 }, 0, names).text).toBe('Feed your animals 1 time (0/1)');
    expect(describeObjective({ kind: 'friendship', npc: 'willa', hearts: 2 }, 1, names).text).toBe('Reach 2 hearts with Willa Thorne');
    expect(describeObjective({ kind: 'deliver', item: 'strawberry', count: 3, to: 'tobias' }, 1, names).text).toContain('to Tobias');
  });

  it('never shows more progress than the target, and falls back to ids for unknown names', () => {
    expect(describeObjective({ kind: 'harvest', item: 'radish', count: 5 }, 9, names).text).toBe('Pick 5 Radish (5/5)');
    expect(describeObjective({ kind: 'visit', map: 'nowhere' }, 0, names).text).toBe('Visit nowhere');
  });

  it('lists rewards in plain words', () => {
    expect(describeReward({ money: 100 }, names)).toBe('100 gold');
    expect(describeReward({ money: 100, items: [{ id: 'radish_seeds', count: 5 }] }, names)).toBe('100 gold and 5 Radish seeds');
    expect(describeReward({ animal: 'chicken' }, names)).toBe('a chicken');
    expect(describeReward({}, names)).toBe('Nothing but thanks');
  });

  it('describes every shipped quest, with something to do and something to earn', () => {
    expect(CONTENT.quests.length).toBeGreaterThan(0);
    for (const quest of CONTENT.quests) {
      const line = describeQuest(quest, 'active', [], names);
      expect(line.objectives.length, quest.id).toBeGreaterThan(0);
      expect(line.giver, quest.id).not.toBe(quest.giver); // the villager's name, not their id
      expect(line.reward.length, quest.id).toBeGreaterThan(0);
    }
  });

  it('shows a finished quest as fully done whatever was saved', () => {
    const quest = CONTENT.quests[0]!;
    expect(describeQuest(quest, 'done', [], names).objectives.every((o) => o.done)).toBe(true);
  });
});
