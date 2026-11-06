import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AudioSettings } from '../engine/audio/types';
import { DEFAULT_AUDIO_SETTINGS } from '../engine/audio/types';
import type { ZoomPreference } from '../rendering/viewport';

/** What the HUD shows. The game and the platform write it; React only reads it. */

export interface DialogOptionView {
  readonly label: string;
  readonly enabled: boolean;
}

/** Who is speaking in a dialog: a villager's portrait and how much they like the player. */
export interface SpeakerView {
  readonly name: string;
  readonly role: string;
  /** Atlas frame of the portrait. */
  readonly portrait: string;
  /** Hearts earned, 0 to 10. */
  readonly hearts: number;
}

export interface DialogView {
  readonly title: string;
  readonly speaker: SpeakerView | undefined;
  readonly text: string;
  readonly page: number;
  readonly pages: number;
  /** Choices, shown on the last page. Empty for a plain message. */
  readonly options: readonly DialogOptionView[];
  readonly selected: number;
  /** What just happened ("Bought 5 Radish seeds"). */
  readonly note: string | undefined;
}

/** One hotbar slot as the HUD draws it. */
export interface SlotView {
  readonly empty: boolean;
  readonly name: string;
  readonly description: string;
  /** Atlas frame of the icon. */
  readonly icon: string | undefined;
  readonly count: number;
  readonly quality: number;
  /** For the watering can: how full it is, 0 to 1. */
  readonly meter: number | undefined;
}

/** One quest as the journal shows it. */
export interface QuestView {
  readonly id: string;
  readonly title: string;
  readonly giver: string;
  readonly summary: string;
  readonly status: 'active' | 'ready' | 'done';
  readonly objectives: readonly { readonly text: string; readonly done: boolean }[];
  readonly reward: string;
}

/** One fish or mineral on the collection page. `count` is 0 for one the player has not found yet. */
export interface CollectionEntry {
  readonly id: string;
  readonly name: string;
  /** Atlas frame of the icon. */
  readonly icon: string;
  readonly count: number;
  readonly description: string;
  /** Given to the museum, and on show there. */
  readonly onDisplay: boolean;
}

/** What the player has caught and dug up, and how deep the old mine has been explored. */
export interface CollectionView {
  readonly fish: readonly CollectionEntry[];
  readonly minerals: readonly CollectionEntry[];
  readonly artifacts: readonly CollectionEntry[];
  /** How much of the museum is filled, if the world has a museum. */
  readonly museum: { readonly have: number; readonly total: number } | undefined;
  readonly deepest: number;
  readonly floors: number;
}

/** The morning report. */
export interface SummaryView {
  readonly date: string;
  readonly cause: 'slept' | 'exhausted';
  readonly earned: number;
  readonly shipped: readonly { readonly name: string; readonly count: number; readonly quality: number; readonly total: number }[];
  readonly grown: number;
  readonly withered: number;
  readonly ripe: number;
  readonly eggs: number;
  readonly readyQuests: readonly string[];
  /** Buildings the carpenter finished overnight. */
  readonly built: readonly string[];
  /** Today's weather and the forecast for tomorrow, by name ("Rain"). */
  readonly weather: string;
  /** `weather` as an icon key ("rain"). */
  readonly weatherKey: string;
  readonly forecast: string;
  /** The festival held today, if any. */
  readonly festival: string | undefined;
  /** A festival prize the player earned but never asked for, brought round in the night. */
  readonly festivalPrize: string | undefined;
}

/** One rare creature on the bestiary page. Until it has been seen the page shows only a question mark. */
export interface CreatureEntry {
  readonly id: string;
  readonly name: string;
  /** Atlas frame of its picture. */
  readonly frame: string;
  readonly seen: boolean;
  readonly friend: boolean;
  /** Only filled in once it has been seen. */
  readonly description: string;
  /** Where and when it is about ("Marlow fen · summer · 7:00 am to 12:00 pm · fine weather"), once seen. */
  readonly habitat: string;
  /** What it likes, by name, once seen. */
  readonly likes: readonly string[];
  /** What it leaves a friend, once it has befriended the player. */
  readonly keepsake: string;
}

export interface BestiaryView {
  readonly entries: readonly CreatureEntry[];
  readonly seen: number;
  readonly friends: number;
}

/** The weather as the HUD shows it: today's, and tomorrow's forecast. `key` names the icon (`icon/weather_<key>`). */
export interface WeatherView {
  readonly key: string;
  readonly name: string;
  readonly forecastKey: string;
  readonly forecastName: string;
}

/** One square of the calendar page. */
export interface CalendarDay {
  /** Day of the season, 1 to 28. */
  readonly day: number;
  /** The weekday column, 0 (Monday) to 6 (Sunday). */
  readonly weekday: number;
  readonly marks: readonly { readonly kind: 'festival' | 'birthday'; readonly label: string }[];
  /** The merchant comes on this day. */
  readonly market: boolean;
}

/** The calendar page of the journal: this season laid out in weeks, and what is coming up next. */
export interface CalendarView {
  readonly season: string;
  /** The game's own year, counted from 1. */
  readonly year: number;
  /** Day of the season today is, 1 to 28. */
  readonly today: number;
  readonly days: readonly CalendarDay[];
  readonly upcoming: readonly { readonly when: string; readonly inDays: number; readonly kind: 'festival' | 'birthday'; readonly label: string }[];
}

export interface HintView {
  readonly text: string;
  readonly tone: 'info' | 'warn';
  /** Changes for every hint, so the same words twice in a row still replay the animation. */
  readonly key: number;
}

export interface PromptView {
  readonly verb: string;
  readonly name: string;
}

export type SaveStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: number }
  | { readonly kind: 'failed' };

export interface DebugInfo {
  readonly fps: number;
  readonly zoom: number;
  readonly pixelRatio: number;
  readonly backend: string;
  readonly visibleChunks: number;
  readonly builtChunks: number;
  readonly visibleObjects: number;
  readonly x: number;
  readonly y: number;
  readonly tileX: number;
  readonly tileY: number;
  readonly facing: string;
  readonly map: string;
  readonly playTime: string;
}

export interface UiState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | undefined;
  readonly locationName: string;
  readonly regionName: string;
  /** Changes every time the location banner should appear again. */
  readonly bannerKey: number;
  readonly prompt: PromptView | undefined;
  readonly dialog: DialogView | undefined;
  readonly menuOpen: boolean;
  readonly journalOpen: boolean;
  /** Quests being worked on or waiting for a report, then finished ones. */
  readonly quests: readonly QuestView[];
  readonly collection: CollectionView | undefined;
  readonly calendar: CalendarView | undefined;
  readonly bestiary: BestiaryView | undefined;
  /** Today's weather and tomorrow's forecast. */
  readonly weather: WeatherView | undefined;
  /** What to tell the player about today's festival ("The Egg Hunt · 3 of 8 painted eggs"), or an empty string on an ordinary day. */
  readonly festivalNote: string;
  readonly hudVisible: boolean;
  /** The player's volumes and mute. */
  readonly audio: AudioSettings;
  /** Accessibility choices (they also set classes on the page: see `df-large-text` and `df-high-contrast` in the styles). */
  readonly textSize: 'normal' | 'large';
  readonly highContrast: boolean;
  readonly motion: 'system' | 'reduced' | 'full';
  readonly hintsVisible: boolean;
  readonly debugVisible: boolean;
  readonly focusLost: boolean;
  readonly saveStatus: SaveStatus;
  /** A message the player should read (a recovered save, for example). */
  readonly notice: string | undefined;
  readonly zoomLevel: number;
  readonly zoomPreference: ZoomPreference;
  readonly debug: DebugInfo | undefined;
  readonly hotbar: readonly SlotView[];
  readonly selectedSlot: number;
  readonly money: number;
  /** "6:20 am" */
  readonly timeLabel: string;
  /** "Spring 3" */
  readonly dateLabel: string;
  readonly weekday: string;
  readonly season: string;
  readonly hint: HintView | undefined;
  readonly summary: SummaryView | undefined;
  /** Changes whenever a night has passed, to replay the fade from black. */
  readonly fadeKey: number;
  /** Changes whenever the player walks onto another map, to replay a quick fade. */
  readonly travelKey: number;
  /** Short key names for the controls, taken from the active keymap. */
  readonly keys: Readonly<Record<string, string>>;
}

export const INITIAL_UI_STATE: UiState = {
  status: 'loading',
  error: undefined,
  locationName: '',
  regionName: '',
  bannerKey: 0,
  prompt: undefined,
  dialog: undefined,
  menuOpen: false,
  journalOpen: false,
  quests: [],
  collection: undefined,
  calendar: undefined,
  bestiary: undefined,
  weather: undefined,
  festivalNote: '',
  hudVisible: true,
  audio: DEFAULT_AUDIO_SETTINGS,
  textSize: 'normal',
  highContrast: false,
  motion: 'system',
  hintsVisible: false,
  debugVisible: false,
  focusLost: false,
  saveStatus: { kind: 'idle' },
  notice: undefined,
  zoomLevel: 3,
  zoomPreference: 'auto',
  debug: undefined,
  hotbar: [],
  selectedSlot: 0,
  money: 0,
  timeLabel: '',
  dateLabel: '',
  weekday: '',
  season: 'spring',
  hint: undefined,
  summary: undefined,
  fadeKey: 0,
  travelKey: 0,
  keys: {},
};

type Listener = () => void;

/** A tiny observable store, read in React through `useSyncExternalStore`, so a change re-renders only what uses it. */
export class UiStore {
  private state: UiState = INITIAL_UI_STATE;
  private readonly listeners = new Set<Listener>();

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getState = (): UiState => this.state;

  set(patch: Partial<UiState>): void {
    // Skip the update entirely when nothing changed, so a per-frame caller costs nothing.
    let changed = false;
    for (const key of Object.keys(patch) as (keyof UiState)[]) {
      if (!Object.is(this.state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }
}

/** The things the HUD can ask the game to do. */
export interface UiActions {
  resume(): void;
  openMenu(): void;
  saveGame(): void;
  setZoom(preference: ZoomPreference): void;
  toggleHud(): void;
  showHints(): void;
  dismissHints(): void;
  focusGame(): void;
  advanceDialog(): void;
  dismissNotice(): void;
  selectSlot(index: number): void;
  chooseOption(index: number): void;
  dismissSummary(): void;
  openJournal(): void;
  closeJournal(): void;
  /** Changes the volumes or the mute. */
  setAudio(patch: Partial<AudioSettings>): void;
  setAccessibility(patch: Partial<Pick<UiState, 'textSize' | 'highContrast' | 'motion'>>): void;
}

export interface UiContextValue {
  readonly store: UiStore;
  readonly actions: UiActions;
}

export const UiContext = createContext<UiContextValue | undefined>(undefined);

function useUiContext(): UiContextValue {
  const value = useContext(UiContext);
  if (value === undefined) throw new Error('UI used outside <UiContext.Provider>');
  return value;
}

/** Reads one slice of the UI state. Pick primitives or stable references so unrelated changes do not re-render. */
export function useUi<T>(selector: (state: UiState) => T): T {
  const { store } = useUiContext();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useUiActions(): UiActions {
  return useUiContext().actions;
}
