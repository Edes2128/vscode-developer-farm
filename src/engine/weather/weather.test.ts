import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, seasonOf, type Season } from '../time/calendar';
import { WEATHERS, type Weather } from './types';
import { SEASON_WEATHER, WEATHER_NAMES, dimming, forecastFor, isFalling, watersFields, weatherOn } from './weather';

const sumOf = (weights: Readonly<Record<Weather, number>>): number => WEATHERS.reduce((total, w) => total + weights[w], 0);
/** The chance of a weather in a season, from the weights. */
const chance = (season: Season, weather: Weather): number => SEASON_WEATHER[season][weather] / sumOf(SEASON_WEATHER[season]);

/** The days of one year, from day 1: a year is 4 seasons of 28 days. */
const year = (seed?: number, clearDays?: ReadonlySet<number>): Weather[] =>
  Array.from({ length: DAYS_PER_YEAR }, (_, i) => weatherOn(i + 1, clearDays, seed));

/** Every day of a season over many years, from year 2 on (day 1, the one forced day, belongs to year 1). */
function seasonDays(season: Season, years: number): number[] {
  const days: number[] = [];
  for (let y = 1; y <= years; y += 1) {
    for (let k = 1; k <= DAYS_PER_SEASON; k += 1) days.push(y * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON + k);
  }
  return days;
}

/** The longest stretch of identical weather in days `from` to `to`. */
function longestRun(from: number, to: number, seed?: number): number {
  let best = 0;
  let run = 0;
  let previous: Weather | undefined;
  for (let day = from; day <= to; day += 1) {
    const weather = weatherOn(day, undefined, seed);
    run = weather === previous ? run + 1 : 1;
    previous = weather;
    best = Math.max(best, run);
  }
  return best;
}

describe('SEASON_WEATHER', () => {
  it('keeps the designed weights', () => {
    expect(SEASON_WEATHER.spring).toEqual({ sun: 45, cloud: 25, rain: 25, storm: 5, snow: 0 });
    expect(SEASON_WEATHER.summer).toEqual({ sun: 60, cloud: 15, rain: 15, storm: 10, snow: 0 });
    expect(SEASON_WEATHER.autumn).toEqual({ sun: 35, cloud: 30, rain: 30, storm: 5, snow: 0 });
    expect(SEASON_WEATHER.winter).toEqual({ sun: 30, cloud: 30, rain: 0, storm: 5, snow: 35 });
  });

  it('has a weight for every weather in every season, and some weather every season', () => {
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        expect(Number.isFinite(SEASON_WEATHER[season][weather])).toBe(true);
        expect(SEASON_WEATHER[season][weather]).toBeGreaterThanOrEqual(0);
      }
      expect(sumOf(SEASON_WEATHER[season])).toBeGreaterThan(0);
    }
  });
});

describe('weatherOn: determinism', () => {
  it('gives the same weather for the same day every time', () => {
    for (let day = 1; day <= 300; day += 1) expect(weatherOn(day)).toBe(weatherOn(day));
    expect(year()).toEqual(year());
  });

  it('does not depend on the order days are asked in', () => {
    const forward = Array.from({ length: 400 }, (_, i) => weatherOn(i + 1));
    // Backwards, and in a fixed scramble (stride 7 is coprime with 400), so the test needs no randomness.
    const backward = Array.from({ length: 400 }, (_, i) => weatherOn(400 - i)).reverse();
    const scrambled: Weather[] = [];
    for (let i = 0; i < 400; i += 1) scrambled[(i * 7) % 400] = weatherOn(((i * 7) % 400) + 1);
    expect(backward).toEqual(forward);
    expect(scrambled).toEqual(forward);
  });

  it('is not changed by asking about other days, seeds or clear days in between', () => {
    const before = weatherOn(40);
    weatherOn(41);
    weatherOn(40, new Set([40]));
    weatherOn(40, undefined, 99);
    forecastFor(39);
    expect(weatherOn(40)).toBe(before);
  });

  it('treats no seed as seed 0', () => {
    expect(year(0)).toEqual(year());
    expect(year(undefined)).toEqual(year());
  });

  it('gives different years for different seeds, each the same every time', () => {
    const seeds = [0, 1, 2, 3, 7, 42, 1234, 2 ** 31, 2 ** 32 - 1];
    const years = seeds.map((seed) => year(seed));
    expect(new Set(years.map((y) => y.join())).size).toBe(seeds.length);
    seeds.forEach((seed, i) => expect(year(seed)).toEqual(years[i]));
    // Independent years agree on a day only now and then (about a third of the time), not mostly.
    for (let i = 1; i < years.length; i += 1) {
      const first = years[0] as Weather[];
      const other = years[i] as Weather[];
      const differing = first.filter((w, d) => w !== other[d]).length;
      expect(differing).toBeGreaterThan(DAYS_PER_YEAR * 0.4);
    }
  });
});

describe('weatherOn: the first morning and clear days', () => {
  it('is sunny on day 1, whatever the seed', () => {
    expect(weatherOn(1)).toBe('sun');
    for (let seed = 0; seed < 500; seed += 1) expect(weatherOn(1, undefined, seed)).toBe('sun');
    expect(weatherOn(1, new Set())).toBe('sun');
  });

  it('counts a day below 1, a fraction or something that is not a day as the first day or the day it falls in', () => {
    expect(weatherOn(0)).toBe('sun');
    expect(weatherOn(-12)).toBe('sun');
    expect(weatherOn(Number.NaN)).toBe('sun');
    expect(weatherOn(Number.POSITIVE_INFINITY)).toBe('sun');
    expect(weatherOn(37.9)).toBe(weatherOn(37));
  });

  it('forces the listed days to sun and changes nothing else', () => {
    // Pick days that are not sunny on their own, so the test can tell "forced" from "happened to be sunny".
    const notSunny = Array.from({ length: 200 }, (_, i) => i + 2).filter((d) => weatherOn(d) !== 'sun');
    const clear = new Set(notSunny.slice(0, 30));
    expect(clear.size).toBe(30);
    for (let day = 1; day <= 200; day += 1) {
      if (clear.has(day)) expect(weatherOn(day, clear)).toBe('sun');
      else expect(weatherOn(day, clear)).toBe(weatherOn(day));
    }
  });

  it('does not make the first day of a season clear on its own', () => {
    let sunny = 0;
    let firsts = 0;
    for (let y = 1; y <= 300; y += 1) {
      for (const season of SEASONS) {
        const first = y * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON + 1;
        expect(seasonOf(first)).toBe(season);
        firsts += 1;
        if (weatherOn(first) === 'sun') sunny += 1;
      }
    }
    // About 42% of those days are sunny by the weights; clear days would make it all of them.
    expect(sunny / firsts).toBeGreaterThan(0.3);
    expect(sunny / firsts).toBeLessThan(0.55);
  });

  it('keeps clear days sunny under any seed', () => {
    const clear = new Set([29, 30, 100]);
    for (let seed = 0; seed < 50; seed += 1) for (const day of clear) expect(weatherOn(day, clear, seed)).toBe('sun');
  });
});

describe('weatherOn: seasons', () => {
  it('never snows outside winter, never rains in winter, and every possible weather turns up in its season', () => {
    for (const season of SEASONS) {
      const seen = new Set<Weather>();
      for (const day of seasonDays(season, 200)) seen.add(weatherOn(day));
      for (const weather of WEATHERS) {
        // A weather with no weight never comes up, and one with weight does (200 seasons is plenty for the rarest, 5%).
        expect(seen.has(weather), `${season} ${weather}`).toBe(SEASON_WEATHER[season][weather] > 0);
      }
    }
  });

  it('keeps those rules under other seeds, in the first years too', () => {
    for (const seed of [1, 2, 3, 500, 2 ** 31]) {
      for (let day = 1; day <= DAYS_PER_YEAR * 20; day += 1) {
        const weather = weatherOn(day, undefined, seed);
        expect(SEASON_WEATHER[seasonOf(day)][weather]).toBeGreaterThan(0);
      }
    }
  });

  it('follows the weights over 28 000 days of each season', () => {
    for (const season of SEASONS) {
      const days = seasonDays(season, 1000);
      expect(days).toHaveLength(28000);
      const counts: Record<Weather, number> = { sun: 0, cloud: 0, rain: 0, storm: 0, snow: 0 };
      for (const day of days) counts[weatherOn(day)] += 1;
      for (const weather of WEATHERS) {
        // The spread of a share over 28 000 draws is at most about 0.003, so 0.015 is five times that: loose, not sloppy.
        expect(Math.abs(counts[weather] / days.length - chance(season, weather)), `${season} ${weather}`).toBeLessThan(0.015);
      }
    }
  });

  it('follows the weights under another seed too', () => {
    const days = seasonDays('winter', 1000);
    const counts: Record<Weather, number> = { sun: 0, cloud: 0, rain: 0, storm: 0, snow: 0 };
    for (const day of days) counts[weatherOn(day, undefined, 77)] += 1;
    for (const weather of WEATHERS) expect(Math.abs(counts[weather] / days.length - chance('winter', weather))).toBeLessThan(0.015);
  });
});

describe('weatherOn: no patterns from day to day', () => {
  it('repeats yesterday about as often as independent days would', () => {
    for (const season of SEASONS) {
      // Two independent days match with probability (sum of squared chances): 0.33 in spring, 0.415 in summer.
      const expected = WEATHERS.reduce((total, w) => total + chance(season, w) ** 2, 0);
      let same = 0;
      let pairs = 0;
      for (let y = 1; y <= 1000; y += 1) {
        for (let k = 1; k < DAYS_PER_SEASON; k += 1) {
          const day = y * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON + k;
          pairs += 1;
          if (weatherOn(day) === weatherOn(day + 1)) same += 1;
        }
      }
      // 27 000 pairs: the spread is under 0.003.
      expect(Math.abs(same / pairs - expected), season).toBeLessThan(0.015);
    }
  });

  it('has no repeating cycle: every weather is uncorrelated with itself at every lag up to a year', () => {
    const years = 400;
    const total = years * DAYS_PER_YEAR;
    for (const weather of WEATHERS) {
      // How far each day is from what its season leads one to expect, so the seasons themselves do not count as a pattern.
      const spread: number[] = [];
      for (let day = 1; day <= total; day += 1) spread.push((weatherOn(day) === weather ? 1 : 0) - chance(seasonOf(day), weather));
      const variance = spread.reduce((sum, value) => sum + value * value, 0);
      for (let lag = 1; lag <= DAYS_PER_YEAR + 8; lag += 1) {
        let together = 0;
        for (let i = 0; i + lag < total; i += 1) together += (spread[i] as number) * (spread[i + lag] as number);
        // Independent days scatter this around 0 by about 0.005 over 44 800 days; 0.04 is eight times that, and a weekly,
        // monthly or yearly rhythm (or a stuck generator) would sit far above it.
        expect(Math.abs(together / variance), `${weather} at lag ${lag}`).toBeLessThan(0.04);
      }
    }
  });

  it('never repeats a whole stretch of days: no two seasons of a year match', () => {
    const y = year();
    const seasons = SEASONS.map((_, i) => y.slice(i * DAYS_PER_SEASON, (i + 1) * DAYS_PER_SEASON).join());
    expect(new Set(seasons).size).toBe(4);
    const years = Array.from({ length: 20 }, (_, i) => Array.from({ length: DAYS_PER_YEAR }, (_, d) => weatherOn(i * DAYS_PER_YEAR + d + 1)).join());
    expect(new Set(years).size).toBe(20);
  });

  it('has no stretch of identical weather too long to be chance', () => {
    // The likeliest weather is summer sun at 60%, so n days of it in a row has odds 0.6^n of following any start: a run of
    // 20 is about 1 in 27 000. Over 100 years (11 200 days, about 3 000 summer days that can start one) that is a few
    // percent, so passing is fair; a hash that clumps would break it long before.
    expect(longestRun(1, DAYS_PER_YEAR * 100)).toBeLessThanOrEqual(20);
    expect(longestRun(1, DAYS_PER_YEAR * 100, 5)).toBeLessThanOrEqual(20);
  });

  it('gives the first year some of everything that its seasons allow, with no season stuck on one weather', () => {
    const y = year();
    for (const [i, season] of SEASONS.entries()) {
      const kinds = new Set(y.slice(i * DAYS_PER_SEASON, (i + 1) * DAYS_PER_SEASON));
      expect(kinds.size, season).toBeGreaterThanOrEqual(3);
    }
    expect(longestRun(1, DAYS_PER_YEAR)).toBeLessThan(12);
  });
});

describe('forecastFor', () => {
  it("is tomorrow's weather", () => {
    for (let day = 0; day <= 500; day += 1) expect(forecastFor(day)).toBe(weatherOn(day + 1));
  });

  it('honours clear days and seeds the same way', () => {
    const clear = new Set([51, 80]);
    expect(forecastFor(50, clear)).toBe('sun');
    expect(forecastFor(79, clear)).toBe('sun');
    for (let day = 0; day <= 200; day += 1) {
      expect(forecastFor(day, clear, 9)).toBe(weatherOn(day + 1, clear, 9));
      expect(forecastFor(day, undefined, 9)).toBe(weatherOn(day + 1, undefined, 9));
    }
  });

  it('promises a sunny first morning on the day before it', () => {
    expect(forecastFor(0)).toBe('sun');
  });
});

describe('what the weather does', () => {
  it('names every weather', () => {
    expect(WEATHER_NAMES).toEqual({ sun: 'Sunny', cloud: 'Cloudy', rain: 'Rainy', storm: 'Stormy', snow: 'Snowy' });
    expect(Object.keys(WEATHER_NAMES).sort()).toEqual([...WEATHERS].sort());
  });

  it('waters the fields in rain and storms only', () => {
    const watering = WEATHERS.filter(watersFields);
    expect(watering).toEqual(['rain', 'storm']);
    expect(watersFields('snow')).toBe(false);
    expect(watersFields('cloud')).toBe(false);
    expect(watersFields('sun')).toBe(false);
  });

  it('counts rain, storms and snow as falling, and sun and cloud as not', () => {
    expect(WEATHERS.filter(isFalling)).toEqual(['rain', 'storm', 'snow']);
    expect(isFalling('sun')).toBe(false);
    expect(isFalling('cloud')).toBe(false);
  });

  it('waters wherever it rains: every watering weather is falling', () => {
    for (const weather of WEATHERS) if (watersFields(weather)) expect(isFalling(weather)).toBe(true);
  });

  it('dims the world: sun is full light, rain and storms are darker than cloud and snow, storms darkest', () => {
    expect(dimming('sun')).toBe(1);
    for (const weather of WEATHERS) {
      expect(dimming(weather)).toBeGreaterThan(0);
      expect(dimming(weather)).toBeLessThanOrEqual(1);
      if (weather !== 'sun') expect(dimming(weather)).toBeLessThan(1);
    }
    expect(dimming('cloud')).toBeLessThan(1);
    expect(dimming('snow')).toBeLessThan(1);
    expect(dimming('cloud')).toBeGreaterThan(dimming('rain'));
    expect(dimming('snow')).toBeGreaterThan(dimming('rain'));
    expect(dimming('rain')).toBeGreaterThan(dimming('storm'));
    // "A little" lower for cloud and snow: still most of the light.
    expect(dimming('cloud')).toBeGreaterThanOrEqual(0.85);
    expect(dimming('snow')).toBeGreaterThanOrEqual(0.85);
  });
});
