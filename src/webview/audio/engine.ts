import { BEDS, SOUNDS } from '../../data/sounds';
import {
  BEATS_PER_BAR,
  PHRASE_BARS,
  bedsFor,
  channelGain,
  midiToHz,
  musicAllowed,
  noiseMakeup,
  restBarsAfter,
  sanitizeAudioSettings,
  tempo,
  tuneFor,
  type NoiseColor,
  type NoiseFilter,
} from '../../engine/audio/audio';
import type { AudioSettings, BedDef, BedId, FilterSpec, Note, SoundDef, SoundId, SoundLayer, Surroundings } from '../../engine/audio/types';
import { createRng } from '../../engine/core/random';
import type { Season } from '../../engine/time/calendar';

/**
 * The webview's sound engine: it turns the recipes in `src/data/sounds.ts` and the answers of `src/engine/audio/audio.ts` into sound
 * with the Web Audio API. It never touches `AudioContext` directly: it is given a factory and uses only the small structural types
 * below, so it compiles with a real `AudioContext` and runs in plain Node against a fake in the tests.
 *
 * Nothing is created before `unlock()` (browsers refuse sound before a key press or click), nothing plays while paused or muted, and
 * nothing here throws: if audio is missing or breaks, the game goes on silent.
 */

// ------------------------------------------------------------------------------------------ the part of Web Audio we use

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(target: number, time: number, timeConstant: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike | AudioParamLike): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

/** Anything that plays from a start time to a stop time: an oscillator or a buffer source. */
export interface SourceNodeLike extends AudioNodeLike {
  start(when?: number): void;
  stop(when?: number): void;
}

export interface OscillatorNodeLike extends SourceNodeLike {
  /** 'sine' | 'triangle' | 'square' | 'sawtooth'. */
  type: string;
  readonly frequency: AudioParamLike;
  readonly detune: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  /** 'lowpass' | 'highpass' | 'bandpass'. */
  type: string;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface AudioBufferLike {
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export interface StereoPannerNodeLike extends AudioNodeLike {
  readonly pan: AudioParamLike;
}

/** The small subset of `AudioContext` the engine uses. A real `AudioContext` satisfies it. */
export interface AudioContextLike {
  readonly currentTime: number;
  /** 'running' | 'suspended' | 'closed' (and 'interrupted' on some browsers). */
  readonly state: string;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceNodeLike;
  /** Optional: without it a `pan` option is ignored. */
  createStereoPanner?(): StereoPannerNodeLike;
}

export type AudioContextFactory = () => AudioContextLike | undefined;

export interface PlayOptions {
  /** Multiplies the sound's own volume, 0 to 1. */
  readonly volume?: number;
  /** -1 (left) to 1 (right). */
  readonly pan?: number;
}

// ------------------------------------------------------------------------------------------ tuning

/** Time constant of a volume change, seconds: about 0.2 s to settle. */
const SETTINGS_TIME_CONSTANT = 0.04;
/** Time constant of the fade for a pause. */
const PAUSE_TIME_CONSTANT = 0.05;
/** The context is suspended this long after a pause begins, once the fade has finished. */
const PAUSE_SUSPEND_AFTER = 0.4;
/** Backgrounds fade in and out with these time constants and are released after BED_RELEASE_AFTER seconds. */
const BED_IN_TIME_CONSTANT = 0.6;
const BED_OUT_TIME_CONSTANT = 0.5;
const BED_RELEASE_AFTER = 2.5;
/** How far ahead of its start a bar of music is handed to the context. */
const MUSIC_LOOKAHEAD = 0.5;
/** Silence before the first phrase (and after music has been off), in seconds of game time. */
const MUSIC_FIRST_DELAY = 3;
/** How loud a note of velocity 1 is. */
const MUSIC_NOTE_GAIN = 0.38;
/** All one-shot voices alive at once (sounds and music notes). */
const MAX_VOICES = 24;
/** The shared noise loops are this long. */
const NOISE_SECONDS = 2;
/** RMS of the noise buffers; `noiseMakeup` scales a filtered noise to the loudness its recipe asks for. */
const NOISE_RMS = 0.25;
const NOISE_FADE_SECONDS = 0.05;
/** Envelope floors and tails. */
const SILENCE = 0.0001;
const STOP_PADDING = 0.03;
/** A sound starts this far ahead of "now", so that its first sample is not already in the past. */
const START_LEAD = 0.005;

// ------------------------------------------------------------------------------------------ helpers

const clamp = (n: number, low: number, high: number): number => (Number.isNaN(n) ? low : Math.min(high, Math.max(low, n)));

/** Runs `fn`; any error, and any rejection of a promise it returns, is swallowed. */
function quietly(fn: () => unknown): void {
  try {
    const result = fn();
    if (typeof result === 'object' && result !== null && typeof (result as { catch?: unknown }).catch === 'function') {
      (result as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    // Audio must never take the game down.
  }
}

const SOUND_BY_ID: ReadonlyMap<SoundId, SoundDef> = new Map(SOUNDS.map((def) => [def.id, def]));
const BED_BY_ID: ReadonlyMap<BedId, BedDef> = new Map(BEDS.map((def) => [def.id, def]));

/** Geometric middle of a sweep: where a filter that moves from `from` to `to` spends its time. */
const middle = (from: number, to: number): number => Math.sqrt(Math.max(1, from) * Math.max(1, to));

function noiseFilterOf(filter: FilterSpec | undefined): NoiseFilter | undefined {
  if (filter === undefined) return undefined;
  return {
    type: filter.type,
    freq: middle(filter.freq.from, filter.freq.to),
    ...(filter.q === undefined ? {} : { q: filter.q }),
  };
}

/**
 * A loop of noise that joins itself without a click: `seconds` long, white, pink (1/f) or brown (1/f^2), at a fixed loudness.
 * Deterministic, so every run makes the same samples. The end of the loop is crossfaded into its start.
 */
function noiseSamples(color: NoiseColor, length: number, seed: number): Float32Array {
  const fade = Math.max(1, Math.min(Math.floor(length / 4), Math.floor(NOISE_FADE_SECONDS * (length / NOISE_SECONDS))));
  const total = length + fade;
  const rng = createRng(seed);
  const raw = new Float32Array(total);
  if (color === 'white') {
    for (let i = 0; i < total; i += 1) raw[i] = rng() * 2 - 1;
  } else if (color === 'pink') {
    // Paul Kellet's economy pink filter over white noise.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < total; i += 1) {
      const white = rng() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }
  } else {
    // A leaky integral of white noise.
    let last = 0;
    for (let i = 0; i < total; i += 1) {
      last = (last + 0.02 * (rng() * 2 - 1)) / 1.02;
      raw[i] = last;
    }
  }
  // Equal-power crossfade of the tail into the head: sample `length` follows sample `length - 1` in the raw stream, so the loop is seamless.
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    if (i < fade) {
      const t = (i + 0.5) / fade;
      out[i] = (raw[i] as number) * Math.sin((t * Math.PI) / 2) + (raw[length + i] as number) * Math.cos((t * Math.PI) / 2);
    } else {
      out[i] = raw[i] as number;
    }
  }
  let power = 0;
  for (let i = 0; i < length; i += 1) power += (out[i] as number) ** 2;
  const rms = Math.sqrt(power / length) || 1;
  const scale = NOISE_RMS / rms;
  for (let i = 0; i < length; i += 1) out[i] = clamp((out[i] as number) * scale, -1, 1);
  return out;
}

const NOISE_SEEDS: Readonly<Record<NoiseColor, number>> = { white: 101, pink: 202, brown: 303 };

/** One sound or note being played: the nodes to let go of, and when it is over. */
interface Voice {
  readonly id: SoundId | 'note';
  readonly endsAt: number;
  readonly nodes: AudioNodeLike[];
  readonly sources: SourceNodeLike[];
}

/** One background: its nodes, the gain that fades it, and the level it is fading to. */
interface BedInstance {
  readonly id: BedId;
  readonly fade: GainNodeLike;
  readonly nodes: AudioNodeLike[];
  readonly sources: SourceNodeLike[];
  level: number;
  releaseAt: number;
}

type Channels = Readonly<Record<'sfx' | 'ambient' | 'music', GainNodeLike>>;

// ------------------------------------------------------------------------------------------ the engine

export class AudioEngine {
  private ctx: AudioContextLike | undefined;
  private failed = false;
  private disposed = false;
  private settings: AudioSettings;
  private paused = false;

  private master: GainNodeLike | undefined;
  private channels: Channels | undefined;
  private noise: Partial<Record<NoiseColor, AudioBufferLike>> = {};

  private voices: Voice[] = [];

  private surroundings: Surroundings | undefined;
  private bedKey = '';
  private beds = new Map<BedId, BedInstance>();
  private fading: BedInstance[] = [];

  private pendingSuspend = false;
  private suspendAt = 0;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  // The tune: phrases of PHRASE_BARS bars, each followed by a rest.
  private musicDelay = MUSIC_FIRST_DELAY;
  private nextBar: number | undefined;
  private phrase = 0;
  private barInPhrase = 0;
  private musicSeason: Season | undefined;

  constructor(
    private readonly factory: AudioContextFactory,
    settings: AudioSettings,
    private readonly random: () => number = Math.random,
  ) {
    this.settings = sanitizeAudioSettings(settings);
  }

  /** True once the audio context exists. (It is not created until `unlock()`.) */
  get unlocked(): boolean {
    return this.ctx !== undefined && !this.disposed;
  }

  /** Creates the audio context (call it from a key press or click) and resumes it. A missing or failing context leaves the engine silent for good. */
  unlock(): void {
    if (this.disposed) return;
    let created: AudioContextLike | undefined;
    try {
      const existing = this.ctx;
      if (existing !== undefined) {
        if (existing.state === 'suspended' && !this.paused) quietly(() => existing.resume());
        return;
      }
      if (this.failed) return;
      // One attempt only: a missing or failing context means silence for good.
      this.failed = true;
      created = this.factory();
      if (!created) return;
      this.build(created);
      this.failed = false;
      this.ctx = created;
      if (!this.paused) quietly(() => created?.resume());
      this.applyBeds();
    } catch {
      this.failed = true;
      this.teardown();
      const broken = created;
      if (broken !== undefined) quietly(() => broken.close());
    }
  }

  setSettings(settings: AudioSettings): void {
    try {
      this.settings = sanitizeAudioSettings(settings);
      this.applySettings();
    } catch {
      // Silent.
    }
  }

  /** While paused: nothing plays, the output fades to silence and the context is suspended. Unpausing resumes and fades back. */
  setPaused(paused: boolean): void {
    try {
      if (this.disposed || paused === this.paused) return;
      this.paused = paused;
      const ctx = this.ctx;
      if (ctx === undefined) return;
      this.applySettings();
      if (paused) {
        this.pendingSuspend = true;
        this.suspendAt = this.now(ctx) + PAUSE_SUSPEND_AFTER;
        this.armSuspendTimer();
      } else {
        this.pendingSuspend = false;
        this.clearSuspendTimer();
        quietly(() => ctx.resume());
      }
    } catch {
      // Silent.
    }
  }

  /** Plays a sound once. Does nothing when locked, paused, muted, unknown or over its `voices`. */
  play(id: SoundId, options: PlayOptions = {}): void {
    try {
      const ctx = this.ctx;
      const channels = this.channels;
      if (ctx === undefined || channels === undefined || this.disposed || this.paused) return;
      if (channelGain(this.settings, 'sfx') <= 0) return;
      const def = SOUND_BY_ID.get(id);
      if (def === undefined) return;
      const now = this.now(ctx);
      this.prune(now);
      if (this.voices.length >= MAX_VOICES) return;
      if (this.voices.filter((voice) => voice.id === id).length >= def.voices) return;
      this.voices.push(this.buildSound(ctx, channels.sfx, def, now, options));
    } catch {
      // Silent.
    }
  }

  /** Chooses the backgrounds for where the player is and fades to them. The same input again changes nothing. */
  setSurroundings(surroundings: Surroundings): void {
    try {
      if (this.disposed) return;
      this.surroundings = surroundings;
      this.applyBeds();
    } catch {
      // Silent.
    }
  }

  /** Call every frame or so with the seconds since the last call: drives the music and tidies up finished sounds. */
  update(dt: number): void {
    try {
      const ctx = this.ctx;
      if (ctx === undefined || this.disposed) return;
      const now = this.now(ctx);
      this.prune(now);
      if (this.pendingSuspend && now >= this.suspendAt) this.finishPause();
      if (this.paused) return;
      const surroundings = this.surroundings;
      const music = this.channels?.music;
      if (music === undefined || surroundings === undefined || !this.musicMayPlay(surroundings)) {
        // Off (muted, music at zero, or underground): start afresh, with a pause, when it comes back.
        this.musicDelay = MUSIC_FIRST_DELAY;
        this.nextBar = undefined;
        this.barInPhrase = 0;
        return;
      }
      if (this.musicDelay > 0) {
        this.musicDelay -= Number.isFinite(dt) && dt > 0 ? Math.min(dt, 5) : 0;
        if (this.musicDelay > 0) return;
      }
      this.scheduleMusic(ctx, music, surroundings, now);
    } catch {
      // Silent.
    }
  }

  /** Stops everything and closes the context. Every later call does nothing. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardown();
  }

  // ---------------------------------------------------------------------------------------- the graph

  private now(ctx: AudioContextLike): number {
    return Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
  }

  /** Builds the output chain: sfx, ambient and music buses into one master gain into the speakers. */
  private build(ctx: AudioContextLike): void {
    const master = ctx.createGain();
    master.gain.value = this.masterTarget();
    master.connect(ctx.destination);
    const bus = (level: number): GainNodeLike => {
      const gain = ctx.createGain();
      gain.gain.value = level;
      gain.connect(master);
      return gain;
    };
    this.master = master;
    this.channels = { sfx: bus(this.settings.sfx), ambient: bus(this.settings.ambient), music: bus(this.settings.music) };
    this.noise = {};
    this.noise.white = this.makeNoise(ctx, 'white');
  }

  private makeNoise(ctx: AudioContextLike, color: NoiseColor): AudioBufferLike {
    const length = Math.max(2, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    buffer.getChannelData(0).set(noiseSamples(color, length, NOISE_SEEDS[color]));
    return buffer;
  }

  private noiseBuffer(ctx: AudioContextLike, color: NoiseColor): AudioBufferLike {
    let buffer = this.noise[color];
    if (buffer === undefined) {
      buffer = this.makeNoise(ctx, color);
      this.noise[color] = buffer;
    }
    return buffer;
  }

  private masterTarget(): number {
    return this.settings.muted || this.paused ? 0 : clamp(this.settings.master, 0, 1);
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const master = this.master;
    const channels = this.channels;
    if (ctx === undefined || master === undefined || channels === undefined) return;
    const now = this.now(ctx);
    master.gain.setTargetAtTime(this.masterTarget(), now, this.paused ? PAUSE_TIME_CONSTANT : SETTINGS_TIME_CONSTANT);
    channels.sfx.gain.setTargetAtTime(clamp(this.settings.sfx, 0, 1), now, SETTINGS_TIME_CONSTANT);
    channels.ambient.gain.setTargetAtTime(clamp(this.settings.ambient, 0, 1), now, SETTINGS_TIME_CONSTANT);
    channels.music.gain.setTargetAtTime(clamp(this.settings.music, 0, 1), now, SETTINGS_TIME_CONSTANT);
  }

  // ---------------------------------------------------------------------------------------- pausing

  private armSuspendTimer(): void {
    this.clearSuspendTimer();
    if (typeof setTimeout !== 'function') return;
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = undefined;
      this.finishPause();
    }, PAUSE_SUSPEND_AFTER * 1000 + 50);
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
    this.suspendTimer = undefined;
  }

  /** The fade is done: suspend the context, if the game is still paused. */
  private finishPause(): void {
    this.clearSuspendTimer();
    const ctx = this.ctx;
    if (!this.pendingSuspend || ctx === undefined || !this.paused) return;
    this.pendingSuspend = false;
    quietly(() => ctx.suspend());
  }

  // ---------------------------------------------------------------------------------------- one-shot sounds

  /** An envelope: silence, up to `peak` over the attack, then an exponential fall to silence. Returns when it ends. */
  private envelope(param: AudioParamLike, start: number, peak: number, attack: number, decay: number): number {
    const rise = Math.max(0.002, attack);
    const end = start + rise + Math.max(0.01, decay);
    param.setValueAtTime(0, start);
    param.linearRampToValueAtTime(Math.max(SILENCE * 2, peak), start + rise);
    param.exponentialRampToValueAtTime(SILENCE, end);
    return end;
  }

  private filterNode(ctx: AudioContextLike, spec: FilterSpec, start: number, end: number, ratio: number): BiquadFilterNodeLike {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.setValueAtTime(clamp(spec.freq.from * ratio, 10, ctx.sampleRate / 2 - 100), start);
    if (spec.freq.to !== spec.freq.from) filter.frequency.exponentialRampToValueAtTime(clamp(spec.freq.to * ratio, 10, ctx.sampleRate / 2 - 100), end);
    if (spec.q !== undefined) filter.Q.value = spec.q;
    return filter;
  }

  private buildSound(ctx: AudioContextLike, bus: GainNodeLike, def: SoundDef, now: number, options: PlayOptions): Voice {
    const out = ctx.createGain();
    out.gain.value = clamp(def.volume * clamp(options.volume ?? 1, 0, 1), 0, 1);
    const nodes: AudioNodeLike[] = [out];
    const sources: SourceNodeLike[] = [];
    const pan = options.pan;
    if (pan !== undefined && pan !== 0 && ctx.createStereoPanner !== undefined) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      out.connect(panner);
      panner.connect(bus);
      nodes.push(panner);
    } else {
      out.connect(bus);
    }

    const random = (): number => clamp(this.random(), 0, 1);
    // One small random shift of pitch for the whole sound, so a repeated sound is not mechanical.
    const cents = (random() * 2 - 1) * (def.detune ?? 0);
    const ratio = 2 ** (cents / 1200);
    let endsAt = now;

    for (const layer of def.layers) {
      const end = this.buildLayer(ctx, out, layer, now + START_LEAD + (layer.delay ?? 0), cents, ratio, random(), nodes, sources);
      endsAt = Math.max(endsAt, end);
    }
    return { id: def.id, endsAt: endsAt + STOP_PADDING + 0.02, nodes, sources };
  }

  /** One layer: a source (tone or noise), its filter and its envelope, into `out`. Returns the time it ends. */
  private buildLayer(
    ctx: AudioContextLike,
    out: GainNodeLike,
    layer: SoundLayer,
    start: number,
    cents: number,
    ratio: number,
    offsetRandom: number,
    nodes: AudioNodeLike[],
    sources: SourceNodeLike[],
  ): number {
    const env = ctx.createGain();
    env.gain.value = 0;
    nodes.push(env);
    const isNoise = layer.wave === 'noise';
    const peak = layer.gain * (isNoise ? noiseMakeup('white', noiseFilterOf(layer.filter), ctx.sampleRate) : 1);
    const end = this.envelope(env.gain, start, peak, layer.attack, layer.decay);

    let source: SourceNodeLike;
    if (isNoise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(ctx, 'white');
      noise.loop = true;
      noise.start(start, offsetRandom * NOISE_SECONDS);
      source = noise;
    } else {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      const sweep = layer.freq ?? { from: 440, to: 440 };
      osc.frequency.setValueAtTime(Math.max(1, sweep.from), start);
      if (sweep.to !== sweep.from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweep.to), end);
      osc.detune.value = cents;
      osc.start(start);
      source = osc;
    }
    source.stop(end + STOP_PADDING);
    sources.push(source);
    nodes.push(source);

    if (layer.filter === undefined) {
      source.connect(env);
    } else {
      const filter = this.filterNode(ctx, layer.filter, start, end, ratio);
      nodes.push(filter);
      source.connect(filter);
      filter.connect(env);
    }
    env.connect(out);
    return end;
  }

  /** Lets go of voices that have ended. */
  private prune(now: number): void {
    if (this.voices.length > 0) {
      const alive: Voice[] = [];
      for (const voice of this.voices) {
        if (now >= voice.endsAt) disconnectAll(voice.nodes);
        else alive.push(voice);
      }
      this.voices = alive;
    }
    if (this.fading.length > 0) {
      const alive: BedInstance[] = [];
      for (const bed of this.fading) {
        if (now >= bed.releaseAt) disconnectAll(bed.nodes);
        else alive.push(bed);
      }
      this.fading = alive;
    }
  }

  // ---------------------------------------------------------------------------------------- backgrounds

  private applyBeds(): void {
    const ctx = this.ctx;
    const channels = this.channels;
    const surroundings = this.surroundings;
    if (ctx === undefined || channels === undefined || surroundings === undefined) return;
    const now = this.now(ctx);
    this.prune(now);

    const wanted = bedsFor(surroundings);
    const key = wanted.map((plan) => `${plan.bed}:${plan.gain.toFixed(3)}`).join('|');
    if (key === this.bedKey) return;
    this.bedKey = key;

    const wantedIds = new Set<BedId>(wanted.map((plan) => plan.bed));
    for (const [id, bed] of this.beds) {
      if (wantedIds.has(id)) continue;
      // Fade out over a couple of seconds, then let go.
      bed.fade.gain.setTargetAtTime(0, now, BED_OUT_TIME_CONSTANT);
      bed.releaseAt = now + BED_RELEASE_AFTER;
      for (const source of bed.sources) quietly(() => source.stop(bed.releaseAt));
      this.fading.push(bed);
      this.beds.delete(id);
    }
    for (const plan of wanted) {
      const existing = this.beds.get(plan.bed);
      if (existing !== undefined) {
        if (Math.abs(existing.level - plan.gain) > 0.0005) {
          existing.level = plan.gain;
          existing.fade.gain.setTargetAtTime(plan.gain, now, BED_IN_TIME_CONSTANT);
        }
        continue;
      }
      const def = BED_BY_ID.get(plan.bed);
      if (def === undefined) continue;
      this.beds.set(plan.bed, this.buildBed(ctx, channels.ambient, def, plan.gain, now));
    }
  }

  /** A background: each layer is looped noise through a filter, its level wobbled by a slow oscillator. Fades in. */
  private buildBed(ctx: AudioContextLike, bus: GainNodeLike, def: BedDef, level: number, now: number): BedInstance {
    const fade = ctx.createGain();
    fade.gain.value = 0;
    fade.connect(bus);
    fade.gain.setTargetAtTime(level, now, BED_IN_TIME_CONSTANT);
    const nodes: AudioNodeLike[] = [fade];
    const sources: SourceNodeLike[] = [];

    for (const layer of def.layers) {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer(ctx, layer.noise);
      source.loop = true;
      source.start(now, clamp(this.random(), 0, 1) * NOISE_SECONDS);
      sources.push(source);
      nodes.push(source);

      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter.type;
      filter.frequency.value = clamp(layer.filter.freq, 10, ctx.sampleRate / 2 - 100);
      if (layer.filter.q !== undefined) filter.Q.value = layer.filter.q;
      nodes.push(filter);

      const peak = layer.gain * noiseMakeup(layer.noise, { type: layer.filter.type, freq: layer.filter.freq, ...(layer.filter.q === undefined ? {} : { q: layer.filter.q }) }, ctx.sampleRate);
      const wobble = layer.wobble;
      const gain = ctx.createGain();
      nodes.push(gain);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(fade);
      if (wobble === undefined || wobble.depth <= 0 || wobble.rate <= 0) {
        gain.gain.value = peak;
        continue;
      }
      // The level swings between peak * (1 - depth) and peak.
      const depth = clamp(wobble.depth, 0, 1);
      gain.gain.value = peak * (1 - depth / 2);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      // A touch of difference between layers, so that they never gust in step.
      lfo.frequency.value = wobble.rate * (0.9 + 0.2 * clamp(this.random(), 0, 1));
      const depthGain = ctx.createGain();
      depthGain.gain.value = (peak * depth) / 2;
      lfo.connect(depthGain);
      depthGain.connect(gain.gain);
      lfo.start(now);
      sources.push(lfo);
      nodes.push(lfo, depthGain);
    }
    return { id: def.id, fade, nodes, sources, level, releaseAt: Infinity };
  }

  // ---------------------------------------------------------------------------------------- music

  private musicMayPlay(surroundings: Surroundings): boolean {
    return musicAllowed(surroundings) && channelGain(this.settings, 'music') > 0;
  }

  /** Hands the bars that start within the lookahead to the context, one phrase of music and then a rest. */
  private scheduleMusic(ctx: AudioContextLike, bus: GainNodeLike, surroundings: Surroundings, now: number): void {
    if (this.nextBar === undefined) this.nextBar = now + 0.2;
    let guard = 0;
    while (this.nextBar < now + MUSIC_LOOKAHEAD && guard < 4) {
      guard += 1;
      // The season is taken when a phrase begins, so a change of season waits for the end of the phrase.
      if (this.barInPhrase === 0 || this.musicSeason === undefined) this.musicSeason = surroundings.season;
      const season = this.musicSeason;
      const beat = 60 / tempo(season);
      const barStart = Math.max(this.nextBar, now + 0.02);
      for (const note of tuneFor(season, this.phrase * PHRASE_BARS + this.barInPhrase)) {
        this.playNote(ctx, bus, note, barStart + note.start * beat, beat, now);
      }
      this.nextBar = barStart + BEATS_PER_BAR * beat;
      this.barInPhrase += 1;
      if (this.barInPhrase >= PHRASE_BARS) {
        this.barInPhrase = 0;
        this.nextBar += restBarsAfter(this.phrase) * BEATS_PER_BAR * beat;
        this.phrase += 1;
      }
    }
  }

  /** A soft pluck: a triangle with a quiet sine an octave up, through a low-pass that closes as the note dies. */
  private playNote(ctx: AudioContextLike, bus: GainNodeLike, note: Note, start: number, beat: number, now: number): void {
    if (this.voices.length >= MAX_VOICES) return;
    const hz = midiToHz(note.midi);
    const peak = clamp(note.velocity, 0, 1) * MUSIC_NOTE_GAIN;
    const ring = clamp(note.beats * beat * 1.15, 0.6, 2.6);
    const nodes: AudioNodeLike[] = [];
    const sources: SourceNodeLike[] = [];

    const env = ctx.createGain();
    env.gain.value = 0;
    const end = this.envelope(env.gain, start, peak, 0.012, ring);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3200, start);
    lowpass.frequency.exponentialRampToValueAtTime(900, end);
    lowpass.Q.value = 0.5;
    env.connect(lowpass);
    lowpass.connect(bus);
    nodes.push(env, lowpass);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = hz;
    body.detune.value = (clamp(this.random(), 0, 1) - 0.5) * 6;
    body.connect(env);
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = hz * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.18;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(env);
    nodes.push(body, shimmer, shimmerGain);
    for (const source of [body, shimmer]) {
      source.start(start);
      source.stop(end + STOP_PADDING);
      sources.push(source);
    }
    this.voices.push({ id: 'note', endsAt: Math.max(end, now) + STOP_PADDING + 0.02, nodes, sources });
  }

  // ---------------------------------------------------------------------------------------- tearing down

  private teardown(): void {
    this.clearSuspendTimer();
    this.pendingSuspend = false;
    const everything: { nodes: AudioNodeLike[]; sources: SourceNodeLike[] }[] = [...this.voices, ...this.beds.values(), ...this.fading];
    for (const part of everything) {
      for (const source of part.sources) quietly(() => source.stop());
      disconnectAll(part.nodes);
    }
    this.voices = [];
    this.beds.clear();
    this.fading = [];
    this.bedKey = '';
    this.nextBar = undefined;
    const ctx = this.ctx;
    const master = this.master;
    const channels = this.channels;
    this.ctx = undefined;
    this.master = undefined;
    this.channels = undefined;
    this.noise = {};
    if (channels !== undefined) disconnectAll([channels.sfx, channels.ambient, channels.music]);
    if (master !== undefined) disconnectAll([master]);
    if (ctx !== undefined) quietly(() => ctx.close());
  }
}

function disconnectAll(nodes: readonly AudioNodeLike[]): void {
  for (const node of nodes) quietly(() => node.disconnect());
}
