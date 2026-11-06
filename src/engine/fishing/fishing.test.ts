import { describe, expect, it } from 'vitest';
import { createRng } from '../core/random';
import { biting, pickFish } from './rules';
import {
  BITE_DELAY_MIN,
  BITE_DELAY_SPREAD,
  BITE_WINDOW_MIN,
  MARKER_SPEED_BASE,
  MARKER_SPEED_PER_DIFFICULTY,
  REEL_TIMEOUT,
  biteWindow,
  catchQuality,
  FishingSession,
  markerSpeed,
  zoneWidth,
} from './session';
import type { FishDef } from './types';

const BASE: FishDef = {
  id: 'minnow',
  name: 'Minnow',
  item: 'minnow',
  waters: ['pond'],
  seasons: ['spring', 'summer'],
  from: 360,
  to: 1200,
  difficulty: 1,
  weight: 1,
};
const fish = (over: Partial<FishDef> = {}): FishDef => ({ ...BASE, ...over });

describe('biting', () => {
  const trout = fish({ id: 'trout', waters: ['river'], seasons: ['spring', 'autumn'], from: 360, to: 720 });
  const carp = fish({ id: 'carp', waters: ['pond', 'river'], seasons: ['spring', 'summer', 'autumn', 'winter'], from: 360, to: 1440 });
  const eel = fish({ id: 'eel', waters: ['pond'], seasons: ['summer'], from: 1200, to: 1560 });
  const all = [trout, carp, eel];
  const ids = (list: readonly FishDef[]): string[] => list.map((f) => f.id);

  it('keeps only fish that live in this kind of water and bite in this season', () => {
    expect(ids(biting(all, 'river', 'spring', 400))).toEqual(['trout', 'carp']);
    expect(ids(biting(all, 'pond', 'spring', 400))).toEqual(['carp']);
    expect(ids(biting(all, 'river', 'winter', 400))).toEqual(['carp']);
    expect(biting(all, 'ocean', 'spring', 400)).toEqual([]);
  });

  it('opens at `from` (inclusive) and closes at `to` (exclusive)', () => {
    expect(ids(biting([trout], 'river', 'spring', 359))).toEqual([]);
    expect(ids(biting([trout], 'river', 'spring', 360))).toEqual(['trout']);
    expect(ids(biting([trout], 'river', 'spring', 719))).toEqual(['trout']);
    expect(ids(biting([trout], 'river', 'spring', 720))).toEqual([]);
  });

  it('reads the clock past midnight as it runs: values above 1440 are late at night', () => {
    expect(ids(biting([eel], 'pond', 'summer', 1199))).toEqual([]);
    expect(ids(biting([eel], 'pond', 'summer', 1200))).toEqual(['eel']);
    expect(ids(biting([eel], 'pond', 'summer', 1440))).toEqual(['eel']);
    expect(ids(biting([eel], 'pond', 'summer', 1500))).toEqual(['eel']);
    expect(ids(biting([eel], 'pond', 'summer', 1559))).toEqual(['eel']);
    expect(ids(biting([eel], 'pond', 'summer', 1560))).toEqual([]);
    // A morning fish does not bite at 1500 just because the clock wrapped past the day.
    expect(ids(biting([trout], 'river', 'spring', 1500))).toEqual([]);
  });

  it('returns every match, in list order, as a new list', () => {
    const everything = [carp, trout];
    const result = biting(everything, 'river', 'spring', 500);
    expect(ids(result)).toEqual(['carp', 'trout']);
    expect(result).not.toBe(everything);
    expect(biting([], 'river', 'spring', 500)).toEqual([]);
  });
});

describe('pickFish', () => {
  const a = fish({ id: 'a', weight: 1 });
  const b = fish({ id: 'b', weight: 3 });
  const c = fish({ id: 'c', weight: 6 });

  it('is undefined when there is nothing to pick', () => {
    expect(pickFish([], 0.5)).toBeUndefined();
    expect(pickFish([fish({ weight: 0 })], 0.5)).toBeUndefined();
    expect(pickFish([fish({ weight: 0 }), fish({ weight: -2 })], 0)).toBeUndefined();
  });

  it('picks the first fish at roll 0 and the last just under 1', () => {
    expect(pickFish([a, b, c], 0)?.id).toBe('a');
    expect(pickFish([a, b, c], 1 - 2 ** -53)?.id).toBe('c');
    expect(pickFish([a], 0)?.id).toBe('a');
    expect(pickFish([a], 1 - 2 ** -53)?.id).toBe('a');
  });

  it('gives each fish a slice as wide as its share of the weight, in list order', () => {
    // weights 1, 3, 6 of 10: a owns [0, 0.1), b [0.1, 0.4), c [0.4, 1).
    expect(pickFish([a, b, c], 0.099)?.id).toBe('a');
    expect(pickFish([a, b, c], 0.101)?.id).toBe('b');
    expect(pickFish([a, b, c], 0.399)?.id).toBe('b');
    expect(pickFish([a, b, c], 0.401)?.id).toBe('c');
  });

  it('is exactly proportional over an even sweep of rolls', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const picked = pickFish([a, b, c], (i + 0.5) / 1000);
      if (picked) counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    expect(counts).toEqual({ a: 100, b: 300, c: 600 });
  });

  it('is roughly proportional over random rolls', () => {
    const rng = createRng(7);
    const counts: Record<string, number> = {};
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const picked = pickFish([a, b, c], rng());
      if (picked) counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    expect(Math.abs((counts.a ?? 0) / n - 0.1)).toBeLessThan(0.02);
    expect(Math.abs((counts.b ?? 0) / n - 0.3)).toBeLessThan(0.02);
    expect(Math.abs((counts.c ?? 0) / n - 0.6)).toBeLessThan(0.02);
  });

  it('never chooses a fish with zero or negative weight', () => {
    const none = fish({ id: 'none', weight: 0 });
    const bad = fish({ id: 'bad', weight: -5 });
    const list = [none, a, bad, b, none];
    expect(pickFish(list, 0)?.id).toBe('a');
    expect(pickFish(list, 1 - 2 ** -53)?.id).toBe('b');
    for (let i = 0; i < 500; i++) {
      const picked = pickFish(list, (i + 0.5) / 500);
      expect(['a', 'b']).toContain(picked?.id);
    }
  });

  it('is deterministic and leaves the list alone', () => {
    const list = [a, b, c];
    const before = [...list];
    expect(pickFish(list, 0.55)).toBe(pickFish(list, 0.55));
    expect(list).toEqual(before);
  });

  it('copes with a roll outside [0, 1) by clamping it', () => {
    expect(pickFish([a, b, c], 1)?.id).toBe('c');
    expect(pickFish([a, b, c], 7)?.id).toBe('c');
    expect(pickFish([a, b, c], -1)?.id).toBe('a');
    expect(pickFish([a, b, c], Number.NaN)?.id).toBe('a');
  });
});

// ---------------------------------------------------------------------------------------------------------------------

const CELL = { x: 4, y: 7 };
const STEP = 1 / 60;
const MINNOW = fish({ id: 'minnow', difficulty: 1 });
const CARP = fish({ id: 'carp', difficulty: 3 });
const EEL = fish({ id: 'eel', difficulty: 5 });

const session = (candidates: readonly FishDef[], seed = 1): FishingSession => new FishingSession({ cell: CELL, candidates, seed });

type Zone = { readonly from: number; readonly to: number };

/** Steps without pressing until the line leaves 'waiting'. Afterwards `elapsed` is only the sliver of the step that spilled over. */
function advanceToBite(s: FishingSession, dt = 0.01): void {
  for (let t = 0; t < 20 && s.phase === 'waiting'; t += dt) s.update(dt, false);
  expect(s.phase).toBe('bite');
}

/** Bites, then presses straight away. */
function hook(s: FishingSession): void {
  advanceToBite(s);
  s.update(STEP, true);
  expect(s.phase).toBe('reeling');
}

/** Steps (without pressing) until `where` holds for the marker, then presses on that very marker. Returns where it pressed. */
function pressWhen(s: FishingSession, where: (marker: number, zone: Zone) => boolean, dt = 0.0005): number {
  for (let i = 0; i < REEL_TIMEOUT / dt; i++) {
    expect(s.phase).toBe('reeling');
    if (where(s.marker, s.zone)) {
      const at = s.marker;
      s.update(dt, true);
      return at;
    }
    s.update(dt, false);
  }
  throw new Error('the marker never got where the test wanted it');
}

const inZone = (marker: number, zone: Zone): boolean => marker >= zone.from && marker <= zone.to;
/** Distance from the centre of the zone as a share of its width: the unit quality is judged in. */
const offsetShare = (marker: number, zone: Zone): number => Math.abs(marker - (zone.from + zone.to) / 2) / (zone.to - zone.from);
const between = (low: number, high: number) => (marker: number, zone: Zone): boolean => {
  const share = offsetShare(marker, zone);
  return inZone(marker, zone) && share >= low && share <= high;
};

/** How long the seeded line waits before it bites, measured from outside by stepping finely. */
function biteDelayOf(candidates: readonly FishDef[], seed: number): number {
  const s = session(candidates, seed);
  let total = 0;
  while (s.phase === 'waiting' && total < 20) {
    s.update(0.002, false);
    total += 0.002;
  }
  return total - s.elapsed;
}

const snapshot = (s: FishingSession) => ({ phase: s.phase, elapsed: s.elapsed, fish: s.fish, caught: s.caught, marker: s.marker, zone: s.zone });

describe('FishingSession: waiting and the bite', () => {
  it('starts waiting, with nothing hooked', () => {
    const s = session([MINNOW]);
    expect(s.cell).toEqual(CELL);
    expect(s.phase).toBe('waiting');
    expect(s.elapsed).toBe(0);
    expect(s.fish).toBeUndefined();
    expect(s.caught).toBeUndefined();
    expect(s.finished).toBe(false);
  });

  it('counts the seconds the line has been in the water', () => {
    const s = session([MINNOW]);
    s.update(0.5, false);
    s.update(0.25, false);
    expect(s.phase).toBe('waiting');
    expect(s.elapsed).toBeCloseTo(0.75);
  });

  it('bites after a delay of 2 to 8 seconds, drawn from the seed', () => {
    const delays: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const s = session([MINNOW], seed);
      s.update(BITE_DELAY_MIN - 0.001, false);
      expect(s.phase).toBe('waiting');
      delays.push(biteDelayOf([MINNOW], seed));
    }
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(BITE_DELAY_MIN);
    expect(Math.max(...delays)).toBeLessThan(BITE_DELAY_MIN + BITE_DELAY_SPREAD);
    // It really is a spread, not one fixed wait.
    expect(Math.min(...delays)).toBeLessThan(BITE_DELAY_MIN + 0.5);
    expect(Math.max(...delays)).toBeGreaterThan(BITE_DELAY_MIN + BITE_DELAY_SPREAD - 0.5);
  });

  it('turns to a bite with the fish known, and restarts the phase clock', () => {
    const s = session([CARP]);
    advanceToBite(s);
    expect(s.fish).toBe(CARP);
    expect(s.finished).toBe(false);
    expect(s.elapsed).toBeLessThan(0.01 + 1e-9);
  });

  it('picks the fish that bites from the candidates by weight', () => {
    const light = fish({ id: 'light', weight: 1 });
    const heavy = fish({ id: 'heavy', weight: 9 });
    const seen: Record<string, number> = {};
    for (let seed = 0; seed < 400; seed++) {
      const s = session([light, heavy], seed);
      advanceToBite(s, 0.05);
      const id = s.fish?.id ?? 'none';
      seen[id] = (seen[id] ?? 0) + 1;
    }
    expect(seen.none).toBeUndefined();
    expect(seen.light ?? 0).toBeGreaterThan(10);
    expect(seen.heavy ?? 0).toBeGreaterThan((seen.light ?? 0) * 3);
  });

  it("ends as 'nothing' when no fish are biting: the honest 'no fish right now'", () => {
    const s = session([], 3);
    s.update(BITE_DELAY_MIN - 0.001, false);
    expect(s.phase).toBe('waiting');
    s.update(BITE_DELAY_SPREAD + 0.01, false);
    expect(s.phase).toBe('nothing');
    expect(s.finished).toBe(true);
    expect(s.fish).toBeUndefined();
    expect(s.caught).toBeUndefined();
  });

  it("also ends as 'nothing' when every candidate has no weight", () => {
    const s = session([fish({ weight: 0 })], 3);
    s.update(20, false);
    expect(s.phase).toBe('nothing');
    expect(s.fish).toBeUndefined();
  });

  it('ignores a press while waiting: it neither hooks nor cancels anything', () => {
    const s = session([MINNOW], 5);
    const delay = biteDelayOf([MINNOW], 5);
    // Mash the button for the whole wait, right up to the step where the bite appears.
    let elapsedBefore = 0;
    for (let i = 0; i < 2000 && s.phase === 'waiting'; i++) {
      s.update(0.01, true);
      if (s.phase === 'waiting') {
        expect(s.finished).toBe(false);
        expect(s.fish).toBeUndefined();
        expect(s.elapsed).toBeGreaterThan(elapsedBefore);
        elapsedBefore = s.elapsed;
      }
    }
    // The bite arrives on schedule, as a bite: a press on the step it appeared could not have hooked it.
    expect(s.phase).toBe('bite');
    expect(elapsedBefore).toBeLessThan(delay);
    expect(s.elapsed).toBeLessThan(0.01 + 1e-9);
  });

  it('lets a press hook the fish while the bite is open', () => {
    const s = session([CARP]);
    advanceToBite(s);
    s.update(biteWindow(3) - s.elapsed - 0.01, false);
    expect(s.phase).toBe('bite');
    s.update(0.005, true);
    expect(s.phase).toBe('reeling');
    expect(s.fish).toBe(CARP);
    expect(s.finished).toBe(false);
  });

  it('lets the fish go when the bite window closes first', () => {
    const s = session([CARP]);
    advanceToBite(s);
    s.update(biteWindow(3) - s.elapsed + 0.01, false);
    expect(s.phase).toBe('escaped');
    expect(s.finished).toBe(true);
    expect(s.caught).toBeUndefined();
    s.update(STEP, true); // too late: the press changes nothing
    expect(s.phase).toBe('escaped');
    expect(s.caught).toBeUndefined();
  });

  it('closes the window at exactly its length', () => {
    const s = session([CARP]);
    advanceToBite(s);
    s.update(biteWindow(3) - s.elapsed - 1e-6, false);
    expect(s.phase).toBe('bite');
    s.update(2e-6, false);
    expect(s.phase).toBe('escaped');
  });

  it('judges a press against the bite the player was looking at, whatever the step length', () => {
    const s = session([CARP]);
    advanceToBite(s);
    // This step is long enough for the window to close, but the press belongs to the state it began in: it hooks,
    // and the rest of the step is spent reeling.
    s.update(biteWindow(3), true);
    expect(s.phase).toBe('reeling');
    expect(s.elapsed).toBeCloseTo(biteWindow(3));
    const hooked = session([CARP]);
    advanceToBite(hooked);
    hooked.update(0, true);
    expect(hooked.phase).toBe('reeling');
  });
});

describe('FishingSession: reeling', () => {
  it('starts with the marker on the bar and the sweet spot inside it', () => {
    const s = session([CARP]);
    hook(s);
    expect(s.marker).toBeGreaterThanOrEqual(0);
    expect(s.marker).toBeLessThanOrEqual(1);
    expect(s.zone.from).toBeGreaterThanOrEqual(0);
    expect(s.zone.to).toBeLessThanOrEqual(1);
    expect(s.zone.from).toBeLessThan(s.zone.to);
    expect(s.elapsed).toBeLessThan(0.1);
  });

  it('draws the starting marker from the seed', () => {
    const starts = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const s = session([CARP], seed);
      hook(s);
      starts.add(Math.round(s.marker * 20));
    }
    expect(starts.size).toBeGreaterThan(8);
  });

  it('keeps the marker on the bar and sweeps it back and forth', () => {
    const s = session([MINNOW], 2);
    hook(s);
    let low = 1;
    let high = 0;
    let turns = 0;
    let previous = s.marker;
    let direction = 0;
    for (let t = 0; t < 5; t += 0.001) {
      s.update(0.001, false);
      expect(s.phase).toBe('reeling');
      expect(s.marker).toBeGreaterThanOrEqual(0);
      expect(s.marker).toBeLessThanOrEqual(1);
      low = Math.min(low, s.marker);
      high = Math.max(high, s.marker);
      const moved = Math.sign(s.marker - previous);
      if (moved !== 0 && direction !== 0 && moved !== direction) turns += 1;
      if (moved !== 0) direction = moved;
      previous = s.marker;
    }
    expect(low).toBeLessThan(0.01);
    expect(high).toBeGreaterThan(0.99);
    expect(turns).toBeGreaterThanOrEqual(4); // 5 s at 1.25 per second is 6 lengths of the bar
  });

  it('catches the fish when the press lands inside the sweet spot', () => {
    for (const f of [MINNOW, CARP, EEL]) {
      for (let seed = 0; seed < 10; seed++) {
        const s = session([f], seed);
        hook(s);
        pressWhen(s, inZone);
        expect(s.phase).toBe('caught');
        expect(s.finished).toBe(true);
        expect(s.caught?.fish).toBe(f);
        expect([0, 1, 2]).toContain(s.caught?.quality);
      }
    }
  });

  it('lets the fish go when the press lands outside the sweet spot', () => {
    for (const f of [MINNOW, CARP, EEL]) {
      for (let seed = 0; seed < 10; seed++) {
        const s = session([f], seed);
        hook(s);
        pressWhen(s, (marker, zone) => marker < zone.from - 0.02 || marker > zone.to + 0.02);
        expect(s.phase).toBe('escaped');
        expect(s.finished).toBe(true);
        expect(s.caught).toBeUndefined();
      }
    }
  });

  it('lets the fish go after 6 seconds without a press', () => {
    // Literal seconds, not the constant: this is the designed number and should not drift unnoticed.
    const timed = session([CARP]);
    hook(timed);
    timed.update(5.9, false);
    expect(timed.phase).toBe('reeling');
    timed.update(0.2, false);
    expect(timed.phase).toBe('escaped');

    const s = session([CARP]);
    hook(s);
    s.update(REEL_TIMEOUT - s.elapsed - 0.001, false);
    expect(s.phase).toBe('reeling');
    s.update(0.002, false);
    expect(s.phase).toBe('escaped');
    expect(s.caught).toBeUndefined();
    expect(s.marker).toBeGreaterThanOrEqual(0);
    expect(s.marker).toBeLessThanOrEqual(1);
  });

  it('keeps the sweet spot where it was while the marker moves', () => {
    const s = session([CARP]);
    hook(s);
    const zone = s.zone;
    s.update(2, false);
    expect(s.zone).toEqual(zone);
  });
});

describe('FishingSession: quality', () => {
  const quality = (f: FishDef, seed: number, where: (marker: number, zone: Zone) => boolean): number | undefined => {
    const s = session([f], seed);
    hook(s);
    pressWhen(s, where);
    expect(s.phase).toBe('caught');
    return s.caught?.quality;
  };

  it('is Excellent for a press within 10% of the zone width of the centre on a hard fish (difficulty 3+)', () => {
    for (const f of [fish({ id: 'd3', difficulty: 3 }), fish({ id: 'd4', difficulty: 4 }), EEL]) {
      for (let seed = 0; seed < 5; seed++) expect(quality(f, seed, between(0, 0.05))).toBe(2);
    }
  });

  it('tops out at Good on easy fish (difficulty 1 and 2), however well the press lands', () => {
    for (const f of [MINNOW, fish({ id: 'd2', difficulty: 2 })]) {
      for (let seed = 0; seed < 5; seed++) expect(quality(f, seed, between(0, 0.05))).toBe(1);
    }
  });

  it('is Good between 10% and 35% of the width from the centre, on any fish', () => {
    for (const f of [MINNOW, CARP, EEL]) {
      for (let seed = 0; seed < 5; seed++) expect(quality(f, seed, between(0.15, 0.3))).toBe(1);
    }
  });

  it('is Normal for the rest of the sweet spot', () => {
    for (const f of [MINNOW, CARP, EEL]) {
      for (let seed = 0; seed < 5; seed++) expect(quality(f, seed, between(0.4, 0.49))).toBe(0);
    }
  });

  it('draws its thresholds exactly at 10% and 35%, and counts the edges of the zone as inside', () => {
    const zone = { from: 0.25, to: 0.75 }; // width 0.5, centre 0.5: 10% is 0.05, 35% is 0.175
    expect(catchQuality(0.5, zone, 3)).toBe(2);
    expect(catchQuality(0.5 + 0.049, zone, 3)).toBe(2);
    expect(catchQuality(0.5 - 0.049, zone, 3)).toBe(2);
    expect(catchQuality(0.5 + 0.051, zone, 3)).toBe(1);
    expect(catchQuality(0.5 - 0.051, zone, 3)).toBe(1);
    expect(catchQuality(0.5 + 0.174, zone, 3)).toBe(1);
    expect(catchQuality(0.5 + 0.176, zone, 3)).toBe(0);
    expect(catchQuality(0.25, zone, 3)).toBe(0);
    expect(catchQuality(0.75, zone, 3)).toBe(0);
    expect(catchQuality(0.2499, zone, 3)).toBeUndefined();
    expect(catchQuality(0.7501, zone, 3)).toBeUndefined();
    expect(catchQuality(0, zone, 3)).toBeUndefined();
    expect(catchQuality(1, zone, 3)).toBeUndefined();
  });

  it('only gives Excellent from difficulty 3', () => {
    const zone = { from: 0.25, to: 0.75 };
    expect([1, 2, 3, 4, 5].map((d) => catchQuality(0.5, zone, d))).toEqual([1, 1, 2, 2, 2]);
  });
});

describe('FishingSession: tuning', () => {
  it('keeps the designed numbers', () => {
    expect([BITE_DELAY_MIN, BITE_DELAY_SPREAD]).toEqual([2, 6]);
    expect(BITE_WINDOW_MIN).toBe(0.45);
    expect(REEL_TIMEOUT).toBe(6);
    expect([1, 2, 3, 4, 5].map((d) => biteWindow(d))).toEqual([0.98, 0.86, 0.74, 0.62, 0.5].map((n) => expect.closeTo(n, 10)));
    expect([1, 2, 3, 4, 5].map((d) => zoneWidth(d))).toEqual([0.355, 0.29, 0.225, 0.16, 0.095].map((n) => expect.closeTo(n, 10)));
    expect([1, 2, 3, 4, 5].map((d) => markerSpeed(d))).toEqual([1.25, 1.6, 1.95, 2.3, 2.65].map((n) => expect.closeTo(n, 10)));
  });
});

describe('FishingSession: difficulty', () => {
  it('narrows the sweet spot for harder fish (0.355 at 1, 0.095 at 5)', () => {
    expect(zoneWidth(1)).toBeCloseTo(0.355);
    expect(zoneWidth(5)).toBeCloseTo(0.095);
    const widths: number[] = [];
    for (const f of [MINNOW, fish({ difficulty: 2 }), CARP, fish({ difficulty: 4 }), EEL]) {
      const s = session([f], 9);
      hook(s);
      widths.push(s.zone.to - s.zone.from);
    }
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1] ?? 0);
    expect(widths[0]).toBeCloseTo(0.355);
    expect(widths[4]).toBeCloseTo(0.095);
  });

  it('puts the sweet spot anywhere on the bar, but always whole', () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      const f = fish({ difficulty: d });
      const width = zoneWidth(d);
      let lowest = 1;
      let highest = 0;
      for (let seed = 0; seed < 200; seed++) {
        const s = session([f], seed);
        hook(s);
        expect(s.zone.from).toBeGreaterThanOrEqual(0);
        expect(s.zone.to).toBeLessThanOrEqual(1);
        expect(s.zone.to - s.zone.from).toBeCloseTo(width, 10);
        const centre = (s.zone.from + s.zone.to) / 2;
        lowest = Math.min(lowest, centre);
        highest = Math.max(highest, centre);
      }
      expect(lowest).toBeLessThan(width / 2 + 0.05);
      expect(highest).toBeGreaterThan(1 - width / 2 - 0.05);
    }
  });

  it('speeds the marker up for harder fish (1.25 per second at 1, 2.65 at 5)', () => {
    expect(markerSpeed(1)).toBeCloseTo(MARKER_SPEED_BASE + MARKER_SPEED_PER_DIFFICULTY);
    expect(markerSpeed(1)).toBeCloseTo(1.25);
    expect(markerSpeed(5)).toBeCloseTo(2.65);
    // Measured from outside: the distance the marker covers in one second.
    const travelled = (f: FishDef): number => {
      const s = session([f], 4);
      hook(s);
      let distance = 0;
      let previous = s.marker;
      for (let i = 0; i < 1000; i++) {
        s.update(0.001, false);
        distance += Math.abs(s.marker - previous);
        previous = s.marker;
      }
      return distance;
    };
    const easy = travelled(MINNOW);
    const hard = travelled(EEL);
    expect(easy).toBeCloseTo(markerSpeed(1), 1);
    expect(hard).toBeCloseTo(markerSpeed(5), 1);
    expect(hard).toBeGreaterThan(easy * 1.5);
  });

  it('shortens the bite window for harder fish, but never below the floor', () => {
    expect(biteWindow(1)).toBeCloseTo(0.98);
    expect(biteWindow(5)).toBeCloseTo(0.5);
    expect(biteWindow(5)).toBeLessThan(biteWindow(1));
    expect(biteWindow(10)).toBe(BITE_WINDOW_MIN);
    expect(biteWindow(1000)).toBe(BITE_WINDOW_MIN);

    const easy = session([MINNOW]);
    const hard = session([EEL]);
    advanceToBite(easy);
    advanceToBite(hard);
    easy.update(0.6, false);
    hard.update(0.6, false);
    expect(easy.phase).toBe('bite');
    expect(hard.phase).toBe('escaped');
  });

  it('keeps odd difficulty data from breaking the game', () => {
    for (const d of [0, -3, 9, 100]) {
      const odd = fish({ difficulty: d as number as FishDef['difficulty'] });
      const s = session([odd], 2);
      hook(s);
      expect(s.zone.from).toBeLessThan(s.zone.to);
      expect(s.zone.from).toBeGreaterThanOrEqual(0);
      expect(s.zone.to).toBeLessThanOrEqual(1);
      expect(s.zone.to - s.zone.from).toBeGreaterThanOrEqual(zoneWidth(5) - 1e-9);
      pressWhen(s, inZone);
      expect(s.phase).toBe('caught');
    }
  });
});

describe('FishingSession: ending', () => {
  const finals: Record<string, () => FishingSession> = {
    caught: () => {
      const s = session([CARP], 6);
      hook(s);
      pressWhen(s, inZone);
      return s;
    },
    escaped: () => {
      const s = session([CARP], 6);
      advanceToBite(s);
      s.update(2, false);
      return s;
    },
    nothing: () => {
      const s = session([], 6);
      s.update(20, false);
      return s;
    },
    'reeled-in': () => {
      const s = session([CARP], 6);
      s.cancel();
      return s;
    },
  };

  for (const [phase, make] of Object.entries(finals)) {
    it(`treats '${phase}' as final: nothing moves it afterwards`, () => {
      const s = make();
      expect(s.phase).toBe(phase);
      expect(s.finished).toBe(true);
      const before = snapshot(s);
      s.update(100, true);
      s.update(0.5, false);
      s.update(0, true);
      s.update(STEP, true);
      s.cancel();
      expect(s.phase).toBe(phase);
      expect(s.finished).toBe(true);
      expect(snapshot(s)).toEqual(before);
    });
  }

  it("pulls the line in with cancel() while waiting, as 'reeled-in'", () => {
    const s = session([CARP]);
    s.update(1, false);
    s.cancel();
    expect(s.phase).toBe('reeled-in');
    expect(s.finished).toBe(true);
    expect(s.caught).toBeUndefined();
  });

  it("pulls the line in with cancel() during the bite and during the reel", () => {
    const biting = session([CARP]);
    advanceToBite(biting);
    biting.cancel();
    expect(biting.phase).toBe('reeled-in');
    expect(biting.caught).toBeUndefined();

    const reeling = session([CARP]);
    hook(reeling);
    reeling.cancel();
    expect(reeling.phase).toBe('reeled-in');
    expect(reeling.caught).toBeUndefined();
  });

  it('is fine to cancel twice', () => {
    const s = session([CARP]);
    s.cancel();
    s.cancel();
    expect(s.phase).toBe('reeled-in');
  });
});

describe('FishingSession: determinism', () => {
  /** A scripted player: presses at random-looking moments, but the same moments every time. */
  const trace = (candidates: readonly FishDef[], seed: number) => {
    const s = session(candidates, seed);
    const presses = createRng(99);
    const steps: unknown[][] = [];
    for (let i = 0; i < 3000 && !s.finished; i++) {
      s.update(STEP, presses() < 0.04);
      steps.push([s.phase, s.elapsed, s.marker, s.zone.from, s.zone.to, s.fish?.id ?? null, s.caught?.quality ?? null]);
    }
    return steps;
  };

  it('plays out the same way for the same options and the same presses', () => {
    const everyone = [MINNOW, CARP, EEL];
    let reeled = 0;
    for (let seed = 0; seed < 40; seed++) {
      const first = trace(everyone, seed);
      expect(trace(everyone, seed)).toEqual(first);
      if (first.some((step) => step[0] === 'reeling')) reeled += 1;
    }
    expect(reeled).toBeGreaterThan(0); // the script really did get as far as the reel
  });

  it('plays out differently for different seeds', () => {
    const distinct = new Set<string>();
    for (let seed = 0; seed < 10; seed++) distinct.add(JSON.stringify(trace([MINNOW, CARP, EEL], seed)));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('draws the same fish and the same sweet spot however time is sliced', () => {
    const everyone = [MINNOW, CARP, EEL];
    for (let seed = 0; seed < 30; seed++) {
      const fine = session(everyone, seed);
      const coarse = session(everyone, seed);
      advanceToBite(fine, 0.003);
      advanceToBite(coarse, 0.07);
      expect(coarse.fish?.id).toBe(fine.fish?.id);
      fine.update(0, true);
      coarse.update(0, true);
      expect(coarse.zone).toEqual(fine.zone);
    }
  });
});

describe('FishingSession: large and odd time steps', () => {
  it('lets the whole thing play out in order when one step covers it all', () => {
    const s = session([CARP], 8);
    s.update(100, false);
    // It bit, nobody pressed, and the window really did pass.
    expect(s.phase).toBe('escaped');
    expect(s.fish).toBe(CARP);
    expect(s.caught).toBeUndefined();

    const nothing = session([], 8);
    nothing.update(100, false);
    expect(nothing.phase).toBe('nothing');
  });

  it('ends where many small steps would have ended', () => {
    for (let seed = 0; seed < 30; seed++) {
      const big = session([MINNOW, CARP], seed);
      const small = session([MINNOW, CARP], seed);
      big.update(10, false);
      for (let i = 0; i < 1000; i++) small.update(0.01, false);
      expect(big.phase).toBe('escaped');
      expect(small.phase).toBe('escaped');
      expect(big.fish?.id).toBe(small.fish?.id);
    }
  });

  it('carries the time left over into the next phase instead of dropping it', () => {
    for (let seed = 0; seed < 20; seed++) {
      const delay = biteDelayOf([CARP], seed);
      const s = session([CARP], seed);
      s.update(delay + 0.1, false);
      // The bite opened partway through the step, and only the 0.1 s after it has used up the window.
      expect(s.phase).toBe('bite');
      expect(s.elapsed).toBeCloseTo(0.1, 6);
      s.update(0.01, true);
      expect(s.phase).toBe('reeling');
      pressWhen(s, inZone);
      expect(s.phase).toBe('caught');
    }
  });

  it('closes the bite window on time even when it opens and closes inside one long step', () => {
    for (let seed = 0; seed < 10; seed++) {
      const delay = biteDelayOf([CARP], seed);
      const justOpen = session([CARP], seed);
      justOpen.update(delay + biteWindow(3) - 0.01, false);
      expect(justOpen.phase).toBe('bite');
      const justClosed = session([CARP], seed);
      justClosed.update(delay + biteWindow(3) + 0.01, false);
      expect(justClosed.phase).toBe('escaped');
    }
  });

  it('does not let a press on the very step a bite appears hook it', () => {
    for (let seed = 0; seed < 20; seed++) {
      const delay = biteDelayOf([CARP], seed);
      const s = session([CARP], seed);
      s.update(delay + 0.01, true);
      expect(s.phase).toBe('bite');
    }
  });

  it('never turns a press during a long wait into a catch', () => {
    const s = session([CARP], 8);
    s.update(100, true);
    expect(s.phase).toBe('escaped');
    expect(s.caught).toBeUndefined();
  });

  it('lets a long step time out the reel', () => {
    const s = session([CARP]);
    hook(s);
    s.update(50, false);
    expect(s.phase).toBe('escaped');
    expect(s.caught).toBeUndefined();
  });

  it('keeps the marker where a press would see it, however long the step before it', () => {
    const a = session([CARP], 12);
    const b = session([CARP], 12);
    hook(a);
    hook(b);
    a.update(1.5, false);
    for (let i = 0; i < 1500; i++) b.update(0.001, false);
    expect(a.marker).toBeCloseTo(b.marker, 6);
    expect(a.elapsed).toBeCloseTo(b.elapsed, 6);
  });

  it('ignores a step of zero, a negative step or NaN, but still takes the press', () => {
    for (const dt of [0, -1, Number.NaN]) {
      const s = session([CARP], 3);
      s.update(1, false);
      const before = snapshot(s);
      s.update(dt, false);
      expect(snapshot(s)).toEqual(before);
    }
    const s = session([CARP], 3);
    advanceToBite(s);
    const elapsed = s.elapsed;
    s.update(-5, false);
    expect(s.phase).toBe('bite');
    expect(s.elapsed).toBe(elapsed);
    s.update(-5, true);
    expect(s.phase).toBe('reeling');
  });
});
