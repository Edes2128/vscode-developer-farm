/**
 * What the sky does. Weather is decided by the day alone (plus an optional world seed), so it is never saved: asking about
 * the same day always gives the same answer, in any order, and the forecast is just tomorrow's answer. Pure functions: no
 * `Math.random`, no clock, nothing remembered between calls.
 */
import { createRng, hash2 } from '../core/random';
import { seasonOf, type Season } from '../time/calendar';
import { WEATHERS, type Weather } from './types';

/**
 * Chance weights per season. They need not sum to 1, they are normalised, so "45 of 100" and "9 of 20" mean the same.
 * A weight of 0 means that weather never happens in that season (no snow in summer, no rain in winter).
 */
export const SEASON_WEATHER: Readonly<Record<Season, Readonly<Record<Weather, number>>>> = {
  spring: { sun: 45, cloud: 25, rain: 25, storm: 5, snow: 0 },
  summer: { sun: 60, cloud: 15, rain: 15, storm: 10, snow: 0 },
  autumn: { sun: 35, cloud: 30, rain: 30, storm: 5, snow: 0 },
  winter: { sun: 30, cloud: 30, rain: 0, storm: 5, snow: 35 },
};

export const WEATHER_NAMES: Readonly<Record<Weather, string>> = {
  sun: 'Sunny',
  cloud: 'Cloudy',
  rain: 'Rainy',
  storm: 'Stormy',
  snow: 'Snowy',
};

/** How much of the day's light gets through. Rain and storms are the gloomy ones; cloud and snow only take the edge off. */
const BRIGHTNESS: Readonly<Record<Weather, number>> = {
  sun: 1,
  cloud: 0.9,
  snow: 0.9,
  rain: 0.75,
  storm: 0.6,
};

const UINT32 = 4294967296;
/** `hash2` takes two coordinates and a seed: the day goes in beside this fixed number, the world seed in the seed slot. */
const WEATHER_SALT = 0x5ea7;

/** The first morning of the game is always bright. */
const FIRST_DAY = 1;

/**
 * A weighted pick: each weather owns a slice of [0, 1) as wide as its share of the total weight, in `WEATHERS` order, and
 * `roll` says which slice. A weather with no weight owns no slice, so it can never come up.
 */
function pickWeather(weights: Readonly<Record<Weather, number>>, roll: number): Weather {
  let total = 0;
  for (const weather of WEATHERS) total += weights[weather];
  const target = roll * total;
  let seen = 0;
  // Only reached as the answer if every weight were 0, which the table above never has.
  let last: Weather = 'sun';
  for (const weather of WEATHERS) {
    const weight = weights[weather];
    if (weight <= 0) continue;
    seen += weight;
    last = weather;
    if (target < seen) return weather;
  }
  // Rounding can leave `target` a hair above the running sum: the last weather with any weight takes the remainder.
  return last;
}

/**
 * The weather on a day (day 1 is the first day of spring). The same day (and seed) always gives the same weather, whatever
 * else was asked before. `clearDays` lists days forced to 'sun', such as festivals; the first day of a season is not
 * clear unless it is listed. Day 1 is always sun. A day below 1 or not a number counts as day 1.
 */
export function weatherOn(day: number, clearDays?: ReadonlySet<number>, seed = 0): Weather {
  const today = Number.isFinite(day) && day >= FIRST_DAY ? Math.floor(day) : FIRST_DAY;
  if (today === FIRST_DAY || clearDays?.has(today)) return 'sun';

  // `hash2` alone is a thin mix of two numbers and consecutive days would sit close together, so its result seeds a
  // generator and the first draw from that is the roll: the second round of mixing is what scatters neighbouring days.
  const roll = createRng(Math.floor(hash2(today, WEATHER_SALT, seed) * UINT32))();
  return pickWeather(SEASON_WEATHER[seasonOf(today)], roll);
}

/** Tomorrow's weather, which the player can be told today. */
export const forecastFor = (day: number, clearDays?: ReadonlySet<number>, seed?: number): Weather => weatherOn(day + 1, clearDays, seed);

/** Rain and storms water outdoor fields overnight; nothing else does (not even snow). */
export const watersFields = (weather: Weather): boolean => weather === 'rain' || weather === 'storm';

/** Is it raining or snowing right now (anything that falls)? */
export const isFalling = (weather: Weather): boolean => weather === 'rain' || weather === 'storm' || weather === 'snow';

/** How the weather darkens the world: a multiplier on brightness, 1 for sun, lower for rain and storms, a little lower for cloud and snow. */
export const dimming = (weather: Weather): number => BRIGHTNESS[weather];
