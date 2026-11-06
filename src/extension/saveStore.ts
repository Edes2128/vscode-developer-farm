import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { isValidStorageKey, type StorageBackend } from '../engine/persistence/storage';

/**
 * Keeps the game's saves as files in one folder (the extension's global storage on the player's computer).
 *
 * Each key is one `<key>.json` file. A write goes to a temporary file first and is renamed into place, so a
 * crash or a full disk can never leave a half-written save behind. Keys are checked against a strict
 * pattern, so a message from the webview can never reach outside the folder.
 */
export class FileSaveStore implements StorageBackend {
  /** Operations run one at a time, in order, so a read never sees a half-finished write. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(readonly directory: string) {}

  fileFor(key: string): string {
    if (!isValidStorageKey(key)) throw new Error(`Invalid storage key "${key}"`);
    return path.join(this.directory, `${key}.json`);
  }

  read(key: string): Promise<string | null> {
    return this.enqueue(async () => {
      try {
        return await fs.readFile(this.fileFor(key), 'utf8');
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    });
  }

  write(key: string, text: string): Promise<void> {
    return this.enqueue(async () => {
      const file = this.fileFor(key);
      await fs.mkdir(this.directory, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      try {
        const handle = await fs.open(temporary, 'w');
        try {
          await handle.writeFile(text, 'utf8');
          await handle.sync(); // on the disk before the rename makes it the save
        } finally {
          await handle.close();
        }
        await fs.rename(temporary, file);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  remove(key: string): Promise<void> {
    return this.enqueue(async () => {
      await fs.rm(this.fileFor(key), { force: true });
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    // Keep the chain alive whether this operation succeeded or failed.
    this.tail = result.catch(() => undefined);
    return result;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}
