import type { BedDef, FilterSpec, SoundDef, SoundLayer, Sweep, Wave } from '../engine/audio/types';

/**
 * Every sound in Developer Farm is a recipe here, made in the webview with the Web Audio API: there are no audio files.
 * The feel is cozy and soft (a Stardew-like farm): short, rounded, low-passed, never loud. Nothing here has been listened to by its
 * author: the mix is a first pass for a human ear to adjust, and every number below is meant to be turned.
 *
 * Reading a recipe:
 * - A layer's `gain` is how loud it is meant to *sound*. For noise the engine makes up what its filter throws away
 *   (`noiseMakeup`), so a noise layer and a tone with the same gain are about equally loud.
 * - A layer's `freq` sweeps exponentially from `from` to `to` over its life; so does a filter's. A sweep of one value is a held note.
 * - On a low-pass or high-pass filter, `q` is the resonance in dB (Web Audio's meaning: 0 is flat, a few dB make a soft bump); on a
 *   band-pass it is the usual Q (narrow when large).
 * - A layer lasts `delay + attack + decay`: no sound runs past about 1.5 s except `discover`, `prize`, `sleep` and `thunder` (under 3 s).
 */

const hz = (from: number, to: number = from): Sweep => ({ from, to });

const lowpass = (from: number, to: number = from, q?: number): FilterSpec => ({
  type: 'lowpass',
  freq: hz(from, to),
  ...(q === undefined ? {} : { q }),
});
const bandpass = (from: number, to: number, q: number): FilterSpec => ({ type: 'bandpass', freq: hz(from, to), q });

interface LayerOptions {
  readonly filter?: FilterSpec;
  readonly delay?: number;
}

/** A tone: a held or swept oscillator with a quick attack and a falling tail. */
const tone = (wave: Exclude<Wave, 'noise'>, freq: Sweep, gain: number, attack: number, decay: number, options: LayerOptions = {}): SoundLayer => ({
  wave,
  freq,
  gain,
  attack,
  decay,
  ...(options.filter === undefined ? {} : { filter: options.filter }),
  ...(options.delay === undefined ? {} : { delay: options.delay }),
});

/** A burst of white noise, shaped by its filter. */
const noise = (gain: number, attack: number, decay: number, options: LayerOptions = {}): SoundLayer => ({
  wave: 'noise',
  gain,
  attack,
  decay,
  ...(options.filter === undefined ? {} : { filter: options.filter }),
  ...(options.delay === undefined ? {} : { delay: options.delay }),
});

// Pitches, Hz.
const G4 = 392;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;

export const SOUNDS: readonly SoundDef[] = [
  // ---- work on the land
  {
    // A dull thud of the hoe and a soft scrape of soil.
    id: 'till',
    volume: 0.9,
    voices: 3,
    detune: 60,
    layers: [
      tone('sine', hz(125, 52), 0.32, 0.004, 0.15, { filter: lowpass(400) }),
      tone('triangle', hz(210, 100), 0.14, 0.004, 0.1, { filter: lowpass(900) }),
      noise(0.2, 0.01, 0.24, { delay: 0.02, filter: bandpass(1000, 450, 0.9) }),
    ],
  },
  {
    // A soft falling trickle with two small drops.
    id: 'water',
    volume: 0.85,
    voices: 2,
    detune: 80,
    layers: [
      noise(0.28, 0.08, 0.65, { filter: bandpass(2400, 900, 1.2) }),
      noise(0.17, 0.12, 0.5, { delay: 0.05, filter: lowpass(1400) }),
      tone('sine', hz(1500, 900), 0.05, 0.004, 0.1, { delay: 0.2, filter: lowpass(3000) }),
      tone('sine', hz(1300, 750), 0.04, 0.004, 0.1, { delay: 0.42, filter: lowpass(3000) }),
    ],
  },
  {
    // Two soft pops and a puff of soil.
    id: 'plant',
    volume: 0.9,
    voices: 2,
    detune: 90,
    layers: [
      tone('sine', hz(430, 190), 0.26, 0.004, 0.1, { filter: lowpass(1600) }),
      tone('sine', hz(540, 260), 0.22, 0.004, 0.1, { delay: 0.11, filter: lowpass(1600) }),
      noise(0.06, 0.003, 0.05, { filter: lowpass(1200) }),
    ],
  },
  {
    // A bright two-note pluck, E then A.
    id: 'harvest',
    volume: 0.9,
    voices: 3,
    detune: 15,
    layers: [
      tone('triangle', hz(E5), 0.26, 0.004, 0.24, { filter: lowpass(4200) }),
      tone('sine', hz(E5 * 2), 0.06, 0.004, 0.18),
      tone('triangle', hz(A5), 0.26, 0.004, 0.32, { delay: 0.09, filter: lowpass(4200) }),
      tone('sine', hz(A5 * 2), 0.05, 0.004, 0.22, { delay: 0.09 }),
    ],
  },
  {
    // The watering can filling: a rising gurgle.
    id: 'refill',
    volume: 0.85,
    voices: 1,
    detune: 60,
    layers: [
      noise(0.28, 0.12, 0.6, { filter: bandpass(500, 1500, 1.4) }),
      tone('sine', hz(380, 760), 0.08, 0.06, 0.5, { filter: lowpass(2000) }),
      noise(0.16, 0.05, 0.4, { delay: 0.25, filter: lowpass(900) }),
    ],
  },
  {
    // A wooden thunk into the shipping box, then two small bell notes.
    id: 'ship',
    volume: 0.9,
    voices: 2,
    detune: 40,
    layers: [
      tone('sine', hz(190, 85), 0.3, 0.004, 0.16, { filter: lowpass(500) }),
      noise(0.18, 0.003, 0.1, { filter: lowpass(1200) }),
      tone('sine', hz(C6), 0.12, 0.004, 0.3, { delay: 0.14, filter: lowpass(4000) }),
      tone('sine', hz(C6 * 1.5), 0.1, 0.004, 0.4, { delay: 0.21, filter: lowpass(4000) }),
    ],
  },
  {
    // Two happy little rising chirps.
    id: 'pet',
    volume: 0.8,
    voices: 2,
    detune: 150,
    layers: [
      tone('sine', hz(520, 700), 0.2, 0.02, 0.14, { filter: lowpass(2500) }),
      tone('sine', hz(620, 860), 0.2, 0.02, 0.2, { delay: 0.13, filter: lowpass(2500) }),
      tone('triangle', hz(260, 350), 0.08, 0.02, 0.14),
    ],
  },
  {
    // A pick on rock: a tick, a knock and a low thud.
    id: 'mine',
    volume: 0.9,
    voices: 3,
    detune: 80,
    layers: [
      noise(0.22, 0.002, 0.07, { filter: bandpass(1800, 1200, 2) }),
      tone('triangle', hz(340, 190), 0.24, 0.002, 0.13, { filter: lowpass(2200) }),
      tone('sine', hz(115, 65), 0.26, 0.002, 0.13),
    ],
  },
  {
    // A rock giving way: a crumble, a deep thud and three falling pebbles.
    id: 'break',
    volume: 0.9,
    voices: 2,
    detune: 60,
    layers: [
      noise(0.3, 0.005, 0.42, { filter: lowpass(1700, 500) }),
      tone('sine', hz(95, 42), 0.32, 0.005, 0.36),
      noise(0.12, 0.002, 0.06, { delay: 0.07, filter: bandpass(2200, 1800, 2) }),
      noise(0.1, 0.002, 0.06, { delay: 0.14, filter: bandpass(1900, 1500, 2) }),
      noise(0.08, 0.002, 0.06, { delay: 0.2, filter: bandpass(2400, 1600, 2) }),
    ],
  },
  {
    // A soft splash and a plop.
    id: 'splash',
    volume: 0.85,
    voices: 2,
    detune: 100,
    layers: [
      noise(0.3, 0.01, 0.55, { filter: bandpass(1500, 600, 0.8) }),
      tone('sine', hz(320, 120), 0.14, 0.004, 0.22, { filter: lowpass(900) }),
      noise(0.14, 0.1, 0.5, { delay: 0.08, filter: lowpass(2200, 1200) }),
    ],
  },
  {
    // A spade in soft earth.
    id: 'dig',
    volume: 0.9,
    voices: 3,
    detune: 80,
    layers: [
      noise(0.28, 0.01, 0.24, { filter: lowpass(1000, 400) }),
      tone('sine', hz(105, 58), 0.26, 0.004, 0.15),
      noise(0.1, 0.004, 0.1, { delay: 0.13, filter: bandpass(1200, 700, 0.8) }),
    ],
  },
  {
    // Setting something down: a soft wooden thunk.
    id: 'place',
    volume: 0.85,
    voices: 2,
    detune: 60,
    layers: [
      tone('sine', hz(230, 125), 0.28, 0.003, 0.13, { filter: lowpass(900) }),
      noise(0.14, 0.002, 0.06, { filter: lowpass(1200) }),
      tone('triangle', hz(440, 330), 0.08, 0.003, 0.1, { delay: 0.02, filter: lowpass(2000) }),
    ],
  },

  // ---- money
  {
    // Two quick bell notes a fifth apart, A and E.
    id: 'coin',
    volume: 0.8,
    voices: 3,
    detune: 20,
    layers: [
      tone('sine', hz(A5), 0.2, 0.003, 0.28, { filter: lowpass(5000) }),
      tone('sine', hz(A5 * 2), 0.04, 0.003, 0.16),
      tone('sine', hz(A5 * 1.5), 0.2, 0.003, 0.42, { delay: 0.07, filter: lowpass(5000) }),
      tone('sine', hz(A5 * 3), 0.035, 0.003, 0.22, { delay: 0.07 }),
    ],
  },

  // ---- footsteps: very quiet, a little different for every ground
  {
    // A faint puff of rustled grass.
    id: 'step_grass',
    volume: 0.6,
    voices: 2,
    detune: 120,
    layers: [
      noise(0.24, 0.012, 0.1, { filter: lowpass(850, 450) }),
      noise(0.06, 0.006, 0.05, { delay: 0.02, filter: bandpass(2000, 1500, 1) }),
    ],
  },
  {
    // Dry earth: a little crunch.
    id: 'step_dirt',
    volume: 0.7,
    voices: 2,
    detune: 120,
    layers: [
      noise(0.22, 0.004, 0.08, { filter: bandpass(1400, 800, 0.7) }),
      noise(0.16, 0.004, 0.07, { delay: 0.035, filter: lowpass(900) }),
      noise(0.1, 0.003, 0.05, { delay: 0.07, filter: bandpass(2200, 1600, 1) }),
    ],
  },
  {
    // Boards: a soft low tick and thud.
    id: 'step_wood',
    volume: 0.7,
    voices: 2,
    detune: 80,
    layers: [
      tone('sine', hz(190, 105), 0.17, 0.003, 0.08, { filter: lowpass(700) }),
      tone('triangle', hz(340, 260), 0.06, 0.002, 0.05, { filter: lowpass(1500) }),
      noise(0.08, 0.002, 0.04, { filter: lowpass(900) }),
    ],
  },
  {
    // Stone: a higher, drier tick.
    id: 'step_stone',
    volume: 0.6,
    voices: 2,
    detune: 100,
    layers: [
      tone('triangle', hz(560, 420), 0.1, 0.002, 0.05, { filter: lowpass(3000) }),
      noise(0.16, 0.002, 0.035, { filter: bandpass(2400, 1800, 1.5) }),
      tone('sine', hz(150, 100), 0.1, 0.002, 0.05),
    ],
  },
  {
    // A low wooden creak, then the door settling.
    id: 'door',
    volume: 0.85,
    voices: 1,
    detune: 30,
    layers: [
      tone('sawtooth', hz(88, 150), 0.16, 0.06, 0.42, { filter: lowpass(480, 700, 4) }),
      tone('triangle', hz(94, 158), 0.1, 0.06, 0.38, { delay: 0.03, filter: lowpass(600, 900, 3) }),
      tone('sine', hz(150, 90), 0.24, 0.004, 0.14, { delay: 0.42, filter: lowpass(500) }),
      noise(0.1, 0.002, 0.05, { delay: 0.44, filter: lowpass(1200) }),
    ],
  },

  // ---- menus: tiny sine ticks
  {
    id: 'ui_move',
    volume: 0.6,
    voices: 2,
    detune: 30,
    layers: [tone('sine', hz(660), 0.14, 0.002, 0.05, { filter: lowpass(3000) })],
  },
  {
    id: 'ui_choose',
    volume: 0.7,
    voices: 2,
    detune: 20,
    layers: [
      tone('sine', hz(660), 0.19, 0.002, 0.07, { filter: lowpass(3500) }),
      tone('sine', hz(990), 0.19, 0.002, 0.12, { delay: 0.05, filter: lowpass(3500) }),
    ],
  },
  {
    id: 'ui_open',
    volume: 0.7,
    voices: 2,
    detune: 20,
    layers: [
      tone('sine', hz(440, 560), 0.17, 0.005, 0.09, { filter: lowpass(3500) }),
      tone('sine', hz(587, 740), 0.17, 0.005, 0.12, { delay: 0.05, filter: lowpass(3500) }),
    ],
  },
  {
    id: 'ui_close',
    volume: 0.7,
    voices: 2,
    detune: 20,
    layers: [
      tone('sine', hz(587, 470), 0.17, 0.005, 0.09, { filter: lowpass(3500) }),
      tone('sine', hz(440, 350), 0.17, 0.005, 0.12, { delay: 0.05, filter: lowpass(3500) }),
    ],
  },

  // ---- fishing
  {
    // A bite: a plop and a smaller one after it.
    id: 'bite',
    volume: 0.85,
    voices: 2,
    detune: 120,
    layers: [
      tone('sine', hz(520, 170), 0.28, 0.003, 0.13, { filter: lowpass(1500) }),
      tone('sine', hz(740, 300), 0.15, 0.003, 0.11, { delay: 0.08, filter: lowpass(1500) }),
      noise(0.1, 0.003, 0.1, { filter: bandpass(900, 600, 1) }),
    ],
  },
  {
    // The reel: four soft clicks of a ratchet.
    id: 'reel',
    volume: 0.6,
    voices: 2,
    detune: 80,
    layers: [
      noise(0.26, 0.002, 0.028, { filter: bandpass(1800, 1500, 3) }),
      noise(0.26, 0.002, 0.028, { delay: 0.05, filter: bandpass(1800, 1500, 3) }),
      noise(0.26, 0.002, 0.028, { delay: 0.1, filter: bandpass(1800, 1500, 3) }),
      noise(0.26, 0.002, 0.028, { delay: 0.15, filter: bandpass(1800, 1500, 3) }),
      tone('sine', hz(260, 230), 0.06, 0.004, 0.2, { filter: lowpass(600) }),
    ],
  },
  {
    // A catch: a rising three-note arpeggio, C, E, G.
    id: 'catch',
    volume: 0.85,
    voices: 1,
    detune: 10,
    layers: [
      tone('triangle', hz(C5), 0.24, 0.004, 0.22, { filter: lowpass(4200) }),
      tone('triangle', hz(E5), 0.24, 0.004, 0.22, { delay: 0.1, filter: lowpass(4200) }),
      tone('triangle', hz(G5), 0.26, 0.004, 0.42, { delay: 0.2, filter: lowpass(4200) }),
      tone('sine', hz(G5 * 2), 0.05, 0.004, 0.3, { delay: 0.2 }),
    ],
  },

  // ---- moments
  {
    // Finding something for the first time: a gentle four-note chime, G, B, D, G.
    id: 'discover',
    volume: 0.85,
    voices: 1,
    layers: [
      tone('sine', hz(G4), 0.2, 0.004, 1.0, { filter: lowpass(4500) }),
      tone('sine', hz(G4 * 2), 0.04, 0.004, 0.6),
      tone('sine', hz(B4), 0.2, 0.004, 1.0, { delay: 0.2, filter: lowpass(4500) }),
      tone('sine', hz(B4 * 2), 0.04, 0.004, 0.6, { delay: 0.2 }),
      tone('sine', hz(D5), 0.2, 0.004, 1.1, { delay: 0.4, filter: lowpass(4500) }),
      tone('sine', hz(D5 * 2), 0.04, 0.004, 0.6, { delay: 0.4 }),
      tone('sine', hz(G5), 0.22, 0.004, 1.6, { delay: 0.62, filter: lowpass(4500) }),
      tone('sine', hz(G5 * 2), 0.045, 0.004, 0.9, { delay: 0.62 }),
    ],
  },
  {
    // A short cheerful fanfare: C, E, G run up and settle on a held C chord.
    id: 'prize',
    volume: 0.85,
    voices: 1,
    layers: [
      tone('triangle', hz(C5), 0.22, 0.004, 0.2, { filter: lowpass(4500) }),
      tone('triangle', hz(E5), 0.22, 0.004, 0.2, { delay: 0.12, filter: lowpass(4500) }),
      tone('triangle', hz(G5), 0.22, 0.004, 0.2, { delay: 0.24, filter: lowpass(4500) }),
      tone('triangle', hz(C6), 0.24, 0.004, 0.9, { delay: 0.4, filter: lowpass(4500) }),
      tone('sine', hz(C5), 0.12, 0.01, 1.1, { delay: 0.4 }),
      tone('sine', hz(E5), 0.1, 0.01, 1.1, { delay: 0.4 }),
      tone('sine', hz(G5), 0.1, 0.01, 1.1, { delay: 0.4 }),
    ],
  },
  {
    // A distant low rumble of thunder.
    id: 'thunder',
    volume: 0.8,
    voices: 1,
    layers: [
      noise(0.34, 0.3, 1.9, { filter: lowpass(380, 90, 1) }),
      noise(0.3, 0.5, 2.0, { delay: 0.4, filter: lowpass(150, 55) }),
      tone('sine', hz(58, 34), 0.18, 0.4, 2.0, { delay: 0.15 }),
    ],
  },
  {
    // Going to sleep: a slow descending lullaby of three soft notes, E, C, G.
    id: 'sleep',
    volume: 0.8,
    voices: 1,
    layers: [
      tone('triangle', hz(E5), 0.2, 0.03, 1.3, { filter: lowpass(2500) }),
      tone('sine', hz(E5 / 2), 0.08, 0.03, 1.3),
      tone('triangle', hz(C5), 0.2, 0.03, 1.3, { delay: 0.75, filter: lowpass(2500) }),
      tone('sine', hz(C5 / 2), 0.08, 0.03, 1.3, { delay: 0.75 }),
      tone('triangle', hz(G4), 0.2, 0.03, 1.3, { delay: 1.5, filter: lowpass(2500) }),
      tone('sine', hz(G4 / 2), 0.08, 0.03, 1.3, { delay: 1.5 }),
    ],
  },
];

/**
 * The backgrounds. Each layer is a noise (white, pink or brown) through a filter, with a level that slowly rises and falls.
 * `gain` is how loud the layer is meant to sound (the engine makes up what the filter removes), and `wobble.rate` is in Hz.
 */
export const BEDS: readonly BedDef[] = [
  {
    // Low, slow gusts.
    id: 'wind',
    layers: [
      { noise: 'pink', filter: { type: 'lowpass', freq: 420, q: 0.7 }, gain: 0.32, wobble: { rate: 0.12, depth: 0.55 } },
      { noise: 'pink', filter: { type: 'bandpass', freq: 700, q: 1.1 }, gain: 0.1, wobble: { rate: 0.07, depth: 0.7 } },
    ],
  },
  {
    // A gentler air with a faint rustle.
    id: 'breeze',
    layers: [
      { noise: 'pink', filter: { type: 'lowpass', freq: 600, q: 0.5 }, gain: 0.2, wobble: { rate: 0.1, depth: 0.45 } },
      { noise: 'white', filter: { type: 'bandpass', freq: 3000, q: 0.6 }, gain: 0.02, wobble: { rate: 0.2, depth: 0.6 } },
    ],
  },
  {
    // Steady rain on leaves and ground.
    id: 'rain',
    layers: [
      { noise: 'white', filter: { type: 'bandpass', freq: 2400, q: 0.45 }, gain: 0.2, wobble: { rate: 0.25, depth: 0.12 } },
      { noise: 'pink', filter: { type: 'lowpass', freq: 700 }, gain: 0.1 },
    ],
  },
  {
    // Heavier rain with a low rumble underneath.
    id: 'storm',
    layers: [
      { noise: 'white', filter: { type: 'bandpass', freq: 2200, q: 0.4 }, gain: 0.3, wobble: { rate: 0.2, depth: 0.2 } },
      { noise: 'brown', filter: { type: 'lowpass', freq: 160, q: 0.7 }, gain: 0.3, wobble: { rate: 0.08, depth: 0.5 } },
    ],
  },
  {
    // The muffled hush of falling snow: barely there.
    id: 'snow_hush',
    layers: [{ noise: 'pink', filter: { type: 'lowpass', freq: 300, q: 0.5 }, gain: 0.1, wobble: { rate: 0.06, depth: 0.3 } }],
  },
  {
    // A thin shimmer of crickets: narrow high bands, each pulsing at its own quick rate.
    id: 'crickets',
    layers: [
      { noise: 'white', filter: { type: 'bandpass', freq: 4300, q: 12 }, gain: 0.14, wobble: { rate: 5.2, depth: 0.9 } },
      { noise: 'white', filter: { type: 'bandpass', freq: 5000, q: 14 }, gain: 0.1, wobble: { rate: 6.3, depth: 0.9 } },
      { noise: 'white', filter: { type: 'bandpass', freq: 3800, q: 10 }, gain: 0.08, wobble: { rate: 4.4, depth: 0.85 } },
    ],
  },
  {
    // Running water: a soft burble that swells and ebbs.
    id: 'water',
    layers: [
      { noise: 'brown', filter: { type: 'bandpass', freq: 600, q: 0.6 }, gain: 0.18, wobble: { rate: 0.22, depth: 0.5 } },
      { noise: 'pink', filter: { type: 'bandpass', freq: 1800, q: 0.8 }, gain: 0.06, wobble: { rate: 0.4, depth: 0.6 } },
    ],
  },
  {
    // The quiet of a room: a very low hum.
    id: 'indoor_hum',
    layers: [{ noise: 'brown', filter: { type: 'lowpass', freq: 180, q: 0.5 }, gain: 0.15 }],
  },
  {
    // The hollow low drone of a cave, slowly breathing.
    id: 'cave_drone',
    layers: [
      { noise: 'brown', filter: { type: 'lowpass', freq: 140, q: 0.8 }, gain: 0.2, wobble: { rate: 0.07, depth: 0.5 } },
      { noise: 'brown', filter: { type: 'bandpass', freq: 90, q: 2 }, gain: 0.12, wobble: { rate: 0.11, depth: 0.6 } },
    ],
  },
];
