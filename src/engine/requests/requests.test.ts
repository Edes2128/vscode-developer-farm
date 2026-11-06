import { describe, expect, it } from 'vitest';
import { seasonOf, type Season } from '../time/calendar';
import { REQUESTS_PER_DAY, canFulfil, paymentFor, requestText, requestsFor } from './requests';
import type { Request, RequestOffer, RequestPool } from './types';

/** An offer; `seasons` is only present when given (the type forbids an explicit `undefined`). */
const offer = (item: string, min: number, max: number, pay: number, seasons?: readonly Season[]): RequestOffer =>
  seasons === undefined ? { item, min, max, pay } : { item, min, max, pay, seasons };

const request = (money: number, count = 3, id = 'req:1:0'): Request => ({ id, giver: 'willa', item: 'radish', count, money });

const GIVERS = ['willa', 'bram', 'ione', 'tess', 'otto', 'mara'];
const YEAR_ROUND: RequestOffer[] = [
  offer('egg', 2, 6, 12),
  offer('milk', 1, 3, 25),
  offer('firewood', 4, 10, 6),
  offer('honey', 1, 2, 40),
  offer('wool', 1, 4, 30),
];
const SEASONAL: RequestOffer[] = [
  offer('radish', 2, 5, 40, ['spring']),
  offer('blueberry', 3, 8, 20, ['summer']),
  offer('pumpkin', 1, 3, 70, ['autumn']),
  offer('snowdrop', 2, 4, 35, ['winter']),
  offer('carp', 1, 2, 55, ['spring', 'summer', 'autumn']),
];
const RICH: RequestPool = { givers: GIVERS, offers: [...YEAR_ROUND, ...SEASONAL] };
const FLAT: RequestPool = { givers: GIVERS, offers: YEAR_ROUND };

/** The parts of a board that are chosen, without the id (which carries the day and would make every board differ). */
const shape = (board: readonly Request[]): string => JSON.stringify(board.map(({ giver, item, count, money }) => [giver, item, count, money]));
const days = (first: number, last: number): number[] => Array.from({ length: last - first + 1 }, (_, i) => first + i);
const offerFor = (pool: RequestPool, item: string): RequestOffer => pool.offers.find((o) => o.item === item) as RequestOffer;

/** Freezes a pool all the way down, so any attempt to change it throws. */
const frozen = (pool: RequestPool): RequestPool => {
  pool.offers.forEach((o) => Object.freeze(o.seasons));
  pool.offers.forEach(Object.freeze);
  Object.freeze(pool.offers);
  Object.freeze(pool.givers);
  return Object.freeze(pool);
};

describe('requestsFor', () => {
  it('gives the same board for the same day and pool every time', () => {
    const first = requestsFor(12, RICH);
    expect(requestsFor(12, RICH)).toEqual(first);
    expect(requestsFor(12, structuredClone(RICH))).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('gives a different board on a different day', () => {
    const boards = new Set(days(1, 60).map((day) => shape(requestsFor(day, FLAT))));
    expect(boards.size).toBe(60);
  });

  it('gives a different board for a different pool', () => {
    const other: RequestPool = { givers: GIVERS, offers: YEAR_ROUND.slice(0, 4) };
    expect(requestsFor(5, other)).not.toEqual(requestsFor(5, FLAT));
  });

  it('gives REQUESTS_PER_DAY requests on every day of two years', () => {
    for (const day of days(1, 224)) expect(requestsFor(day, RICH)).toHaveLength(REQUESTS_PER_DAY);
  });

  it('numbers its requests req:<day>:<slot>', () => {
    for (const day of [1, 2, 57, 300]) {
      expect(requestsFor(day, RICH).map((r) => r.id)).toEqual(Array.from({ length: REQUESTS_PER_DAY }, (_, slot) => `req:${day}:${slot}`));
    }
  });

  it('never asks for the same item twice in a day', () => {
    for (const day of days(1, 200)) {
      const items = requestsFor(day, RICH).map((r) => r.item);
      expect(new Set(items).size).toBe(items.length);
    }
  });

  it('keeps two offers for one item off the board together', () => {
    const pool: RequestPool = { givers: GIVERS, offers: [offer('carp', 1, 2, 50), offer('carp', 3, 4, 60), offer('egg', 1, 2, 10)] };
    for (const day of days(1, 60)) {
      const items = requestsFor(day, pool).map((r) => r.item);
      expect(items.sort()).toEqual(['carp', 'egg']);
    }
  });

  it('uses a different giver for every request when the pool has enough', () => {
    for (const day of days(1, 100)) {
      const askers = requestsFor(day, RICH).map((r) => r.giver);
      expect(new Set(askers).size).toBe(askers.length);
      expect(askers.every((giver) => GIVERS.includes(giver))).toBe(true);
    }
  });

  it('still uses different givers when there are exactly as many as requests', () => {
    const pool: RequestPool = { givers: ['willa', 'bram', 'ione'], offers: YEAR_ROUND };
    for (const day of days(1, 60)) expect(new Set(requestsFor(day, pool).map((r) => r.giver)).size).toBe(REQUESTS_PER_DAY);
  });

  it('shares the work out when there are fewer givers than requests', () => {
    const two: RequestPool = { givers: ['willa', 'bram'], offers: YEAR_ROUND };
    const one: RequestPool = { givers: ['willa'], offers: YEAR_ROUND };
    for (const day of days(1, 40)) {
      const board = requestsFor(day, two);
      expect(board).toHaveLength(REQUESTS_PER_DAY);
      expect(new Set(board.map((r) => r.giver))).toEqual(new Set(['willa', 'bram']));
      expect(requestsFor(day, one).map((r) => r.giver)).toEqual(['willa', 'willa', 'willa']);
    }
  });

  it('counts a giver listed twice as one giver', () => {
    const pool: RequestPool = { givers: ['willa', 'willa', 'bram'], offers: YEAR_ROUND };
    for (const day of days(1, 20)) expect(new Set(requestsFor(day, pool).map((r) => r.giver))).toEqual(new Set(['willa', 'bram']));
  });

  it('does not ask for a spring-only offer in winter, or for any offer out of its seasons', () => {
    for (const day of days(1, 224)) {
      const season = seasonOf(day);
      for (const r of requestsFor(day, RICH)) {
        const seasons = offerFor(RICH, r.item).seasons;
        if (seasons !== undefined) expect(seasons, `${r.item} on day ${day}`).toContain(season);
      }
    }
    const winter = days(85, 112);
    expect(winter.every((day) => seasonOf(day) === 'winter')).toBe(true);
    for (const day of winter) expect(requestsFor(day, RICH).map((r) => r.item)).not.toContain('radish');
  });

  it('gives an empty board when every offer is out of season', () => {
    const springOnly: RequestPool = { givers: GIVERS, offers: [offer('radish', 1, 3, 40, ['spring'])] };
    expect(requestsFor(1, springOnly)).toHaveLength(1);
    expect(requestsFor(29, springOnly)).toEqual([]);
    expect(requestsFor(85, springOnly)).toEqual([]);
  });

  it('asks for offers with no seasons at any time of year, and never for an empty list of seasons', () => {
    const pool: RequestPool = { givers: GIVERS, offers: [offer('egg', 1, 2, 10), offer('ghost', 1, 2, 10, [])] };
    for (const day of [1, 30, 60, 90]) expect(requestsFor(day, pool).map((r) => r.item)).toEqual(['egg']);
  });

  it('keeps count a whole number within the offer, and reaches both ends', () => {
    const seen = new Map<string, Set<number>>();
    for (const day of days(1, 200)) {
      for (const r of requestsFor(day, RICH)) {
        const { min, max } = offerFor(RICH, r.item);
        expect(Number.isInteger(r.count)).toBe(true);
        expect(r.count).toBeGreaterThanOrEqual(min);
        expect(r.count).toBeLessThanOrEqual(max);
        seen.set(r.item, (seen.get(r.item) ?? new Set<number>()).add(r.count));
      }
    }
    for (const { item, min, max } of RICH.offers) {
      expect(seen.get(item)?.has(min), `${item} min`).toBe(true);
      expect(seen.get(item)?.has(max), `${item} max`).toBe(true);
    }
  });

  it('rounds count x pay to a whole number of gold', () => {
    // 3 x 2.5 = 7.5 and 2 x 1.25 = 2.5 are ties and round up; 3 x 0.3 = 0.9 rounds to 1.
    const cases: [RequestOffer, number][] = [[offer('a', 3, 3, 2.5), 8], [offer('b', 2, 2, 1.25), 3], [offer('c', 3, 3, 0.3), 1], [offer('d', 4, 4, 0.1), 0]];
    for (const [o, money] of cases) {
      const [only] = requestsFor(1, { givers: GIVERS, offers: [o] });
      expect(only?.money).toBe(money);
    }
  });

  it('pays count x pay for every request, to the gold', () => {
    for (const day of days(1, 100)) {
      for (const r of requestsFor(day, RICH)) {
        expect(r.money).toBe(Math.round(r.count * offerFor(RICH, r.item).pay));
        expect(Number.isInteger(r.money)).toBe(true);
      }
    }
  });

  it('never changes the pool or its arrays', () => {
    const pool = frozen(structuredClone(RICH));
    const before = JSON.stringify(pool);
    for (const day of days(1, 60)) requestsFor(day, pool);
    expect(JSON.stringify(pool)).toBe(before);
  });

  it('asks for every offer in a rich pool at least once over 200 days', () => {
    const asked = new Set<string>();
    for (const day of days(1, 200)) for (const r of requestsFor(day, RICH)) asked.add(r.item);
    expect([...asked].sort()).toEqual(RICH.offers.map((o) => o.item).sort());
  });

  it('gives nothing when there are no givers or no offers', () => {
    expect(requestsFor(1, { givers: [], offers: YEAR_ROUND })).toEqual([]);
    expect(requestsFor(1, { givers: GIVERS, offers: [] })).toEqual([]);
    expect(requestsFor(1, { givers: [], offers: [] })).toEqual([]);
  });

  it('gives one request for a one-offer pool, and as many as there are offers when short', () => {
    const one = requestsFor(7, { givers: GIVERS, offers: [offer('egg', 2, 4, 10)] });
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ id: 'req:7:0', item: 'egg' });
    expect(requestsFor(7, { givers: GIVERS, offers: YEAR_ROUND.slice(0, 2) })).toHaveLength(2);
    expect(requestsFor(7, { givers: ['willa'], offers: [offer('egg', 2, 4, 10)] })).toHaveLength(1);
  });

  it('gives fewer requests when the pool has too few distinct items', () => {
    const same: RequestPool = { givers: GIVERS, offers: [offer('egg', 1, 2, 10), offer('egg', 2, 3, 12), offer('egg', 3, 4, 14), offer('milk', 1, 1, 20)] };
    for (const day of days(1, 20)) expect(requestsFor(day, same)).toHaveLength(2);
  });

  it('skips offers that could not give a sensible request', () => {
    const broken: RequestOffer[] = [
      offer('zero', 0, 0, 10),
      offer('backwards', 5, 2, 10),
      offer('between', 2.2, 2.8, 10),
      offer('nan_pay', 1, 2, Number.NaN),
      offer('free_lunch', 1, 2, -5),
      offer('infinite', 1, Number.POSITIVE_INFINITY, 5),
    ];
    expect(requestsFor(1, { givers: GIVERS, offers: broken })).toEqual([]);
    for (const day of days(1, 30)) {
      expect(requestsFor(day, { givers: GIVERS, offers: [...broken, ...YEAR_ROUND] }).every((r) => YEAR_ROUND.some((o) => o.item === r.item))).toBe(true);
    }
  });

  it('takes whole counts from an offer with fractional bounds', () => {
    const fractional = offer('egg', 1.5, 3.9, 10);
    for (const day of days(1, 40)) expect([2, 3]).toContain(requestsFor(day, { givers: GIVERS, offers: [fractional] })[0]?.count);
  });
});

describe('canFulfil', () => {
  it('needs at least as many as asked for', () => {
    expect(canFulfil(request(100, 3), 2)).toBe(false);
    expect(canFulfil(request(100, 3), 3)).toBe(true);
    expect(canFulfil(request(100, 3), 4)).toBe(true);
  });

  it('is false for an empty hand, true for a request of one when holding one', () => {
    expect(canFulfil(request(100, 3), 0)).toBe(false);
    expect(canFulfil(request(100, 1), 0)).toBe(false);
    expect(canFulfil(request(100, 1), 1)).toBe(true);
  });

  it('is false when the count held is not a number', () => {
    expect(canFulfil(request(100, 3), Number.NaN)).toBe(false);
  });
});

describe('paymentFor', () => {
  it('adds 5% per heart: nothing at 0, a quarter at 5, a half at 10', () => {
    expect(paymentFor(request(100), 0)).toBe(100);
    expect(paymentFor(request(100), 5)).toBe(125);
    expect(paymentFor(request(100), 10)).toBe(150);
    expect(paymentFor(request(130), 0)).toBe(130);
    expect(paymentFor(request(130), 10)).toBe(195);
  });

  it('rounds to a whole number of gold, with a half rounding up', () => {
    expect(paymentFor(request(10), 1)).toBe(11); // 10.5
    expect(paymentFor(request(10), 3)).toBe(12); // 11.5
    expect(paymentFor(request(9), 1)).toBe(9); // 9.45
    expect(paymentFor(request(9), 2)).toBe(10); // 9.9
    expect(paymentFor(request(7), 1)).toBe(7); // 7.35
    expect(paymentFor(request(130), 1)).toBe(137); // 136.5, a tie that float math can get wrong
    for (let hearts = 0; hearts <= 10; hearts += 1) expect(Number.isInteger(paymentFor(request(37), hearts))).toBe(true);
  });

  it('never pays less with more hearts', () => {
    let last = 0;
    for (let hearts = 0; hearts <= 10; hearts += 1) {
      const pay = paymentFor(request(53), hearts);
      expect(pay).toBeGreaterThanOrEqual(last);
      last = pay;
    }
  });

  it('treats hearts outside 0 to 10 as the nearest end, and nonsense as none', () => {
    expect(paymentFor(request(100), -4)).toBe(100);
    expect(paymentFor(request(100), 25)).toBe(150);
    expect(paymentFor(request(100), Number.NaN)).toBe(100);
  });

  it('pays nothing extra on a free request', () => {
    expect(paymentFor(request(0), 10)).toBe(0);
  });
});

describe('requestText', () => {
  const ids = days(1, 20).flatMap((day) => [0, 1, 2].map((slot) => `req:${day}:${slot}`));

  it('mentions the count, the item name, the pay and the giver', () => {
    for (const id of ids) {
      const text = requestText(request(130, 3, id), 'Willa', 'Radish');
      expect(text, id).toContain('3 Radish');
      expect(text, id).toContain('130g');
      expect(text, id).toContain('Willa');
    }
  });

  it('says what the request in front of it asks, whatever the numbers', () => {
    const text = requestText(request(7, 12, 'req:9:1'), 'Bram', 'Firewood');
    expect(text).toContain('12 Firewood');
    expect(text).toContain('7g');
    expect(text).toContain('Bram');
  });

  it('reads the same every time for the same id', () => {
    for (const id of ids) {
      const first = requestText(request(130, 3, id), 'Willa', 'Radish');
      expect(requestText(request(130, 3, id), 'Willa', 'Radish')).toBe(first);
    }
  });

  it('chooses the wording by id, so different ids do not all read alike', () => {
    const wordings = new Set(ids.map((id) => requestText(request(130, 3, id), 'Willa', 'Radish')));
    expect(wordings.size).toBeGreaterThanOrEqual(4);
  });

  it('keeps the wording and swaps only the facts when they change', () => {
    const a = requestText(request(130, 3, 'req:4:2'), 'Willa', 'Radish');
    const b = requestText(request(60, 8, 'req:4:2'), 'Bram', 'Turnip');
    expect(b).toBe(a.replace('130g', '60g').replace('3 Radish', '8 Turnip').replace('Willa', 'Bram'));
  });

  it('gives a text for every request on a real board', () => {
    for (const day of days(1, 30)) {
      for (const r of requestsFor(day, RICH)) {
        const text = requestText(r, 'Someone', 'Thing');
        expect(text).toContain(`${r.count} Thing`);
        expect(text).toContain(`${r.money}g`);
      }
    }
  });
});
