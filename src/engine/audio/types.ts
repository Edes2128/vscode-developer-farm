import type { Season } from '../time/calendar';
import type { Weather } from '../weather/types';

/**
 * Sound for Developer Farm (Phase 8). Every sound is **made in the webview with the Web Audio API from the recipes below**: nothing is
 * a file, so there is nothing to ship or license. This module is the pure part (what to play when, how loud, what the notes are); the
 * webview's `AudioEngine` (src/webview/audio) interprets the recipes. Recipes are data in `src/data/sounds.ts`.
 *
 * Rules that must hold everywhere: nothing plays until the player has pressed a key or clicked (browsers refuse earlier), nothing
 * plays while the game is paused, the master volume and mute are always honoured, and nothing here may throw if audio is unavailable.
 */

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

/** A value that moves from one number to another over a layer's life (frequencies move exponentially, others linearly). */
export interface Sweep {
  readonly from: number;
  readonly to: number;
}

export interface FilterSpec {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  readonly freq: Sweep;
  readonly q?: number;
}

/** One voice of a sound: a tone or a burst of noise with an envelope, optionally filtered. */
export interface SoundLayer {
  readonly wave: Wave;
  /** Hz, swept over the layer's life. Ignored for noise. */
  readonly freq?: Sweep;
  readonly filter?: FilterSpec;
  /** Peak level, 0 to 1 (before the sound's own volume and the player's settings). */
  readonly gain: number;
  /** Seconds to rise to the peak. */
  readonly attack: number;
  /** Seconds to fall from the peak to silence after the attack: the layer lasts `delay + attack + decay`. */
  readonly decay: number;
  /** Seconds to wait before this layer starts (to build a little arpeggio or a two-part click). */
  readonly delay?: number;
}

/** A short sound for something that happened. */
export interface SoundDef {
  readonly id: SoundId;
  readonly layers: readonly SoundLayer[];
  /** A random shift of pitch, in cents, so a repeated sound is not mechanical. Decided by the engine, never saved. */
  readonly detune?: number;
  /** Overall level, 0 to 1. */
  readonly volume: number;
  /** At most this many copies at once; a new one beyond that is dropped (footsteps, rain on a roof). */
  readonly voices: number;
}

export type SoundId =
  | 'till' | 'water' | 'plant' | 'harvest' | 'refill' | 'ship' | 'pet' | 'mine' | 'break' | 'splash' | 'dig' | 'place'
  | 'coin' | 'step_grass' | 'step_dirt' | 'step_wood' | 'step_stone' | 'door'
  | 'ui_move' | 'ui_choose' | 'ui_open' | 'ui_close'
  | 'bite' | 'catch' | 'reel' | 'discover' | 'prize' | 'thunder' | 'sleep';

export const SOUND_IDS: readonly SoundId[] = [
  'till', 'water', 'plant', 'harvest', 'refill', 'ship', 'pet', 'mine', 'break', 'splash', 'dig', 'place',
  'coin', 'step_grass', 'step_dirt', 'step_wood', 'step_stone', 'door',
  'ui_move', 'ui_choose', 'ui_open', 'ui_close',
  'bite', 'catch', 'reel', 'discover', 'prize', 'thunder', 'sleep',
];

/** One layer of a continuous background (wind, rain, water, crickets): filtered noise whose level slowly wobbles. */
export interface BedLayer {
  readonly noise: 'white' | 'pink' | 'brown';
  readonly filter: { readonly type: 'lowpass' | 'highpass' | 'bandpass'; readonly freq: number; readonly q?: number };
  /** Level, 0 to 1. */
  readonly gain: number;
  /** A slow rise and fall of the level (gusts, waves). */
  readonly wobble?: { readonly rate: number; readonly depth: number };
}

export interface BedDef {
  readonly id: BedId;
  readonly layers: readonly BedLayer[];
}

export type BedId = 'wind' | 'breeze' | 'rain' | 'storm' | 'snow_hush' | 'crickets' | 'water' | 'indoor_hum' | 'cave_drone';

export const BED_IDS: readonly BedId[] = ['wind', 'breeze', 'rain', 'storm', 'snow_hush', 'crickets', 'water', 'indoor_hum', 'cave_drone'];

/** What the player's surroundings are, for choosing the background and the tune. */
export interface Surroundings {
  readonly ambient: 'outdoor' | 'indoor' | 'cave';
  readonly weather: Weather;
  readonly season: Season;
  /** Minutes since midnight. */
  readonly minutes: number;
  /** Open water within a few cells of the player. */
  readonly nearWater: boolean;
}

/** The player's volume choices, saved with their preferences. Every number is 0 to 1. */
export interface AudioSettings {
  readonly master: number;
  readonly sfx: number;
  readonly ambient: number;
  readonly music: number;
  readonly muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: 0.6, sfx: 0.8, ambient: 0.7, music: 0.5, muted: false };

export type Channel = 'sfx' | 'ambient' | 'music';

/** One note of the tune: a MIDI pitch, when it starts and how long it lasts, in beats from the start of the bar. */
export interface Note {
  readonly midi: number;
  readonly start: number;
  readonly beats: number;
  /** 0 to 1. */
  readonly velocity: number;
}
