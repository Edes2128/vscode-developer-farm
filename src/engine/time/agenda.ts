/**
 * The village calendar: what is coming up, for the journal's calendar page. Pure functions of the content and the game's own
 * day count, so it never looks at a real clock. Festivals and birthdays are data (`src/data`); this only lays them out.
 */
import type { FestivalDef } from '../festivals/types';
import type { NpcDef } from '../social/types';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, seasonName, type Season } from './calendar';

export type AgendaKind = 'festival' | 'birthday';

export interface AgendaEntry {
  readonly season: Season;
  /** Day of the season, 1 to 28. */
  readonly day: number;
  readonly kind: AgendaKind;
  readonly label: string;
}

/** Every festival and birthday of the year, in calendar order. */
export function yearAgenda(festivals: readonly FestivalDef[], npcs: readonly NpcDef[]): AgendaEntry[] {
  const entries: AgendaEntry[] = [
    ...festivals.map((f) => ({ season: f.season, day: f.day, kind: 'festival' as const, label: f.name })),
    ...npcs.map((n) => ({ season: n.birthday.season, day: n.birthday.day, kind: 'birthday' as const, label: `${n.name.split(' ')[0] ?? n.name}'s birthday` })),
  ];
  return entries.sort((a, b) => SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season) || a.day - b.day || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}

/** What happens in one season, by day. */
export const seasonAgenda = (season: Season, festivals: readonly FestivalDef[], npcs: readonly NpcDef[]): AgendaEntry[] => yearAgenda(festivals, npcs).filter((e) => e.season === season);

/** The game day (1-based) on which an entry next falls on or after `from` (this year's, or next year's if it has passed). */
function nextDayOf(entry: AgendaEntry, from: number): number {
  const inYear = SEASONS.indexOf(entry.season) * DAYS_PER_SEASON + entry.day;
  const base = Math.floor((from - 1) / DAYS_PER_YEAR) * DAYS_PER_YEAR;
  return base + inYear >= from ? base + inYear : base + DAYS_PER_YEAR + inYear;
}

export interface Upcoming {
  readonly inDays: number;
  readonly when: string;
  readonly kind: AgendaKind;
  readonly label: string;
}

/** The next few things from tomorrow on ("in 3 days": Summer 11), soonest first. Today's own events are not repeated here. */
export function upcoming(today: number, festivals: readonly FestivalDef[], npcs: readonly NpcDef[], limit = 4): Upcoming[] {
  return yearAgenda(festivals, npcs)
    .map((entry) => ({ entry, at: nextDayOf(entry, today + 1) }))
    .sort((a, b) => a.at - b.at || a.entry.label.localeCompare(b.entry.label))
    .slice(0, Math.max(0, limit))
    .map(({ entry, at }) => ({ inDays: at - today, when: `${seasonName(entry.season)} ${entry.day}`, kind: entry.kind, label: entry.label }));
}
