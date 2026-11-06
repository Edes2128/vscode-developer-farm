import { SEASONS, seasonName, type Season } from '../time/calendar';
import type { Weather } from '../weather/types';
import type { CreatureDef } from './types';

/**
 * Where and when a creature is about, in words, for the journal's bestiary page. The journal only shows this for creatures the
 * player has already seen: before that, finding them is the game.
 */

const WEATHER_WORDS: Readonly<Record<Weather, string>> = { sun: 'fine', cloud: 'grey', rain: 'rainy', storm: 'stormy', snow: 'snowy' };

/** "6:00 am" from minutes since midnight (hours past midnight wrap: 26:00 is 2:00 am). */
export function clockWords(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${hour24 % 12 === 0 ? 12 : hour24 % 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'pm' : 'am'}`;
}

/** "spring", "summer and autumn", "spring to autumn", "every season". */
export function seasonWords(seasons: readonly Season[]): string {
  const have = SEASONS.filter((s) => seasons.includes(s));
  if (have.length === SEASONS.length) return 'every season';
  const first = have[0];
  const last = have[have.length - 1];
  if (first === undefined || last === undefined) return '';
  const consecutive = have.length >= 3 && SEASONS.indexOf(last) - SEASONS.indexOf(first) === have.length - 1;
  if (consecutive) return `${seasonName(first).toLowerCase()} to ${seasonName(last).toLowerCase()}`;
  return have.map((s) => seasonName(s).toLowerCase()).join(' and ');
}

/** "fine weather", "grey or rainy weather", "any weather". */
export function weatherWords(weather: readonly Weather[]): string {
  const order: readonly Weather[] = ['sun', 'cloud', 'rain', 'storm', 'snow'];
  const have = order.filter((w) => weather.includes(w));
  if (have.length === order.length) return 'any weather';
  return `${have.map((w) => WEATHER_WORDS[w]).join(' or ')} weather`;
}

/** The whole line: "Marlow fen · spring to autumn · 6:00 am to 11:00 am · grey or rainy weather". `mapName` turns a map id into its name. */
export function habitatLine(def: CreatureDef, mapName: (id: string) => string | undefined): string {
  const places = def.maps.map((id) => mapName(id) ?? id).join(' or ');
  return [places, seasonWords(def.seasons), `${clockWords(def.from)} to ${clockWords(def.to)}`, weatherWords(def.weather)].filter((part) => part !== '').join(' · ');
}
