/**
 * Where saves live. The engine only knows this interface; the platform provides the implementation:
 * the VS Code extension host writes files, a browser build can use localStorage, tests use memory.
 *
 * Keys are short, lowercase and safe to use as file names: `^[a-z0-9][a-z0-9._-]{0,63}$`.
 */
export interface StorageBackend {
  /** The stored text, or null when nothing is stored under the key. */
  read(key: string): Promise<string | null>;
  /** Replaces the value. Implementations must not leave a half-written value behind if they fail. */
  write(key: string, text: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const STORAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const isValidStorageKey = (key: string): boolean => STORAGE_KEY_PATTERN.test(key);

/** An in-memory backend, for tests and as a last resort when nothing else is available. */
export class MemoryBackend implements StorageBackend {
  readonly entries = new Map<string, string>();

  read(key: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(key) ?? null);
  }

  write(key: string, text: string): Promise<void> {
    this.entries.set(key, text);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
}
