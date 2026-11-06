import { decodeSave, encodeSave, type DecodeFailure, type GameSaveState } from './saveFormat';
import type { StorageBackend } from './storage';
import { WriteQueue } from './writeQueue';

export type LoadOutcome =
  /** Nothing saved yet: a new game. */
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'loaded';
      readonly state: GameSaveState;
      /** `backup` means the main file was unreadable and the previous good save was used. */
      readonly source: 'primary' | 'backup';
      readonly migrated: boolean;
      readonly savedAt: string;
    }
  /** Neither the save nor its backup could be read. The damaged data was archived and a new game starts. */
  | { readonly kind: 'unreadable'; readonly reason: DecodeFailure; readonly archivedAs: string | undefined }
  /** The save was written by a newer Developer Farm. It is left untouched and saving is switched off. */
  | { readonly kind: 'newer-version'; readonly version: number };

export interface SaveManagerOptions {
  readonly slot?: number;
  readonly now?: () => Date;
  readonly onError?: (message: string, error?: unknown) => void;
  /** Called after each save reached storage. */
  readonly onSaved?: (at: Date) => void;
}

/**
 * Saves and loads the game safely.
 *
 *  - The previous good save is kept as a backup before every write.
 *  - A save that cannot be read is archived, not deleted, and the backup is tried.
 *  - A save from a newer version is never overwritten.
 *  - Writes are coalesced: many requests in a row cost one write, and the last one wins.
 */
export class SaveManager {
  readonly slot: number;
  private readonly now: () => Date;
  private readonly onError: (message: string, error?: unknown) => void;
  private readonly onSaved: (at: Date) => void;
  private readonly queue: WriteQueue<GameSaveState>;
  private locked = false;
  private lastSaved: Date | undefined;

  constructor(
    private readonly backend: StorageBackend,
    options: SaveManagerOptions = {},
  ) {
    this.slot = options.slot ?? 1;
    this.now = options.now ?? (() => new Date());
    this.onError = options.onError ?? (() => undefined);
    this.onSaved = options.onSaved ?? (() => undefined);
    this.queue = new WriteQueue((state) => this.writeNow(state), (error) => this.onError('Saving failed', error));
  }

  get primaryKey(): string {
    return `slot-${this.slot}`;
  }

  get backupKey(): string {
    return `slot-${this.slot}.backup`;
  }

  /** True when saving is switched off to protect a save from a newer version. */
  get isLocked(): boolean {
    return this.locked;
  }

  get lastSavedAt(): Date | undefined {
    return this.lastSaved;
  }

  async load(): Promise<LoadOutcome> {
    const primaryText = await this.safeRead(this.primaryKey);
    const backupText = await this.safeRead(this.backupKey);

    if (primaryText === null && backupText === null) return { kind: 'empty' };

    let failure: DecodeFailure = 'not-json';
    if (primaryText !== null) {
      const decoded = decodeSave(primaryText);
      if (decoded.ok) return { kind: 'loaded', state: decoded.state, source: 'primary', migrated: decoded.migrated, savedAt: decoded.savedAt };
      if (decoded.reason === 'newer-version') {
        this.locked = true;
        return { kind: 'newer-version', version: decoded.version ?? 0 };
      }
      failure = decoded.reason;
      this.onError(`Save file could not be read (${decoded.reason}); trying the backup`);
    }

    if (backupText !== null) {
      const decoded = decodeSave(backupText);
      if (decoded.ok) {
        const archivedAs = primaryText === null ? undefined : await this.archive(primaryText);
        if (archivedAs !== undefined) this.onError(`The damaged save was kept as "${archivedAs}"`);
        return { kind: 'loaded', state: decoded.state, source: 'backup', migrated: decoded.migrated, savedAt: decoded.savedAt };
      }
      if (decoded.reason === 'newer-version') {
        this.locked = true;
        return { kind: 'newer-version', version: decoded.version ?? 0 };
      }
      failure = decoded.reason;
    }

    // Nothing usable. Keep the damaged text so nothing is ever lost silently, then start fresh.
    const archivedAs = primaryText !== null ? await this.archive(primaryText) : backupText !== null ? await this.archive(backupText) : undefined;
    return { kind: 'unreadable', reason: failure, archivedAs };
  }

  /** Asks for the state to be saved soon. Cheap to call often. */
  save(state: GameSaveState): void {
    if (this.locked) return;
    this.queue.schedule(state);
  }

  /** Saves and resolves once it is on disk. */
  async saveNow(state: GameSaveState): Promise<void> {
    if (this.locked) return;
    this.queue.schedule(state);
    await this.queue.flush();
  }

  /** Resolves once everything scheduled has been written. */
  flush(): Promise<void> {
    return this.queue.flush();
  }

  private async writeNow(state: GameSaveState): Promise<void> {
    // Keep the last good save as the backup, but never copy a damaged file over a good backup.
    const current = await this.safeRead(this.primaryKey);
    if (current !== null && decodeSave(current).ok) await this.backend.write(this.backupKey, current);
    const savedAt = this.now();
    await this.backend.write(this.primaryKey, encodeSave(state, savedAt));
    this.lastSaved = savedAt;
    this.onSaved(savedAt);
  }

  private async safeRead(key: string): Promise<string | null> {
    try {
      return await this.backend.read(key);
    } catch (error) {
      this.onError(`Could not read "${key}"`, error);
      return null;
    }
  }

  /** Stores damaged data under a new key. Returns the key, or undefined if even that failed. */
  private async archive(text: string): Promise<string | undefined> {
    const key = `slot-${this.slot}.damaged-${this.now().getTime()}`;
    try {
      await this.backend.write(key, text);
      return key;
    } catch (error) {
      this.onError('Could not archive the damaged save', error);
      return undefined;
    }
  }
}
