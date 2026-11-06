/**
 * Typed message protocol between the extension host and the webview.
 *
 * Imported by both sides, so it must stay free of `vscode` and DOM dependencies. Anything coming from the
 * webview is untrusted: the host must run it through `parseWebviewMessage` instead of casting.
 *
 * The host is deliberately thin. The game runs entirely in the webview; the host only keeps files for it
 * (see "Architecture" in GAME_DESIGN.md), so the protocol is: say hello, read/write/remove a stored value,
 * and report diagnostics.
 */
import { isValidStorageKey } from '../engine/persistence/storage';

/** Where the webview bundle was loaded from. */
export type AssetMode = 'dev' | 'prod';

/** Largest value the host will store for the webview (saves are small today; this is a safety net). */
export const MAX_STORED_BYTES = 8 * 1024 * 1024;

const MAX_TEXT_LENGTH = 400;

// ---------------------------------------------------------------- webview -> host

export type WebviewToHostMessage =
  /** The page loaded and is waiting for `init`. */
  | { readonly type: 'ready' }
  /** The game drew its first frame. `renderer` names the graphics backend that was used. */
  | { readonly type: 'rendered'; readonly renderer: string; readonly mapId: string; readonly fontsLoaded: boolean }
  /** Asks for a stored value. The host answers with a `storageResult` carrying the same `id`. */
  | { readonly type: 'storageRead'; readonly id: number; readonly key: string }
  | { readonly type: 'storageWrite'; readonly id: number; readonly key: string; readonly text: string }
  | { readonly type: 'storageRemove'; readonly id: number; readonly key: string }
  /** The browser blocked something because of the Content Security Policy. */
  | { readonly type: 'cspViolation'; readonly directive: string; readonly blockedUri: string }
  /** An uncaught error or unhandled promise rejection inside the webview. */
  | { readonly type: 'error'; readonly message: string }
  /** Test builds only: the game's state, in answer to a `testProbe`. */
  | { readonly type: 'testState'; readonly id: number; readonly state: TestState };

/** What an integration test can learn about the running game. */
export interface TestState {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly facing: string;
  readonly playTimeMs: number;
  readonly paused: boolean;
  readonly dialog: string | null;
  readonly saveCount: number;
  readonly day: number;
  readonly money: number;
  /** The morning report is showing. */
  readonly summaryOpen: boolean;
  /** The item in the selected slot, or null. */
  readonly selected: string | null;
  /** Total of each item the player holds. */
  readonly inventory: Readonly<Record<string, number>>;
  readonly soil: number;
  /** Stages of the crops in the ground, in no particular order. */
  readonly cropStages: readonly number[];
  readonly canWater: number;
  /** The phase of the fishing line in the water ("waiting", "bite", "reeling"), or null when not fishing. */
  readonly fishing: string | null;
  /** How many rocks and ore veins stand on the current map. */
  readonly nodes: number;
  /** How many objects (furniture, a building, scaffolding) were put on the current map after it was built. */
  readonly placed: number;
  /** Today's weather ("sun", "cloud", "rain", "storm", "snow"). */
  readonly weather: string;
  /** The festival that is open right now, or null. */
  readonly festival: string | null;
  /** How the player is doing at it (eggs found, fish caught, and so on). */
  readonly festivalScore: number;
  /** Painted eggs still hidden on this map. */
  readonly eggsLeft: number;
  /** Requests handed in at the notice board today. */
  readonly requestsDone: number;
  /** Rare creatures standing on the current map right now. */
  readonly creatures: number;
  /** Rare creatures seen so far, and the ones that are friends. */
  readonly creaturesSeen: number;
  readonly creatureFriends: number;
  /** The audio context has been created (after the first key press or click). */
  readonly audioUnlocked: boolean;
}

// ---------------------------------------------------------------- host -> webview

export interface InitPayload {
  readonly extensionVersion: string;
  readonly assetMode: AssetMode;
  /** True only in test builds: the webview then accepts `testKeys` and `testProbe`. */
  readonly testMode: boolean;
}

export type HostToWebviewMessage =
  | { readonly type: 'init'; readonly payload: InitPayload }
  /** The answer to a storage request. `text` is the stored value (null when absent) for reads. */
  | { readonly type: 'storageResult'; readonly id: number; readonly ok: boolean; readonly text: string | null; readonly error?: string }
  /** Test builds only: press and release keys as if the player typed them. */
  | { readonly type: 'testKeys'; readonly codes: readonly string[]; readonly holdMs: number }
  /** Test builds only: report the game state with `testState`. */
  | { readonly type: 'testProbe'; readonly id: number }
  /** Test builds only: save now, as if the player chose "Save game". */
  | { readonly type: 'testSave' }
  /** Test builds only: go to bed, as if the player chose it at the farmhouse door. */
  | { readonly type: 'testSleep' }
  /** Test builds only: close the morning report. */
  | { readonly type: 'testDismiss' };

// ---------------------------------------------------------------- validation

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = MAX_TEXT_LENGTH): value is string => typeof value === 'string' && value.length <= max;
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function parseTestState(value: unknown): TestState | undefined {
  if (!isRecord(value)) return undefined;
  const { mapId, x, y, facing, playTimeMs, paused, dialog, saveCount, day, money, summaryOpen, selected, inventory, soil, cropStages, canWater, fishing, nodes, placed, weather, festival, festivalScore, eggsLeft, requestsDone, creatures, creaturesSeen, creatureFriends, audioUnlocked } = value;
  if (!isString(mapId) || !isString(facing)) return undefined;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof playTimeMs !== 'number' || typeof saveCount !== 'number') return undefined;
  if (typeof day !== 'number' || typeof money !== 'number' || typeof soil !== 'number' || typeof canWater !== 'number') return undefined;
  if (typeof paused !== 'boolean' || typeof summaryOpen !== 'boolean') return undefined;
  if (dialog !== null && !isString(dialog)) return undefined;
  if (selected !== null && !isString(selected)) return undefined;
  if (!isRecord(inventory) || !Object.values(inventory).every((n) => typeof n === 'number')) return undefined;
  if (fishing !== null && !isString(fishing)) return undefined;
  if (typeof nodes !== 'number' || typeof placed !== 'number') return undefined;
  if (!isString(weather) || (festival !== null && !isString(festival))) return undefined;
  if (typeof festivalScore !== 'number' || typeof eggsLeft !== 'number' || typeof requestsDone !== 'number') return undefined;
  if (typeof creatures !== 'number' || typeof creaturesSeen !== 'number' || typeof creatureFriends !== 'number') return undefined;
  if (typeof audioUnlocked !== 'boolean') return undefined;
  if (!Array.isArray(cropStages) || !cropStages.every((n) => typeof n === 'number') || cropStages.length > 100_000) return undefined;
  return {
    mapId,
    x,
    y,
    facing,
    playTimeMs,
    paused,
    dialog: dialog as string | null,
    saveCount,
    day,
    money,
    summaryOpen,
    selected: selected as string | null,
    inventory: inventory as Record<string, number>,
    soil,
    cropStages: cropStages as number[],
    canWater,
    fishing: fishing as string | null,
    nodes,
    placed,
    weather,
    festival: festival as string | null,
    festivalScore,
    eggsLeft,
    requestsDone,
    creatures,
    creaturesSeen,
    creatureFriends,
    audioUnlocked,
  };
}

/** Validates a message from the webview. Returns undefined for anything that is not exactly a known message. */
export function parseWebviewMessage(raw: unknown): WebviewToHostMessage | undefined {
  if (!isRecord(raw)) return undefined;
  switch (raw['type']) {
    case 'ready':
      return { type: 'ready' };
    case 'rendered':
      return isString(raw['renderer']) && isString(raw['mapId']) && typeof raw['fontsLoaded'] === 'boolean'
        ? { type: 'rendered', renderer: raw['renderer'], mapId: raw['mapId'], fontsLoaded: raw['fontsLoaded'] }
        : undefined;
    case 'storageRead':
    case 'storageRemove':
      return isId(raw['id']) && isString(raw['key'], 64) && isValidStorageKey(raw['key'])
        ? { type: raw['type'], id: raw['id'], key: raw['key'] }
        : undefined;
    case 'storageWrite':
      return isId(raw['id']) && isString(raw['key'], 64) && isValidStorageKey(raw['key']) && isString(raw['text'], MAX_STORED_BYTES)
        ? { type: 'storageWrite', id: raw['id'], key: raw['key'], text: raw['text'] }
        : undefined;
    case 'cspViolation':
      return isString(raw['directive']) && isString(raw['blockedUri'])
        ? { type: 'cspViolation', directive: raw['directive'], blockedUri: raw['blockedUri'] }
        : undefined;
    case 'error':
      return isString(raw['message']) ? { type: 'error', message: raw['message'] } : undefined;
    case 'testState': {
      const state = parseTestState(raw['state']);
      return isId(raw['id']) && state !== undefined ? { type: 'testState', id: raw['id'], state } : undefined;
    }
    default:
      return undefined;
  }
}

/** Validates a message from the host. The webview trusts the host, but still checks the shape. */
export function parseHostMessage(raw: unknown): HostToWebviewMessage | undefined {
  if (!isRecord(raw)) return undefined;
  switch (raw['type']) {
    case 'init': {
      const p = raw['payload'];
      if (!isRecord(p) || !isString(p['extensionVersion']) || (p['assetMode'] !== 'dev' && p['assetMode'] !== 'prod') || typeof p['testMode'] !== 'boolean') return undefined;
      return { type: 'init', payload: { extensionVersion: p['extensionVersion'], assetMode: p['assetMode'], testMode: p['testMode'] } };
    }
    case 'storageResult': {
      const { id, ok, text, error } = raw;
      if (!isId(id) || typeof ok !== 'boolean') return undefined;
      if (text !== null && typeof text !== 'string') return undefined;
      return typeof error === 'string' ? { type: 'storageResult', id, ok, text, error } : { type: 'storageResult', id, ok, text };
    }
    case 'testKeys': {
      const { codes, holdMs } = raw;
      if (!Array.isArray(codes) || !codes.every((c) => isString(c, 32)) || typeof holdMs !== 'number' || holdMs < 0 || holdMs > 10_000) return undefined;
      return { type: 'testKeys', codes: codes as string[], holdMs };
    }
    case 'testProbe':
      return isId(raw['id']) ? { type: 'testProbe', id: raw['id'] } : undefined;
    case 'testSave':
      return { type: 'testSave' };
    case 'testSleep':
      return { type: 'testSleep' };
    case 'testDismiss':
      return { type: 'testDismiss' };
    default:
      return undefined;
  }
}
