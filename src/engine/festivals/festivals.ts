import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, dayOfSeason, seasonOf } from '../time/calendar';
import type { FestivalDef } from './types';

/** The festival held on a day (counted from 1), if any. */
export function festivalOn(festivals: readonly FestivalDef[], day: number): FestivalDef | undefined {
  const season = seasonOf(day);
  const inSeason = dayOfSeason(day);
  return festivals.find((f) => f.season === season && f.day === inSeason);
}

/** Is it open at this time of day (minutes on the game clock)? */
export const isOpen = (festival: FestivalDef, minutes: number): boolean => minutes >= festival.from && minutes < festival.to;

/** The absolute days festivals fall on over the first `years` years: the sky is always clear on these. */
export function festivalDays(festivals: readonly FestivalDef[], years = 1000): Set<number> {
  const days = new Set<number>();
  for (let year = 0; year < years; year += 1) {
    for (const f of festivals) days.add(year * DAYS_PER_YEAR + SEASONS.indexOf(f.season) * DAYS_PER_SEASON + f.day);
  }
  return days;
}
