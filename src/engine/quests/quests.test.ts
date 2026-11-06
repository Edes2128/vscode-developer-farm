import { describe, expect, it } from 'vitest';
import { QuestLog } from './questLog';
import type { QuestDef } from './types';

const quest = (over: Partial<QuestDef> = {}): QuestDef => ({
  id: 'q',
  title: 'Q',
  giver: 'ann',
  summary: '',
  offer: ['hi'],
  accepted: 'ok',
  done: ['thanks'],
  objectives: [{ kind: 'ship', item: 'radish', count: 3 }],
  rewards: { money: 10 },
  ...over,
});

describe('QuestLog', () => {
  it('offers a quest once its conditions hold, and not once it is taken', () => {
    const log = new QuestLog([quest({ requires: [{ kind: 'flag', name: 'x' }] })]);
    expect(log.canOffer('q', (c) => c.length === 0)).toBe(false);
    expect(log.canOffer('q', () => true)).toBe(true);
    log.accept('q');
    expect(log.canOffer('q', () => true)).toBe(false);
    expect(log.canOffer('missing', () => true)).toBe(false);
  });

  it('counts progress towards an objective and becomes ready when it is met', () => {
    const log = new QuestLog([quest()]);
    log.accept('q');
    expect(log.status('q')).toBe('active');
    expect(log.notify({ kind: 'ship', item: 'radish', count: 2 })).toMatchObject({ progressed: [{ id: 'q' }], ready: [] });
    expect(log.progress('q')).toEqual([2]);
    expect(log.notify({ kind: 'ship', item: 'radish', count: 5 }).ready.map((d) => d.id)).toEqual(['q']);
    expect(log.progress('q')).toEqual([3]); // capped at what was asked for
    expect(log.status('q')).toBe('ready');
  });

  it('ignores things that are not what was asked for', () => {
    const log = new QuestLog([quest()]);
    log.accept('q');
    const change = log.notify({ kind: 'ship', item: 'pumpkin', count: 9 });
    expect(change.progressed).toEqual([]);
    expect(log.notify({ kind: 'harvest', item: 'radish', count: 9 }).progressed).toEqual([]);
    expect(log.progress('q')).toEqual([0]);
  });

  it('does not count what happened before the quest was taken', () => {
    const log = new QuestLog([quest()]);
    log.notify({ kind: 'ship', item: 'radish', count: 3 });
    log.accept('q');
    expect(log.progress('q')).toEqual([0]);
  });

  it('can be primed with what the player has already done', () => {
    const log = new QuestLog([quest({ objectives: [{ kind: 'visit', map: 'green' }] })]);
    log.accept('q', (o) => (o.kind === 'visit' ? 1 : 0));
    expect(log.status('q')).toBe('ready');
  });

  it('needs every objective, not just one', () => {
    const log = new QuestLog([quest({ objectives: [{ kind: 'ship', item: 'radish', count: 1 }, { kind: 'feed', count: 2 }, { kind: 'visit', map: 'green' }] })]);
    log.accept('q');
    log.notify({ kind: 'ship', item: 'radish', count: 1 });
    log.notify({ kind: 'feed', count: 1 });
    expect(log.status('q')).toBe('active');
    log.notify({ kind: 'feed', count: 1 });
    log.notify({ kind: 'visit', map: 'green' });
    expect(log.status('q')).toBe('ready');
  });

  it('treats friendship as a level, not a tally', () => {
    const log = new QuestLog([quest({ objectives: [{ kind: 'friendship', npc: 'ann', hearts: 3 }] })]);
    log.accept('q', () => 1);
    log.notify({ kind: 'friendship', npc: 'ann', hearts: 2 });
    expect(log.progress('q')).toEqual([2]);
    log.notify({ kind: 'friendship', npc: 'ann', hearts: 1 });
    expect(log.progress('q')).toEqual([2]); // never goes back down
    log.notify({ kind: 'friendship', npc: 'bob', hearts: 9 });
    expect(log.status('q')).toBe('active');
    log.notify({ kind: 'friendship', npc: 'ann', hearts: 3 });
    expect(log.status('q')).toBe('ready');
  });

  it('knows what a villager is waiting to be handed', () => {
    const log = new QuestLog([quest({ objectives: [{ kind: 'deliver', item: 'strawberry', count: 3, to: 'ann' }] })]);
    expect(log.deliveries('ann')).toEqual([]);
    log.accept('q');
    expect(log.deliveries('ann')).toMatchObject([{ remaining: 3 }]);
    expect(log.deliveries('bob')).toEqual([]);
    log.notify({ kind: 'deliver', item: 'strawberry', count: 2, to: 'ann' });
    expect(log.deliveries('ann')).toMatchObject([{ remaining: 1 }]);
    log.notify({ kind: 'deliver', item: 'strawberry', count: 1, to: 'ann' });
    expect(log.deliveries('ann')).toEqual([]);
  });

  it('is finished by reporting a ready quest, once', () => {
    const log = new QuestLog([quest()]);
    expect(log.complete('q')).toBeUndefined();
    log.accept('q');
    expect(log.complete('q')).toBeUndefined(); // not ready
    log.notify({ kind: 'ship', item: 'radish', count: 3 });
    expect(log.open().map((d) => d.id)).toEqual(['q']);
    expect(log.complete('q')?.id).toBe('q');
    expect(log.complete('q')).toBeUndefined();
    expect(log.status('q')).toBe('done');
    expect(log.open()).toEqual([]);
    expect(log.finished().map((d) => d.id)).toEqual(['q']);
  });

  it('round-trips through a save, drops unknown quests and clamps nonsense', () => {
    const log = new QuestLog([quest()]);
    log.accept('q');
    log.notify({ kind: 'ship', item: 'radish', count: 2 });
    const copy = new QuestLog([quest()], log.toSave());
    expect(copy.toSave()).toEqual(log.toSave());
    const odd = new QuestLog([quest()], [{ id: 'gone', status: 'active', progress: [1] }, { id: 'q', status: 'active', progress: [99] }]);
    expect(odd.toSave()).toEqual([{ id: 'q', status: 'active', progress: [3] }]);
  });

  it('tells the HUD when something changed', () => {
    const log = new QuestLog([quest()]);
    const v0 = log.version;
    log.notify({ kind: 'ship', item: 'radish', count: 1 });
    expect(log.version).toBe(v0);
    log.accept('q');
    expect(log.version).toBeGreaterThan(v0);
  });
});
