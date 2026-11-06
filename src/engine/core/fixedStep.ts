/**
 * Runs the simulation in fixed time steps, whatever the display's frame rate is.
 *
 * Simulation and rendering are decoupled: the renderer calls `advance` once per frame with the real
 * elapsed time, the loop runs as many fixed `step`s as that time pays for, and returns how far into the
 * next step we are (`alpha`, 0 to 1) so the renderer can interpolate between the last two states.
 */
export class FixedStepLoop {
  /** Seconds simulated per step. */
  readonly stepSeconds: number;
  /** Frames longer than this many steps are cut short, so one hitch never snowballs into a freeze. */
  readonly maxStepsPerFrame: number;

  private accumulator = 0;

  constructor(
    private readonly step: (seconds: number) => void,
    stepSeconds = 1 / 60,
    maxStepsPerFrame = 5,
  ) {
    this.stepSeconds = stepSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  /** Feeds `frameSeconds` of real time. Returns the interpolation alpha for rendering. */
  advance(frameSeconds: number): number {
    // A tab that was hidden for minutes must not be "caught up": clamp the frame.
    this.accumulator += Math.min(Math.max(frameSeconds, 0), this.stepSeconds * this.maxStepsPerFrame);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      this.step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps += 1;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = 0;
    return this.accumulator / this.stepSeconds;
  }

  /** Forgets any leftover time (after a pause, for instance). */
  reset(): void {
    this.accumulator = 0;
  }
}
