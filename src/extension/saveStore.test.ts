import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSaveStore } from './saveStore';

let directory: string;
let store: FileSaveStore;

beforeEach(() => {
  // A folder that does not exist yet, as on a first run.
  directory = path.join(mkdtempSync(path.join(tmpdir(), 'farm-saves-')), 'saves');
  store = new FileSaveStore(directory);
});

afterEach(() => {
  rmSync(path.dirname(directory), { recursive: true, force: true });
});

describe('FileSaveStore', () => {
  it('reads nothing where nothing was saved', async () => {
    expect(await store.read('slot-1')).toBeNull();
  });

  it('creates its folder, writes a file and reads it back', async () => {
    await store.write('slot-1', '{"hello":"world"}');
    expect(await store.read('slot-1')).toBe('{"hello":"world"}');
    expect(readFileSync(path.join(directory, 'slot-1.json'), 'utf8')).toBe('{"hello":"world"}');
  });

  it('replaces a save completely and leaves no temporary files behind', async () => {
    await store.write('slot-1', 'x'.repeat(5000));
    await store.write('slot-1', 'short');
    expect(await store.read('slot-1')).toBe('short');
    expect(readdirSync(directory)).toEqual(['slot-1.json']);
  });

  it('keeps unicode intact', async () => {
    await store.write('preferences', '{"name":"Café · 農場"}');
    expect(await store.read('preferences')).toBe('{"name":"Café · 農場"}');
  });

  it('removes a save, and does not mind removing one that is not there', async () => {
    await store.write('slot-1.backup', 'a');
    await store.remove('slot-1.backup');
    await store.remove('slot-1.backup');
    expect(await store.read('slot-1.backup')).toBeNull();
  });

  it('refuses keys that could point outside its folder', async () => {
    for (const key of ['../escape', '/etc/passwd', 'a/b', '..', '', 'A', '.hidden']) {
      await expect(store.write(key, 'x'), key).rejects.toThrow(/Invalid storage key/);
      await expect(store.read(key), key).rejects.toThrow(/Invalid storage key/);
    }
    expect(() => store.fileFor('../escape')).toThrow();
  });

  it('applies overlapping writes in the order they were asked for', async () => {
    const writes = Array.from({ length: 25 }, (_, i) => store.write('slot-1', `version ${i}`));
    await Promise.all(writes);
    expect(await store.read('slot-1')).toBe('version 24');
  });

  it('keeps working after an operation fails', async () => {
    await expect(store.write('Bad Key', 'x')).rejects.toThrow();
    await store.write('slot-1', 'fine');
    expect(await store.read('slot-1')).toBe('fine');
  });

  it('reads back a file that was put there by something else', async () => {
    await store.write('slot-1', 'first');
    writeFileSync(path.join(directory, 'slot-1.json'), 'edited by hand');
    expect(await store.read('slot-1')).toBe('edited by hand');
  });
});
