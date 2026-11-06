import { describe, expect, it } from 'vitest';
import { Bestiary } from './bestiary';
import type { BestiarySave, CreatureDef } from './types';

const make = (id: string): CreatureDef => ({
  id,
  name: id,
  description: '',
  sprite: id,
  maps: ['woods'],
  seasons: ['autumn'],
  weather: ['sun'],
  from: 360,
  to: 600,
  chance: 1,
  likes: ['berry'],
  keepsake: { item: 'feather', count: 1 },
});

/** Declared in this order: a save is written in this order, whatever order things happened in. */
const defs: readonly CreatureDef[] = ['fox', 'owl', 'heron', 'deer'].map(make);

const bestiaryWith = (seen: readonly string[], friends: readonly string[] = []): Bestiary => new Bestiary(defs, { seen, friends });

describe('Bestiary', () => {
  it('starts empty', () => {
    const book = new Bestiary(defs);
    expect(book.seenCount).toBe(0);
    expect(book.friendCount).toBe(0);
    expect(book.version).toBe(0);
    for (const def of defs) {
      expect(book.hasSeen(def.id)).toBe(false);
      expect(book.isFriend(def.id)).toBe(false);
    }
    expect(book.toSave()).toEqual({ seen: [], friends: [] });
  });

  it('starts empty from an empty save too', () => {
    const book = new Bestiary(defs, { seen: [], friends: [] });
    expect(book.seenCount).toBe(0);
    expect(book.friendCount).toBe(0);
    expect(book.toSave()).toEqual({ seen: [], friends: [] });
  });

  it('works with no creatures at all', () => {
    const book = new Bestiary([]);
    expect(book.see('fox')).toBe(false);
    expect(book.befriend('fox')).toBe(false);
    expect(book.toSave()).toEqual({ seen: [], friends: [] });
    expect(book.version).toBe(0);
  });

  describe('see', () => {
    it('writes a creature in the book, true only the first time', () => {
      const book = new Bestiary(defs);
      expect(book.see('fox')).toBe(true);
      expect(book.hasSeen('fox')).toBe(true);
      expect(book.seenCount).toBe(1);

      expect(book.see('fox')).toBe(false);
      expect(book.seenCount).toBe(1);
      expect(book.hasSeen('owl')).toBe(false);
    });

    it('refuses a creature the game does not have', () => {
      const book = new Bestiary(defs);
      expect(book.see('dragon')).toBe(false);
      expect(book.see('')).toBe(false);
      expect(book.hasSeen('dragon')).toBe(false);
      expect(book.seenCount).toBe(0);
      expect(book.version).toBe(0);
    });

    it('does not make a friend', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      expect(book.isFriend('fox')).toBe(false);
      expect(book.friendCount).toBe(0);
    });

    it('counts each different creature once', () => {
      const book = new Bestiary(defs);
      for (const id of ['fox', 'owl', 'fox', 'heron', 'owl', 'deer', 'deer']) book.see(id);
      expect(book.seenCount).toBe(4);
    });
  });

  describe('befriend', () => {
    it('needs the creature to have been seen first', () => {
      const book = new Bestiary(defs);
      expect(book.befriend('fox')).toBe(false);
      expect(book.isFriend('fox')).toBe(false);
      expect(book.friendCount).toBe(0);
      expect(book.hasSeen('fox')).toBe(false); // refusing it did not write it in as seen either
      expect(book.version).toBe(0);
    });

    it('makes a seen creature a friend, true only the first time', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      expect(book.befriend('fox')).toBe(true);
      expect(book.isFriend('fox')).toBe(true);
      expect(book.friendCount).toBe(1);

      expect(book.befriend('fox')).toBe(false);
      expect(book.friendCount).toBe(1);
    });

    it('refuses a creature the game does not have, even if it was somehow "seen"', () => {
      const book = new Bestiary(defs);
      book.see('dragon');
      expect(book.befriend('dragon')).toBe(false);
      expect(book.isFriend('dragon')).toBe(false);
    });

    it('keeps the creature seen', () => {
      const book = new Bestiary(defs);
      book.see('owl');
      book.befriend('owl');
      expect(book.hasSeen('owl')).toBe(true);
      expect(book.seenCount).toBe(1);
    });

    it('does not befriend the others', () => {
      const book = new Bestiary(defs);
      book.see('owl');
      book.see('fox');
      book.befriend('owl');
      expect(book.isFriend('fox')).toBe(false);
      expect(book.friendCount).toBe(1);
      expect(book.seenCount).toBe(2);
    });
  });

  describe('loading a save', () => {
    it('restores what was seen and befriended', () => {
      const book = bestiaryWith(['fox', 'owl', 'deer'], ['owl']);
      expect(book.seenCount).toBe(3);
      expect(book.friendCount).toBe(1);
      expect(book.hasSeen('fox')).toBe(true);
      expect(book.hasSeen('heron')).toBe(false);
      expect(book.isFriend('owl')).toBe(true);
      expect(book.isFriend('fox')).toBe(false);
    });

    it('drops creatures the game no longer has', () => {
      const book = bestiaryWith(['fox', 'dragon', 'unicorn'], ['fox', 'dragon']);
      expect(book.seenCount).toBe(1);
      expect(book.friendCount).toBe(1);
      expect(book.hasSeen('dragon')).toBe(false);
      expect(book.isFriend('dragon')).toBe(false);
      expect(book.toSave()).toEqual({ seen: ['fox'], friends: ['fox'] });
    });

    it('counts a creature listed twice once', () => {
      const book = bestiaryWith(['fox', 'fox', 'owl', 'fox'], ['fox', 'fox']);
      expect(book.seenCount).toBe(2);
      expect(book.friendCount).toBe(1);
      expect(book.toSave()).toEqual({ seen: ['fox', 'owl'], friends: ['fox'] });
    });

    it('drops a friend that was never seen: you can only befriend what you have seen', () => {
      // Decided: a friend missing from `seen` is junk and goes. It is not promoted to "seen" to make the save add up.
      const book = bestiaryWith(['fox'], ['fox', 'owl']);
      expect(book.isFriend('fox')).toBe(true);
      expect(book.isFriend('owl')).toBe(false);
      expect(book.hasSeen('owl')).toBe(false);
      expect(book.friendCount).toBe(1);
      expect(book.seenCount).toBe(1);
      expect(book.toSave()).toEqual({ seen: ['fox'], friends: ['fox'] });
    });

    it('drops every friend when nothing was seen', () => {
      const book = bestiaryWith([], ['fox', 'owl']);
      expect(book.friendCount).toBe(0);
      expect(book.seenCount).toBe(0);
      expect(book.toSave()).toEqual({ seen: [], friends: [] });
    });

    it('does not take a friend whose "seen" was an unknown creature, either', () => {
      const book = bestiaryWith(['dragon'], ['dragon']);
      expect(book.toSave()).toEqual({ seen: [], friends: [] });
    });

    it('can still befriend a dropped friend later, once it has been seen', () => {
      const book = bestiaryWith(['fox'], ['owl']);
      expect(book.befriend('owl')).toBe(false);
      expect(book.see('owl')).toBe(true);
      expect(book.befriend('owl')).toBe(true);
    });

    it('lets a creature that is seen but not a friend be befriended', () => {
      const book = bestiaryWith(['fox', 'owl'], ['owl']);
      expect(book.befriend('fox')).toBe(true);
      expect(book.befriend('owl')).toBe(false);
    });

    it('is not a change: the version stays at 0, even when junk was dropped', () => {
      expect(new Bestiary(defs, { seen: ['fox', 'owl'], friends: ['fox'] }).version).toBe(0);
      expect(new Bestiary(defs, { seen: ['fox', 'dragon', 'fox'], friends: ['owl', 'dragon'] }).version).toBe(0);
    });

    it('does not change the save it was given', () => {
      const saved: BestiarySave = { seen: ['owl', 'fox', 'fox', 'dragon'], friends: ['fox', 'deer'] };
      const before = JSON.stringify(saved);
      const book = new Bestiary(defs, saved);
      book.see('heron');
      book.befriend('heron');
      expect(JSON.stringify(saved)).toBe(before);
    });

    it('does not share the save\'s arrays: changing the book later leaves the save alone', () => {
      const seen = ['fox'];
      const friends: string[] = [];
      const book = new Bestiary(defs, { seen, friends });
      book.see('owl');
      book.befriend('owl');
      expect(seen).toEqual(['fox']);
      expect(friends).toEqual([]);
    });

    it('copes with creatures that share an id in the defs, counting them once', () => {
      const twice = [...defs, make('fox')];
      const book = new Bestiary(twice, { seen: ['fox'], friends: ['fox'] });
      expect(book.seenCount).toBe(1);
      expect(book.toSave()).toEqual({ seen: ['fox'], friends: ['fox'] });
      expect(book.see('owl')).toBe(true);
      expect(book.toSave().seen).toEqual(['fox', 'owl']);
    });
  });

  describe('toSave', () => {
    it('writes ids in the order of the defs, not the order they happened in', () => {
      const book = new Bestiary(defs);
      for (const id of ['deer', 'fox', 'heron', 'owl']) book.see(id);
      for (const id of ['owl', 'deer', 'fox']) book.befriend(id);
      expect(book.toSave()).toEqual({
        seen: ['fox', 'owl', 'heron', 'deer'],
        friends: ['fox', 'owl', 'deer'],
      });
    });

    it('writes the order of the defs even when the save it loaded was in another order', () => {
      const book = bestiaryWith(['deer', 'owl', 'fox'], ['deer', 'fox']);
      expect(book.toSave()).toEqual({ seen: ['fox', 'owl', 'deer'], friends: ['fox', 'deer'] });
    });

    it('hands out copies, never the sets of the book', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      book.befriend('fox');

      const first = book.toSave();
      (first.seen as string[]).push('owl');
      (first.friends as string[]).length = 0;
      expect(book.hasSeen('owl')).toBe(false);
      expect(book.isFriend('fox')).toBe(true);
      expect(book.toSave()).toEqual({ seen: ['fox'], friends: ['fox'] });

      const a = book.toSave();
      const b = book.toSave();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.seen).not.toBe(b.seen);
      expect(a.friends).not.toBe(b.friends);
    });

    it('does not change as the book is saved again and again', () => {
      const book = bestiaryWith(['owl', 'fox'], ['owl']);
      const first = JSON.stringify(book.toSave());
      expect(JSON.stringify(book.toSave())).toBe(first);
      expect(book.version).toBe(0);
    });

    it('survives a round trip, in either direction of order', () => {
      const book = new Bestiary(defs);
      for (const id of ['heron', 'fox', 'deer']) book.see(id);
      book.befriend('heron');
      book.befriend('fox');

      const loaded = new Bestiary(defs, book.toSave());
      expect(loaded.toSave()).toEqual(book.toSave());
      for (const def of defs) {
        expect(loaded.hasSeen(def.id)).toBe(book.hasSeen(def.id));
        expect(loaded.isFriend(def.id)).toBe(book.isFriend(def.id));
      }
      expect(loaded.seenCount).toBe(3);
      expect(loaded.friendCount).toBe(2);
    });

    it('survives a trip through JSON', () => {
      const book = bestiaryWith(['owl', 'fox'], ['fox']);
      const loaded = new Bestiary(defs, JSON.parse(JSON.stringify(book.toSave())) as BestiarySave);
      expect(loaded.toSave()).toEqual(book.toSave());
    });

    it('a cleaned save saves as it loads: loading junk then saving gives a clean save that loads to itself', () => {
      const dirty: BestiarySave = { seen: ['dragon', 'owl', 'owl', 'fox'], friends: ['deer', 'dragon', 'fox', 'fox'] };
      const once = new Bestiary(defs, dirty).toSave();
      expect(once).toEqual({ seen: ['fox', 'owl'], friends: ['fox'] });
      expect(new Bestiary(defs, once).toSave()).toEqual(once);
    });
  });

  describe('version', () => {
    it('starts at 0', () => {
      expect(new Bestiary(defs).version).toBe(0);
    });

    it('goes up by one on every real change', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      expect(book.version).toBe(1);
      book.befriend('fox');
      expect(book.version).toBe(2);
      book.see('owl');
      expect(book.version).toBe(3);
    });

    it('does not move when nothing changed', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      book.befriend('fox');
      const version = book.version;
      expect(book.see('fox')).toBe(false); // already seen
      expect(book.befriend('fox')).toBe(false); // already a friend
      expect(book.see('dragon')).toBe(false); // unknown
      expect(book.befriend('dragon')).toBe(false); // unknown
      expect(book.befriend('owl')).toBe(false); // not seen
      book.hasSeen('fox');
      book.isFriend('fox');
      book.toSave();
      expect(book.version).toBe(version);
    });

    it('moves exactly when the call says true', () => {
      const book = new Bestiary(defs);
      const calls: (() => boolean)[] = [
        () => book.befriend('fox'),
        () => book.see('fox'),
        () => book.see('fox'),
        () => book.befriend('fox'),
        () => book.befriend('fox'),
        () => book.see('nope'),
        () => book.see('deer'),
      ];
      for (const call of calls) {
        const before = book.version;
        const changed = call();
        expect(book.version).toBe(before + (changed ? 1 : 0));
      }
      expect(book.version).toBe(3);
    });

    it('is not reset by saving, and a loaded book starts again from 0', () => {
      const book = new Bestiary(defs);
      book.see('fox');
      book.toSave();
      expect(book.version).toBe(1);
      const loaded = new Bestiary(defs, book.toSave());
      expect(loaded.version).toBe(0);
      loaded.see('owl');
      expect(loaded.version).toBe(1);
    });
  });
});
