import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import { seasonAgenda, upcoming, yearAgenda } from './agenda';

describe('the village calendar', () => {
  const { festivals, npcs } = CONTENT;

  it('lists every festival and every villager\'s birthday once, in calendar order', () => {
    const all = yearAgenda(festivals, npcs);
    expect(all.filter((e) => e.kind === 'festival')).toHaveLength(festivals.length);
    expect(all.filter((e) => e.kind === 'birthday')).toHaveLength(npcs.length);
    const order = ['spring', 'summer', 'autumn', 'winter'];
    for (let i = 1; i < all.length; i += 1) {
      const a = all[i - 1]!;
      const b = all[i]!;
      expect(order.indexOf(a.season) * 100 + a.day).toBeLessThanOrEqual(order.indexOf(b.season) * 100 + b.day);
    }
  });

  it('picks out one season', () => {
    const spring = seasonAgenda('spring', festivals, npcs);
    expect(spring.every((e) => e.season === 'spring')).toBe(true);
    expect(spring.some((e) => e.label === 'The Egg Hunt' && e.day === 13)).toBe(true);
    expect(spring.some((e) => e.label === "Willa's birthday" && e.day === 14)).toBe(true);
  });

  it('says what is next from tomorrow, soonest first, and wraps into next year', () => {
    const next = upcoming(10, festivals, npcs, 3);
    expect(next[0]).toMatchObject({ label: 'The Egg Hunt', inDays: 3, when: 'Spring 13', kind: 'festival' });
    expect(next.map((n) => n.inDays)).toEqual([...next.map((n) => n.inDays)].sort((a, b) => a - b));
    // The last day of the year: what is next is early in spring, in a day or a few.
    const wrap = upcoming(112, festivals, npcs, 1)[0]!;
    expect(wrap.inDays).toBeGreaterThanOrEqual(1);
    expect(wrap.inDays).toBeLessThanOrEqual(28);
    // Today's own event is not repeated: on Egg Hunt day the next festival is far off.
    expect(upcoming(13, festivals, npcs, 10).some((n) => n.label === 'The Egg Hunt' && n.inDays < 100)).toBe(false);
  });

  it('is empty when asked for nothing or when there is nothing', () => {
    expect(upcoming(1, festivals, npcs, 0)).toEqual([]);
    expect(upcoming(1, [], [], 5)).toEqual([]);
  });
});
