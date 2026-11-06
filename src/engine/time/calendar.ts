/**
 * The game's own calendar. Days are counted from 1 and everything else is worked out from the count:
 * 28 days to a season, 4 seasons to a year. It never looks at the real date.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const isSeason = (value: unknown): value is Season => typeof value === 'string' && (SEASONS as readonly string[]).includes(value);

export const seasonOf = (day: number): Season => SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length] as Season;

/** 1 to 28. */
export const dayOfSeason = (day: number): number => ((day - 1) % DAYS_PER_SEASON) + 1;

export const yearOf = (day: number): number => Math.floor((day - 1) / DAYS_PER_YEAR) + 1;

export const weekdayOf = (day: number): (typeof WEEKDAYS)[number] => WEEKDAYS[(day - 1) % WEEKDAYS.length] as (typeof WEEKDAYS)[number];

export const seasonName = (season: Season): string => season.charAt(0).toUpperCase() + season.slice(1);

/** "Spring 3, Year 1". */
export const dateLabel = (day: number): string => `${seasonName(seasonOf(day))} ${dayOfSeason(day)}`;
