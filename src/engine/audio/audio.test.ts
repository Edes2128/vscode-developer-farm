import { describe, expect, it } from 'vitest';
import { BEDS, SOUNDS } from '../../data/sounds';
import { SEASONS, type Season } from '../time/calendar';
import { WEATHERS, type Weather } from '../weather/types';
import {
  BEATS_PER_BAR,
  PHRASE_BARS,
  bedsFor,
  channelGain,
  isNight,
  midiToHz,
  musicAllowed,
  noiseMakeup,
  restBarsAfter,
  sanitizeAudioSettings,
  soundForEffect,
  stepSoundFor,
  tempo,
  tuneFor,
} from './audio';
import {
  BED_IDS,
  DEFAULT_AUDIO_SETTINGS,
  SOUND_IDS,
  type AudioSettings,
  type BedId,
  type Channel,
  type Note,
  type SoundId,
  type Surroundings,
} from './types';

const LONG_SOUNDS: readonly SoundId[] = ['discover', 'prize', 'sleep', 'thunder'];
const layerLength = (layer: { delay?: number; attack: number; decay: number }): number => (layer.delay ?? 0) + layer.attack + layer.decay;

describe('sound recipes', () => {
  it('has exactly one recipe for every sound id', () => {
    expect(SOUNDS.map((s) => s.id).sort()).toEqual([...SOUND_IDS].sort());
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
  });

  it('has exactly one bed for every bed id', () => {
    expect(BEDS.map((b) => b.id).sort()).toEqual([...BED_IDS].sort());
    expect(new Set(BEDS.map((b) => b.id)).size).toBe(BEDS.length);
  });

  for (const def of SOUNDS) {
    describe(def.id, () => {
      it('is soft and short', () => {
        expect(def.volume).toBeGreaterThan(0);
        expect(def.volume).toBeLessThanOrEqual(1);
        expect(Number.isInteger(def.voices)).toBe(true);
        expect(def.voices).toBeGreaterThanOrEqual(1);
        expect(def.voices).toBeLessThanOrEqual(6);
        expect(def.detune ?? 0).toBeGreaterThanOrEqual(0);
        expect(def.detune ?? 0).toBeLessThanOrEqual(200);
        expect(def.layers.length).toBeGreaterThanOrEqual(1);
        expect(def.layers.length).toBeLessThanOrEqual(8);
        const length = Math.max(...def.layers.map(layerLength));
        expect(length).toBeLessThanOrEqual(LONG_SOUNDS.includes(def.id) ? 3 : 1.5);
        if (!LONG_SOUNDS.includes(def.id)) expect(length).toBeLessThanOrEqual(1);
      });

      it('has layers with modest gains and a real envelope', () => {
        for (const layer of def.layers) {
          expect(layer.gain).toBeGreaterThan(0);
          expect(layer.gain).toBeLessThanOrEqual(0.35);
          expect(layer.attack).toBeGreaterThanOrEqual(0.001);
          expect(layer.attack).toBeLessThanOrEqual(0.6);
          expect(layer.decay).toBeGreaterThan(0);
          expect(layer.delay ?? 0).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(layerLength(layer))).toBe(true);
        }
      });

      it('gives every tone a frequency and no noise one', () => {
        for (const layer of def.layers) {
          if (layer.wave === 'noise') {
            expect(layer.freq).toBeUndefined();
          } else {
            expect(layer.freq).toBeDefined();
            expect(layer.freq?.from).toBeGreaterThanOrEqual(20);
            expect(layer.freq?.to).toBeGreaterThanOrEqual(20);
            expect(layer.freq?.from).toBeLessThanOrEqual(4000);
            expect(layer.freq?.to).toBeLessThanOrEqual(4000);
          }
        }
      });

      it('has sensible filters', () => {
        for (const layer of def.layers) {
          if (layer.filter === undefined) continue;
          for (const f of [layer.filter.freq.from, layer.filter.freq.to]) {
            expect(f).toBeGreaterThanOrEqual(20);
            expect(f).toBeLessThanOrEqual(8000);
          }
          if (layer.filter.q !== undefined) {
            expect(layer.filter.q).toBeGreaterThanOrEqual(0);
            expect(layer.filter.q).toBeLessThanOrEqual(20);
          }
        }
      });
    });
  }

  it('filters its noise: nothing is raw white noise', () => {
    for (const def of SOUNDS) {
      for (const layer of def.layers) if (layer.wave === 'noise') expect(layer.filter).toBeDefined();
    }
  });

  it('keeps footsteps and menu ticks tiny', () => {
    for (const id of ['step_grass', 'step_dirt', 'step_wood', 'step_stone', 'ui_move', 'ui_choose', 'ui_open', 'ui_close'] as const) {
      const def = SOUNDS.find((s) => s.id === id);
      expect(Math.max(...(def?.layers ?? []).map(layerLength))).toBeLessThanOrEqual(0.3);
      expect(def?.voices).toBeLessThanOrEqual(2);
    }
  });

  it('makes the coin two notes a fifth apart and the catch a rising arpeggio', () => {
    const coin = SOUNDS.find((s) => s.id === 'coin');
    const tones = (coin?.layers ?? []).filter((l) => l.wave === 'sine' && (l.freq?.from ?? 0) < 1500);
    expect(tones).toHaveLength(2);
    expect((tones[1]?.freq?.from ?? 0) / (tones[0]?.freq?.from ?? 1)).toBeCloseTo(1.5, 2);
    const catchSound = SOUNDS.find((s) => s.id === 'catch');
    const notes = (catchSound?.layers ?? []).filter((l) => l.wave === 'triangle').map((l) => l.freq?.from ?? 0);
    expect(notes).toHaveLength(3);
    expect(notes[0]).toBeLessThan(notes[1] ?? 0);
    expect(notes[1]).toBeLessThan(notes[2] ?? 0);
  });

  it('makes the lullaby descend', () => {
    const sleep = SOUNDS.find((s) => s.id === 'sleep');
    const notes = (sleep?.layers ?? []).filter((l) => l.wave === 'triangle').map((l) => l.freq?.from ?? 0);
    expect(notes).toHaveLength(3);
    expect(notes[0]).toBeGreaterThan(notes[1] ?? 0);
    expect(notes[1]).toBeGreaterThan(notes[2] ?? 0);
  });

  for (const def of BEDS) {
    it(`bed ${def.id} is a filtered noise with a gentle level`, () => {
      expect(def.layers.length).toBeGreaterThanOrEqual(1);
      expect(def.layers.length).toBeLessThanOrEqual(4);
      for (const layer of def.layers) {
        expect(['white', 'pink', 'brown']).toContain(layer.noise);
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(0.4);
        expect(layer.filter.freq).toBeGreaterThanOrEqual(20);
        expect(layer.filter.freq).toBeLessThanOrEqual(12000);
        expect(layer.filter.q ?? 1).toBeLessThanOrEqual(20);
        if (layer.wobble !== undefined) {
          expect(layer.wobble.rate).toBeGreaterThan(0);
          expect(layer.wobble.rate).toBeLessThanOrEqual(10);
          expect(layer.wobble.depth).toBeGreaterThanOrEqual(0);
          expect(layer.wobble.depth).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it('shapes the beds as described', () => {
    const bed = (id: BedId) => BEDS.find((b) => b.id === id);
    const total = (id: BedId): number => (bed(id)?.layers ?? []).reduce((sum, l) => sum + l.gain, 0);
    // Crickets: narrow high bands with a quick wobble of 4 to 7 Hz.
    for (const layer of bed('crickets')?.layers ?? []) {
      expect(layer.filter.type).toBe('bandpass');
      expect(layer.filter.freq).toBeGreaterThanOrEqual(3000);
      expect(layer.filter.q ?? 0).toBeGreaterThanOrEqual(8);
      expect(layer.wobble?.rate ?? 0).toBeGreaterThanOrEqual(4);
      expect(layer.wobble?.rate ?? 0).toBeLessThanOrEqual(7);
    }
    // Rain is high-ish noise, the storm is louder and has a low rumble, the snow and the room are the quietest.
    expect(bed('rain')?.layers[0]?.noise).toBe('white');
    expect(total('storm')).toBeGreaterThan(total('rain'));
    expect((bed('storm')?.layers ?? []).some((l) => l.noise === 'brown' && l.filter.freq <= 250)).toBe(true);
    expect(total('snow_hush')).toBeLessThan(total('rain'));
    expect(total('indoor_hum')).toBeLessThan(total('wind'));
    expect(total('breeze')).toBeLessThan(total('wind'));
    expect((bed('indoor_hum')?.layers ?? []).every((l) => l.noise === 'brown' && l.filter.type === 'lowpass')).toBe(true);
    expect((bed('cave_drone')?.layers ?? []).every((l) => l.noise === 'brown' && l.filter.freq <= 300 && l.wobble !== undefined)).toBe(true);
    expect((bed('wind')?.layers ?? []).every((l) => l.noise === 'pink' && l.wobble !== undefined)).toBe(true);
    expect((bed('water')?.layers ?? []).every((l) => l.filter.type === 'bandpass' && l.wobble !== undefined)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------ bedsFor

const surroundings = (over: Partial<Surroundings> = {}): Surroundings => ({
  ambient: 'outdoor',
  weather: 'sun',
  season: 'spring',
  minutes: 12 * 60,
  nearWater: false,
  ...over,
});
const ids = (s: Surroundings): BedId[] => bedsFor(s).map((b) => b.bed);
const gainOf = (s: Surroundings, bed: BedId): number => bedsFor(s).find((b) => b.bed === bed)?.gain ?? 0;

describe('isNight', () => {
  it('is night from 20:00 (1200) through the small hours until 6:00 (360)', () => {
    expect(isNight(1199)).toBe(false);
    expect(isNight(1200)).toBe(true);
    expect(isNight(1560)).toBe(true);
    expect(isNight(0)).toBe(true);
    expect(isNight(359)).toBe(true);
    expect(isNight(360)).toBe(false);
    expect(isNight(720)).toBe(false);
  });
});

describe('bedsFor', () => {
  it('has a breeze outdoors by day in fine weather', () => {
    expect(ids(surroundings())).toEqual(['breeze']);
  });

  it('has wind outdoors by day when cloudy', () => {
    expect(ids(surroundings({ weather: 'cloud' }))).toEqual(['wind']);
  });

  it('has rain, and no breeze or wind, when raining', () => {
    expect(ids(surroundings({ weather: 'rain' }))).toEqual(['rain']);
    expect(ids(surroundings({ weather: 'rain', minutes: 22 * 60 }))).toEqual(['rain']);
  });

  it('has the storm, with wind by day but never a breeze, in a storm', () => {
    const day = ids(surroundings({ weather: 'storm' }));
    expect(day).toContain('storm');
    expect(day).toContain('wind');
    expect(day).not.toContain('breeze');
    expect(day).not.toContain('rain');
    const night = ids(surroundings({ weather: 'storm', minutes: 23 * 60 }));
    expect(night).toContain('storm');
    expect(night).not.toContain('breeze');
    expect(night).not.toContain('crickets');
  });

  it('has the hush of snow instead of the wind when snowing', () => {
    for (const minutes of [720, 1300, 100]) {
      const found = ids(surroundings({ weather: 'snow', season: 'winter', minutes }));
      expect(found).toEqual(['snow_hush']);
    }
  });

  it('has crickets outdoors at night in fine or cloudy weather, loudest in summer, none in winter', () => {
    const at = (season: Season, weather: Weather = 'sun'): number => gainOf(surroundings({ season, weather, minutes: 22 * 60 }), 'crickets');
    expect(at('summer')).toBeGreaterThan(at('spring'));
    expect(at('summer')).toBeGreaterThan(at('autumn'));
    expect(at('spring')).toBeGreaterThan(0);
    expect(at('autumn')).toBeGreaterThan(0);
    expect(at('winter')).toBe(0);
    expect(at('summer', 'cloud')).toBeGreaterThan(0);
    expect(ids(surroundings({ season: 'summer', minutes: 22 * 60 }))).toEqual(['crickets']);
    for (const weather of ['rain', 'storm', 'snow'] as const) expect(at('summer', weather)).toBe(0);
  });

  it('switches between day and night exactly at 6:00 and 20:00', () => {
    const summer = (minutes: number): BedId[] => ids(surroundings({ season: 'summer', minutes }));
    expect(summer(359)).toEqual(['crickets']);
    expect(summer(360)).toEqual(['breeze']);
    expect(summer(1199)).toEqual(['breeze']);
    expect(summer(1200)).toEqual(['crickets']);
    expect(summer(0)).toEqual(['crickets']);
    expect(summer(1500)).toEqual(['crickets']);
    expect(ids(surroundings({ season: 'summer', weather: 'cloud', minutes: 359 }))).toEqual(['crickets']);
    expect(ids(surroundings({ season: 'summer', weather: 'cloud', minutes: 360 }))).toEqual(['wind']);
    expect(ids(surroundings({ season: 'winter', minutes: 1300 }))).toEqual([]);
  });

  it('adds water near water, a little louder outdoors than indoors', () => {
    const outdoors = surroundings({ nearWater: true });
    expect(ids(outdoors)).toEqual(['breeze', 'water']);
    const indoors = surroundings({ ambient: 'indoor', nearWater: true });
    expect(ids(indoors)).toContain('water');
    expect(gainOf(outdoors, 'water')).toBeGreaterThan(gainOf(indoors, 'water'));
    expect(ids(surroundings({ nearWater: false }))).not.toContain('water');
  });

  it('has a quiet hum indoors, with muffled rain when it rains', () => {
    expect(ids(surroundings({ ambient: 'indoor' }))).toEqual(['indoor_hum']);
    for (const minutes of [720, 1300, 10]) expect(ids(surroundings({ ambient: 'indoor', season: 'summer', minutes }))).toEqual(['indoor_hum']);
    for (const weather of ['rain', 'storm'] as const) {
      const room = surroundings({ ambient: 'indoor', weather });
      expect(ids(room)).toEqual(['indoor_hum', 'rain']);
      expect(gainOf(room, 'rain')).toBeLessThan(gainOf(surroundings({ weather: 'rain' }), 'rain'));
      expect(gainOf(room, 'rain')).toBeLessThanOrEqual(0.35);
    }
    expect(ids(surroundings({ ambient: 'indoor', weather: 'snow' }))).toEqual(['indoor_hum']);
    expect(ids(surroundings({ ambient: 'indoor', weather: 'cloud' }))).not.toContain('wind');
  });

  it('has only the drone in a cave, whatever the weather, hour or season', () => {
    for (const weather of WEATHERS) {
      for (const minutes of [0, 360, 720, 1200]) {
        for (const nearWater of [false, true]) {
          expect(ids(surroundings({ ambient: 'cave', weather, minutes, nearWater }))).toEqual(['cave_drone']);
        }
      }
    }
  });

  it('is deterministic, duplicate-free and keeps every gain in (0, 1] for every situation', () => {
    for (const ambient of ['outdoor', 'indoor', 'cave'] as const) {
      for (const weather of WEATHERS) {
        for (const season of SEASONS) {
          for (const minutes of [0, 359, 360, 600, 1199, 1200, 1500, 1559]) {
            for (const nearWater of [false, true]) {
              const s = surroundings({ ambient, weather, season, minutes, nearWater });
              const plan = bedsFor(s);
              expect(bedsFor(s)).toEqual(plan);
              expect(new Set(plan.map((p) => p.bed)).size).toBe(plan.length);
              for (const p of plan) {
                expect(BED_IDS).toContain(p.bed);
                expect(p.gain).toBeGreaterThan(0);
                expect(p.gain).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      }
    }
  });
});

describe('musicAllowed', () => {
  it('is silent underground only', () => {
    expect(musicAllowed(surroundings())).toBe(true);
    expect(musicAllowed(surroundings({ ambient: 'indoor' }))).toBe(true);
    expect(musicAllowed(surroundings({ ambient: 'cave' }))).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------ mappings

describe('soundForEffect', () => {
  it('maps each effect kind to the sound of the same name', () => {
    for (const kind of ['till', 'water', 'plant', 'harvest', 'refill', 'ship', 'pet', 'mine', 'break', 'splash', 'dig', 'place']) {
      expect(soundForEffect(kind)).toBe(kind);
      expect(SOUND_IDS).toContain(soundForEffect(kind));
    }
  });

  it('returns undefined for anything else', () => {
    for (const kind of ['', 'swing', 'TILL', ' till', 'coin', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(soundForEffect(kind)).toBeUndefined();
    }
  });
});

describe('stepSoundFor', () => {
  it('is a wooden step on wood (boards over water, say), whatever the ground below says', () => {
    expect(stepSoundFor(undefined, true)).toBe('step_wood');
    expect(stepSoundFor('step_dirt', true)).toBe('step_wood');
    expect(stepSoundFor('step_stone', true)).toBe('step_wood');
  });

  it('is what the terrain says it sounds like, and grass when it says nothing', () => {
    expect(stepSoundFor('step_dirt', false)).toBe('step_dirt');
    expect(stepSoundFor('step_wood', false)).toBe('step_wood');
    expect(stepSoundFor('step_stone', false)).toBe('step_stone');
    expect(stepSoundFor(undefined, false)).toBe('step_grass');
  });
});

// ------------------------------------------------------------------------------------------ volume

describe('channelGain', () => {
  const settings = (over: Partial<AudioSettings> = {}): AudioSettings => ({ master: 0.5, sfx: 0.8, ambient: 0.6, music: 0.4, muted: false, ...over });

  it('is the master volume times the channel volume', () => {
    expect(channelGain(settings(), 'sfx')).toBeCloseTo(0.4, 10);
    expect(channelGain(settings(), 'ambient')).toBeCloseTo(0.3, 10);
    expect(channelGain(settings(), 'music')).toBeCloseTo(0.2, 10);
  });

  it('is nothing when muted', () => {
    for (const channel of ['sfx', 'ambient', 'music'] as const) expect(channelGain(settings({ muted: true }), channel)).toBe(0);
  });

  it('holds both factors to 0..1', () => {
    expect(channelGain(settings({ master: 3, sfx: 5 }), 'sfx')).toBe(1);
    expect(channelGain(settings({ master: -1 }), 'sfx')).toBe(0);
    expect(channelGain(settings({ sfx: -2 }), 'sfx')).toBe(0);
    expect(channelGain(settings({ master: 2, music: 0.25 }), 'music')).toBe(0.25);
    expect(channelGain(settings({ master: Number.POSITIVE_INFINITY, sfx: 0.5 }), 'sfx')).toBe(0.5);
  });

  it('treats NaN as silence and an unknown channel as silence', () => {
    expect(channelGain(settings({ master: Number.NaN }), 'sfx')).toBe(0);
    expect(channelGain(settings({ sfx: Number.NaN }), 'sfx')).toBe(0);
    expect(channelGain(settings(), 'nonsense' as Channel)).toBe(0);
  });
});

describe('sanitizeAudioSettings', () => {
  it('keeps good settings', () => {
    const good: AudioSettings = { master: 0.1, sfx: 0.2, ambient: 0.3, music: 0.4, muted: true };
    expect(sanitizeAudioSettings(good)).toEqual(good);
    expect(sanitizeAudioSettings(DEFAULT_AUDIO_SETTINGS)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('falls back to the defaults for anything that is not an object', () => {
    for (const junk of [undefined, null, 7, 'loud', true, [], () => 1, Symbol('x')]) {
      expect(sanitizeAudioSettings(junk)).toEqual(DEFAULT_AUDIO_SETTINGS);
    }
  });

  it('returns a fresh object, not the default itself', () => {
    expect(sanitizeAudioSettings(undefined)).not.toBe(DEFAULT_AUDIO_SETTINGS);
  });

  it('clamps numbers to 0..1', () => {
    expect(sanitizeAudioSettings({ master: 4, sfx: -1, ambient: 1.5, music: 0 })).toMatchObject({ master: 1, sfx: 0, ambient: 1, music: 0 });
    expect(sanitizeAudioSettings({ master: Number.POSITIVE_INFINITY, sfx: Number.NEGATIVE_INFINITY })).toMatchObject({ master: 1, sfx: 0 });
  });

  it('ignores non-numbers and NaN, field by field', () => {
    const result = sanitizeAudioSettings({ master: '0.2', sfx: Number.NaN, ambient: null, music: 0.9, muted: 'yes' });
    expect(result).toEqual({
      master: DEFAULT_AUDIO_SETTINGS.master,
      sfx: DEFAULT_AUDIO_SETTINGS.sfx,
      ambient: DEFAULT_AUDIO_SETTINGS.ambient,
      music: 0.9,
      muted: false,
    });
  });

  it('treats a non-boolean muted as false', () => {
    for (const muted of [1, 'true', 'false', null, undefined, {}, []]) expect(sanitizeAudioSettings({ muted }).muted).toBe(false);
    expect(sanitizeAudioSettings({ muted: true }).muted).toBe(true);
  });

  it('never throws, even for hostile objects', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('boom'); } });
    expect(() => sanitizeAudioSettings(hostile)).not.toThrow();
    expect(sanitizeAudioSettings(hostile)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(sanitizeAudioSettings({ master: 0.3, extra: 'ignored' })).toMatchObject({ master: 0.3 });
  });
});

// ------------------------------------------------------------------------------------------ pitch and noise

describe('midiToHz', () => {
  it('puts A4 at 440 and doubles every octave', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880, 8);
    expect(midiToHz(57)).toBeCloseTo(220, 8);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
    expect(midiToHz(72)).toBeCloseTo(523.2511, 3);
    expect(midiToHz(70)).toBeGreaterThan(midiToHz(69));
  });
});

describe('noiseMakeup', () => {
  it('needs nothing for an unfiltered noise and always stays between 1 and 12', () => {
    expect(noiseMakeup('white', undefined)).toBe(1);
    for (const color of ['white', 'pink', 'brown'] as const) {
      for (const type of ['lowpass', 'highpass', 'bandpass'] as const) {
        for (const freq of [20, 100, 1000, 8000, 30000]) {
          for (const q of [undefined, 0.1, 1, 14, 100]) {
            const m = noiseMakeup(color, { type, freq, ...(q === undefined ? {} : { q }) });
            expect(Number.isFinite(m)).toBe(true);
            expect(m).toBeGreaterThanOrEqual(1);
            expect(m).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });

  it('makes up more for a narrower filter', () => {
    expect(noiseMakeup('white', { type: 'bandpass', freq: 4000, q: 12 })).toBeGreaterThan(noiseMakeup('white', { type: 'bandpass', freq: 4000, q: 1 }));
    expect(noiseMakeup('white', { type: 'lowpass', freq: 300 })).toBeGreaterThan(noiseMakeup('white', { type: 'lowpass', freq: 3000 }));
    expect(noiseMakeup('white', { type: 'highpass', freq: 12000 })).toBeGreaterThan(noiseMakeup('white', { type: 'highpass', freq: 500 }));
  });

  it('knows that brown noise lives low: a low low-pass keeps almost all of it', () => {
    expect(noiseMakeup('brown', { type: 'lowpass', freq: 180 })).toBeLessThan(1.3);
    expect(noiseMakeup('white', { type: 'lowpass', freq: 180 })).toBeGreaterThan(noiseMakeup('brown', { type: 'lowpass', freq: 180 }));
  });
});

// ------------------------------------------------------------------------------------------ the tune

const MAX_BARS = 400;
const bars = (season: Season, count = MAX_BARS): Note[][] => Array.from({ length: count }, (_, bar) => tuneFor(season, bar));
const key = (notes: readonly Note[]): string => JSON.stringify(notes);

describe('tuneFor', () => {
  it('is the same every time, from the season and bar alone', () => {
    for (const season of SEASONS) {
      for (const bar of [0, 1, 2, 3, 4, 17, 250, 4000]) expect(tuneFor(season, bar)).toEqual(tuneFor(season, bar));
    }
    expect(key(tuneFor('spring', 5))).not.toBe(key(tuneFor('spring', 6)));
  });

  it('returns fresh notes, so a caller cannot change the tune', () => {
    const first = tuneFor('summer', 9);
    first.pop();
    first[0] = { midi: 1, start: 0, beats: 1, velocity: 1 };
    expect(tuneFor('summer', 9)).not.toEqual(first);
    expect(tuneFor('summer', 9).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every bar inside the limits', () => {
    for (const season of SEASONS) {
      for (const notes of bars(season)) {
        expect(notes.length).toBeGreaterThanOrEqual(2);
        expect(notes.length).toBeLessThanOrEqual(5);
        let previousEnd = 0;
        for (const note of notes) {
          expect(Number.isInteger(note.midi)).toBe(true);
          expect(note.midi).toBeGreaterThanOrEqual(55);
          expect(note.midi).toBeLessThanOrEqual(84);
          expect(note.velocity).toBeGreaterThanOrEqual(0.3);
          expect(note.velocity).toBeLessThanOrEqual(0.7);
          expect(note.start).toBeGreaterThanOrEqual(0);
          expect(note.start).toBeLessThan(BEATS_PER_BAR);
          expect(note.beats).toBeGreaterThan(0);
          // Never rings more than one beat past the end of the bar.
          expect(note.start + note.beats).toBeLessThanOrEqual(BEATS_PER_BAR + 1);
          // A melody of single notes: each begins after the last one ended.
          expect(note.start).toBeGreaterThanOrEqual(previousEnd);
          previousEnd = note.start + note.beats;
        }
      }
    }
  });

  it('rests: some bars have only two notes and some start late', () => {
    for (const season of SEASONS) {
      const all = bars(season);
      expect(all.some((notes) => notes.length === 2)).toBe(true);
      expect(all.some((notes) => (notes[0]?.start ?? 0) > 0)).toBe(true);
      expect(all.some((notes) => notes.length >= 4) || season === 'winter').toBe(true);
    }
  });

  it('keeps each season to its own scale', () => {
    const pitchClasses = (season: Season, tonic: number): Set<number> =>
      new Set(bars(season).flatMap((notes) => notes.map((n) => (((n.midi - tonic) % 12) + 12) % 12)));
    expect([...pitchClasses('spring', 60)].every((pc) => [0, 2, 4, 7, 9].includes(pc))).toBe(true);
    expect([...pitchClasses('summer', 55)].every((pc) => [0, 2, 4, 6, 7, 9, 11].includes(pc))).toBe(true);
    expect([...pitchClasses('autumn', 57)].every((pc) => [0, 3, 5, 7, 10].includes(pc))).toBe(true);
    expect([...pitchClasses('winter', 62)].every((pc) => [0, 2, 3, 5, 7, 9, 10].includes(pc))).toBe(true);
    // Summer reaches the raised fourth that makes it Lydian, which the spring tune never has.
    expect(pitchClasses('summer', 55).has(6)).toBe(true);
    // Every scale is really used.
    expect(pitchClasses('spring', 60).size).toBe(5);
    expect(pitchClasses('autumn', 57).size).toBe(5);
  });

  it('sounds different in every season', () => {
    const summaries = SEASONS.map((season) => {
      const all = bars(season).flat();
      const meanPitch = all.reduce((sum, n) => sum + n.midi, 0) / all.length;
      const meanVelocity = all.reduce((sum, n) => sum + n.velocity, 0) / all.length;
      return { season, meanPitch, meanVelocity, perBar: all.length / MAX_BARS };
    });
    const [spring, summer, autumn, winter] = summaries;
    expect(winter?.meanPitch ?? 0).toBeGreaterThan(Math.max(spring?.meanPitch ?? 0, summer?.meanPitch ?? 0, autumn?.meanPitch ?? 0));
    expect(summer?.meanPitch ?? 99).toBeLessThan(spring?.meanPitch ?? 0);
    // Winter is the sparsest and quietest.
    expect(winter?.perBar ?? 99).toBeLessThan(Math.min(spring?.perBar ?? 0, summer?.perBar ?? 0, autumn?.perBar ?? 0));
    expect(winter?.meanVelocity ?? 99).toBeLessThan(Math.min(spring?.meanVelocity ?? 0, summer?.meanVelocity ?? 0, autumn?.meanVelocity ?? 0));
    for (let a = 0; a < SEASONS.length; a += 1) {
      for (let b = a + 1; b < SEASONS.length; b += 1) {
        expect(bars(SEASONS[a] as Season, 40).map(key)).not.toEqual(bars(SEASONS[b] as Season, 40).map(key));
      }
    }
  });

  it('never repeats the exact same bar for eight bars running, and a phrase always ends differently from how it began', () => {
    for (const season of SEASONS) {
      const all = bars(season, 3000).map(key);
      let run = 1;
      let longest = 1;
      for (let i = 1; i < all.length; i += 1) {
        run = all[i] === all[i - 1] ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
      expect(longest).toBeLessThan(8);
      expect(longest).toBeLessThan(4);
      // The closing bar of a phrase never equals the bar before it or the bar after it.
      for (let phrase = 0; phrase < 300; phrase += 1) {
        const closing = phrase * PHRASE_BARS + (PHRASE_BARS - 1);
        expect(all[closing]).not.toBe(all[closing - 1]);
        expect(all[closing]).not.toBe(all[closing + 1]);
      }
    }
  });

  it('ends each phrase at rest on a long note', () => {
    for (const season of SEASONS) {
      const home = { spring: [60, 67, 64], summer: [55, 62, 59], autumn: [57, 64, 60], winter: [62, 69, 65] }[season];
      const tonicClass = (midi: number): number => midi % 12;
      for (let phrase = 0; phrase < 100; phrase += 1) {
        const closing = tuneFor(season, phrase * PHRASE_BARS + PHRASE_BARS - 1);
        const last = closing[closing.length - 1];
        expect(last).toBeDefined();
        expect(last?.beats ?? 0).toBeGreaterThanOrEqual(2);
        expect(home.map(tonicClass)).toContain(tonicClass(last?.midi ?? -1));
      }
    }
  });

  it('writes a different phrase each time', () => {
    for (const season of SEASONS) {
      const phrases = new Set(Array.from({ length: 60 }, (_, p) => key(Array.from({ length: PHRASE_BARS }, (_, k) => tuneFor(season, p * PHRASE_BARS + k)).flat())));
      expect(phrases.size).toBeGreaterThanOrEqual(55);
    }
  });

  it('copes with bad bar numbers and unknown seasons', () => {
    expect(tuneFor('spring', -5)).toEqual(tuneFor('spring', 0));
    expect(tuneFor('spring', Number.NaN)).toEqual(tuneFor('spring', 0));
    expect(tuneFor('spring', 3.9)).toEqual(tuneFor('spring', 3));
    expect(tuneFor('spring', Number.POSITIVE_INFINITY)).toEqual(tuneFor('spring', 0));
    expect(tuneFor('monsoon' as Season, 2)).toEqual(tuneFor('spring', 2));
    expect(tuneFor('constructor' as Season, 2)).toEqual(tuneFor('spring', 2));
  });
});

describe('tempo', () => {
  it('is slow, 60 to 90 beats a minute, and differs by season', () => {
    const tempos = SEASONS.map(tempo);
    for (const t of tempos) {
      expect(t).toBeGreaterThanOrEqual(60);
      expect(t).toBeLessThanOrEqual(90);
    }
    expect(new Set(tempos).size).toBeGreaterThanOrEqual(3);
    expect(tempo('winter')).toBe(Math.min(...tempos));
    expect(tempo('monsoon' as Season)).toBe(tempo('spring'));
  });
});

describe('restBarsAfter', () => {
  it('is 6 to 10 bars, the same every time, so the tune plays about a third of the time', () => {
    let total = 0;
    const seen = new Set<number>();
    for (let phrase = 0; phrase < 1000; phrase += 1) {
      const rest = restBarsAfter(phrase);
      expect(rest).toBe(restBarsAfter(phrase));
      expect(Number.isInteger(rest)).toBe(true);
      expect(rest).toBeGreaterThanOrEqual(6);
      expect(rest).toBeLessThanOrEqual(10);
      seen.add(rest);
      total += rest;
    }
    expect(seen.size).toBe(5);
    expect(total / 1000).toBeGreaterThan(7.5);
    expect(total / 1000).toBeLessThan(8.5);
    const share = PHRASE_BARS / (PHRASE_BARS + total / 1000);
    expect(share).toBeGreaterThan(0.28);
    expect(share).toBeLessThan(0.38);
  });

  it('copes with bad phrase numbers', () => {
    for (const bad of [Number.NaN, -3, Number.POSITIVE_INFINITY, 2.5]) {
      const rest = restBarsAfter(bad);
      expect(rest).toBeGreaterThanOrEqual(6);
      expect(rest).toBeLessThanOrEqual(10);
    }
  });
});
