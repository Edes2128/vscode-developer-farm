import { describe, expect, it } from 'vitest';
import { ambientColor } from './ambient';
import { dateLabel, dayOfSeason, seasonOf, weekdayOf, yearOf } from './calendar';
import { BEDTIME_MINUTE, formatClock, SECONDS_PER_GAME_MINUTE, WAKE_MINUTE, WorldClock } from './clock';

describe('calendar', () => {
  it('counts 28 days to a season and four seasons to a year', () => {
    expect([seasonOf(1), seasonOf(28), seasonOf(29), seasonOf(56), seasonOf(57), seasonOf(84), seasonOf(85), seasonOf(112)]).toEqual([
      'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter', 'winter',
    ]);
    expect(seasonOf(113)).toBe('spring');
    expect(yearOf(112)).toBe(1);
    expect(yearOf(113)).toBe(2);
  });

  it('numbers the days of a season from 1 to 28', () => {
    expect([dayOfSeason(1), dayOfSeason(28), dayOfSeason(29), dayOfSeason(112), dayOfSeason(113)]).toEqual([1, 28, 1, 28, 1]);
    expect(dateLabel(30)).toBe('Summer 2');
  });

  it('keeps a seven-day week', () => {
    expect(weekdayOf(1)).toBe('Mon');
    expect(weekdayOf(8)).toBe('Mon');
    expect(weekdayOf(7)).toBe('Sun');
  });
});

describe('WorldClock', () => {
  it('starts at 6:00 am on day 1', () => {
    const clock = new WorldClock();
    expect(clock.day).toBe(1);
    expect(clock.minutes).toBe(WAKE_MINUTE);
  });

  it('advances one game minute per fixed number of real seconds', () => {
    const clock = new WorldClock();
    clock.advance(SECONDS_PER_GAME_MINUTE * 60);
    expect(clock.minutes).toBeCloseTo(WAKE_MINUTE + 60);
  });

  it('reaches bedtime exactly once and then stops', () => {
    const clock = new WorldClock({ day: 4, minutes: BEDTIME_MINUTE - 1 });
    expect(clock.advance(SECONDS_PER_GAME_MINUTE * 5)).toBe(true);
    expect(clock.minutes).toBe(BEDTIME_MINUTE);
    expect(clock.advance(10)).toBe(false);
    expect(clock.minutes).toBe(BEDTIME_MINUTE);
  });

  it('starts the next morning at 6:00 on the following day', () => {
    const clock = new WorldClock({ day: 4, minutes: BEDTIME_MINUTE });
    clock.startNextDay();
    expect(clock.toState()).toEqual({ day: 5, minutes: WAKE_MINUTE });
  });

  it('takes about fourteen real minutes from waking to bedtime', () => {
    const seconds = (BEDTIME_MINUTE - WAKE_MINUTE) * SECONDS_PER_GAME_MINUTE;
    expect(seconds / 60).toBeCloseTo(14, 0);
  });

  it('formats the time in ten-minute steps', () => {
    expect(formatClock(360)).toBe('6:00 am');
    expect(formatClock(369.9)).toBe('6:00 am');
    expect(formatClock(370)).toBe('6:10 am');
    expect(formatClock(12 * 60)).toBe('12:00 pm');
    expect(formatClock(13 * 60 + 30)).toBe('1:30 pm');
    expect(formatClock(24 * 60)).toBe('12:00 am');
    expect(formatClock(25 * 60 + 10)).toBe('1:10 am');
  });
});

describe('ambient light', () => {
  it('leaves the world untinted through the day', () => {
    expect(ambientColor(12 * 60)).toEqual([255, 255, 255]);
    expect(ambientColor(9 * 60)).toEqual([255, 255, 255]);
  });

  it('warms at dawn and dusk and darkens at night', () => {
    const dawn = ambientColor(WAKE_MINUTE);
    const dusk = ambientColor(19 * 60);
    const night = ambientColor(BEDTIME_MINUTE);
    expect(dawn[2]).toBeLessThan(dawn[0]);
    expect(dusk[2]).toBeLessThan(dusk[0]);
    expect(night[0]).toBeLessThan(100);
    expect(night[2]).toBeGreaterThan(night[0]);
  });

  it('changes smoothly and stays in range at every minute of the day', () => {
    let previous = ambientColor(WAKE_MINUTE);
    for (let m = WAKE_MINUTE; m <= BEDTIME_MINUTE; m += 1) {
      const c = ambientColor(m);
      for (let i = 0; i < 3; i += 1) {
        expect(c[i]).toBeGreaterThanOrEqual(0);
        expect(c[i]).toBeLessThanOrEqual(255);
        expect(Math.abs((c[i] as number) - (previous[i] as number))).toBeLessThanOrEqual(8);
      }
      previous = c;
    }
  });

  it('clamps outside the day', () => {
    expect(ambientColor(0)).toEqual(ambientColor(WAKE_MINUTE));
    expect(ambientColor(99999)).toEqual(ambientColor(BEDTIME_MINUTE));
  });
});
