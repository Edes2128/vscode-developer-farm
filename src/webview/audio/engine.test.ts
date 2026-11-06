import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUNDS } from '../../data/sounds';
import { PHRASE_BARS, midiToHz, restBarsAfter, tempo, tuneFor } from '../../engine/audio/audio';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings, type SoundId, type Surroundings } from '../../engine/audio/types';
import {
  AudioEngine,
  type AudioBufferLike,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type BufferSourceNodeLike,
  type GainNodeLike,
  type OscillatorNodeLike,
  type BiquadFilterNodeLike,
  type StereoPannerNodeLike,
} from './engine';

// A real AudioContext must satisfy the engine's small interface: this is checked by the compiler, never run.
export const realFactory: () => AudioContextLike = () => new AudioContext();

// ------------------------------------------------------------------------------------------ a fake Web Audio

interface ParamEvent {
  readonly type: 'set' | 'linear' | 'exp' | 'target';
  readonly value: number;
  readonly time: number;
  readonly timeConstant?: number;
}

class FakeParam implements AudioParamLike {
  value: number;
  readonly events: ParamEvent[] = [];
  constructor(initial = 1) {
    this.value = initial;
  }
  setValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ type: 'target', value, time, timeConstant });
    return this;
  }
  /** The value of the last setTargetAtTime. */
  get target(): number | undefined {
    return [...this.events].reverse().find((e) => e.type === 'target')?.value;
  }
}

class FakeNode implements AudioNodeLike {
  readonly connections: unknown[] = [];
  disconnected = 0;
  constructor(readonly ctx: FakeContext) {
    ctx.nodes.push(this);
  }
  connect(destination: AudioNodeLike | AudioParamLike): unknown {
    this.ctx.guard('connect');
    this.connections.push(destination);
    return destination;
  }
  disconnect(): void {
    this.disconnected += 1;
  }
}

class FakeGain extends FakeNode implements GainNodeLike {
  readonly gain = new FakeParam(1);
}

class FakeOscillator extends FakeNode implements OscillatorNodeLike {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  readonly starts: (number | undefined)[] = [];
  readonly stops: (number | undefined)[] = [];
  start(when?: number): void {
    this.starts.push(when);
  }
  stop(when?: number): void {
    this.stops.push(when);
  }
}

class FakeFilter extends FakeNode implements BiquadFilterNodeLike {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
}

class FakeBufferSource extends FakeNode implements BufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  readonly starts: { when: number | undefined; offset: number | undefined }[] = [];
  readonly stops: (number | undefined)[] = [];
  start(when?: number, offset?: number): void {
    this.starts.push({ when, offset });
  }
  stop(when?: number): void {
    this.stops.push(when);
  }
}

class FakePanner extends FakeNode implements StereoPannerNodeLike {
  readonly pan = new FakeParam(0);
}

class FakeBuffer implements AudioBufferLike {
  readonly data: Float32Array;
  constructor(readonly length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeContext implements AudioContextLike {
  currentTime = 0;
  state = 'suspended';
  readonly sampleRate = 44100;
  readonly nodes: FakeNode[] = [];
  readonly buffers: FakeBuffer[] = [];
  readonly destination: FakeNode;
  resumes = 0;
  suspends = 0;
  closes = 0;
  /** When set, every call that builds or connects something throws. */
  broken = false;
  /** When set, `close()` rejects. */
  closeRejects = false;

  constructor() {
    this.destination = new FakeNode(this);
  }

  guard(what: string): void {
    if (this.broken) throw new Error(`fake audio failure in ${what}`);
  }

  resume(): Promise<void> {
    this.resumes += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspends += 1;
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closes += 1;
    this.state = 'closed';
    return this.closeRejects ? Promise.reject(new Error('close failed')) : Promise.resolve();
  }
  createGain(): FakeGain {
    this.guard('createGain');
    return new FakeGain(this);
  }
  createOscillator(): FakeOscillator {
    this.guard('createOscillator');
    return new FakeOscillator(this);
  }
  createBiquadFilter(): FakeFilter {
    this.guard('createBiquadFilter');
    return new FakeFilter(this);
  }
  createBuffer(_channels: number, length: number): FakeBuffer {
    this.guard('createBuffer');
    const buffer = new FakeBuffer(length);
    this.buffers.push(buffer);
    return buffer;
  }
  createBufferSource(): FakeBufferSource {
    this.guard('createBufferSource');
    return new FakeBufferSource(this);
  }
  createStereoPanner(): FakePanner {
    this.guard('createStereoPanner');
    return new FakePanner(this);
  }
}

// ------------------------------------------------------------------------------------------ helpers

const surroundings = (over: Partial<Surroundings> = {}): Surroundings => ({
  ambient: 'outdoor',
  weather: 'sun',
  season: 'spring',
  minutes: 12 * 60,
  nearWater: false,
  ...over,
});

interface Rig {
  readonly ctx: FakeContext;
  readonly engine: AudioEngine;
  readonly factoryCalls: () => number;
  readonly randomCalls: () => number;
}

function rig(options: { settings?: Partial<AudioSettings>; random?: () => number } = {}): Rig {
  const ctx = new FakeContext();
  let calls = 0;
  let randomCalls = 0;
  const random = options.random ?? ((): number => 0.5);
  const engine = new AudioEngine(
    () => {
      calls += 1;
      return ctx;
    },
    { ...DEFAULT_AUDIO_SETTINGS, ...options.settings },
    () => {
      randomCalls += 1;
      return random();
    },
  );
  return { ctx, engine, factoryCalls: () => calls, randomCalls: () => randomCalls };
}

function unlocked(options: Parameters<typeof rig>[0] = {}): Rig {
  const r = rig(options);
  r.engine.unlock();
  return r;
}

const master = (ctx: FakeContext): FakeGain => ctx.nodes[1] as FakeGain;
const sfxBus = (ctx: FakeContext): FakeGain => ctx.nodes[2] as FakeGain;
const ambientBus = (ctx: FakeContext): FakeGain => ctx.nodes[3] as FakeGain;
const musicBus = (ctx: FakeContext): FakeGain => ctx.nodes[4] as FakeGain;

const oscillators = (ctx: FakeContext): FakeOscillator[] => ctx.nodes.filter((n): n is FakeOscillator => n instanceof FakeOscillator);
const bufferSources = (ctx: FakeContext): FakeBufferSource[] => ctx.nodes.filter((n): n is FakeBufferSource => n instanceof FakeBufferSource);
const gains = (ctx: FakeContext): FakeGain[] => ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain);
/** The per-sound output gains: the ones wired straight into the sfx bus (or a panner in front of it). */
const soundOutputs = (ctx: FakeContext): FakeGain[] => gains(ctx).filter((g) => g.connections.includes(sfxBus(ctx)));

const def = (id: SoundId) => SOUNDS.find((s) => s.id === id) as (typeof SOUNDS)[number];
const toneLayers = (id: SoundId) => def(id).layers.filter((l) => l.wave !== 'noise');
const noiseLayers = (id: SoundId) => def(id).layers.filter((l) => l.wave === 'noise');
const filterCount = (id: SoundId): number => def(id).layers.filter((l) => l.filter !== undefined).length;

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------------------------------ locking

describe('AudioEngine before unlock', () => {
  it('creates nothing and calls nothing until unlock()', () => {
    const { ctx, engine, factoryCalls } = rig();
    expect(engine.unlocked).toBe(false);
    engine.play('coin');
    engine.setSurroundings(surroundings());
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, master: 0.2 });
    engine.setPaused(true);
    engine.setPaused(false);
    engine.update(1);
    expect(factoryCalls()).toBe(0);
    expect(ctx.nodes).toHaveLength(1); // only the destination the fake itself makes
    expect(ctx.resumes).toBe(0);
    expect(engine.unlocked).toBe(false);
  });

  it('plays nothing that was asked for while locked, even after unlocking', () => {
    const { ctx, engine } = rig();
    engine.play('coin');
    engine.unlock();
    expect(oscillators(ctx)).toHaveLength(0);
    expect(bufferSources(ctx)).toHaveLength(0);
  });
});

describe('AudioEngine.unlock', () => {
  it('creates the context once, resumes it and builds the output chain', () => {
    const { ctx, engine, factoryCalls } = rig();
    engine.unlock();
    expect(engine.unlocked).toBe(true);
    expect(factoryCalls()).toBe(1);
    expect(ctx.resumes).toBe(1);
    expect(ctx.state).toBe('running');
    expect(master(ctx).connections).toContain(ctx.destination);
    for (const bus of [sfxBus(ctx), ambientBus(ctx), musicBus(ctx)]) expect(bus.connections).toContain(master(ctx));
    expect(master(ctx).gain.value).toBeCloseTo(DEFAULT_AUDIO_SETTINGS.master, 10);
    expect(sfxBus(ctx).gain.value).toBeCloseTo(DEFAULT_AUDIO_SETTINGS.sfx, 10);
    expect(ambientBus(ctx).gain.value).toBeCloseTo(DEFAULT_AUDIO_SETTINGS.ambient, 10);
    expect(musicBus(ctx).gain.value).toBeCloseTo(DEFAULT_AUDIO_SETTINGS.music, 10);
  });

  it('is idempotent: another call only resumes a context that has gone back to sleep', () => {
    const { ctx, engine, factoryCalls } = rig();
    engine.unlock();
    const nodes = ctx.nodes.length;
    engine.unlock();
    engine.unlock();
    expect(factoryCalls()).toBe(1);
    expect(ctx.nodes).toHaveLength(nodes);
    expect(ctx.resumes).toBe(1);
    ctx.state = 'suspended';
    engine.unlock();
    expect(ctx.resumes).toBe(2);
    expect(factoryCalls()).toBe(1);
  });

  it('makes one shared two-second white-noise buffer', () => {
    const { ctx } = unlocked();
    expect(ctx.buffers).toHaveLength(1);
    const buffer = ctx.buffers[0] as FakeBuffer;
    expect(buffer.length).toBe(ctx.sampleRate * 2);
    let power = 0;
    for (const v of buffer.data) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      power += v * v;
    }
    expect(Math.sqrt(power / buffer.length)).toBeGreaterThan(0.2);
    expect(Math.sqrt(power / buffer.length)).toBeLessThan(0.3);
  });

  it('stays silent forever, without an exception, when the factory returns nothing', () => {
    const calls = { n: 0 };
    const engine = new AudioEngine(() => (calls.n++, undefined), DEFAULT_AUDIO_SETTINGS);
    expect(() => engine.unlock()).not.toThrow();
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.unlocked).toBe(false);
    expect(calls.n).toBe(1);
    expect(() => {
      engine.play('coin');
      engine.setSurroundings(surroundings());
      engine.setSettings(DEFAULT_AUDIO_SETTINGS);
      engine.setPaused(true);
      engine.update(1);
      engine.dispose();
    }).not.toThrow();
  });

  it('stays silent forever, without an exception, when the factory throws', () => {
    const calls = { n: 0 };
    const engine = new AudioEngine(
      () => {
        calls.n += 1;
        throw new Error('no audio here');
      },
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(() => engine.unlock()).not.toThrow();
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.unlocked).toBe(false);
    expect(calls.n).toBe(1);
    expect(() => engine.play('door')).not.toThrow();
    expect(() => engine.update(0.016)).not.toThrow();
  });

  it('survives a context that cannot build its graph, and closes it', () => {
    const ctx = new FakeContext();
    ctx.broken = true;
    const engine = new AudioEngine(() => ctx, DEFAULT_AUDIO_SETTINGS);
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.unlocked).toBe(false);
    expect(ctx.closes).toBe(1);
    expect(() => engine.play('coin')).not.toThrow();
  });

  it('does not resume a context it was told to keep paused', () => {
    const { ctx, engine } = rig();
    engine.setPaused(true);
    engine.unlock();
    expect(ctx.resumes).toBe(0);
    expect(master(ctx).gain.value).toBe(0);
    engine.setPaused(false);
    expect(ctx.resumes).toBe(1);
    expect(master(ctx).gain.target).toBeCloseTo(DEFAULT_AUDIO_SETTINGS.master, 10);
  });

  it('starts silent when the settings said mute', () => {
    const { ctx } = unlocked({ settings: { muted: true } });
    expect(master(ctx).gain.value).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------ sounds

describe('AudioEngine.play', () => {
  it('builds one oscillator per tone layer and one looping noise source per noise layer, and stops them all', () => {
    for (const { id } of SOUNDS) {
      const { ctx, engine } = unlocked();
      const before = ctx.nodes.length;
      engine.play(id);
      const created = ctx.nodes.slice(before);
      const oscs = created.filter((n): n is FakeOscillator => n instanceof FakeOscillator);
      const noises = created.filter((n): n is FakeBufferSource => n instanceof FakeBufferSource);
      expect(oscs, id).toHaveLength(toneLayers(id).length);
      expect(noises, id).toHaveLength(noiseLayers(id).length);
      expect(created.filter((n) => n instanceof FakeFilter), id).toHaveLength(filterCount(id));
      for (const source of [...oscs, ...noises]) {
        const starts = source instanceof FakeOscillator ? source.starts : source.starts.map((s) => s.when);
        expect(starts, id).toHaveLength(1);
        expect(source.stops, id).toHaveLength(1);
        expect(starts[0] ?? -1, id).toBeGreaterThanOrEqual(ctx.currentTime);
        expect(source.stops[0] ?? -1, id).toBeGreaterThan(starts[0] ?? 0);
      }
      for (const noise of noises) {
        expect(noise.loop).toBe(true);
        expect(noise.buffer).toBe(ctx.buffers[0]);
        expect(noise.starts[0]?.offset ?? -1).toBeGreaterThanOrEqual(0);
        expect(noise.starts[0]?.offset ?? 99).toBeLessThanOrEqual(2);
      }
      // One output gain per sound, into the sfx bus.
      expect(soundOutputs(ctx), id).toHaveLength(1);
    }
  });

  it('shapes each layer with an attack, then an exponential fall to near silence, and sets the wave and the sweep', () => {
    const { ctx, engine } = unlocked();
    const before = ctx.nodes.length;
    engine.play('ui_move');
    const [out, env, osc, filter] = ctx.nodes.slice(before) as [FakeGain, FakeGain, FakeOscillator, FakeFilter];
    const layer = def('ui_move').layers[0];
    expect(out.gain.value).toBeCloseTo(def('ui_move').volume, 10);
    const [first, second, third] = env.gain.events;
    expect(first).toMatchObject({ type: 'set', value: 0 });
    expect(second?.type).toBe('linear');
    expect(second?.value).toBeCloseTo(layer?.gain ?? 0, 10);
    expect(third?.type).toBe('exp');
    expect(third?.value).toBeLessThan(0.001);
    expect(third?.value).toBeGreaterThan(0);
    expect((second?.time ?? 0) - (first?.time ?? 0)).toBeCloseTo(layer?.attack ?? 0, 6);
    expect((third?.time ?? 0) - (second?.time ?? 0)).toBeCloseTo(layer?.decay ?? 0, 6);
    expect(osc.type).toBe('sine');
    expect(osc.frequency.events[0]?.value).toBe(660);
    expect(osc.starts[0]).toBeCloseTo(first?.time ?? -1, 8);
    expect(osc.stops[0] ?? 0).toBeGreaterThan(third?.time ?? 99);
    expect(filter.type).toBe('lowpass');
    expect(filter.frequency.events[0]?.value).toBeCloseTo(3000, 6);
    expect(osc.connections).toContain(filter);
    expect(filter.connections).toContain(env);
    expect(env.connections).toContain(out);
    expect(out.connections).toContain(sfxBus(ctx));
  });

  it('sweeps tones and filters from their start to their end values', () => {
    const { ctx, engine } = unlocked();
    const before = ctx.nodes.length;
    engine.play('door');
    const created = ctx.nodes.slice(before);
    const creak = created.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.type === 'sawtooth') as FakeOscillator;
    const layer = def('door').layers[0];
    expect(creak.frequency.events[0]?.value).toBeCloseTo(layer?.freq?.from ?? 0, 6);
    const ramp = creak.frequency.events.find((e) => e.type === 'exp');
    expect(ramp?.value).toBeCloseTo(layer?.freq?.to ?? 0, 6);
    const filter = created.find((n): n is FakeFilter => n instanceof FakeFilter) as FakeFilter;
    expect(filter.frequency.events.find((e) => e.type === 'exp')?.value).toBeCloseTo(layer?.filter?.freq.to ?? 0, 6);
    expect(filter.Q.value).toBe(layer?.filter?.q);
  });

  it('delays a layer by its delay', () => {
    const { ctx, engine } = unlocked();
    ctx.currentTime = 10;
    const before = ctx.nodes.length;
    engine.play('coin');
    const tones = ctx.nodes.slice(before).filter((n): n is FakeOscillator => n instanceof FakeOscillator);
    const layers = toneLayers('coin');
    expect(tones).toHaveLength(layers.length);
    const firstStart = tones[0]?.starts[0] ?? -1;
    expect(firstStart).toBeGreaterThanOrEqual(10);
    expect(firstStart).toBeLessThan(10.05);
    tones.forEach((osc, i) => {
      expect((osc.starts[0] ?? -1) - firstStart).toBeCloseTo(layers[i]?.delay ?? 0, 6);
    });
    expect(layers.some((l) => (l.delay ?? 0) > 0)).toBe(true);
  });

  it('makes up for what a noise filter removes, and not for a tone', () => {
    const { ctx, engine } = unlocked();
    const before = ctx.nodes.length;
    engine.play('step_grass');
    const created = ctx.nodes.slice(before);
    const envs = created.filter((n): n is FakeGain => n instanceof FakeGain).slice(1);
    const peak = envs[0]?.gain.events.find((e) => e.type === 'linear')?.value ?? 0;
    expect(peak).toBeGreaterThan(def('step_grass').layers[0]?.gain ?? 1);
  });

  it('shifts the pitch by up to the sound\'s detune, chosen with the injected random', () => {
    const high = unlocked({ random: () => 1 });
    high.engine.play('pet');
    for (const osc of oscillators(high.ctx)) expect(osc.detune.value).toBeCloseTo(def('pet').detune ?? 0, 6);
    const low = unlocked({ random: () => 0 });
    low.engine.play('pet');
    for (const osc of oscillators(low.ctx)) expect(osc.detune.value).toBeCloseTo(-(def('pet').detune ?? 0), 6);
    const middle = unlocked({ random: () => 0.5 });
    middle.engine.play('pet');
    for (const osc of oscillators(middle.ctx)) expect(osc.detune.value).toBeCloseTo(0, 6);
    expect(high.randomCalls()).toBeGreaterThan(0);
  });

  it('does not shift a sound that has no detune', () => {
    const { ctx, engine } = unlocked({ random: () => 1 });
    engine.play('discover');
    for (const osc of oscillators(ctx)) expect(osc.detune.value).toBe(0);
  });

  it('survives an injected random that misbehaves', () => {
    for (const bad of [() => Number.NaN, () => -3, () => 12, () => Number.POSITIVE_INFINITY]) {
      const { ctx, engine } = unlocked({ random: bad });
      expect(() => engine.play('till')).not.toThrow();
      expect(oscillators(ctx).length).toBeGreaterThan(0);
      for (const osc of oscillators(ctx)) expect(Number.isFinite(osc.detune.value)).toBe(true);
    }
  });

  it('scales the sound with its volume option and pans it with a stereo panner when there is one', () => {
    const { ctx, engine } = unlocked();
    engine.play('coin', { volume: 0.5, pan: -0.4 });
    const panner = ctx.nodes.find((n): n is FakePanner => n instanceof FakePanner) as FakePanner;
    expect(panner.pan.value).toBeCloseTo(-0.4, 10);
    expect(panner.connections).toContain(sfxBus(ctx));
    const out = gains(ctx).find((g) => g.connections.includes(panner)) as FakeGain;
    expect(out.gain.value).toBeCloseTo(def('coin').volume * 0.5, 10);
  });

  it('clamps silly volume and pan options', () => {
    const { ctx, engine } = unlocked();
    engine.play('coin', { volume: 40, pan: 9 });
    const panner = ctx.nodes.find((n): n is FakePanner => n instanceof FakePanner) as FakePanner;
    expect(panner.pan.value).toBe(1);
    const out = gains(ctx).find((g) => g.connections.includes(panner)) as FakeGain;
    expect(out.gain.value).toBeCloseTo(def('coin').volume, 10);
  });

  it('ignores the pan option when the context has no stereo panner, and does not make one for pan 0', () => {
    const { ctx, engine } = unlocked();
    engine.play('coin', { pan: 0 });
    expect(ctx.nodes.some((n) => n instanceof FakePanner)).toBe(false);
    const plain = unlocked();
    Object.defineProperty(plain.ctx, 'createStereoPanner', { value: undefined });
    plain.engine.play('coin', { pan: 0.7 });
    expect(plain.ctx.nodes.some((n) => n instanceof FakePanner)).toBe(false);
    expect(oscillators(plain.ctx).length).toBeGreaterThan(0);
  });

  it('drops a sound beyond its voices, and lets it play again once the others are over', () => {
    const { ctx, engine } = unlocked();
    expect(def('step_grass').voices).toBe(2);
    engine.play('step_grass');
    engine.play('step_grass');
    engine.play('step_grass');
    engine.play('step_grass');
    expect(bufferSources(ctx)).toHaveLength(2 * def('step_grass').layers.length);
    // Another sound is not affected.
    engine.play('step_stone');
    expect(oscillators(ctx).length).toBe(toneLayers('step_stone').length);
    // Time passes; the footsteps end.
    ctx.currentTime += 1;
    engine.play('step_grass');
    expect(bufferSources(ctx)).toHaveLength(3 * def('step_grass').layers.length + noiseLayers('step_stone').length);
  });

  it('lets go of a sound\'s nodes once it is over', () => {
    const { ctx, engine } = unlocked();
    engine.play('plant');
    const made = ctx.nodes.slice(5);
    expect(made.length).toBeGreaterThan(5);
    expect(made.every((n) => n.disconnected === 0)).toBe(true);
    ctx.currentTime += 3;
    engine.update(0.016);
    expect(made.every((n) => n.disconnected >= 1)).toBe(true);
  });

  it('caps the sounds alive at once', () => {
    const { ctx, engine } = unlocked();
    for (let round = 0; round < 8; round += 1) for (const { id } of SOUNDS) engine.play(id);
    expect(soundOutputs(ctx).length).toBeLessThanOrEqual(24);
    expect(soundOutputs(ctx).length).toBeGreaterThanOrEqual(20);
  });

  it('does nothing when muted, when the master or sfx volume is zero, when paused, or for an unknown id', () => {
    for (const settings of [{ muted: true }, { master: 0 }, { sfx: 0 }] as const) {
      const { ctx, engine } = unlocked({ settings });
      const before = ctx.nodes.length;
      engine.play('coin');
      expect(ctx.nodes).toHaveLength(before);
    }
    const paused = unlocked();
    paused.engine.setPaused(true);
    const before = paused.ctx.nodes.length;
    paused.engine.play('coin');
    expect(paused.ctx.nodes).toHaveLength(before);

    const unknown = unlocked();
    const count = unknown.ctx.nodes.length;
    expect(() => unknown.engine.play('nope' as SoundId)).not.toThrow();
    expect(unknown.ctx.nodes).toHaveLength(count);
  });

  it('plays again after being unmuted and unpaused', () => {
    const { ctx, engine } = unlocked();
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: true });
    engine.play('coin');
    expect(oscillators(ctx)).toHaveLength(0);
    engine.setSettings(DEFAULT_AUDIO_SETTINGS);
    engine.setPaused(true);
    engine.setPaused(false);
    engine.play('coin');
    expect(oscillators(ctx)).toHaveLength(toneLayers('coin').length);
  });

  it('never throws, even when the context breaks under it', () => {
    const { ctx, engine } = unlocked();
    ctx.broken = true;
    for (const { id } of SOUNDS) expect(() => engine.play(id, { volume: 0.5, pan: 0.2 })).not.toThrow();
    ctx.broken = false;
    engine.play('coin');
    expect(oscillators(ctx).length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------------------ settings and pause

describe('AudioEngine.setSettings', () => {
  it('moves the master gain smoothly to the new volume', () => {
    const { ctx, engine } = unlocked();
    ctx.currentTime = 4;
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, master: 0.3, sfx: 0.5, ambient: 0.25, music: 0.1 });
    const event = master(ctx).gain.events.at(-1);
    expect(event).toMatchObject({ type: 'target', value: 0.3, time: 4 });
    expect(event?.timeConstant ?? 0).toBeGreaterThan(0);
    expect(event?.timeConstant ?? 9).toBeLessThan(0.2);
    expect(sfxBus(ctx).gain.target).toBe(0.5);
    expect(ambientBus(ctx).gain.target).toBe(0.25);
    expect(musicBus(ctx).gain.target).toBe(0.1);
  });

  it('takes the master to zero when muted and back when unmuted', () => {
    const { ctx, engine } = unlocked();
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: true });
    expect(master(ctx).gain.target).toBe(0);
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: false });
    expect(master(ctx).gain.target).toBe(DEFAULT_AUDIO_SETTINGS.master);
  });

  it('cleans up bad settings', () => {
    const { ctx, engine } = unlocked();
    engine.setSettings({ master: 7, sfx: -1, ambient: Number.NaN, music: 'loud', muted: 'yes' } as unknown as AudioSettings);
    expect(master(ctx).gain.target).toBe(1);
    expect(sfxBus(ctx).gain.target).toBe(0);
    expect(ambientBus(ctx).gain.target).toBe(DEFAULT_AUDIO_SETTINGS.ambient);
    expect(musicBus(ctx).gain.target).toBe(DEFAULT_AUDIO_SETTINGS.music);
    expect(() => engine.setSettings(undefined as unknown as AudioSettings)).not.toThrow();
  });

  it('keeps a paused game paused when the volume changes', () => {
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, master: 0.9 });
    expect(master(ctx).gain.target).toBe(0);
    engine.setPaused(false);
    expect(master(ctx).gain.target).toBe(0.9);
  });

  it('takes effect from the first moment when set before unlock', () => {
    const { ctx, engine } = rig();
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, master: 0.35, music: 0.2 });
    engine.unlock();
    expect(master(ctx).gain.value).toBeCloseTo(0.35, 10);
    expect(musicBus(ctx).gain.value).toBeCloseTo(0.2, 10);
  });
});

describe('AudioEngine.setPaused', () => {
  it('fades the output to silence, then suspends the context once the fade is over', () => {
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    expect(master(ctx).gain.target).toBe(0);
    expect(ctx.suspends).toBe(0);
    ctx.currentTime += 0.1;
    engine.update(0.1);
    expect(ctx.suspends).toBe(0);
    ctx.currentTime += 0.5;
    engine.update(0.5);
    expect(ctx.suspends).toBe(1);
    expect(ctx.state).toBe('suspended');
    ctx.currentTime += 5;
    engine.update(5);
    expect(ctx.suspends).toBe(1);
    engine.dispose();
  });

  it('suspends by itself after the fade, even if nobody calls update', () => {
    vi.useFakeTimers();
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    expect(ctx.suspends).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(ctx.suspends).toBe(1);
    engine.dispose();
  });

  it('resumes and fades back when unpaused', () => {
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    ctx.currentTime += 1;
    engine.update(1);
    expect(ctx.state).toBe('suspended');
    const resumes = ctx.resumes;
    engine.setPaused(false);
    expect(ctx.resumes).toBe(resumes + 1);
    expect(ctx.state).toBe('running');
    expect(master(ctx).gain.target).toBe(DEFAULT_AUDIO_SETTINGS.master);
  });

  it('does not suspend when the pause is lifted before the fade ends', () => {
    vi.useFakeTimers();
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    engine.setPaused(false);
    ctx.currentTime += 2;
    engine.update(2);
    vi.advanceTimersByTime(2000);
    expect(ctx.suspends).toBe(0);
    expect(master(ctx).gain.target).toBe(DEFAULT_AUDIO_SETTINGS.master);
    engine.dispose();
  });

  it('is idempotent', () => {
    const { ctx, engine } = unlocked();
    engine.setPaused(true);
    engine.setPaused(true);
    ctx.currentTime += 1;
    engine.update(1);
    engine.update(1);
    expect(ctx.suspends).toBe(1);
    engine.setPaused(false);
    engine.setPaused(false);
    expect(ctx.resumes).toBe(2);
  });

  it('keeps the beds and the clock where they were while paused', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings());
    const nodes = ctx.nodes.length;
    engine.setPaused(true);
    for (let i = 0; i < 20; i += 1) {
      ctx.currentTime += 0.5;
      engine.update(0.5);
    }
    expect(ctx.nodes).toHaveLength(nodes);
  });
});

// ------------------------------------------------------------------------------------------ backgrounds

describe('AudioEngine.setSurroundings', () => {
  it('builds nothing before unlock, then the beds for the place on unlock', () => {
    const { ctx, engine } = rig();
    engine.setSurroundings(surroundings());
    expect(ctx.nodes).toHaveLength(1);
    engine.unlock();
    // A breeze: two layers of looped noise, each with a slow wobble oscillator.
    expect(bufferSources(ctx)).toHaveLength(2);
    expect(oscillators(ctx)).toHaveLength(2);
    for (const source of bufferSources(ctx)) {
      expect(source.loop).toBe(true);
      expect(source.starts).toHaveLength(1);
    }
  });

  it('makes each bed from filtered noise, with a wobble whose rate comes from its recipe', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings({ weather: 'cloud' })); // wind
    const lfos = oscillators(ctx);
    expect(lfos).toHaveLength(2);
    expect(lfos[0]?.type).toBe('sine');
    expect(lfos[0]?.frequency.value).toBeGreaterThan(0.12 * 0.89);
    expect(lfos[0]?.frequency.value).toBeLessThan(0.12 * 1.11);
    expect(ctx.nodes.filter((n) => n instanceof FakeFilter)).toHaveLength(2);
    // Pink noise for the wind.
    expect(ctx.buffers).toHaveLength(2);
    expect(bufferSources(ctx).every((s) => s.buffer === ctx.buffers[1])).toBe(true);
  });

  it('fades a bed in to the level from bedsFor, into the ambient channel', () => {
    const { ctx, engine } = unlocked();
    ctx.currentTime = 7;
    engine.setSurroundings(surroundings());
    const fade = gains(ctx).find((g) => g.connections.includes(ambientBus(ctx))) as FakeGain;
    expect(fade.gain.value).toBe(0);
    const event = fade.gain.events.at(-1);
    expect(event).toMatchObject({ type: 'target', value: 0.55, time: 7 });
    expect(event?.timeConstant ?? 0).toBeGreaterThan(0.3);
  });

  it('does not rebuild for the same input, nor for a change that keeps the same beds', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings());
    const nodes = ctx.nodes.length;
    engine.setSurroundings(surroundings());
    engine.setSurroundings({ ...surroundings() });
    engine.setSurroundings(surroundings({ minutes: 13 * 60, season: 'autumn' }));
    expect(ctx.nodes).toHaveLength(nodes);
    for (const source of [...bufferSources(ctx), ...oscillators(ctx)]) expect(source.disconnected).toBe(0);
  });

  it('retunes a bed whose level changes without rebuilding it', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings({ season: 'spring', minutes: 22 * 60 }));
    const nodes = ctx.nodes.length;
    const fade = gains(ctx).find((g) => g.connections.includes(ambientBus(ctx))) as FakeGain;
    const spring = fade.gain.target ?? 0;
    engine.setSurroundings(surroundings({ season: 'summer', minutes: 22 * 60 }));
    expect(ctx.nodes).toHaveLength(nodes);
    expect(fade.gain.target ?? 0).toBeGreaterThan(spring);
  });

  it('crossfades when the beds change: the old ones fade out and are released after about two seconds', () => {
    const { ctx, engine } = unlocked();
    ctx.currentTime = 10;
    engine.setSurroundings(surroundings());
    const oldFade = gains(ctx).find((g) => g.connections.includes(ambientBus(ctx))) as FakeGain;
    const oldSources = [...bufferSources(ctx), ...oscillators(ctx)];
    const nodes = ctx.nodes.length;
    ctx.currentTime = 20;
    engine.setSurroundings(surroundings({ weather: 'rain' }));
    // The new bed was built and the old one is fading to zero.
    expect(ctx.nodes.length).toBeGreaterThan(nodes);
    expect(oldFade.gain.events.at(-1)).toMatchObject({ type: 'target', value: 0, time: 20 });
    const newFade = gains(ctx).filter((g) => g.connections.includes(ambientBus(ctx))).find((g) => g !== oldFade) as FakeGain;
    expect(newFade.gain.target).toBe(0.8);
    for (const source of oldSources) {
      expect(source.disconnected).toBe(0);
      const stop = source.stops.at(-1) ?? 0;
      expect(stop).toBeGreaterThan(21.9);
      expect(stop).toBeLessThanOrEqual(23);
    }
    // After the fade, an update lets go of them.
    ctx.currentTime = 21;
    engine.update(1);
    expect(oldSources.every((s) => s.disconnected === 0)).toBe(true);
    ctx.currentTime = 23;
    engine.update(2);
    expect(oldSources.every((s) => s.disconnected >= 1)).toBe(true);
    expect(oldFade.disconnected).toBeGreaterThanOrEqual(1);
    expect(newFade.disconnected).toBe(0);
  });

  it('fades out everything when the place has no background, and builds again when it has one', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings({ season: 'winter', minutes: 22 * 60 })); // winter night: nothing
    expect(bufferSources(ctx)).toHaveLength(0);
    engine.setSurroundings(surroundings());
    expect(bufferSources(ctx)).toHaveLength(2);
    ctx.currentTime = 5;
    engine.setSurroundings(surroundings({ season: 'winter', minutes: 22 * 60 }));
    const fade = gains(ctx).find((g) => g.connections.includes(ambientBus(ctx))) as FakeGain;
    expect(fade.gain.target).toBe(0);
    ctx.currentTime = 9;
    engine.update(4);
    expect(fade.disconnected).toBeGreaterThanOrEqual(1);
  });

  it('can bring a bed back while it is still fading out', () => {
    const { ctx, engine } = unlocked();
    engine.setSurroundings(surroundings());
    engine.setSurroundings(surroundings({ weather: 'rain' }));
    ctx.currentTime += 0.5;
    engine.setSurroundings(surroundings());
    const fades = gains(ctx).filter((g) => g.connections.includes(ambientBus(ctx)));
    expect(fades).toHaveLength(3);
    expect(fades[2]?.gain.target).toBe(0.55);
    expect(fades[1]?.gain.target).toBe(0);
  });

  it('makes pink and brown noise only when a bed needs it', () => {
    const { ctx, engine } = unlocked();
    expect(ctx.buffers).toHaveLength(1);
    engine.setSurroundings(surroundings({ ambient: 'cave' }));
    expect(ctx.buffers).toHaveLength(2); // brown
    engine.setSurroundings(surroundings({ ambient: 'cave', weather: 'rain' }));
    expect(ctx.buffers).toHaveLength(2);
  });

  it('makes noise loops that are seamless, deterministic and at a steady loudness', () => {
    const a = unlocked();
    a.engine.setSurroundings(surroundings({ ambient: 'cave', weather: 'sun' }));
    a.engine.setSurroundings(surroundings({ weather: 'cloud' }));
    const b = unlocked();
    b.engine.setSurroundings(surroundings({ ambient: 'cave', weather: 'sun' }));
    b.engine.setSurroundings(surroundings({ weather: 'cloud' }));
    expect(a.ctx.buffers).toHaveLength(3);
    for (let i = 0; i < a.ctx.buffers.length; i += 1) {
      const data = (a.ctx.buffers[i] as FakeBuffer).data;
      expect(data).toEqual((b.ctx.buffers[i] as FakeBuffer).data);
      let power = 0;
      let steps = 0;
      for (let k = 0; k < data.length; k += 1) {
        const v = data[k] as number;
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThanOrEqual(1);
        power += v * v;
        if (k > 0) steps += Math.abs(v - (data[k - 1] as number));
      }
      expect(Math.sqrt(power / data.length)).toBeGreaterThan(0.22);
      expect(Math.sqrt(power / data.length)).toBeLessThan(0.28);
      // The jump from the last sample back to the first is no bigger than the steps inside the loop.
      const meanStep = steps / (data.length - 1);
      expect(Math.abs((data[0] as number) - (data[data.length - 1] as number))).toBeLessThan(meanStep * 8);
    }
    // The three colours differ.
    expect((a.ctx.buffers[0] as FakeBuffer).data).not.toEqual((a.ctx.buffers[1] as FakeBuffer).data);
  });

  it('keeps a bed going while the volume is muted, so it is there when unmuted', () => {
    const { ctx, engine } = unlocked({ settings: { muted: true } });
    engine.setSurroundings(surroundings());
    expect(bufferSources(ctx)).toHaveLength(2);
    expect(master(ctx).gain.value).toBe(0);
  });

  it('never throws, even when the context breaks', () => {
    const { ctx, engine } = unlocked();
    ctx.broken = true;
    expect(() => engine.setSurroundings(surroundings({ weather: 'storm' }))).not.toThrow();
    ctx.broken = false;
    expect(() => engine.setSurroundings(surroundings({ weather: 'rain' }))).not.toThrow();
  });
});

// ------------------------------------------------------------------------------------------ music

/** The notes the engine has put on the timeline: triangle oscillators are the bodies of the notes (nothing else here is a triangle). */
const noteBodies = (ctx: FakeContext): FakeOscillator[] => oscillators(ctx).filter((o) => o.type === 'triangle');

/** Runs the clock forward in small steps, calling update like the game loop would. */
function advance(r: Rig, seconds: number, step = 0.25): void {
  for (let t = 0; t < seconds; t += step) {
    r.ctx.currentTime += step;
    r.engine.update(step);
  }
}

/** The start time of each bar the engine has scheduled, worked out from the first note of each bar. */
function barStarts(ctx: FakeContext, season: Parameters<typeof tuneFor>[0], firstBar = 0): number[] {
  const beat = 60 / tempo(season);
  const bodies = noteBodies(ctx);
  const starts: number[] = [];
  let index = 0;
  for (let bar = firstBar; index < bodies.length; bar += 1) {
    const notes = tuneFor(season, bar);
    const body = bodies[index];
    if (body === undefined) break;
    starts.push((body.starts[0] ?? 0) - (notes[0]?.start ?? 0) * beat);
    index += notes.length;
  }
  return starts;
}

describe('AudioEngine.update (music)', () => {
  it('plays nothing before unlock, and nothing without surroundings', () => {
    const locked = rig();
    locked.engine.setSurroundings(surroundings());
    advance(locked, 30);
    expect(locked.ctx.nodes).toHaveLength(1);
    const lost = unlocked();
    advance(lost, 30);
    expect(noteBodies(lost.ctx)).toHaveLength(0);
  });

  it('waits a few seconds before the first phrase, then schedules a bar of soft plucks slightly ahead of time', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 2.5);
    expect(noteBodies(r.ctx)).toHaveLength(0);
    let guard = 0;
    while (noteBodies(r.ctx).length === 0 && guard < 40) {
      advance(r, 0.25);
      guard += 1;
    }
    const scheduledAt = r.ctx.currentTime;
    expect(scheduledAt).toBeGreaterThanOrEqual(3);
    expect(scheduledAt).toBeLessThanOrEqual(3.5);
    const notes = tuneFor('spring', 0);
    expect(noteBodies(r.ctx)).toHaveLength(notes.length);
    const beat = 60 / tempo('spring');
    const first = noteBodies(r.ctx)[0] as FakeOscillator;
    // Handed over before it sounds, and within a lookahead of the bar.
    expect(first.starts[0] ?? 0).toBeGreaterThan(scheduledAt);
    expect((first.starts[0] ?? 99) - (notes[0]?.start ?? 0) * beat).toBeLessThan(scheduledAt + 0.5);
    noteBodies(r.ctx).forEach((body, i) => {
      const note = notes[i];
      expect(body.frequency.value).toBeCloseTo(midiToHz(note?.midi ?? 0), 6);
      expect((body.starts[0] ?? 0) - (first.starts[0] ?? 0)).toBeCloseTo(((note?.start ?? 0) - (notes[0]?.start ?? 0)) * beat, 6);
      expect(body.stops[0] ?? 0).toBeGreaterThan(body.starts[0] ?? 99);
    });
  });

  it('plays the notes through a gentle low-pass, a triangle with a quiet sine, into the music channel, softly', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 3.5);
    const body = noteBodies(r.ctx)[0] as FakeOscillator;
    const env = body.connections[0] as FakeGain;
    const filter = env.connections[0] as FakeFilter;
    expect(filter.type).toBe('lowpass');
    expect(filter.frequency.events[0]?.value ?? 99999).toBeLessThanOrEqual(4000);
    expect(filter.connections).toContain(musicBus(r.ctx));
    const peak = env.gain.events.find((e) => e.type === 'linear')?.value ?? 9;
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(0.3);
    const sines = oscillators(r.ctx).filter((o) => o.type === 'sine' && o.connections.some((c) => c instanceof FakeGain && c !== env && c.connections.includes(env)));
    expect(sines.length).toBeGreaterThanOrEqual(1);
    expect(sines[0]?.frequency.value).toBeCloseTo(body.frequency.value * 2, 6);
  });

  it('plays four bars, rests for a long time, then plays another phrase: about a third of the time', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 900);
    const starts = barStarts(r.ctx, 'spring');
    const bar = (60 / tempo('spring')) * 4;
    expect(starts.length).toBeGreaterThanOrEqual(4 * 8);
    let tuneBars = 0;
    for (let i = 1; i < starts.length; i += 1) {
      const gap = ((starts[i] as number) - (starts[i - 1] as number)) / bar;
      const phrase = Math.floor((i - 1) / PHRASE_BARS);
      if ((i - 1) % PHRASE_BARS < PHRASE_BARS - 1) {
        expect(gap).toBeCloseTo(1, 6);
        tuneBars += 1;
      } else {
        // After a phrase: its own bar, then the rest.
        expect(gap).toBeCloseTo(1 + restBarsAfter(phrase), 6);
      }
    }
    const span = ((starts.at(-1) as number) - (starts[0] as number)) / bar + 1;
    const share = (starts.length - 0) / (span + restBarsAfter(0));
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.42);
    expect(tuneBars).toBeGreaterThan(0);
  });

  it('keeps the notes in bar order and never schedules the same bar twice', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 300);
    const bodies = noteBodies(r.ctx);
    let index = 0;
    for (let bar = 0; index < bodies.length - 6; bar += 1) {
      for (const note of tuneFor('spring', bar)) {
        expect(bodies[index]?.frequency.value).toBeCloseTo(midiToHz(note.midi), 6);
        index += 1;
      }
    }
  });

  it('uses the tempo of the season', () => {
    const times: Record<string, number> = {};
    for (const season of ['spring', 'winter'] as const) {
      const r = unlocked();
      r.engine.setSurroundings(surroundings({ season }));
      advance(r, 60);
      const starts = barStarts(r.ctx, season);
      times[season] = (starts[1] as number) - (starts[0] as number);
      expect(times[season]).toBeCloseTo((60 / tempo(season)) * 4, 6);
    }
    expect(times.winter).toBeGreaterThan(times.spring ?? 0);
  });

  it('changes season gracefully: the phrase in progress finishes, the next one is in the new season', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings({ season: 'spring' }));
    advance(r, 3.5);
    const first = noteBodies(r.ctx).length;
    expect(first).toBe(tuneFor('spring', 0).length);
    r.engine.setSurroundings(surroundings({ season: 'summer' }));
    advance(r, 3 * (60 / tempo('spring')) * 4 + 1);
    const bodies = noteBodies(r.ctx);
    const expected = [0, 1, 2, 3].flatMap((bar) => tuneFor('spring', bar));
    expect(bodies.slice(0, expected.length).map((b) => Math.round(b.frequency.value))).toEqual(expected.map((n) => Math.round(midiToHz(n.midi))));
    // The rest, and then summer.
    advance(r, 200);
    const all = noteBodies(r.ctx);
    const summerFirst = tuneFor('summer', PHRASE_BARS)[0];
    expect(all[expected.length]?.frequency.value).toBeCloseTo(midiToHz(summerFirst?.midi ?? 0), 6);
  });

  it('plays no music while muted, at music volume zero, at master zero, while paused, or underground', () => {
    const cases: { name: string; settings?: Partial<AudioSettings>; paused?: boolean; place?: Partial<Surroundings> }[] = [
      { name: 'muted', settings: { muted: true } },
      { name: 'music zero', settings: { music: 0 } },
      { name: 'master zero', settings: { master: 0 } },
      { name: 'paused', paused: true },
      { name: 'cave', place: { ambient: 'cave' } },
    ];
    for (const c of cases) {
      const r = unlocked(c.settings === undefined ? {} : { settings: c.settings });
      r.engine.setSurroundings(surroundings(c.place));
      if (c.paused === true) r.engine.setPaused(true);
      advance(r, 120);
      expect(noteBodies(r.ctx), c.name).toHaveLength(0);
    }
  });

  it('plays music indoors', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings({ ambient: 'indoor' }));
    advance(r, 10);
    expect(noteBodies(r.ctx).length).toBeGreaterThan(0);
  });

  it('starts again, after its pause, when unmuted or when the player comes out of a cave', () => {
    const r = unlocked({ settings: { muted: true } });
    r.engine.setSurroundings(surroundings());
    advance(r, 20);
    expect(noteBodies(r.ctx)).toHaveLength(0);
    r.engine.setSettings(DEFAULT_AUDIO_SETTINGS);
    advance(r, 2);
    expect(noteBodies(r.ctx)).toHaveLength(0);
    advance(r, 3);
    expect(noteBodies(r.ctx).length).toBeGreaterThan(0);

    const cave = unlocked();
    cave.engine.setSurroundings(surroundings({ ambient: 'cave' }));
    advance(cave, 30);
    expect(noteBodies(cave.ctx)).toHaveLength(0);
    cave.engine.setSurroundings(surroundings());
    advance(cave, 2);
    expect(noteBodies(cave.ctx)).toHaveLength(0);
    advance(cave, 3);
    expect(noteBodies(cave.ctx).length).toBeGreaterThan(0);
  });

  it('picks up where it left off after a pause', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 3.5);
    const before = noteBodies(r.ctx).length;
    r.engine.setPaused(true);
    advance(r, 100);
    expect(noteBodies(r.ctx)).toHaveLength(before);
    r.engine.setPaused(false);
    advance(r, 5);
    expect(noteBodies(r.ctx).length).toBeGreaterThanOrEqual(before);
  });

  it('copes with a huge, zero, negative or NaN dt', () => {
    for (const dt of [1e12, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = unlocked();
      r.engine.setSurroundings(surroundings());
      expect(() => {
        r.engine.update(dt);
        r.engine.update(dt);
      }).not.toThrow();
    }
    const huge = unlocked();
    huge.engine.setSurroundings(surroundings());
    huge.engine.update(1e12);
    expect(noteBodies(huge.ctx).length).toBeGreaterThan(0);
    const zero = unlocked();
    zero.engine.setSurroundings(surroundings());
    zero.engine.update(0);
    zero.engine.update(0);
    expect(noteBodies(zero.ctx)).toHaveLength(0);
  });

  it('does not flood the context after the clock jumps far ahead', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 3.5);
    const before = noteBodies(r.ctx).length;
    r.ctx.currentTime += 10_000;
    r.engine.update(0.016);
    r.engine.update(0.016);
    expect(noteBodies(r.ctx).length - before).toBeLessThanOrEqual(5);
  });

  it('keeps the number of nodes bounded over a long session, and stops every note', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 600);
    const live = r.ctx.nodes.filter((n) => n.disconnected === 0 && n !== r.ctx.destination);
    expect(live.length).toBeLessThan(80);
    expect(noteBodies(r.ctx).length).toBeGreaterThan(30);
    for (const body of noteBodies(r.ctx)) expect(body.stops).toHaveLength(1);
    // The quiet sine an octave up is stopped too.
    const shimmers = oscillators(r.ctx).filter((o) => (o.connections[0] as FakeGain | undefined)?.gain.value === 0.18);
    expect(shimmers).toHaveLength(noteBodies(r.ctx).length);
    for (const shimmer of shimmers) expect(shimmer.stops).toHaveLength(1);
  });

  it('never throws, even when the context breaks', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings());
    advance(r, 3);
    r.ctx.broken = true;
    expect(() => advance(r, 10)).not.toThrow();
  });
});

// ------------------------------------------------------------------------------------------ disposal

describe('AudioEngine.dispose', () => {
  it('stops everything, disconnects it and closes the context', () => {
    const r = unlocked();
    r.engine.setSurroundings(surroundings({ weather: 'storm', nearWater: true }));
    r.engine.play('thunder');
    r.engine.play('coin');
    advance(r, 4);
    r.engine.dispose();
    expect(r.ctx.closes).toBe(1);
    expect(r.engine.unlocked).toBe(false);
    for (const node of r.ctx.nodes) {
      if (node === r.ctx.destination) continue;
      expect(node.disconnected, node.constructor.name).toBeGreaterThanOrEqual(1);
    }
    for (const source of [...oscillators(r.ctx), ...bufferSources(r.ctx)]) expect(source.stops.length).toBeGreaterThanOrEqual(1);
  });

  it('makes every later call harmless, and does not close twice', () => {
    const r = unlocked();
    r.engine.dispose();
    const nodes = r.ctx.nodes.length;
    expect(() => {
      r.engine.play('coin');
      r.engine.setSurroundings(surroundings());
      r.engine.setSettings(DEFAULT_AUDIO_SETTINGS);
      r.engine.setPaused(true);
      r.engine.setPaused(false);
      r.engine.update(1);
      r.engine.unlock();
      r.engine.dispose();
    }).not.toThrow();
    expect(r.ctx.nodes).toHaveLength(nodes);
    expect(r.ctx.closes).toBe(1);
    expect(r.factoryCalls()).toBe(1);
    expect(r.engine.unlocked).toBe(false);
  });

  it('can be disposed before it was ever unlocked, and then never unlocks', () => {
    const r = rig();
    r.engine.dispose();
    r.engine.unlock();
    expect(r.factoryCalls()).toBe(0);
    expect(r.engine.unlocked).toBe(false);
  });

  it('cancels a pending suspend', () => {
    vi.useFakeTimers();
    const r = unlocked();
    r.engine.setPaused(true);
    r.engine.dispose();
    vi.advanceTimersByTime(2000);
    expect(r.ctx.suspends).toBe(0);
  });

  it('survives a context that cannot be closed', () => {
    const throwing = unlocked();
    throwing.ctx.close = (): Promise<void> => {
      throw new Error('close threw');
    };
    expect(() => throwing.engine.dispose()).not.toThrow();
    const rejecting = unlocked();
    rejecting.ctx.closeRejects = true;
    expect(() => rejecting.engine.dispose()).not.toThrow();
  });

  it('survives nodes that refuse to stop or disconnect', () => {
    const r = unlocked();
    r.engine.play('coin');
    r.engine.setSurroundings(surroundings());
    for (const node of r.ctx.nodes) {
      node.disconnect = (): void => {
        throw new Error('disconnect threw');
      };
    }
    for (const source of [...oscillators(r.ctx), ...bufferSources(r.ctx)]) {
      source.stop = (): void => {
        throw new Error('stop threw');
      };
    }
    expect(() => r.engine.dispose()).not.toThrow();
    expect(r.ctx.closes).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------ nothing ever throws

describe('AudioEngine never throws', () => {
  it('whatever it is asked, in any state', () => {
    const everything = (engine: AudioEngine): void => {
      engine.play('coin');
      engine.play('nope' as SoundId, { volume: Number.NaN, pan: Number.NaN });
      engine.play('till', { volume: -1, pan: -50 });
      engine.setSurroundings(surroundings({ minutes: Number.NaN }));
      engine.setSurroundings({ ambient: 'moon', weather: 'fog', season: 'smarch', minutes: -4, nearWater: true } as unknown as Surroundings);
      engine.setSettings({ master: Number.NaN } as unknown as AudioSettings);
      engine.setPaused(true);
      engine.setPaused(false);
      engine.update(Number.NaN);
      engine.update(1);
    };
    const locked = rig();
    expect(() => everything(locked.engine)).not.toThrow();
    const open = unlocked();
    expect(() => everything(open.engine)).not.toThrow();
    const broken = unlocked();
    broken.ctx.broken = true;
    expect(() => everything(broken.engine)).not.toThrow();
    const gone = unlocked();
    gone.engine.dispose();
    expect(() => everything(gone.engine)).not.toThrow();
  });

  it('with a random that throws', () => {
    const { engine } = unlocked({
      random: () => {
        throw new Error('no randomness today');
      },
    });
    expect(() => {
      engine.play('coin');
      engine.setSurroundings(surroundings());
      engine.update(5);
    }).not.toThrow();
  });
});
