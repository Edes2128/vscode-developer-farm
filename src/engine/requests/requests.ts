/**
 * The village notice board: a few requests a day ("Willa needs 3 radishes"), drawn from a validated pool so each one can be
 * done. Nothing is stored. The same day with the same pool always gives the same board (so reloading cannot reroll it), and
 * the next day is a fresh draw. Pure functions of their arguments: no `Math.random`, no clock.
 */
import { createRng, hash2 } from '../core/random';
import { seasonOf } from '../time/calendar';
import type { Request, RequestOffer, RequestPool } from './types';

export const REQUESTS_PER_DAY = 3;

const MAX_HEARTS = 10;
const BONUS_PERCENT_PER_HEART = 5;
const UINT32 = 4294967296;
/** `hash2` takes two coordinates and a seed; the day goes in beside this fixed number so the board has its own dice. */
const BOARD_SALT = 0xb0a4d;

/** FNV-1a over the text's UTF-16 units: a small stable hash, so a request's id can seed the choice of wording. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A copy of `items` in a random order. A fresh array each time: the input is never touched. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const rest = [...items];
  const order: T[] = [];
  while (rest.length > 0) {
    const [picked] = rest.splice(Math.floor(rng() * rest.length), 1);
    if (picked !== undefined) order.push(picked);
  }
  return order;
}

/**
 * Can this offer ever produce a request? The pool is validated at start, but a bad one must not give a nonsense request
 * (zero pieces, a count with no whole number in range, a pay of NaN), so such offers are simply never asked for.
 */
function isAskable(offer: RequestOffer): boolean {
  return Number.isFinite(offer.min) && Number.isFinite(offer.max) && Number.isFinite(offer.pay) && offer.pay >= 0
    && Math.ceil(offer.min) >= 1 && Math.ceil(offer.min) <= Math.floor(offer.max);
}

/**
 * The day's requests: `REQUESTS_PER_DAY` of them (fewer only if the pool cannot supply that many distinct ones). Each is for
 * an item of its own, from a giver of its own whenever the pool has enough distinct givers. Offers marked for certain
 * seasons are skipped out of season. Deterministic from (day, pool).
 */
export function requestsFor(day: number, pool: RequestPool): Request[] {
  const season = seasonOf(day);
  const askable = pool.offers.filter((offer) => isAskable(offer) && (offer.seasons === undefined || offer.seasons.includes(season)));
  // A giver listed twice is still one person, so repeats must not count as "enough givers".
  const givers = [...new Set(pool.givers)];
  if (givers.length === 0 || askable.length === 0) return [];

  const rng = createRng(Math.floor(hash2(day, BOARD_SALT) * UINT32));

  // Walk the offers in a random order, taking the first of each item: two offers for one item cannot both be on the board.
  const chosen: RequestOffer[] = [];
  const taken = new Set<string>();
  for (const offer of shuffled(askable, rng)) {
    if (chosen.length === REQUESTS_PER_DAY) break;
    if (taken.has(offer.item)) continue;
    taken.add(offer.item);
    chosen.push(offer);
  }

  // Shuffled givers dealt out in turn: all different while there are enough of them, and sharing out the work evenly after.
  const askers = shuffled(givers, rng);
  return chosen.map((offer, slot) => {
    const low = Math.ceil(offer.min);
    const high = Math.floor(offer.max);
    const count = low + Math.floor(rng() * (high - low + 1));
    return {
      id: `req:${day}:${slot}`,
      giver: askers[slot % askers.length] as string,
      item: offer.item,
      count,
      money: Math.round(count * offer.pay),
    };
  });
}

/** Does the player hold enough to fulfil it (`held` is how many of the item they carry)? */
export const canFulfil = (request: Request, held: number): boolean => held >= request.count;

/**
 * What it pays when fulfilled, with a friendship bonus: +5% per heart (hearts 0 to 10), rounded to a whole number of gold.
 * Hearts outside that range count as the nearest end. The sum is done in whole percent so a half-gold tie is exact.
 */
export const paymentFor = (request: Request, hearts: number): number => {
  const kept = Number.isFinite(hearts) ? Math.min(MAX_HEARTS, Math.max(0, hearts)) : 0;
  return Math.round((request.money * (100 + BONUS_PERCENT_PER_HEART * kept)) / 100);
};

/**
 * Ways a giver can word a request. Each one says how many, of what, and what it pays, so the board stays honest whichever is
 * picked; they differ only in voice.
 */
const TEMPLATES: readonly ((giver: string, count: number, item: string, money: number) => string)[] = [
  (giver, count, item, money) => `I need ${count} ${item} for tonight's supper. Bring them to the board and I will pay ${money}g. Thanks, ${giver}.`,
  (giver, count, item, money) => `Could someone spare ${count} ${item}? I will pay ${money}g when they reach the board. ${giver}.`,
  (giver, count, item, money) => `${giver} here. ${count} ${item} would be a real help to me this week, and I will pay ${money}g for them.`,
  (giver, count, item, money) => `Wanted: ${count} ${item}. Leave them at the board and ${money}g is yours. Signed, ${giver}.`,
  (giver, count, item, money) => `I am running short and could use ${count} ${item}. ${money}g for the trouble, paid at the board. ${giver}.`,
];

/**
 * A line the giver says when posting the request, built from their name and the item's name. The wording is chosen from the
 * request's id, so the same request always reads the same and neighbours on the board do not read like a copy and paste.
 * It states the base pay (`request.money`); the friendship bonus is added when the request is handed in.
 */
export function requestText(request: Request, giverName: string, itemName: string): string {
  const pick = Math.floor(createRng(hashString(request.id))() * TEMPLATES.length);
  const template = TEMPLATES[Math.min(pick, TEMPLATES.length - 1)] as (typeof TEMPLATES)[number];
  return template(giverName, request.count, itemName, request.money);
}
