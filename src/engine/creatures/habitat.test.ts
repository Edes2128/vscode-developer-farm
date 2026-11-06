import { describe, expect, it } from 'vitest';
import { habitatLine, clockWords, seasonWords, weatherWords } from './habitat';
import type { CreatureDef } from './types';

const def = (patch: Partial<CreatureDef>): CreatureDef => ({
  id: 'x', name: 'X', description: 'x', sprite: 'x', maps: ['m'], seasons: ['spring'], weather: ['sun'], from: 360, to: 660, chance: 0.5, likes: ['egg'], keepsake: { item: 'egg', count: 1 }, ...patch,
});

describe('creature habitat words', () => {
  it('says the time of day the way the clock panel does, past midnight too', () => {
    expect(clockWords(360)).toBe('6:00 am');
    expect(clockWords(12 * 60)).toBe('12:00 pm');
    expect(clockWords(20 * 60 + 5)).toBe('8:05 pm');
    expect(clockWords(26 * 60)).toBe('2:00 am');
    expect(clockWords(24 * 60)).toBe('12:00 am');
  });

  it('names seasons: one, two, a run of three, or all', () => {
    expect(seasonWords(['summer'])).toBe('summer');
    expect(seasonWords(['autumn', 'winter'])).toBe('autumn and winter');
    expect(seasonWords(['spring', 'summer', 'autumn'])).toBe('spring to autumn');
    expect(seasonWords(['winter', 'spring'])).toBe('spring and winter');
    expect(seasonWords(['spring', 'summer', 'autumn', 'winter'])).toBe('every season');
    expect(seasonWords([])).toBe('');
  });

  it('names weather in a fixed order', () => {
    expect(weatherWords(['sun'])).toBe('fine weather');
    expect(weatherWords(['rain', 'cloud'])).toBe('grey or rainy weather');
    expect(weatherWords(['sun', 'cloud', 'rain', 'storm', 'snow'])).toBe('any weather');
    expect(weatherWords(['storm'])).toBe('stormy weather');
  });

  it('puts it all on one line, with map names where it can', () => {
    const line = habitatLine(def({ maps: ['a', 'b'], seasons: ['spring', 'summer', 'autumn'], weather: ['cloud', 'rain'] }), (id) => (id === 'a' ? 'Marlow fen' : undefined));
    expect(line).toBe('Marlow fen or b · spring to autumn · 6:00 am to 11:00 am · grey or rainy weather');
  });
});
