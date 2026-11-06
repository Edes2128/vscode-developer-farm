import { createRng, hash2 } from '../core/random';
import { SEASONS, type Season } from '../time/calendar';
import {
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
  type BedId,
  type Channel,
  type Note,
  type SoundId,
  type Surroundings,
} from './types';

/**
 * The pure half of the sound system: what is heard where, how loud, and what the tune is. No DOM, no Web Audio, no clock and no
 * `Math.random`: the same input always gives the same answer, so all of it is tested in plain Node. The webview's `AudioEngine`
 * (src/webview/audio/engine.ts) turns these answers into sound.
 */

// ------------------------------------------------------------------------------------------ backgrounds

/** The game clock runs 6:00 to 26:00. Night, for sound, is 20:00 to 6:00 (minutes >= 1200 or < 360). */
export const NIGHT_STARTS = 1200;
export const DAY_STARTS = 360;

export const isNight = (minutes: number): boolean => minutes >= NIGHT_STARTS || minutes < DAY_STARTS;

/** How loud the crickets are in each season (relative, 0 to 1). Winter has none. */
const CRICKET_LEVEL: Readonly<Record<Season, number>> = { spring: 0.45, summer: 0.8, autumn: 0.4, winter: 0 };

export interface BedPlan {
  readonly bed: BedId;
  /** 0 to 1, before the player's settings. */
  readonly gain: number;
}

/**
 * Which backgrounds are heard and how loudly. Outdoors it follows the weather and the hour; indoors a hush with the rain muffled;
 * in a cave only the drone. Open water near the player adds the sound of water, a little louder outdoors than in. Never has a
 * duplicate and every gain is in (0, 1].
 */
export function bedsFor(s: Surroundings): BedPlan[] {
  const plan: BedPlan[] = [];
  const add = (bed: BedId, gain: number): void => {
    if (gain > 0) plan.push({ bed, gain: Math.min(1, gain) });
  };
  const wet = s.weather === 'rain' || s.weather === 'storm';

  if (s.ambient === 'cave') {
    add('cave_drone', 0.7);
    return plan;
  }

  if (s.ambient === 'indoor') {
    add('indoor_hum', 0.5);
    if (wet) add('rain', s.weather === 'storm' ? 0.3 : 0.22);
    if (s.nearWater) add('water', 0.25);
    return plan;
  }

  const night = isNight(s.minutes);
  switch (s.weather) {
    case 'rain':
      add('rain', 0.8);
      break;
    case 'storm':
      add('storm', 0.9);
      if (!night) add('wind', 0.4);
      break;
    case 'snow':
      add('snow_hush', 0.7);
      break;
    case 'cloud':
      if (!night) add('wind', 0.6);
      break;
    case 'sun':
      if (!night) add('breeze', 0.55);
      break;
  }
  if (night && (s.weather === 'sun' || s.weather === 'cloud')) add('crickets', CRICKET_LEVEL[s.season]);
  if (s.nearWater) add('water', 0.6);
  return plan;
}

// ------------------------------------------------------------------------------------------ what plays for what

const EFFECT_SOUNDS: ReadonlyMap<string, SoundId> = new Map<string, SoundId>([
  ['till', 'till'],
  ['water', 'water'],
  ['plant', 'plant'],
  ['harvest', 'harvest'],
  ['refill', 'refill'],
  ['ship', 'ship'],
  ['pet', 'pet'],
  ['mine', 'mine'],
  ['break', 'break'],
  ['splash', 'splash'],
  ['dig', 'dig'],
  ['place', 'place'],
]);

/** The sound for one of the game's effect kinds (the `kind` of a swing's effect), or `undefined` for anything else. */
export const soundForEffect = (kind: string): SoundId | undefined => EFFECT_SOUNDS.get(kind);

/** Which footstep to play: a wooden step on boards, otherwise by what the player stands on (the terrain's own `footstep`, data). Ground that names none sounds like grass. */
export function stepSoundFor(footstep: 'step_dirt' | 'step_wood' | 'step_stone' | undefined, onWood: boolean): SoundId {
  if (onWood) return 'step_wood';
  return footstep ?? 'step_grass';
}

// ------------------------------------------------------------------------------------------ volume

const clamp01 = (n: number): number => (typeof n !== 'number' || Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)));

/** The loudness of one channel: nothing when muted, else the master volume times the channel's, each held to 0..1. */
export function channelGain(settings: AudioSettings, channel: Channel): number {
  if (settings.muted) return 0;
  return clamp01(settings.master) * clamp01(settings[channel]);
}

/** Reads settings from anything (a saved preferences file, a message from the page). Never throws; bad fields fall back to the default. */
export function sanitizeAudioSettings(raw: unknown): AudioSettings {
  const level = (record: Record<string, unknown>, key: 'master' | 'sfx' | 'ambient' | 'music'): number => {
    const value = record[key];
    return typeof value === 'number' && !Number.isNaN(value) ? clamp01(value) : DEFAULT_AUDIO_SETTINGS[key];
  };
  try {
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_AUDIO_SETTINGS };
    const record = raw as Record<string, unknown>;
    return {
      master: level(record, 'master'),
      sfx: level(record, 'sfx'),
      ambient: level(record, 'ambient'),
      music: level(record, 'music'),
      muted: record.muted === true,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

// ------------------------------------------------------------------------------------------ pitch and noise

/** Equal temperament: MIDI 69 is A4 = 440 Hz. */
export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export type NoiseColor = 'white' | 'pink' | 'brown';

export interface NoiseFilter {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  /** The (centre or corner) frequency, Hz. */
  readonly freq: number;
  /** For a band-pass, its Q. */
  readonly q?: number;
}

const SPECTRUM_BOTTOM = 20;
const SPECTRUM_TOP = 20000;

/** Energy of a noise colour between two frequencies: flat for white, 1/f for pink, 1/f^2 for brown. */
function bandEnergy(color: NoiseColor, from: number, to: number): number {
  if (color === 'white') return to - from;
  if (color === 'pink') return Math.log(to / from);
  return 1 / from - 1 / to;
}

/**
 * A filter throws most of a noise away (a narrow band-pass keeps a few percent of it), so the noise would be nearly silent next to a
 * tone of the same `gain`. This is the factor that brings a filtered noise back to the loudness its `gain` promises: one over the
 * square root of the share of the noise's energy the filter lets through, between 1 and 12. An unfiltered noise needs none.
 */
export function noiseMakeup(color: NoiseColor, filter: NoiseFilter | undefined, sampleRate = 44100): number {
  if (filter === undefined || !(filter.freq > 0)) return 1;
  const top = Math.min(SPECTRUM_TOP, sampleRate / 2);
  let low = SPECTRUM_BOTTOM;
  let high = top;
  if (filter.type === 'lowpass') {
    high = filter.freq;
  } else if (filter.type === 'highpass') {
    low = filter.freq;
  } else {
    const half = 1 / (2 * Math.max(0.1, filter.q ?? 0.7071));
    const root = Math.sqrt(1 + half * half);
    low = filter.freq * (root - half);
    high = filter.freq * (root + half);
  }
  low = Math.min(top * 0.99, Math.max(SPECTRUM_BOTTOM, low));
  high = Math.min(top, Math.max(low * 1.01, high));
  const share = bandEnergy(color, low, high) / bandEnergy(color, SPECTRUM_BOTTOM, top);
  return Math.min(12, Math.max(1, 1 / Math.sqrt(Math.min(1, Math.max(0.0025, share)))));
}

// ------------------------------------------------------------------------------------------ the tune

export const BEATS_PER_BAR = 4;
/** The tune is phrases of this many bars; the engine plays one phrase, then rests. */
export const PHRASE_BARS = 4;

/** A bar's rhythm: [start, beats] for each note, in beats from the start of the bar. */
type Rhythm = readonly (readonly [start: number, beats: number])[];

interface Mode {
  /** MIDI pitch of the tonic (the home note). */
  readonly tonic: number;
  /** Semitones above the tonic that belong to the scale. */
  readonly steps: readonly number[];
  /** Semitones above the tonic of the notes a phrase may rest on (tonic, fifth, third). */
  readonly home: readonly number[];
  /** The lowest and highest pitch used. */
  readonly low: number;
  readonly high: number;
  /** How loud a typical note is, 0 to 1. */
  readonly velocity: number;
  readonly bpm: number;
  /** Rhythms for the first three bars of a phrase. */
  readonly patterns: readonly Rhythm[];
  /** Rhythms for the last bar of a phrase: always end on a long note, and never equal to a pattern, so a phrase never ends like it began. */
  readonly cadences: readonly Rhythm[];
}

const MODES: Readonly<Record<Season, Mode>> = {
  // Bright: C major pentatonic, a little lilt.
  spring: {
    tonic: 60,
    steps: [0, 2, 4, 7, 9],
    home: [0, 7, 4],
    low: 60,
    high: 81,
    velocity: 0.5,
    bpm: 78,
    patterns: [
      [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]],
      [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1], [3, 1]],
      [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1.5]],
      [[0.5, 1], [1.5, 0.5], [2, 2]],
      [[0, 2], [2, 1], [3, 1]],
      [[0, 1], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [3, 1.5]],
    ],
    cadences: [
      [[0, 1], [1, 1], [2, 2.5]],
      [[0, 0.5], [0.5, 0.5], [1, 1], [2, 2.5]],
      [[0.5, 1], [1.5, 1], [3, 2]],
    ],
  },
  // Warm: G Lydian (the raised fourth, C sharp, gives it its glow), a little lower.
  summer: {
    tonic: 55,
    steps: [0, 2, 4, 6, 7, 9, 11],
    home: [0, 7, 4],
    low: 55,
    high: 79,
    velocity: 0.5,
    bpm: 84,
    patterns: [
      [[0, 1.5], [1.5, 1], [2.5, 1.5]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 1.5], [3.5, 1]],
      [[1, 1], [2, 1], [3, 1.5]],
      [[0, 3], [3, 1.5]],
      [[0, 1], [1, 1.5], [2.5, 1.5]],
    ],
    cadences: [
      [[0, 1], [1, 1], [2, 2.5]],
      [[0, 1.5], [1.5, 0.5], [2, 3]],
      [[0.5, 1.5], [2, 1], [3, 2]],
    ],
  },
  // Slow and a little wistful: A minor pentatonic.
  autumn: {
    tonic: 57,
    steps: [0, 3, 5, 7, 10],
    home: [0, 7, 3],
    low: 57,
    high: 81,
    velocity: 0.46,
    bpm: 68,
    patterns: [
      [[0, 2], [2, 1], [3, 1]],
      [[0, 1.5], [1.5, 1.5], [3, 1.5]],
      [[0, 1], [1, 1], [2, 2]],
      [[0.5, 1.5], [2, 1], [3, 1]],
      [[0, 1], [1.5, 0.5], [2, 1], [3, 1.5]],
      [[0, 2.5], [2.5, 0.5], [3, 1.5]],
    ],
    cadences: [
      [[0, 1.5], [1.5, 1], [2.5, 2.5]],
      [[0, 1], [1, 1], [2, 3]],
      [[0.5, 1], [2, 3]],
    ],
  },
  // Quiet and sparse: high notes in D Dorian, a few to a bar, with room around them.
  winter: {
    tonic: 62,
    steps: [0, 2, 3, 5, 7, 9, 10],
    home: [0, 7, 3],
    low: 69,
    high: 84,
    velocity: 0.38,
    bpm: 60,
    patterns: [
      [[0, 2], [2, 2]],
      [[0, 3], [3, 1.5]],
      [[1, 2], [3, 1.5]],
      [[0, 1.5], [2, 1.5]],
      [[0, 2], [2.5, 2]],
      [[0, 1], [2, 1], [3, 2]],
      [[0.5, 1.5], [3, 1.5]],
    ],
    cadences: [
      [[0, 1.5], [2, 3]],
      [[1, 1.5], [2.5, 2.5]],
      [[0, 1], [1, 1], [2, 3]],
    ],
  },
};

/** The notes each season may use, low to high. */
function pitchPool(mode: Mode): number[] {
  const pool: number[] = [];
  for (let octave = -4; octave <= 8; octave += 1) {
    for (const step of mode.steps) {
      const pitch = mode.tonic + octave * 12 + step;
      if (pitch >= mode.low && pitch <= mode.high) pool.push(pitch);
    }
  }
  return pool.sort((a, b) => a - b);
}

const POOLS: Readonly<Record<Season, readonly number[]>> = {
  spring: pitchPool(MODES.spring),
  summer: pitchPool(MODES.summer),
  autumn: pitchPool(MODES.autumn),
  winter: pitchPool(MODES.winter),
};

/** An unknown season (it cannot happen in the game, but a message from the page is not trusted) sounds like spring. */
const knownSeason = (season: Season): Season => (Object.hasOwn(MODES, season) ? season : 'spring');

const TUNE_SEED = 7919;
const WALK_STEPS = [-2, -1, 0, 1, 2] as const;
const WALK_WEIGHTS = [1, 3, 1, 3, 1] as const;

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;

/** Four bars: a gentle random walk over the season's notes, rhythms from a short list, ending on a home note. */
function phraseNotes(season: Season, phrase: number): Note[][] {
  const mode = MODES[season];
  const pool = POOLS[season];
  const rng = createRng(Math.floor(hash2(phrase, SEASONS.indexOf(season), TUNE_SEED) * 4294967296));
  const isHome = (pitch: number): boolean => mode.home.includes((((pitch - mode.tonic) % 12) + 12) % 12);
  const homeIndexes = pool.flatMap((pitch, index) => (isHome(pitch) ? [index] : []));
  const middle = homeIndexes.filter((index) => index >= pool.length * 0.25 && index <= pool.length * 0.75);

  const opening = pick(rng, mode.patterns);
  const answer = pick(rng, mode.patterns);
  const closing = pick(rng, mode.cadences);
  const rhythms: readonly Rhythm[] = [opening, answer, opening, closing];

  let index = pick(rng, middle.length > 0 ? middle : homeIndexes);
  const lowLimit = Math.floor(pool.length * 0.2);
  const highLimit = Math.floor(pool.length * 0.8);

  return rhythms.map((rhythm, bar) =>
    rhythm.map(([start, beats], n) => {
      const last = bar === rhythms.length - 1 && n === rhythm.length - 1;
      if (bar !== 0 || n !== 0) {
        // Prefer small steps, and lean back towards the middle when the walk strays to either end.
        const weights = WALK_WEIGHTS.map((weight, k) => {
          const step = WALK_STEPS[k] as number;
          return (index > highLimit && step > 0) || (index < lowLimit && step < 0) ? weight * 0.15 : weight;
        });
        let roll = rng() * weights.reduce((a, b) => a + b, 0);
        let step = 0;
        for (let k = 0; k < weights.length; k += 1) {
          roll -= weights[k] as number;
          if (roll <= 0) {
            step = WALK_STEPS[k] as number;
            break;
          }
        }
        index = Math.min(pool.length - 1, Math.max(0, index + step));
      }
      if (last) {
        // Come to rest on the nearest home note, so a phrase ends like a phrase.
        index = homeIndexes.reduce((best, candidate) => (Math.abs(candidate - index) < Math.abs(best - index) ? candidate : best), homeIndexes[0] as number);
      }
      const accent = start === 0 ? 0.08 : 0;
      const velocity = Math.min(0.7, Math.max(0.3, mode.velocity + accent + (rng() - 0.5) * 0.1));
      return { midi: pool[index] as number, start, beats, velocity };
    }),
  );
}

/**
 * The notes of one bar of the season's tune: a slow generative melody that is the same every time it is asked for. A phrase is four
 * bars (`PHRASE_BARS`), so bars 0 to 3 are the first phrase, 4 to 7 the next, and so on. Each season has its own scale and mood.
 * Every bar has two to five notes, with rests between them; a note may ring into the next bar, but by at most one beat.
 */
export function tuneFor(season: Season, bar: number): Note[] {
  const safeSeason = knownSeason(season);
  const whole = Number.isFinite(bar) ? Math.max(0, Math.floor(bar)) : 0;
  const phrase = Math.floor(whole / PHRASE_BARS);
  return (phraseNotes(safeSeason, phrase)[whole % PHRASE_BARS] ?? []).map((note) => ({ ...note }));
}

/** Beats per minute: slow and unhurried (60 to 90). */
export function tempo(season: Season): number {
  return MODES[knownSeason(season)].bpm;
}

/**
 * How many silent bars follow phrase number `phrase`: 6 to 10 (eight on average), so the tune plays about a third of the time and
 * never settles into a pattern. Decided by the phrase counter alone.
 */
export function restBarsAfter(phrase: number): number {
  const whole = Number.isFinite(phrase) ? Math.max(0, Math.floor(phrase)) : 0;
  return 6 + Math.min(4, Math.floor(hash2(whole, 11, TUNE_SEED) * 5));
}

/** Whether the tune may play here: not underground. (Indoors it plays, as it does in the rest of the village.) */
export const musicAllowed = (s: Surroundings): boolean => s.ambient !== 'cave';
