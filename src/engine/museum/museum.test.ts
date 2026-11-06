import { describe, expect, it } from 'vitest';
import { Museum } from './museum';
import type { MuseumDef, MuseumMilestone, MuseumSave } from './types';

const def: MuseumDef = {
  id: 'museum',
  name: 'Museum',
  slots: [
    { item: 'trout', section: 'fish' },
    { item: 'carp', section: 'fish' },
    { item: 'quartz', section: 'mineral' },
    { item: 'ruby', section: 'mineral' },
    { item: 'arrowhead', section: 'artifact' },
    { item: 'vase', section: 'artifact' },
  ],
  milestones: [
    { count: 2, message: 'A start.', reward: { money: 100 } },
    { count: 4, message: 'Growing.', reward: { items: [{ id: 'bread', count: 2 }] } },
    { count: 6, message: 'Complete!', reward: { money: 500, items: [{ id: 'trophy', count: 1 }] } },
  ],
};

const [FIRST, SECOND, THIRD] = def.milestones as readonly [MuseumMilestone, MuseumMilestone, MuseumMilestone];
const ALL = ['trout', 'carp', 'quartz', 'ruby', 'arrowhead', 'vase'];

const museumWith = (items: readonly string[], claimed: readonly number[] = []): Museum => new Museum(def, { donated: items, claimed });
const indices = (m: Museum): number[] => m.claimable().map((entry) => entry.index);

describe('Museum donations', () => {
  it('starts empty', () => {
    const museum = new Museum(def);
    expect(museum.count).toBe(0);
    expect(ALL.some((item) => museum.has(item))).toBe(false);
    expect(museum.toSave()).toEqual({ donated: [], claimed: [] });
  });

  it('takes each wanted item once', () => {
    const museum = new Museum(def);
    expect(museum.canDonate('trout')).toBe('ok');
    expect(museum.donate('trout')).toBe(true);
    expect(museum.has('trout')).toBe(true);
    expect(museum.count).toBe(1);

    expect(museum.canDonate('trout')).toBe('already');
    expect(museum.donate('trout')).toBe(false);
    expect(museum.count).toBe(1);
  });

  it('refuses what the museum does not want', () => {
    const museum = new Museum(def);
    expect(museum.canDonate('banana')).toBe('not-wanted');
    expect(museum.donate('banana')).toBe(false);
    expect(museum.has('banana')).toBe(false);
    expect(museum.count).toBe(0);
  });

  it('counts distinct items across sections', () => {
    const museum = new Museum(def);
    for (const item of ALL) museum.donate(item);
    expect(museum.count).toBe(6);
    expect(ALL.every((item) => museum.canDonate(item) === 'already')).toBe(true);
  });

  it('reports progress per section', () => {
    const museum = new Museum(def);
    expect(museum.progress('fish')).toEqual({ have: 0, total: 2 });
    expect(museum.progress('mineral')).toEqual({ have: 0, total: 2 });
    expect(museum.progress('artifact')).toEqual({ have: 0, total: 2 });

    museum.donate('trout');
    museum.donate('ruby');
    museum.donate('vase');
    museum.donate('arrowhead');
    museum.donate('banana');
    expect(museum.progress('fish')).toEqual({ have: 1, total: 2 });
    expect(museum.progress('mineral')).toEqual({ have: 1, total: 2 });
    expect(museum.progress('artifact')).toEqual({ have: 2, total: 2 });
  });

  it('counts an item listed twice in the data once', () => {
    const doubled: MuseumDef = { ...def, slots: [...def.slots, { item: 'trout', section: 'mineral' }] };
    const museum = new Museum(doubled);
    expect(museum.progress('fish').total).toBe(2);
    expect(museum.progress('mineral').total).toBe(2);
    museum.donate('trout');
    expect(museum.progress('fish').have).toBe(1);
    expect(museum.progress('mineral').have).toBe(0);
  });

  it('bumps the version on every change and only then', () => {
    const museum = new Museum(def);
    expect(museum.version).toBe(0);
    museum.donate('banana');
    museum.canDonate('trout');
    museum.progress('fish');
    expect(museum.version).toBe(0);

    museum.donate('trout');
    expect(museum.version).toBe(1);
    museum.donate('trout');
    expect(museum.version).toBe(1);
    museum.donate('carp');
    expect(museum.version).toBe(2);

    expect(museum.claim(2)).toBeUndefined();
    expect(museum.version).toBe(2);
    museum.claim(0);
    expect(museum.version).toBe(3);
    museum.claim(0);
    expect(museum.version).toBe(3);
  });
});

describe('Museum milestones', () => {
  it('become claimable exactly when their count is reached', () => {
    const museum = new Museum(def);
    expect(museum.claimable()).toEqual([]);

    museum.donate('trout');
    expect(museum.claimable()).toEqual([]);
    museum.donate('carp');
    expect(museum.claimable()).toEqual([{ index: 0, milestone: FIRST }]);
    museum.donate('quartz');
    expect(indices(museum)).toEqual([0]);
    museum.donate('ruby');
    expect(indices(museum)).toEqual([0, 1]);
    museum.donate('arrowhead');
    expect(indices(museum)).toEqual([0, 1]);
    museum.donate('vase');
    expect(indices(museum)).toEqual([0, 1, 2]);
  });

  it('are handed over once', () => {
    const museum = museumWith(['trout', 'carp']);
    expect(museum.claim(0)).toBe(FIRST);
    expect(museum.claim(0)).toBeUndefined();
    expect(museum.claimable()).toEqual([]);
    expect(museum.toSave().claimed).toEqual([2]);
  });

  it('cannot be claimed early, or by a bad index', () => {
    const museum = museumWith(['trout', 'carp']);
    expect(museum.claim(1)).toBeUndefined();
    expect(museum.claim(3)).toBeUndefined();
    expect(museum.claim(-1)).toBeUndefined();
    expect(museum.claim(0.5)).toBeUndefined();
    expect(museum.claim(Number.NaN)).toBeUndefined();
    expect(museum.toSave().claimed).toEqual([]);
  });

  it('can be several at once, claimed in any order', () => {
    const museum = museumWith(ALL);
    expect(museum.claimable().map((entry) => entry.milestone)).toEqual([FIRST, SECOND, THIRD]);
    expect(museum.claim(2)).toBe(THIRD);
    expect(indices(museum)).toEqual([0, 1]);
    expect(museum.claim(0)).toBe(FIRST);
    expect(indices(museum)).toEqual([1]);
    expect(museum.claim(1)).toBe(SECOND);
    expect(museum.claimable()).toEqual([]);
    expect(museum.toSave().claimed).toEqual([2, 4, 6]);
  });

  it('point at the next one not yet reached', () => {
    const museum = new Museum(def);
    expect(museum.nextMilestone()).toBe(FIRST);
    museum.donate('trout');
    expect(museum.nextMilestone()).toBe(FIRST);
    museum.donate('carp');
    expect(museum.nextMilestone()).toBe(SECOND);
    museum.donate('quartz');
    museum.donate('ruby');
    expect(museum.nextMilestone()).toBe(THIRD);
    museum.donate('arrowhead');
    expect(museum.nextMilestone()).toBe(THIRD);
    museum.donate('vase');
    expect(museum.nextMilestone()).toBeUndefined();
  });

  it('keep pointing past a reached milestone whether or not it was claimed', () => {
    const museum = museumWith(['trout', 'carp'], [2]);
    expect(museum.nextMilestone()).toBe(SECOND);
    expect(museumWith(['trout', 'carp']).nextMilestone()).toBe(SECOND);
  });
});

describe('Museum saving', () => {
  it('round trips what was donated and claimed', () => {
    const museum = new Museum(def);
    for (const item of ['ruby', 'trout', 'vase', 'carp']) museum.donate(item);
    museum.claim(0);
    museum.claim(1);

    const saved = museum.toSave();
    const loaded = new Museum(def, JSON.parse(JSON.stringify(saved)) as MuseumSave);
    expect(loaded.toSave()).toEqual(saved);
    expect(loaded.count).toBe(4);
    expect(['ruby', 'trout', 'vase', 'carp'].every((item) => loaded.has(item))).toBe(true);
    expect(loaded.has('quartz')).toBe(false);
    expect(loaded.claimable()).toEqual([]);
    expect(loaded.nextMilestone()).toBe(THIRD);
    expect(loaded.version).toBe(0);
  });

  it('writes donations in slot order and claims ascending, however they happened', () => {
    const museum = new Museum(def);
    for (const item of ['vase', 'ruby', 'carp', 'trout']) museum.donate(item);
    museum.claim(1);
    museum.claim(0);
    expect(museum.toSave()).toEqual({ donated: ['trout', 'carp', 'ruby', 'vase'], claimed: [2, 4] });
  });

  it('hands out a copy, not the museum\'s own lists', () => {
    const museum = museumWith(['trout']);
    const saved = museum.toSave();
    (saved.donated as string[]).push('carp');
    expect(museum.has('carp')).toBe(false);
    expect(museum.toSave().donated).toEqual(['trout']);
  });

  it('does not change the save it loads from', () => {
    const saved: MuseumSave = { donated: ['ghost', 'trout', 'trout'], claimed: [7, 0, 0] };
    const copy = JSON.parse(JSON.stringify(saved)) as MuseumSave;
    new Museum(def, saved);
    expect(saved).toEqual(copy);
  });

  it('drops donations the museum no longer wants, and repeats', () => {
    const museum = museumWith(['ghost', 'carp', 'trout', 'carp', 'banana', 'trout']);
    expect(museum.count).toBe(2);
    expect(museum.toSave().donated).toEqual(['trout', 'carp']);
    expect(museum.has('ghost')).toBe(false);
    expect(museum.canDonate('ghost')).toBe('not-wanted');
  });

  it('drops claims that are for a count no milestone has, malformed, or for a milestone not yet earned', () => {
    // Two donations earn only the milestone at 2. The ones at 4 and 6 are not earned yet; 3, 99, 0 and -1 are no milestone's count; 1.5 and NaN are not counts.
    const museum = museumWith(['trout', 'carp'], [3, 99, -1, 0, 1.5, Number.NaN, 6, 4, 2, 2]);
    expect(museum.toSave().claimed).toEqual([2]);
    expect(museum.claimable()).toEqual([]);
  });

  it('keeps claims for milestones the donations have earned', () => {
    const museum = museumWith(['trout', 'carp', 'quartz', 'ruby'], [4, 2]);
    expect(museum.toSave().claimed).toEqual([2, 4]);
    expect(museum.claimable()).toEqual([]);
  });

  it('judges claims against the donations that survive the cleaning, not the ones that were listed', () => {
    // Four listed, but two are unknown: only two count, so the milestone at four has not been earned.
    const museum = museumWith(['trout', 'carp', 'ghost', 'phantom'], [2, 4]);
    expect(museum.count).toBe(2);
    expect(museum.toSave().claimed).toEqual([2]);
  });

  it('keeps a paid reward paid when the list of rewards changes: it is remembered by the count that earned it', () => {
    const items = ['trout', 'carp', 'quartz', 'ruby'];
    const saved = museumWith(items, [2]).toSave();
    // A newer museum puts a new reward at 1 in front of the old ones, and moves the others down a place.
    const newer: MuseumDef = { ...def, milestones: [{ count: 1, message: 'New.', reward: { money: 1 } }, ...def.milestones] };
    const museum = new Museum(newer, saved);
    expect(museum.claimable().map((e) => e.milestone.count)).toEqual([1, 4]); // 2 is still paid, 1 and 4 are new
    expect(museum.toSave().claimed).toEqual([2]);
  });

  it('copes with an empty save', () => {
    const museum = new Museum(def, { donated: [], claimed: [] });
    expect(museum.toSave()).toEqual({ donated: [], claimed: [] });
    expect(museum.nextMilestone()).toBe(FIRST);
  });
});
