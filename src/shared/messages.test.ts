import { describe, expect, it } from 'vitest';
import { MAX_STORED_BYTES, parseHostMessage, parseWebviewMessage } from './messages';

describe('webview -> host messages', () => {
  it('accepts well-formed messages', () => {
    expect(parseWebviewMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseWebviewMessage({ type: 'storageRead', id: 1, key: 'slot-1' })).toEqual({ type: 'storageRead', id: 1, key: 'slot-1' });
    expect(parseWebviewMessage({ type: 'storageWrite', id: 2, key: 'slot-1.backup', text: '{}' })).toMatchObject({ type: 'storageWrite', id: 2 });
    expect(parseWebviewMessage({ type: 'storageRemove', id: 3, key: 'preferences' })).toMatchObject({ type: 'storageRemove' });
    expect(parseWebviewMessage({ type: 'error', message: 'boom' })).toEqual({ type: 'error', message: 'boom' });
  });

  it('rejects anything that is not exactly a known message', () => {
    for (const bad of [null, undefined, 'ready', 42, [], {}, { type: 'nope' }, { type: 'storageRead' }, { type: 'storageRead', id: -1, key: 'a' }, { type: 'storageRead', id: 1.5, key: 'a' }]) {
      expect(parseWebviewMessage(bad)).toBeUndefined();
    }
  });

  it('refuses storage keys that could escape the save folder', () => {
    for (const key of ['../secrets', '/etc/passwd', 'a/b', 'a\\b', '..', '', 'A', '.x', 'x'.repeat(65), 'a\0b']) {
      expect(parseWebviewMessage({ type: 'storageWrite', id: 1, key, text: 'x' }), key).toBeUndefined();
      expect(parseWebviewMessage({ type: 'storageRead', id: 1, key }), key).toBeUndefined();
    }
  });

  it('refuses an oversized value and non-string values', () => {
    expect(parseWebviewMessage({ type: 'storageWrite', id: 1, key: 'slot-1', text: 'x'.repeat(MAX_STORED_BYTES + 1) })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'storageWrite', id: 1, key: 'slot-1', text: 5 })).toBeUndefined();
  });

  it('validates the test state report', () => {
    const state = { mapId: 'm', x: 1, y: 2, facing: 'up', playTimeMs: 3, paused: false, dialog: null, saveCount: 0, day: 1, money: 5, summaryOpen: false, selected: 'hoe', inventory: { hoe: 1 }, soil: 2, cropStages: [0, 1], canWater: 24, fishing: null, nodes: 0, placed: 0, weather: 'rain', festival: null, festivalScore: 0, eggsLeft: 0, requestsDone: 0, creatures: 0, creaturesSeen: 0, creatureFriends: 0, audioUnlocked: false };
    expect(parseWebviewMessage({ type: 'testState', id: 1, state })).toMatchObject({ type: 'testState' });
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, x: 'a' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, inventory: { hoe: 'one' } } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, cropStages: 'many' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, festival: 'egg_hunt', festivalScore: 3, eggsLeft: 5 } })).toMatchObject({ type: 'testState' });
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, weather: 3 } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, festival: 7 } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, eggsLeft: 'none' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, creatures: 1, creaturesSeen: 2, creatureFriends: 1 } })).toMatchObject({ type: 'testState' });
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, creaturesSeen: 'two' } })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, audioUnlocked: true } })).toMatchObject({ type: 'testState' });
    expect(parseWebviewMessage({ type: 'testState', id: 1, state: { ...state, audioUnlocked: 'yes' } })).toBeUndefined();
  });
});

describe('host -> webview messages', () => {
  it('accepts init, storage results and test commands', () => {
    expect(parseHostMessage({ type: 'init', payload: { extensionVersion: '0.1.0', assetMode: 'prod', testMode: false } })).toMatchObject({ type: 'init' });
    expect(parseHostMessage({ type: 'storageResult', id: 1, ok: true, text: null })).toEqual({ type: 'storageResult', id: 1, ok: true, text: null });
    expect(parseHostMessage({ type: 'storageResult', id: 1, ok: false, text: null, error: 'x' })).toMatchObject({ error: 'x' });
    expect(parseHostMessage({ type: 'testKeys', codes: ['KeyD'], holdMs: 500 })).toMatchObject({ type: 'testKeys' });
    expect(parseHostMessage({ type: 'testProbe', id: 4 })).toEqual({ type: 'testProbe', id: 4 });
    expect(parseHostMessage({ type: 'testSave' })).toEqual({ type: 'testSave' });
    expect(parseHostMessage({ type: 'testSleep' })).toEqual({ type: 'testSleep' });
    expect(parseHostMessage({ type: 'testDismiss' })).toEqual({ type: 'testDismiss' });
  });

  it('rejects malformed ones', () => {
    for (const bad of [null, {}, { type: 'init' }, { type: 'init', payload: { extensionVersion: 1 } }, { type: 'storageResult', id: 1, ok: 'yes', text: null }, { type: 'testKeys', codes: [1], holdMs: 5 }, { type: 'testKeys', codes: ['a'], holdMs: 99999 }]) {
      expect(parseHostMessage(bad)).toBeUndefined();
    }
  });
});
