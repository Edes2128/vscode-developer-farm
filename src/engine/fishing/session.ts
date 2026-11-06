/**
 * One cast of the line: wait for a bite, hook it in time, then time one press on a moving marker. It is a small timing
 * game that can never cost the player anything: a missed bite or a missed press only lets the fish go, and walking away
 * simply pulls the line in. Everything is driven by `update`, and all randomness comes from one generator seeded by the
 * caller, so the same options and the same presses always play out the same way.
 *
 * A press belongs to the state the player was looking at when they made it. `update` therefore applies the press first,
 * against the phase and marker as they stood at the start of the step, and only then lets time pass. That is why a press
 * on the very step a bite appears does nothing (they could not have seen it), why a lag spike never turns a good press
 * into a miss, and why one long `update` behaves exactly like many short ones with no presses in between.
 */
import { createRng } from '../core/random';
import type { Quality } from '../items/types';
import { pickFish } from './rules';
import type { FishDef } from './types';

export type FishingPhase = 'waiting' | 'bite' | 'reeling' | 'caught' | 'escaped' | 'nothing' | 'reeled-in';

export interface FishingOptions {
  /** The water cell the bobber floats on. */
  readonly cell: { readonly x: number; readonly y: number };
  /** The result of `biting(...)`. Empty means nothing is biting right now. */
  readonly candidates: readonly FishDef[];
  /** The caller derives it from the cell, the day and the minutes. */
  readonly seed: number;
}

// Waiting: how long until something takes the bait, in seconds.
export const BITE_DELAY_MIN = 2;
export const BITE_DELAY_SPREAD = 6;

// The bite: how long the player has to press, in seconds. Harder fish give less time, but never under the floor.
export const BITE_WINDOW_BASE = 1.1;
export const BITE_WINDOW_PER_DIFFICULTY = 0.12;
export const BITE_WINDOW_MIN = 0.45;

// Reeling: the marker sweeps 0..1 and back at this many "lengths" per second.
export const MARKER_SPEED_BASE = 0.9;
export const MARKER_SPEED_PER_DIFFICULTY = 0.35;
/** The line goes slack and the fish gets away if no press comes within this many seconds of hooking it. */
export const REEL_TIMEOUT = 6;

// The sweet spot: its width as a share of the 0..1 bar. Difficulty 1 is 0.355, difficulty 5 is 0.095.
export const ZONE_WIDTH_BASE = 0.42;
export const ZONE_WIDTH_PER_DIFFICULTY = 0.065;

// Quality is how close to the middle of the sweet spot the press lands, as a share of the zone's width.
/** Within this of the centre: Excellent (2), but only for fish this hard or harder. Easier fish top out at Good. */
export const EXCELLENT_RADIUS = 0.1;
export const EXCELLENT_MIN_DIFFICULTY = 3;
/** Within this of the centre: Good (1). Anywhere else in the zone: Normal (0). */
export const GOOD_RADIUS = 0.35;

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;

/** Seconds the player has to press once a fish bites. `difficulty` is 1 to 5. */
export const biteWindow = (difficulty: number): number =>
  Math.max(BITE_WINDOW_MIN, BITE_WINDOW_BASE - BITE_WINDOW_PER_DIFFICULTY * difficulty);

/** How fast the marker travels, in bar lengths per second. */
export const markerSpeed = (difficulty: number): number => MARKER_SPEED_BASE + MARKER_SPEED_PER_DIFFICULTY * difficulty;

/** The width of the sweet spot, as a share of the bar. */
export const zoneWidth = (difficulty: number): number => ZONE_WIDTH_BASE - ZONE_WIDTH_PER_DIFFICULTY * difficulty;

/**
 * What a press at `marker` catches: undefined when it is outside the zone (the fish escapes), otherwise a quality by how
 * near the centre it is. The zone's own edges count as inside.
 */
export function catchQuality(marker: number, zone: { readonly from: number; readonly to: number }, difficulty: number): Quality | undefined {
  if (marker < zone.from || marker > zone.to) return undefined;
  const width = zone.to - zone.from;
  const offset = Math.abs(marker - (zone.from + zone.to) / 2);
  if (offset <= EXCELLENT_RADIUS * width) return difficulty >= EXCELLENT_MIN_DIFFICULTY ? 2 : 1;
  if (offset <= GOOD_RADIUS * width) return 1;
  return 0;
}

/** A triangle wave: 0 up to 1, back down to 0, forever, with a period of 2. */
const triangle = (position: number): number => {
  const wrapped = position % 2;
  return wrapped <= 1 ? wrapped : 2 - wrapped;
};

export class FishingSession {
  readonly cell: { readonly x: number; readonly y: number };
  phase: FishingPhase = 'waiting';
  /** Seconds in the current phase: how long the line has been in the water, then how long the bite or the reel has lasted. */
  elapsed = 0;
  /** Known once something bites. */
  fish: FishDef | undefined = undefined;
  /**
   * While reeling: where the marker is (0..1) and the sweet spot (from < to, both in 0..1). Both are only meaningful once
   * reeling has begun, and they stay as they were when it ends so a view can show where the press landed.
   */
  marker = 0;
  zone: { readonly from: number; readonly to: number } = { from: 0, to: 0 };
  /** Set when the phase is 'caught'. */
  caught: { readonly fish: FishDef; readonly quality: Quality } | undefined = undefined;

  private readonly candidates: readonly FishDef[];
  private readonly rng: () => number;
  /** Drawn once, up front, so it never depends on how the caller slices time. */
  private readonly biteDelay: number;
  /** Where the marker is on its triangle wave when reeling starts (also picks which way it first moves). */
  private wavePhase = 0;

  constructor(options: FishingOptions) {
    this.cell = options.cell;
    this.candidates = options.candidates;
    this.rng = createRng(options.seed);
    this.biteDelay = BITE_DELAY_MIN + BITE_DELAY_SPREAD * this.rng();
  }

  /** True once the session has ended (any phase other than waiting, bite or reeling). */
  get finished(): boolean {
    return this.phase !== 'waiting' && this.phase !== 'bite' && this.phase !== 'reeling';
  }

  /**
   * Advances by `dt` seconds. `pressed` is true on the step the player pressed the use button. A press only ever acts on
   * the phase the step began in; during 'waiting' it does nothing at all. Time then runs phase by phase, carrying what is
   * left over, so a large `dt` plays out in order and a window only resolves if its time really passed.
   */
  update(dt: number, pressed: boolean): void {
    if (this.finished) return;
    if (pressed) this.press();

    let left = dt > 0 ? dt : 0; // also swallows NaN
    // Every phase has a finite length, so this ends in at most three turns, even for a huge `dt`.
    while (!this.finished) {
      const room = this.phaseLength() - this.elapsed;
      if (left < room) {
        this.elapsed += left;
        this.syncMarker();
        return;
      }
      left -= room;
      this.elapsed += room;
      this.syncMarker();
      this.timeRunsOut();
    }
  }

  /** The player pulls the line in (walks away, puts the rod down): ends the session as 'reeled-in' if it is still running. */
  cancel(): void {
    if (!this.finished) this.enter('reeled-in');
  }

  private enter(phase: FishingPhase): void {
    this.phase = phase;
    this.elapsed = 0;
  }

  /** How long the current phase lasts if nobody presses. */
  private phaseLength(): number {
    switch (this.phase) {
      case 'waiting':
        return this.biteDelay;
      case 'bite':
        return biteWindow(this.difficulty());
      default: // only 'reeling' gets here: finished sessions never ask
        return REEL_TIMEOUT;
    }
  }

  /** The fish's difficulty, kept inside 1..5 so odd data can never give a zero-width zone. */
  private difficulty(): number {
    return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, this.fish?.difficulty ?? MIN_DIFFICULTY));
  }

  private press(): void {
    if (this.phase === 'bite') {
      // Still in 'bite' at the start of the step means the window had not closed: the press is in time.
      this.startReeling();
    } else if (this.phase === 'reeling' && this.fish) {
      const quality = catchQuality(this.marker, this.zone, this.difficulty());
      if (quality === undefined) {
        this.enter('escaped'); // pressed outside the sweet spot
      } else {
        this.caught = { fish: this.fish, quality };
        this.enter('caught');
      }
    }
    // 'waiting': a press must not hook or cancel anything.
  }

  /** The current phase ran its full length with no press. */
  private timeRunsOut(): void {
    if (this.phase === 'waiting') {
      const fish = this.candidates.length > 0 ? pickFish(this.candidates, this.rng()) : undefined;
      if (fish) {
        this.fish = fish;
        this.enter('bite');
      } else {
        // The honest outcome: no fish bites in this water right now.
        this.enter('nothing');
      }
    } else {
      this.enter('escaped'); // the bite window closed, or the reel timed out
    }
  }

  private startReeling(): void {
    // Fixed draw order (wave position, then zone position) keeps a session reproducible from its seed alone.
    this.wavePhase = this.rng() * 2;
    const width = zoneWidth(this.difficulty());
    // Drawing `from` uniformly over what is left of the bar makes the centre uniform too, and the zone always fits.
    const from = this.rng() * (1 - width);
    this.zone = { from, to: from + width };
    this.enter('reeling');
    this.syncMarker();
  }

  /** The marker is a pure function of time spent reeling, so it comes out the same however `update` is sliced. */
  private syncMarker(): void {
    if (this.phase !== 'reeling') return;
    this.marker = triangle(this.wavePhase + markerSpeed(this.difficulty()) * this.elapsed);
  }
}
