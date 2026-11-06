import { describe, expect, it } from 'vitest';
import { SEASONS, type Season } from '../time/calendar';
import { WEATHERS, type Weather } from '../weather/types';
import { SEE_RANGE, acceptsGift, canSee, homeOn, isAbout, placeCreatures } from './creatures';
import type { CreatureDef, CreaturePlacement } from './types';

/** A made-up creature: about in autumn and winter, in sun or cloud, from 06:00 to 10:00, every day, on one map. */
const make = (over: Partial<CreatureDef> = {}): CreatureDef => ({
  id: 'fox',
  name: 'Red Fox',
  description: 'Shy, and fond of berries.',
  sprite: 'fox',
  maps: ['woods'],
  seasons: ['autumn', 'winter'],
  weather: ['sun', 'cloud'],
  from: 360,
  to: 600,
  chance: 1,
  likes: ['berry', 'egg'],
  keepsake: { item: 'fox_tail', count: 1 },
  ...over,
});

const fox = make();
const days = (count: number, from = 1): number[] => Array.from({ length: count }, (_, i) => from + i);
const grid = (width: number, height: number, x0 = 0, y0 = 0): { x: number; y: number }[] => {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ x: x0 + x, y: y0 + y });
  return cells;
};
const key = (cell: { x: number; y: number }): string => `${cell.x},${cell.y}`;

/** An ordinary, in-window moment for `fox`. */
const NOW = { season: 'autumn', weather: 'sun', minutes: 480 } as const;

describe('isAbout', () => {
  it('is about in a season, weather and hour it likes', () => {
    expect(isAbout(fox, NOW)).toBe(true);
  });

  it('follows the season: only the listed ones', () => {
    for (const season of SEASONS) {
      expect(isAbout(fox, { ...NOW, season })).toBe(fox.seasons.includes(season));
    }
    expect(isAbout(fox, { ...NOW, season: 'spring' })).toBe(false);
    expect(isAbout(fox, { ...NOW, season: 'summer' })).toBe(false);
    expect(isAbout(fox, { ...NOW, season: 'winter' })).toBe(true);
  });

  it('follows the weather: only the listed ones', () => {
    for (const weather of WEATHERS) {
      expect(isAbout(fox, { ...NOW, weather })).toBe(fox.weather.includes(weather));
    }
    expect(isAbout(fox, { ...NOW, weather: 'rain' })).toBe(false);
    expect(isAbout(fox, { ...NOW, weather: 'storm' })).toBe(false);
    expect(isAbout(fox, { ...NOW, weather: 'snow' })).toBe(false);
  });

  it('counts the first minute of the window and not the last', () => {
    expect(isAbout(fox, { ...NOW, minutes: 359 })).toBe(false);
    expect(isAbout(fox, { ...NOW, minutes: 360 })).toBe(true); // from is inclusive
    expect(isAbout(fox, { ...NOW, minutes: 599 })).toBe(true);
    expect(isAbout(fox, { ...NOW, minutes: 600 })).toBe(false); // to is exclusive
    expect(isAbout(fox, { ...NOW, minutes: 601 })).toBe(false);
  });

  it('handles a window that starts at midnight and one that ends at the end of the day', () => {
    const night = make({ from: 0, to: 60 });
    expect(isAbout(night, { ...NOW, minutes: 0 })).toBe(true);
    expect(isAbout(night, { ...NOW, minutes: 59 })).toBe(true);
    expect(isAbout(night, { ...NOW, minutes: 60 })).toBe(false);
    const late = make({ from: 1380, to: 1440 });
    expect(isAbout(late, { ...NOW, minutes: 1379 })).toBe(false);
    expect(isAbout(late, { ...NOW, minutes: 1439 })).toBe(true);
    expect(isAbout(late, { ...NOW, minutes: 1440 })).toBe(false);
  });

  it('is never about in an empty window or one that runs backwards', () => {
    const empty = make({ from: 500, to: 500 });
    const backwards = make({ from: 600, to: 360 });
    for (let minutes = 0; minutes < 1440; minutes += 7) {
      expect(isAbout(empty, { ...NOW, minutes })).toBe(false);
      expect(isAbout(backwards, { ...NOW, minutes })).toBe(false);
    }
  });

  it('is never about with no seasons or no weather listed', () => {
    expect(isAbout(make({ seasons: [] }), NOW)).toBe(false);
    expect(isAbout(make({ weather: [] }), NOW)).toBe(false);
  });

  it('does not throw on a time that is not a number, and says no', () => {
    expect(isAbout(fox, { ...NOW, minutes: Number.NaN })).toBe(false);
    expect(isAbout(fox, { ...NOW, minutes: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isAbout(fox, { ...NOW, minutes: Number.NEGATIVE_INFINITY })).toBe(false);
  });

  it('needs all three at once', () => {
    const every = (season: Season, weather: Weather, minutes: number): boolean => isAbout(fox, { season, weather, minutes });
    expect(every('autumn', 'sun', 480)).toBe(true);
    expect(every('spring', 'sun', 480)).toBe(false);
    expect(every('autumn', 'rain', 480)).toBe(false);
    expect(every('autumn', 'sun', 700)).toBe(false);
    expect(every('spring', 'rain', 700)).toBe(false);
  });
});

describe('homeOn', () => {
  it('gives the same answer every time, in any order of asking', () => {
    const def = make({ maps: ['woods', 'beach', 'quarry'], chance: 0.5 });
    const forward = days(120).map((day) => homeOn(def, day));
    const backward = days(120)
      .reverse()
      .map((day) => homeOn(def, day))
      .reverse();
    expect(backward).toEqual(forward);
    expect(days(120).map((day) => homeOn(def, day))).toEqual(forward);
    // A copy of the def is the same creature.
    expect(days(120).map((day) => homeOn({ ...def, maps: [...def.maps] }, day))).toEqual(forward);
    // Asking about other creatures and days in between changes nothing.
    homeOn(make({ id: 'owl', maps: ['woods'] }), 5);
    homeOn(def, 999);
    expect(days(120).map((day) => homeOn(def, day))).toEqual(forward);
  });

  it('only ever answers with one of its maps, or nothing', () => {
    const def = make({ maps: ['woods', 'beach', 'quarry'], chance: 0.5 });
    for (const day of days(300)) {
      const home = homeOn(def, day);
      expect(home === undefined || def.maps.includes(home)).toBe(true);
    }
  });

  it('is about every day when the chance is 1, and never when it is 0', () => {
    const always = make({ chance: 1, maps: ['woods', 'beach'] });
    const never = make({ chance: 0, maps: ['woods', 'beach'] });
    for (const day of days(400)) {
      expect(homeOn(always, day)).toBeDefined();
      expect(homeOn(never, day)).toBeUndefined();
    }
  });

  it('is about on roughly half the days with a chance of 0.5, and about a tenth with 0.1', () => {
    const half = make({ chance: 0.5 });
    const aboutDays = days(400).filter((day) => homeOn(half, day) !== undefined).length;
    expect(aboutDays).toBeGreaterThan(150);
    expect(aboutDays).toBeLessThan(250);

    const tenth = make({ chance: 0.1 });
    const rareDays = days(4000).filter((day) => homeOn(tenth, day) !== undefined).length;
    expect(rareDays).toBeGreaterThan(400 * 0.8);
    expect(rareDays).toBeLessThan(400 * 1.2);
  });

  it('is not stuck in streaks: about days and quiet days both come in both orders', () => {
    const half = make({ chance: 0.5 });
    const about = days(400).map((day) => homeOn(half, day) !== undefined);
    let changes = 0;
    for (let i = 1; i < about.length; i += 1) if (about[i] !== about[i - 1]) changes += 1;
    // A fair coin flips on about half of the 399 steps.
    expect(changes).toBeGreaterThan(140);
    expect(changes).toBeLessThan(260);
  });

  it('clamps the chance: below 0 is never, above 1 is always, NaN is never', () => {
    for (const chance of [-0.5, -1, -100, Number.NEGATIVE_INFINITY, Number.NaN]) {
      const def = make({ chance });
      for (const day of days(100)) expect(homeOn(def, day)).toBeUndefined();
    }
    for (const chance of [1.5, 2, 100, Number.POSITIVE_INFINITY]) {
      const def = make({ chance });
      for (const day of days(100)) expect(homeOn(def, day)).toBe('woods');
    }
  });

  it('honours a small and a large chance, not just the middle', () => {
    const count = (chance: number): number => days(2000).filter((day) => homeOn(make({ chance }), day) !== undefined).length;
    expect(count(0.01)).toBeLessThan(60);
    expect(count(0.99)).toBeGreaterThan(1940);
    expect(count(0.25)).toBeGreaterThan(400);
    expect(count(0.25)).toBeLessThan(600);
  });

  it('keeps the days it already had when the chance is raised (tuning the data does not reshuffle the calendar)', () => {
    const low = make({ chance: 0.2, maps: ['woods', 'beach'] });
    const high = make({ chance: 0.6, maps: ['woods', 'beach'] });
    let lowDays = 0;
    for (const day of days(500)) {
      const before = homeOn(low, day);
      if (before === undefined) continue;
      lowDays += 1;
      expect(homeOn(high, day)).toBe(before);
    }
    expect(lowDays).toBeGreaterThan(50);
  });

  it('spreads its days evenly across several maps', () => {
    const maps = ['woods', 'beach', 'quarry', 'meadow'];
    const def = make({ maps, chance: 1 });
    const counts = new Map<string, number>();
    const total = 4000;
    for (const day of days(total)) {
      const home = homeOn(def, day) as string;
      counts.set(home, (counts.get(home) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const map of maps) {
      expect(counts.get(map)).toBeGreaterThan((total / 4) * 0.85);
      expect(counts.get(map)).toBeLessThan((total / 4) * 1.15);
    }
  });

  it('spreads evenly across maps even when it is only about some days', () => {
    const maps = ['woods', 'beach', 'quarry'];
    const def = make({ maps, chance: 0.5 });
    const counts = new Map<string, number>();
    let about = 0;
    for (const day of days(6000)) {
      const home = homeOn(def, day);
      if (home === undefined) continue;
      about += 1;
      counts.set(home, (counts.get(home) ?? 0) + 1);
    }
    for (const map of maps) {
      expect(counts.get(map)).toBeGreaterThan((about / 3) * 0.85);
      expect(counts.get(map)).toBeLessThan((about / 3) * 1.15);
    }
  });

  it('does not stay on one map for long: it moves about between days', () => {
    const def = make({ maps: ['woods', 'beach'], chance: 1 });
    const homes = days(200).map((day) => homeOn(def, day));
    let moves = 0;
    for (let i = 1; i < homes.length; i += 1) if (homes[i] !== homes[i - 1]) moves += 1;
    expect(moves).toBeGreaterThan(60);
  });

  it('is always on its only map when it has one', () => {
    const def = make({ maps: ['woods'], chance: 1 });
    for (const day of days(100)) expect(homeOn(def, day)).toBe('woods');
  });

  it('is never about when it has no maps, whatever its chance', () => {
    for (const chance of [0, 0.5, 1, 5, Number.NaN]) {
      const def = make({ maps: [], chance });
      for (const day of days(50)) expect(homeOn(def, day)).toBeUndefined();
    }
  });

  it('gives different creatures different calendars', () => {
    const maps = ['woods', 'beach', 'quarry'];
    const calendar = (id: string): string => days(60).map((day) => homeOn(make({ id, maps, chance: 0.5 }), day) ?? '-').join(',');
    const ids = ['fox', 'owl', 'heron', 'deer', 'otter', 'hare', 'badger', 'lynx'];
    expect(new Set(ids.map(calendar)).size).toBe(ids.length);
  });

  it('depends on the creature and the day only: not on the season, weather, hour, name or likes', () => {
    const base = make({ maps: ['woods', 'beach'], chance: 0.5 });
    const changed = make({
      maps: ['woods', 'beach'],
      chance: 0.5,
      name: 'Someone else',
      description: 'Other',
      sprite: 'other',
      seasons: ['spring'],
      weather: ['storm'],
      from: 0,
      to: 1440,
      likes: [],
      keepsake: { item: 'other', count: 9 },
    });
    expect(days(200).map((day) => homeOn(changed, day))).toEqual(days(200).map((day) => homeOn(base, day)));
  });

  it('is home on a day even when that day cannot suit it: home is not the same as seen', () => {
    // Snow in spring never happens, and the fox only likes sun and cloud: it is still "home" on those days.
    const def = make({ seasons: ['spring'], weather: ['snow'], chance: 1 });
    expect(homeOn(def, 3)).toBe('woods');
    expect(isAbout(def, { season: 'spring', weather: 'sun', minutes: 480 })).toBe(false);
  });

  it('treats a day below 1 or not a number as day 1', () => {
    const def = make({ maps: ['woods', 'beach', 'quarry'], chance: 0.5 });
    // Find out what day 1 gives and make sure it is not a day where the answer is "nothing" by luck of the odd inputs.
    const dayOne = homeOn(def, 1);
    for (const odd of [0, -1, -50, 0.5, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(homeOn(def, odd)).toBe(dayOne);
    }
    // And for a creature that is always about, so the answer is a real map and not just two undefineds.
    const always = make({ maps: ['woods', 'beach', 'quarry'], chance: 1 });
    expect(homeOn(always, 1)).toBeDefined();
    for (const odd of [0, -7, Number.NaN, Number.POSITIVE_INFINITY]) expect(homeOn(always, odd)).toBe(homeOn(always, 1));
  });

  it('rounds a fractional day down', () => {
    const def = make({ maps: ['woods', 'beach', 'quarry'], chance: 1 });
    for (const day of days(40)) {
      expect(homeOn(def, day + 0.9)).toBe(homeOn(def, day));
      expect(homeOn(def, day + 0.5)).toBe(homeOn(def, day));
    }
  });

  it('copes with a huge day without throwing, and stays deterministic', () => {
    const def = make({ maps: ['woods', 'beach'], chance: 1 });
    const far = 1e15;
    expect(() => homeOn(def, far)).not.toThrow();
    expect(homeOn(def, far)).toBe(homeOn(def, far));
    expect(def.maps).toContain(homeOn(def, far));
    expect(homeOn(def, Number.MAX_VALUE)).toBeDefined();
  });
});

describe('placeCreatures', () => {
  const candidates = grid(10, 10);
  const input = (over: Partial<Parameters<typeof placeCreatures>[0]> = {}): Parameters<typeof placeCreatures>[0] => ({
    day: 3,
    map: 'woods',
    defs: [fox],
    candidates,
    ...NOW,
    ...over,
  });
  const cellOf = (placements: readonly CreaturePlacement[], id: string): string | undefined => {
    const found = placements.find((p) => p.creature === id);
    return found === undefined ? undefined : key(found);
  };

  it('puts a creature that is home and about on one of the candidates, with its id and map', () => {
    const placed = placeCreatures(input());
    expect(placed).toHaveLength(1);
    const [only] = placed as [CreaturePlacement];
    expect(only.creature).toBe('fox');
    expect(only.map).toBe('woods');
    expect(candidates.map(key)).toContain(key(only));
  });

  it('gives the same answer every time', () => {
    const defs = [fox, make({ id: 'owl' }), make({ id: 'deer' })];
    const first = placeCreatures(input({ defs }));
    expect(placeCreatures(input({ defs }))).toEqual(first);
    expect(placeCreatures(input({ defs: [...defs], candidates: [...candidates] }))).toEqual(first);
    expect(first).toHaveLength(3);
  });

  it('stands still while it is about: the same cell at every minute of the window', () => {
    for (const day of days(30)) {
      const cells = new Set<string>();
      for (let minutes = 360; minutes < 600; minutes += 5) {
        const placed = placeCreatures(input({ day, minutes }));
        expect(placed).toHaveLength(1);
        cells.add(key(placed[0] as CreaturePlacement));
      }
      expect(cells.size).toBe(1);
    }
  });

  it('does not move with the weather: the same cell in sun and in cloud', () => {
    for (const day of days(30)) {
      const sun = placeCreatures(input({ day, weather: 'sun' }));
      const cloud = placeCreatures(input({ day, weather: 'cloud' }));
      expect(sun).toHaveLength(1);
      expect(cloud).toEqual(sun);
    }
  });

  it('does not depend on the season either: the same cell in autumn and winter', () => {
    for (const day of days(30)) {
      expect(placeCreatures(input({ day, season: 'winter' }))).toEqual(placeCreatures(input({ day, season: 'autumn' })));
    }
  });

  it('is simply not there when the hour, the weather or the season is wrong', () => {
    expect(placeCreatures(input({ minutes: 359 }))).toEqual([]);
    expect(placeCreatures(input({ minutes: 600 }))).toEqual([]);
    expect(placeCreatures(input({ minutes: 0 }))).toEqual([]);
    expect(placeCreatures(input({ weather: 'rain' }))).toEqual([]);
    expect(placeCreatures(input({ weather: 'snow' }))).toEqual([]);
    expect(placeCreatures(input({ season: 'spring' }))).toEqual([]);
    expect(placeCreatures(input({ season: 'summer' }))).toEqual([]);
  });

  it('is simply not there on a day it is not home at all', () => {
    const rare = make({ chance: 0 });
    for (const day of days(50)) expect(placeCreatures(input({ day, defs: [rare] }))).toEqual([]);
    const homeless = make({ maps: [] });
    expect(placeCreatures(input({ defs: [homeless] }))).toEqual([]);
  });

  it('appears and vanishes with the hour without moving', () => {
    const at = (minutes: number): CreaturePlacement[] => placeCreatures(input({ minutes }));
    const morning = at(400);
    expect(morning).toHaveLength(1);
    expect(at(300)).toEqual([]);
    expect(at(700)).toEqual([]);
    expect(at(599)).toEqual(morning);
    expect(at(360)).toEqual(morning);
  });

  it('gives nothing when there are no candidates', () => {
    expect(placeCreatures(input({ candidates: [] }))).toEqual([]);
    expect(placeCreatures(input({ candidates: [], defs: [fox, make({ id: 'owl' })] }))).toEqual([]);
  });

  it('gives nothing when there are no creatures', () => {
    expect(placeCreatures(input({ defs: [] }))).toEqual([]);
  });

  it('does not place a creature whose home today is another map', () => {
    const wanderer = make({ id: 'heron', maps: ['woods', 'beach'], chance: 1 });
    let onWoods = 0;
    let onBeach = 0;
    for (const day of days(80)) {
      const woods = placeCreatures(input({ day, defs: [wanderer], map: 'woods' }));
      const beach = placeCreatures(input({ day, defs: [wanderer], map: 'beach' }));
      // Exactly one map has it each day, and it is the one `homeOn` names.
      expect(woods.length + beach.length).toBe(1);
      expect(woods.length === 1).toBe(homeOn(wanderer, day) === 'woods');
      expect(beach.length === 1).toBe(homeOn(wanderer, day) === 'beach');
      onWoods += woods.length;
      onBeach += beach.length;
    }
    expect(onWoods).toBeGreaterThan(10);
    expect(onBeach).toBeGreaterThan(10);
  });

  it('does not place anything on a map none of the creatures live on', () => {
    for (const day of days(30)) expect(placeCreatures(input({ day, map: 'mine_1' }))).toEqual([]);
  });

  it('only places the creatures that are home here today, leaving others out', () => {
    const woodsOnly = make({ id: 'fox', maps: ['woods'] });
    const beachOnly = make({ id: 'crab', maps: ['beach'] });
    const placed = placeCreatures(input({ defs: [woodsOnly, beachOnly] }));
    expect(placed.map((p) => p.creature)).toEqual(['fox']);
  });

  it('chooses the cell by day: it is somewhere else on other days', () => {
    const cells = new Set(days(60).map((day) => cellOf(placeCreatures(input({ day })), 'fox')));
    expect(cells.size).toBeGreaterThan(30);
  });

  it('chooses the cell by map: the same creature on another map stands elsewhere', () => {
    const inWoods = make({ id: 'fox', maps: ['woods'] });
    const onBeach = make({ id: 'fox', maps: ['beach'] });
    let differs = 0;
    for (const day of days(40)) {
      const a = cellOf(placeCreatures(input({ day, defs: [inWoods], map: 'woods' })), 'fox');
      const b = cellOf(placeCreatures(input({ day, defs: [onBeach], map: 'beach' })), 'fox');
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (a !== b) differs += 1;
    }
    expect(differs).toBeGreaterThan(30);
  });

  it('chooses the cell by creature: two creatures stand in different places', () => {
    let differs = 0;
    for (const day of days(40)) {
      const placed = placeCreatures(input({ day, defs: [fox, make({ id: 'owl' })] }));
      if (cellOf(placed, 'fox') !== cellOf(placed, 'owl')) differs += 1;
    }
    expect(differs).toBe(40); // never the same cell, and that is the rule, not luck
  });

  it('chooses by index into the list it is given: another order is another list', () => {
    const reversed = [...candidates].reverse();
    for (const day of days(40)) {
      const a = placeCreatures(input({ day })).at(0) as CreaturePlacement;
      const b = placeCreatures(input({ day, candidates: reversed })).at(0) as CreaturePlacement;
      const index = candidates.findIndex((c) => key(c) === key(a));
      expect(key(reversed[index] as { x: number; y: number })).toBe(key(b));
    }
  });

  it('only ever stands on a candidate, with offset and negative coordinates too', () => {
    const odd = grid(6, 5, -3, -2);
    const allowed = new Set(odd.map(key));
    const defs = [fox, make({ id: 'owl' }), make({ id: 'deer' }), make({ id: 'hare' })];
    for (const day of days(100)) {
      for (const p of placeCreatures(input({ day, defs, candidates: odd }))) expect(allowed.has(key(p))).toBe(true);
    }
  });

  it('uses every candidate over many days', () => {
    const small = grid(4, 4);
    const counts = new Map<string, number>();
    const total = 3200;
    for (const day of days(total)) {
      const cell = cellOf(placeCreatures(input({ day, candidates: small })), 'fox') as string;
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
    expect(counts.size).toBe(16);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan((total / 16) * 0.7);
      expect(n).toBeLessThan((total / 16) * 1.3);
    }
  });

  it('never puts two creatures on one cell, even when the cells are scarce', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const defs = ids.map((id) => make({ id }));
    for (const count of [8, 9, 12, 30]) {
      const cells = grid(count, 1);
      for (const day of days(60)) {
        const placed = placeCreatures(input({ day, defs, candidates: cells }));
        expect(placed).toHaveLength(8);
        expect(new Set(placed.map(key)).size).toBe(8);
      }
    }
  });

  it('with as many cells as creatures, fills every cell exactly once', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const defs = ids.map((id) => make({ id }));
    const cells = grid(5, 1);
    for (const day of days(60)) {
      const placed = placeCreatures(input({ day, defs, candidates: cells }));
      expect(new Set(placed.map(key))).toEqual(new Set(cells.map(key)));
    }
  });

  it('leaves out the later creatures when there are fewer cells than creatures', () => {
    const defs = ['a', 'b', 'c'].map((id) => make({ id }));
    for (const day of days(40)) {
      const placed = placeCreatures(input({ day, defs, candidates: grid(2, 1) }));
      expect(placed.map((p) => p.creature)).toEqual(['a', 'b']);
      expect(new Set(placed.map(key)).size).toBe(2);
    }
  });

  it('gives a single cell to the first creature that is home, and nothing to the rest', () => {
    const defs = ['a', 'b'].map((id) => make({ id }));
    for (const day of days(20)) {
      const placed = placeCreatures(input({ day, defs, candidates: [{ x: 4, y: 4 }] }));
      expect(placed).toEqual([{ creature: 'a', map: 'woods', x: 4, y: 4 }]);
    }
  });

  it('takes a cell listed twice to be one cell', () => {
    const defs = ['a', 'b'].map((id) => make({ id }));
    for (const day of days(20)) {
      const placed = placeCreatures(input({ day, defs, candidates: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }));
      expect(placed).toHaveLength(1);
    }
  });

  it('walks forward past a taken cell to the next free one, and wraps round the end', () => {
    // Two creatures, two cells: whichever the first takes, the second must take the other, wrapping if need be.
    const defs = [make({ id: 'a' }), make({ id: 'b' })];
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    let wrapped = false;
    for (const day of days(80)) {
      const [first, second] = placeCreatures(input({ day, defs, candidates: cells })) as [CreaturePlacement, CreaturePlacement];
      expect(key(first)).not.toBe(key(second));
      if (key(first) === '1,0' && key(second) === '0,0') wrapped = true;
    }
    expect(wrapped).toBe(true);
  });

  it('keeps a creature where it was when a neighbour comes or goes with the hour', () => {
    // Three cells and two creatures that often want the same one: the early bird is out only in the morning, the other all day.
    const bird = make({ id: 'bird', from: 360, to: 480 });
    const stay = make({ id: 'stay', from: 0, to: 1440 });
    const cells = grid(3, 1);
    for (const day of days(120)) {
      const withBird = placeCreatures(input({ day, defs: [bird, stay], candidates: cells, minutes: 400 }));
      const withoutBird = placeCreatures(input({ day, defs: [bird, stay], candidates: cells, minutes: 900 }));
      expect(withBird).toHaveLength(2);
      expect(withoutBird).toHaveLength(1);
      expect(cellOf(withoutBird, 'stay')).toBe(cellOf(withBird, 'stay'));
    }
  });

  it('keeps a creature where it was when a neighbour is kept away by the weather', () => {
    const shy = make({ id: 'shy', weather: ['sun'] });
    const bold = make({ id: 'bold', weather: ['sun', 'cloud'] });
    const cells = grid(2, 1);
    for (const day of days(60)) {
      const sunny = placeCreatures(input({ day, defs: [shy, bold], candidates: cells, weather: 'sun' }));
      const cloudy = placeCreatures(input({ day, defs: [shy, bold], candidates: cells, weather: 'cloud' }));
      expect(sunny).toHaveLength(2);
      expect(cloudy).toHaveLength(1);
      expect(cellOf(cloudy, 'bold')).toBe(cellOf(sunny, 'bold'));
    }
  });

  it('lists the placements in the order of the defs', () => {
    const defs = [make({ id: 'c' }), make({ id: 'a' }), make({ id: 'b' })];
    for (const day of days(30)) {
      expect(placeCreatures(input({ day, defs })).map((p) => p.creature)).toEqual(['c', 'a', 'b']);
    }
    const some = [make({ id: 'z' }), make({ id: 'never', chance: 0 }), make({ id: 'y' })];
    expect(placeCreatures(input({ defs: some })).map((p) => p.creature)).toEqual(['z', 'y']);
  });

  it('leaves out creatures that are not about while placing the ones that are', () => {
    const day = make({ id: 'day', from: 360, to: 600 });
    const night = make({ id: 'night', from: 1200, to: 1380 });
    expect(placeCreatures(input({ defs: [day, night], minutes: 480 })).map((p) => p.creature)).toEqual(['day']);
    expect(placeCreatures(input({ defs: [day, night], minutes: 1250 })).map((p) => p.creature)).toEqual(['night']);
    expect(placeCreatures(input({ defs: [day, night], minutes: 800 }))).toEqual([]);
  });

  it('does not change the defs or the candidates it is given', () => {
    const defs = [fox, make({ id: 'owl' })];
    const list = [...candidates].reverse();
    const defsBefore = JSON.stringify(defs);
    const listBefore = JSON.stringify(list);
    placeCreatures(input({ defs, candidates: list }));
    expect(JSON.stringify(defs)).toBe(defsBefore);
    expect(JSON.stringify(list)).toBe(listBefore);
  });

  it('hands out fresh objects, not the candidates themselves', () => {
    const list = [{ x: 2, y: 2 }];
    const [placed] = placeCreatures(input({ candidates: list })) as [CreaturePlacement];
    expect(placed).not.toBe(list[0]);
    expect(placed).toEqual({ creature: 'fox', map: 'woods', x: 2, y: 2 });
  });

  it('treats a day below 1 or not a number as day 1, without throwing', () => {
    const dayOne = placeCreatures(input({ day: 1 }));
    expect(dayOne).toHaveLength(1);
    for (const day of [0, -4, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(placeCreatures(input({ day }))).toEqual(dayOne);
    }
    expect(placeCreatures(input({ day: 3.8 }))).toEqual(placeCreatures(input({ day: 3 })));
  });

  it('copes with odd minutes: nothing is about, nothing throws', () => {
    expect(placeCreatures(input({ minutes: Number.NaN }))).toEqual([]);
    expect(placeCreatures(input({ minutes: Number.POSITIVE_INFINITY }))).toEqual([]);
  });
});

describe('canSee', () => {
  const at = (x: number, y: number): { x: number; y: number } => ({ x, y });
  const you = at(10, 10);

  it('has a see range of 3 cells', () => {
    expect(SEE_RANGE).toBe(3);
  });

  it('sees a creature on the player\'s own cell', () => {
    expect(canSee(you, at(10, 10), false)).toBe(true);
  });

  it('sees it exactly 3 cells away along a row or a column, in all four directions', () => {
    expect(canSee(you, at(13, 10), false)).toBe(true);
    expect(canSee(you, at(7, 10), false)).toBe(true);
    expect(canSee(you, at(10, 13), false)).toBe(true);
    expect(canSee(you, at(10, 7), false)).toBe(true);
  });

  it('does not see it 4 cells away', () => {
    expect(canSee(you, at(14, 10), false)).toBe(false);
    expect(canSee(you, at(6, 10), false)).toBe(false);
    expect(canSee(you, at(10, 14), false)).toBe(false);
    expect(canSee(you, at(10, 6), false)).toBe(false);
  });

  it('is just over the edge a hair beyond 3 cells, and just inside a hair before', () => {
    expect(canSee(you, at(13.01, 10), false)).toBe(false);
    expect(canSee(you, at(12.99, 10), false)).toBe(true);
    expect(canSee(you, at(10, 13.0001), false)).toBe(false);
  });

  it('measures straight-line distance, so diagonals reach less far along each axis', () => {
    expect(canSee(you, at(12, 12), false)).toBe(true); // 2.83 cells
    expect(canSee(you, at(8, 8), false)).toBe(true);
    expect(canSee(you, at(12, 8), false)).toBe(true);
    expect(canSee(you, at(13, 13), false)).toBe(false); // 4.24 cells
    expect(canSee(you, at(7, 7), false)).toBe(false);
    expect(canSee(you, at(12, 13), false)).toBe(false); // 3.61 cells
    expect(canSee(you, at(13, 11), false)).toBe(false); // 3.16 cells
    expect(canSee(you, at(11, 13), false)).toBe(false);
    expect(canSee(you, at(13, 10), false)).toBe(true);
    expect(canSee(you, at(11, 12), false)).toBe(true); // 2.24 cells
  });

  it('is the same from either side', () => {
    for (const [dx, dy] of [[3, 0], [2, 2], [3, 1], [0, 4], [1, 1]] as const) {
      expect(canSee(at(0, 0), at(dx, dy), false)).toBe(canSee(at(dx, dy), at(0, 0), false));
    }
  });

  it('works with negative coordinates', () => {
    expect(canSee(at(-2, -2), at(-5, -2), false)).toBe(true);
    expect(canSee(at(-2, -2), at(-6, -2), false)).toBe(false);
  });

  it('never sees a creature while running, however close', () => {
    expect(canSee(you, at(10, 10), true)).toBe(false);
    expect(canSee(you, at(11, 10), true)).toBe(false);
    expect(canSee(you, at(13, 10), true)).toBe(false);
    expect(canSee(you, at(10, 10), false)).toBe(true);
  });

  it('sees nothing when a position is not a number', () => {
    expect(canSee(at(Number.NaN, 10), at(10, 10), false)).toBe(false);
    expect(canSee(you, at(10, Number.NaN), false)).toBe(false);
    expect(canSee(at(Number.POSITIVE_INFINITY, 0), at(Number.POSITIVE_INFINITY, 0), false)).toBe(false);
    expect(canSee(you, at(Number.NEGATIVE_INFINITY, 10), false)).toBe(false);
  });
});

describe('acceptsGift', () => {
  it('takes what it likes', () => {
    expect(acceptsGift(fox, 'berry')).toBe(true);
    expect(acceptsGift(fox, 'egg')).toBe(true);
  });

  it('refuses everything else', () => {
    expect(acceptsGift(fox, 'rock')).toBe(false);
    expect(acceptsGift(fox, '')).toBe(false);
    expect(acceptsGift(fox, 'fox_tail')).toBe(false); // its own keepsake is not a gift it wants
  });

  it('matches the whole item id, with its exact spelling', () => {
    expect(acceptsGift(fox, 'Berry')).toBe(false);
    expect(acceptsGift(fox, 'berr')).toBe(false);
    expect(acceptsGift(fox, 'berry ')).toBe(false);
    expect(acceptsGift(fox, 'berry_jam')).toBe(false);
  });

  it('takes nothing when it likes nothing', () => {
    expect(acceptsGift(make({ likes: [] }), 'berry')).toBe(false);
  });

  it('asks nothing of the season, weather or hour', () => {
    const def = make({ seasons: [], weather: [], from: 0, to: 0 });
    expect(acceptsGift(def, 'berry')).toBe(true);
  });
});
