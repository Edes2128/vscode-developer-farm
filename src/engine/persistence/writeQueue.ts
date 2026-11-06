/**
 * Writes the latest value without ever running two writes at once. A value that arrives while a write is
 * running replaces any waiting value, so a burst of changes costs one more write and the last write always
 * carries the newest state.
 */
export class WriteQueue<T> {
  private pending: { value: T } | undefined;
  private writing: Promise<void> | undefined;

  constructor(
    private readonly write: (value: T) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Asks for `value` to be written soon, replacing anything still waiting. */
  schedule(value: T): void {
    this.pending = { value };
    this.writing ??= this.drain();
  }

  /** Resolves once everything scheduled so far has been written. */
  async flush(): Promise<void> {
    // Bounded so a bug can never turn a shutdown into an endless loop.
    for (let pass = 0; pass < 100 && this.writing !== undefined; pass += 1) await this.writing;
  }

  private async drain(): Promise<void> {
    // Yield first: `writing` is assigned from this method's return value, so the `finally` below must
    // never run before that assignment (it could if `write` threw synchronously).
    await Promise.resolve();
    try {
      while (this.pending !== undefined) {
        const { value } = this.pending;
        this.pending = undefined;
        try {
          await this.write(value);
        } catch (error) {
          this.onError(error);
        }
      }
    } finally {
      this.writing = undefined;
    }
  }
}
