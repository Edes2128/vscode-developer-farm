import { MemoryBackend, type StorageBackend } from '../engine/persistence/storage';
import type { HostConnection } from './host';

/** Saves through the extension host, which keeps them as files on the player's computer. */
export class HostStorageBackend implements StorageBackend {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (text: string | null) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly host: HostConnection,
    private readonly timeoutMs = 15_000,
  ) {
    host.onMessage((message) => {
      if (message.type !== 'storageResult') return;
      const entry = this.pending.get(message.id);
      if (entry === undefined) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.ok) entry.resolve(message.text);
      else entry.reject(new Error(message.error ?? 'The extension could not complete the request'));
    });
  }

  read(key: string): Promise<string | null> {
    return this.request((id) => ({ type: 'storageRead', id, key }));
  }

  async write(key: string, text: string): Promise<void> {
    await this.request((id) => ({ type: 'storageWrite', id, key, text }));
  }

  async remove(key: string): Promise<void> {
    await this.request((id) => ({ type: 'storageRemove', id, key }));
  }

  private request(build: (id: number) => Parameters<HostConnection['send']>[0]): Promise<string | null> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The extension did not answer a storage request in time'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.host.send(build(id));
    });
  }
}

/**
 * Saves into the browser's localStorage, for when the page runs outside VS Code (the Vite preview, or a
 * standalone build one day). Falls back to memory if the browser refuses storage.
 */
export class LocalStorageBackend implements StorageBackend {
  private readonly fallback = new MemoryBackend();
  private readonly prefix = 'developer-farm:';

  async read(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(this.prefix + key);
    } catch {
      return this.fallback.read(key);
    }
  }

  async write(key: string, text: string): Promise<void> {
    try {
      window.localStorage.setItem(this.prefix + key, text);
    } catch {
      await this.fallback.write(key, text);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch {
      await this.fallback.remove(key);
    }
  }
}
