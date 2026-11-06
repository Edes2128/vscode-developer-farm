/**
 * The world clock. A day runs from 6:00 am until 2:00 am the next morning; when the clock reaches 2:00 the day
 * ends by itself. The clock only moves while the game is running, so a paused or closed game loses no time.
 */

/** A new day starts at 6:00 am. */
export const WAKE_MINUTE = 6 * 60;
/** 2:00 am: the day ends by itself. Minutes past midnight count on from 24:00. */
export const BEDTIME_MINUTE = 26 * 60;
/** Real seconds that pass for one minute of game time: a full day lasts 14 real minutes. */
export const SECONDS_PER_GAME_MINUTE = 0.7;

export interface ClockState {
  readonly day: number;
  readonly minutes: number;
}

export class WorldClock {
  /** Total days since the start, from 1. */
  day: number;
  /** Minutes since midnight of the current day; runs past 1440 after midnight. */
  minutes: number;

  constructor(state: ClockState = { day: 1, minutes: WAKE_MINUTE }) {
    this.day = state.day;
    this.minutes = state.minutes;
  }

  /** Moves time on. Returns true when this call reached bedtime. */
  advance(seconds: number): boolean {
    if (this.minutes >= BEDTIME_MINUTE) return false;
    this.minutes = Math.min(BEDTIME_MINUTE, this.minutes + seconds / SECONDS_PER_GAME_MINUTE);
    return this.minutes >= BEDTIME_MINUTE;
  }

  /** Starts the next morning. */
  startNextDay(): void {
    this.day += 1;
    this.minutes = WAKE_MINUTE;
  }

  toState(): ClockState {
    return { day: this.day, minutes: Math.floor(this.minutes) };
  }
}

/** "6:00 am", "12:30 pm", "1:10 am". Shown in ten-minute steps. */
export function formatClock(minutes: number): string {
  const total = Math.floor(minutes / 10) * 10;
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const suffix = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}
