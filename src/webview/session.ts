import atlasImageUrl from '../assets/generated/world.png?url';
import atlasManifest from '../assets/generated/world.json';
import { CONTENT } from '../data/content';
import { Game, type DaySummary } from '../engine/game';
import { DEFAULT_KEYMAP, InputState, type Action } from '../engine/input/actions';
import { sanitizeAudioSettings, soundForEffect } from '../engine/audio/audio';
import type { AudioSettings } from '../engine/audio/types';
import { PreferencesStore, type Preferences } from '../engine/persistence/preferences';
import { SaveManager, type LoadOutcome } from '../engine/persistence/saveManager';
import type { StorageBackend } from '../engine/persistence/storage';
import { TILE_SIZE } from '../engine/math/coords';
import { validateContent } from '../engine/world/validate';
import { World } from '../engine/world/world';
import { Atlas, type AtlasManifest } from '../rendering/atlas';
import { rendererFrames } from '../rendering/frameNames';
import { GameRenderer } from '../rendering/gameRenderer';
import { stepZoom, type ZoomPreference } from '../rendering/viewport';
import type { HostToWebviewMessage, InitPayload, TestState } from '../shared/messages';
import { hudKeyLabels } from '../ui/keyLabels';
import { formatClock } from '../engine/time/clock';
import { dayOfSeason, weekdayOf, yearOf } from '../engine/time/calendar';
import { seasonAgenda, upcoming } from '../engine/time/agenda';
import { WEATHER_NAMES } from '../engine/weather/weather';
import { CAN_CAPACITY } from '../engine/farming/tools';
import { describeQuest, type QuestNames } from '../engine/quests/describe';
import { characterFrame } from '../engine/world/frames';
import { MINE_FLOORS } from '../engine/mine/surface';
import { habitatLine } from '../engine/creatures/habitat';
import { UiStore, type CalendarView, type CollectionEntry, type CreatureEntry, type QuestView, type SlotView, type SummaryView, type UiActions } from '../ui/store';
import { AudioEngine } from './audio/engine';
import type { HostConnection } from './host';
import { attachKeyboard } from './keyboard';
import { HostStorageBackend, LocalStorageBackend } from './storage';

export interface SessionOptions {
  readonly host: HostConnection;
  /** The element the game's canvas goes into. */
  readonly gameElement: HTMLElement;
}

export interface Session {
  readonly store: UiStore;
  readonly actions: UiActions;
  /** Resolves when the game is on screen, rejects if it could not start (the store shows the reason). */
  readonly ready: Promise<void>;
  /** Development builds only: the running game and renderer, for poking at from the console. Always undefined in a packaged build. */
  debug(): { readonly game: Game; readonly renderer: GameRenderer } | undefined;
  dispose(): void;
}

/** How often the game saves by itself, while it is running. */
const AUTOSAVE_MS = 30_000;
/** How long to wait for the extension host's greeting before carrying on without it (a plain browser never sends one). */
const HANDSHAKE_MS = 4_000;

const formatDuration = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Starts the game and connects it to everything around it: the keyboard, the renderer, the saved files
 * and the HUD. All the game's rules live in the engine; this is the platform glue.
 */
export function createSession(options: SessionOptions): Session {
  const { host, gameElement } = options;
  const store = new UiStore();
  const disposers: (() => void)[] = [];
  let disposed = false;

  // Filled in once loading finishes. The actions below are safe to call before that: they do nothing.
  let running: RunningGame | undefined;

  const actions: UiActions = {
    resume: () => running?.closeMenu(),
    openMenu: () => running?.openMenu(),
    saveGame: () => running?.saveManually(),
    setZoom: (preference) => running?.setZoom(preference),
    setAudio: (patch) => running?.setAudio(patch),
    setAccessibility: (patch) => running?.setAccessibility(patch),
    toggleHud: () => running?.toggleHud(),
    showHints: () => running?.setHints(true),
    dismissHints: () => running?.setHints(false),
    focusGame: () => running?.focusGame(),
    advanceDialog: () => running?.tapInteract(),
    dismissNotice: () => store.set({ notice: undefined }),
    selectSlot: (index) => running?.selectSlot(index),
    chooseOption: (index) => running?.chooseOption(index),
    dismissSummary: () => running?.dismissSummary(),
    openJournal: () => running?.openJournal(),
    closeJournal: () => running?.closeJournal(),
  };

  const ready = (async () => {
    try {
      const init = await handshake(host);
      const backend: StorageBackend = host.kind === 'vscode' ? new HostStorageBackend(host) : new LocalStorageBackend();
      const game = await RunningGame.start({ host, gameElement, store, backend, init, onDispose: (fn) => disposers.push(fn) });
      if (disposed) {
        game.dispose();
        return;
      }
      running = game;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.set({ status: 'error', error: message });
      host.send({ type: 'error', message: `Startup failed: ${message}` });
      throw error;
    }
  })();
  // The rejection is already shown on screen; keep it from also being reported as unhandled.
  ready.catch(() => undefined);

  return {
    store,
    actions,
    ready,
    debug: () => (import.meta.env.DEV ? running?.internals() : undefined),
    dispose: () => {
      disposed = true;
      running?.dispose();
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}

/** Says hello to the extension host and waits for its answer. Resolves with undefined outside VS Code. */
function handshake(host: HostConnection): Promise<InitPayload | undefined> {
  if (host.kind !== 'vscode') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      off();
      resolve(undefined);
    }, HANDSHAKE_MS);
    const off = host.onMessage((message) => {
      if (message.type !== 'init') return;
      clearTimeout(timer);
      off();
      resolve(message.payload);
    });
    host.send({ type: 'ready' });
  });
}

interface StartArguments {
  readonly host: HostConnection;
  readonly gameElement: HTMLElement;
  readonly store: UiStore;
  readonly backend: StorageBackend;
  readonly init: InitPayload | undefined;
  readonly onDispose: (dispose: () => void) => void;
}

/** A loaded, running game with its renderer, saves and input. */
class RunningGame {
  private manualSavePending = false;
  private saveCount = 0;
  private readonly timers: ReturnType<typeof setInterval>[] = [];
  private readonly offs: (() => void)[] = [];

  private hintCounter = 0;
  /** The quest log version the HUD last copied. */
  private questVersion = -1;
  private collectionKey = '';
  private calendarDay = -1;
  private bestiaryVersion = -1;

  private constructor(
    private readonly host: HostConnection,
    private readonly gameElement: HTMLElement,
    private readonly store: UiStore,
    private readonly game: Game,
    private readonly renderer: GameRenderer,
    private readonly saves: SaveManager,
    private readonly prefs: PreferencesStore,
    private readonly audio: AudioEngine,
  ) {}

  static async start({ host, gameElement, store, backend, init, onDispose }: StartArguments): Promise<RunningGame> {
    const errors: string[] = [];
    const prefs = new PreferencesStore(backend, (message, error) => errors.push(`${message}: ${String(error)}`));
    const preferences = await prefs.load();

    // Filled in just below; the save manager's callbacks need it before the game exists.
    const saveHooks: { onSaved: (at: Date) => void; onError: (message: string, error?: unknown) => void } = {
      onSaved: () => undefined,
      onError: () => undefined,
    };
    const saves = new SaveManager(backend, {
      onSaved: (at) => saveHooks.onSaved(at),
      onError: (message, error) => saveHooks.onError(message, error),
    });
    const outcome = await saves.load();

    // Content is checked every start: a broken content pack should fail loudly here, not half-work in the world.
    const problems = validateContent(CONTENT, new Set([...Object.keys((atlasManifest as AtlasManifest).frames)]));
    const missing = rendererFrames().filter((frame) => !(frame in (atlasManifest as AtlasManifest).frames));
    if (problems.length > 0 || missing.length > 0) {
      throw new Error([...problems.map((p) => `${p.where}: ${p.message}`), ...missing.map((m) => `atlas has no frame "${m}"`)].slice(0, 6).join('\n'));
    }

    const world = new World(CONTENT);
    const input = new InputState(DEFAULT_KEYMAP);
    const saved = outcome.kind === 'loaded' ? outcome.state : undefined;
    const game = new Game(world, input, saved);

    const atlas = await Atlas.load(atlasImageUrl, atlasManifest as AtlasManifest);
    const reducedMotion = wantsReducedMotion(preferences.motion);
    // All sound is made here from recipes, once the player has pressed a key or clicked (browsers do not allow it sooner).
    const audio = new AudioEngine(() => (typeof AudioContext === 'undefined' ? undefined : new AudioContext()), preferences.audio);
    const renderer = await GameRenderer.create({ host: gameElement, game, atlas, zoom: preferences.zoom, reducedMotion, onThunder: () => audio.play('thunder') });

    const running = new RunningGame(host, gameElement, store, game, renderer, saves, prefs, audio);
    saveHooks.onSaved = (at) => running.onSaved(at);
    saveHooks.onError = (message, error) => {
      host.send({ type: 'error', message: `${message}${error === undefined ? '' : `: ${String(error)}`}`.slice(0, 400) });
      store.set({ saveStatus: { kind: 'failed' } });
    };
    for (const message of errors) host.send({ type: 'error', message: message.slice(0, 400) });

    running.begin(preferences, outcome, init);
    onDispose(() => atlas.destroy());
    return running;
  }

  /** Brings everything to life once all the parts exist. */
  private begin(preferences: Preferences, outcome: LoadOutcome, init: InitPayload | undefined): void {
    const { game, store, host } = this;
    // A test window is rarely the focused one; pausing on blur would stop every test. Real players still get it.
    const pauseOnBlur = init?.testMode !== true;

    store.set({
      status: 'ready',
      hudVisible: preferences.hudVisible,
      audio: preferences.audio,
      textSize: preferences.textSize,
      highContrast: preferences.highContrast,
      motion: preferences.motion,
      hintsVisible: !preferences.hintsDismissed,
      zoomPreference: preferences.zoom,
      zoomLevel: this.renderer.zoomLevel,
      keys: hudKeyLabels(game.input.getKeymap()),
      locationName: game.map.name,
      regionName: game.regionName,
      bannerKey: 1,
      notice: noticeFor(outcome),
    });

    this.applyAccessibility(preferences);
    // "System" motion follows the computer's setting, also if it changes while the game is open.
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onSystemMotion = (): void => this.applyAccessibility(this.prefs.value);
    reducedQuery.addEventListener('change', onSystemMotion);
    this.offs.push(() => reducedQuery.removeEventListener('change', onSystemMotion));
    this.syncStatus();
    this.attachAudio();

    this.offs.push(
      game.events.on('promptChanged', (prompt) => {
        store.set({ prompt: prompt === undefined ? undefined : { verb: prompt.verb, name: prompt.name } });
      }),
      game.events.on('dialogChanged', (dialog) => {
        this.dialogSound(dialog);
        store.set({
          dialog:
            dialog === undefined
              ? undefined
              : {
                  title: dialog.title,
                  speaker:
                    dialog.speaker === undefined
                      ? undefined
                      : {
                          name: dialog.speaker.name,
                          role: dialog.speaker.role,
                          portrait: characterFrame(dialog.speaker.sprite, 'down', false, 0),
                          hearts: dialog.speaker.hearts,
                        },
                  text: dialog.lines[dialog.page] ?? '',
                  page: dialog.page,
                  pages: dialog.lines.length,
                  options: dialog.options.map((o) => ({ label: o.label, enabled: o.enabled })),
                  selected: dialog.selected,
                  note: dialog.note,
                },
        });
      }),
      game.events.on('statusChanged', () => this.syncStatus()),
      game.events.on('mapChanged', ({ map }) => {
        this.audio.play('door');
        store.set({ locationName: map.name, regionName: game.regionName, bannerKey: store.getState().bannerKey + 1, travelKey: store.getState().travelKey + 1 });
        this.autosave();
      }),
      game.events.on('hint', ({ text, tone }) => {
        this.hintCounter += 1;
        store.set({ hint: { text, tone, key: this.hintCounter } });
      }),
      game.events.on('daySummary', (summary) => {
        if (summary === undefined) {
          store.set({ summary: undefined });
          return;
        }
        store.set({ summary: summaryView(summary), fadeKey: store.getState().fadeKey + 1, prompt: undefined, hint: undefined });
        // A new day is a natural place to save.
        this.autosave();
      }),
      attachKeyboard({
        input: game.input,
        onUiAction: (action) => this.onUiAction(action),
        intercept: (action) => {
          // While the morning report is up, the interact key closes it.
          if (action === 'interact' && game.summary !== undefined) {
            this.dismissSummary();
            return true;
          }
          return false;
        },
        onFocusLost: () => {
          if (!pauseOnBlur) return;
          game.setPaused('blur', true);
          store.set({ focusLost: true });
          this.autosave();
        },
        onFocusGained: () => {
          game.setPaused('blur', false);
          store.set({ focusLost: false });
        },
        onHidden: (hidden) => {
          game.setPaused('hidden', hidden);
          if (hidden) this.autosave();
        },
      }),
    );

    this.attachPointer();

    // The window may open without focus (the tab was restored in the background).
    if (pauseOnBlur && !document.hasFocus()) {
      game.setPaused('blur', true);
      store.set({ focusLost: true });
    }

    this.timers.push(
      setInterval(() => this.autosave(), AUTOSAVE_MS),
      setInterval(() => this.refreshStatus(), 250),
      setInterval(() => this.updateAudio(), 100),
    );

    if (init?.testMode === true) this.offs.push(host.onMessage((message) => this.onTestMessage(message)));

    // One frame has been drawn by the time the next animation frame fires.
    requestAnimationFrame(() => {
      host.send({
        type: 'rendered',
        renderer: this.renderer.stats.backend,
        mapId: game.map.id,
        fontsLoaded: document.fonts.check('700 17px "Pixelify Sans"'),
      });
    });
  }

  // ------------------------------------------------------------------------------------------ actions

  private onUiAction(action: Action): void {
    const { game, store } = this;
    switch (action) {
      case 'menu':
        if (game.summary !== undefined) break; // the morning report comes first
        // Escape first closes whatever is open, and only then opens the menu.
        if (store.getState().menuOpen) this.closeMenu();
        else if (store.getState().journalOpen) this.closeJournal();
        else if (game.dialog !== undefined) game.closeDialog();
        else this.openMenu();
        break;
      case 'journal':
        if (store.getState().journalOpen) this.closeJournal();
        else this.openJournal();
        break;
      case 'zoomIn':
        this.setZoom(stepZoom(this.renderer.zoomLevel, 1) as ZoomChoice);
        break;
      case 'zoomOut':
        this.setZoom(stepZoom(this.renderer.zoomLevel, -1) as ZoomChoice);
        break;
      case 'toggleHud':
        this.toggleHud();
        break;
      case 'toggleDebug':
        store.set({ debugVisible: !store.getState().debugVisible });
        this.refreshStatus();
        break;
      default:
        break;
    }
  }

  /** Mouse and wheel become the same actions as the keys: click uses the item, the wheel changes it. */
  private attachPointer(): void {
    const { game, gameElement } = this;
    const onDown = (event: PointerEvent): void => {
      if (event.button === 0) game.input.press('Mouse0');
    };
    const onUp = (event: PointerEvent): void => {
      if (event.button === 0) game.input.release('Mouse0');
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const code = event.deltaY > 0 ? 'WheelDown' : 'WheelUp';
      game.input.press(code);
      game.input.release(code);
    };
    gameElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    gameElement.addEventListener('wheel', onWheel, { passive: false });
    this.offs.push(() => {
      gameElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      gameElement.removeEventListener('wheel', onWheel);
    });
  }

  /** Copies what the HUD shows (pockets, money, the clock) out of the game. Runs when the game says something changed. */
  private syncStatus(): void {
    const { game, store } = this;
    const hotbar: SlotView[] = game.inventory.slots.map((stack) => {
      const def = stack === null ? undefined : game.item(stack.id);
      if (stack === null || def === undefined) return { empty: true, name: '', description: '', icon: undefined, count: 0, quality: 0, meter: undefined };
      return {
        empty: false,
        name: def.name,
        description: def.description,
        icon: def.icon,
        count: stack.count,
        quality: stack.quality,
        meter: def.tool === 'watering_can' ? game.canWater / CAN_CAPACITY : undefined,
      };
    });
    store.set({
      hotbar,
      selectedSlot: game.inventory.selected,
      money: game.money,
      timeLabel: formatClock(game.clock.minutes),
      dateLabel: game.date,
      weekday: weekdayOf(game.clock.day),
      season: game.season,
    });
    this.syncQuests();
    this.syncCollection();
    this.syncSky();
    this.syncCalendar();
    this.syncBestiary();
  }

  /** The bestiary page: what has been seen and befriended. Rebuilt only when it changed. */
  private syncBestiary(): void {
    const { game, store } = this;
    const defs = game.world.index.content.creatures;
    if (defs.length === 0 || game.bestiary.version === this.bestiaryVersion) return;
    this.bestiaryVersion = game.bestiary.version;
    const entries: CreatureEntry[] = defs.map((def) => {
      const seen = game.bestiary.hasSeen(def.id);
      const friend = game.bestiary.isFriend(def.id);
      return {
        id: def.id,
        name: def.name,
        frame: `creature/${def.sprite}_0`,
        seen,
        friend,
        description: seen ? def.description : '',
        habitat: seen ? habitatLine(def, (id) => game.world.mapDef(id)?.name) : '',
        likes: seen ? def.likes.map((id) => game.item(id)?.name ?? id) : [],
        keepsake: friend ? `${def.keepsake.count} ${game.item(def.keepsake.item)?.name ?? def.keepsake.item}` : '',
      };
    });
    store.set({ bestiary: { entries, seen: game.bestiary.seenCount, friends: game.bestiary.friendCount } });
  }

  /** Today's weather, tomorrow's forecast, and what the day's festival (if any) is up to. */
  private syncSky(): void {
    const { game, store } = this;
    const weather = game.weather;
    const forecast = game.forecast;
    const shown = store.getState().weather;
    if (shown === undefined || shown.key !== weather || shown.forecastKey !== forecast) {
      store.set({ weather: { key: weather, name: WEATHER_NAMES[weather], forecastKey: forecast, forecastName: WEATHER_NAMES[forecast] } });
    }
    store.set({ festivalNote: this.festivalNote() });
  }

  private festivalNote(): string {
    const { game } = this;
    const festival = game.festivalToday;
    if (festival === undefined) return '';
    const minutes = game.clock.minutes;
    if (minutes < festival.from) return `${festival.name} · opens at ${formatClock(festival.from)}`;
    if (minutes >= festival.to) return `${festival.name} · over for today`;
    return `${festival.name} · ${game.festivalStatus()?.line ?? ''}`;
  }

  /** This season laid out in weeks, with the festivals, birthdays and market days marked: rebuilt once a day. */
  private syncCalendar(): void {
    const { game, store } = this;
    if (this.calendarDay === game.clock.day) return;
    this.calendarDay = game.clock.day;
    const { festivals, npcs } = game.world.index.content;
    const agenda = seasonAgenda(game.season, festivals, npcs);
    const marketWeekdays = new Set(npcs.flatMap((n) => n.schedule.flatMap((e) => (e.serves !== undefined && e.days !== undefined ? e.days : []))));
    const days: CalendarView['days'] = Array.from({ length: 28 }, (_, i) => ({
      day: i + 1,
      weekday: i % 7,
      marks: agenda.filter((e) => e.day === i + 1).map((e) => ({ kind: e.kind, label: e.label })),
      market: marketWeekdays.has(i % 7),
    }));
    store.set({ calendar: { season: game.season, year: yearOf(game.clock.day), today: dayOfSeason(game.clock.day), days, upcoming: upcoming(game.clock.day, festivals, npcs, 4) } });
  }

  private questNames(): QuestNames {
    const { index } = this.game.world;
    return {
      item: (id) => index.itemById.get(id)?.name,
      npc: (id) => index.npcById.get(id)?.name,
      map: (id) => this.game.world.mapDef(id)?.name,
      animal: (kind) => index.animalById.get(kind)?.name,
      building: (id) => index.buildingById.get(id)?.name,
    };
  }

  /** Copies what has been caught and dug up into the HUD, when it changed. */
  private syncCollection(): void {
    const { game, store } = this;
    const key = `${game.mineDeepest}|${game.museum?.version ?? 0}|${Object.entries(game.collection).map(([id, n]) => `${id}:${n}`).join(',')}`;
    if (key === this.collectionKey) return;
    this.collectionKey = key;
    const entry = (id: string): CollectionEntry | undefined => {
      const def = game.item(id);
      return def === undefined ? undefined : { id, name: def.name, icon: def.icon, count: game.collection[id] ?? 0, description: def.description, onDisplay: game.museum?.has(id) === true };
    };
    const { content } = game.world.index;
    const fish = [...new Set(content.fish.map((f) => f.item))].flatMap((id) => entry(id) ?? []);
    const minerals = content.items.filter((i) => i.kind === 'mineral').flatMap((i) => entry(i.id) ?? []);
    const artifacts = content.items.filter((i) => i.kind === 'artifact').flatMap((i) => entry(i.id) ?? []);
    const museum = game.museum === undefined ? undefined : { have: game.museum.count, total: game.museum.def.slots.length };
    store.set({ collection: { fish, minerals, artifacts, museum, deepest: game.mineDeepest, floors: MINE_FLOORS } });
  }

  /** Copies the quest log into the HUD, when it changed. */
  private syncQuests(): void {
    const { game, store } = this;
    if (game.quests.version === this.questVersion) return;
    this.questVersion = game.quests.version;
    const names = this.questNames();
    const view = (def: Parameters<typeof describeQuest>[0], status: QuestView['status']): QuestView =>
      describeQuest(def, status, game.quests.progress(def.id), names);
    store.set({
      quests: [
        ...game.quests.open().map((def) => view(def, game.quests.status(def.id) === 'ready' ? 'ready' : 'active')),
        ...game.quests.finished().map((def) => view(def, 'done')),
      ],
    });
  }

  selectSlot(index: number): void {
    this.game.selectSlot(index);
  }

  chooseOption(index: number): void {
    this.game.chooseOption(index);
  }

  dismissSummary(): void {
    this.game.dismissSummary();
    this.focusGame();
  }

  /** The journal pauses the game, like the menu. It opens from the menu too, and not over a dialog or the morning report. */
  openJournal(): void {
    const { game, store } = this;
    if (game.summary !== undefined || game.dialog !== undefined || store.getState().journalOpen) return;
    this.audio.play('ui_open');
    if (store.getState().menuOpen) this.closeMenu();
    this.syncQuests();
    game.setPaused('journal', true);
    store.set({ journalOpen: true });
  }

  closeJournal(): void {
    if (!this.store.getState().journalOpen) return;
    this.audio.play('ui_close');
    this.game.setPaused('journal', false);
    this.store.set({ journalOpen: false });
    this.focusGame();
  }

  openMenu(): void {
    this.audio.play('ui_open');
    if (this.store.getState().journalOpen) this.closeJournal();
    this.game.closeDialog();
    this.game.setPaused('menu', true);
    this.store.set({ menuOpen: true });
    this.autosave();
  }

  closeMenu(): void {
    this.audio.play('ui_close');
    this.game.setPaused('menu', false);
    this.store.set({ menuOpen: false });
    this.focusGame();
  }

  /** The player clicked to carry on. That is a clear "resume", whatever the browser says about focus. */
  focusGame(): void {
    window.focus();
    this.game.setPaused('blur', false);
    this.store.set({ focusLost: false });
  }

  setZoom(preference: ZoomPreference): void {
    this.prefs.update({ zoom: preference });
    this.renderer.setZoom(preference);
    this.store.set({ zoomPreference: preference, zoomLevel: this.renderer.zoomLevel });
  }

  toggleHud(): void {
    const hudVisible = !this.store.getState().hudVisible;
    this.prefs.update({ hudVisible });
    this.store.set({ hudVisible });
  }

  // ------------------------------------------------------------------------------------------ sound and accessibility

  private dialogWasOpen = false;
  private lastAudioTick = performance.now();
  private waterCell = '';
  private waterNear = false;

  /** Connects the game's sound requests to the audio engine, and unlocks it on the first key press or click. */
  private attachAudio(): void {
    const { game, audio } = this;
    const unlock = (): void => audio.unlock();
    // Kept for the whole session: `unlock` only creates the context the first time, and afterwards only wakes it if the browser put it
    // back to sleep (a first key that does not count as a gesture, like Escape, must not leave a keyboard player silent).
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    this.offs.push(
      () => window.removeEventListener('keydown', unlock),
      () => window.removeEventListener('pointerdown', unlock),
      game.events.on('sound', ({ id }) => audio.play(id)),
      game.events.on('effect', ({ kind }) => {
        const id = soundForEffect(kind);
        if (id !== undefined) audio.play(id);
      }),
    );
  }

  /** A tick when the message box opens or closes. (Moving the highlight, choosing and page turns are the game's own.) */
  private dialogSound(dialog: unknown): void {
    const open = dialog !== undefined;
    if (open && !this.dialogWasOpen) this.audio.play('ui_open');
    else if (!open && this.dialogWasOpen) this.audio.play('ui_close');
    this.dialogWasOpen = open;
  }

  /** Is there open water within a few cells of the player? (Cached for as long as the player stays in a cell.) */
  private nearWater(): boolean {
    const { game } = this;
    const x = Math.floor(game.player.x / TILE_SIZE);
    const y = Math.floor((game.player.y - 3) / TILE_SIZE);
    const key = `${game.map.id}:${x},${y}`;
    if (key === this.waterCell) return this.waterNear;
    this.waterCell = key;
    this.waterNear = false;
    for (let dy = -3; dy <= 3 && !this.waterNear; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (game.map.terrainAt(x + dx, y + dy)?.waterSource === true) {
          this.waterNear = true;
          break;
        }
      }
    }
    return this.waterNear;
  }

  /** Several times a second: the surroundings (for the background and the tune), a window that has lost focus, and the music's clock. */
  private updateAudio(): void {
    const { game, audio } = this;
    const now = performance.now();
    const dt = Math.min(1, (now - this.lastAudioTick) / 1000);
    this.lastAudioTick = now;
    // Only a window nobody is looking at is silent: a menu or the journal still has its background and its little clicks.
    audio.setPaused(game.pausedFor('blur') || game.pausedFor('hidden'));
    audio.setSurroundings({ ambient: game.map.ambient, weather: game.weather, season: game.season, minutes: game.clock.minutes, nearWater: this.nearWater() });
    audio.update(dt);
  }

  setAudio(patch: Partial<AudioSettings>): void {
    const next = sanitizeAudioSettings({ ...this.store.getState().audio, ...patch });
    this.prefs.update({ audio: next });
    this.store.set({ audio: next });
    this.audio.setSettings(next);
    // A sample, so a slider can be set by ear.
    if (patch.master !== undefined || patch.sfx !== undefined) this.audio.play('coin');
  }

  setAccessibility(patch: Partial<Pick<Preferences, 'textSize' | 'highContrast' | 'motion'>>): void {
    const next = this.prefs.update(patch);
    this.store.set({ textSize: next.textSize, highContrast: next.highContrast, motion: next.motion });
    this.applyAccessibility(next);
  }

  /** Puts the accessibility choices into effect: classes on the page (text size, contrast) and the renderer's motion setting. */
  private applyAccessibility(preferences: Preferences): void {
    const root = document.documentElement;
    root.classList.toggle('df-large-text', preferences.textSize === 'large');
    root.classList.toggle('df-high-contrast', preferences.highContrast);
    const calm = wantsReducedMotion(preferences.motion);
    root.classList.toggle('df-calm', calm); // the interface's own animations follow the same choice as the world's
    this.renderer.setReducedMotion(calm);
  }

  setHints(visible: boolean): void {
    this.prefs.update({ hintsDismissed: !visible });
    this.store.set({ hintsVisible: visible });
  }

  /** Clicking the message box does what the interact key does. */
  tapInteract(): void {
    this.game.input.press('KeyE');
    this.game.input.release('KeyE');
  }

  saveManually(): void {
    // A save from a newer version is protected: saving is switched off, and "Save game" must say so, not spin.
    if (this.saves.isLocked) {
      this.store.set({ notice: NEWER_VERSION_NOTICE });
      return;
    }
    this.manualSavePending = true;
    this.store.set({ saveStatus: { kind: 'saving' } });
    void this.saves.saveNow(this.game.toSaveState());
  }

  /** Saves quietly. The player only hears about it if it fails. */
  private autosave(): void {
    if (this.saves.isLocked) return;
    this.saves.save(this.game.toSaveState());
  }

  private onSaved(at: Date): void {
    this.saveCount += 1;
    if (this.manualSavePending) {
      this.manualSavePending = false;
      this.store.set({ saveStatus: { kind: 'saved', at: at.getTime() } });
    } else if (this.store.getState().saveStatus.kind === 'failed') {
      this.store.set({ saveStatus: { kind: 'idle' } });
    }
  }

  /** Runs a few times a second: things the HUD shows that change without an event. */
  private refreshStatus(): void {
    const { game, store, renderer } = this;
    store.set({ zoomLevel: renderer.zoomLevel });
    if (!store.getState().debugVisible) return;
    const stats = renderer.stats;
    store.set({
      debug: {
        ...stats,
        x: game.player.x,
        y: game.player.y,
        tileX: Math.floor(game.player.x / TILE_SIZE),
        tileY: Math.floor(game.player.y / TILE_SIZE),
        facing: game.player.facing,
        map: `${game.regionName} / ${game.map.name}`,
        playTime: formatDuration(game.playTimeMs),
      },
    });
  }

  // ------------------------------------------------------------------------------------------ tests

  /** Test builds only: lets an integration test drive and inspect the game from outside the webview. */
  private onTestMessage(message: HostToWebviewMessage): void {
    if (message.type === 'testKeys') {
      this.audio.unlock(); // a test key press stands in for the player's first real one
      for (const code of message.codes) this.game.input.press(code);
      setTimeout(() => {
        for (const code of message.codes) this.game.input.release(code);
      }, message.holdMs);
    } else if (message.type === 'testSave') {
      this.saveManually();
    } else if (message.type === 'testSleep') {
      this.game.endDay('slept');
    } else if (message.type === 'testDismiss') {
      this.dismissSummary();
    } else if (message.type === 'testProbe') {
      const { game } = this;
      const inventory: Record<string, number> = {};
      for (const slot of game.inventory.slots) if (slot !== null) inventory[slot.id] = (inventory[slot.id] ?? 0) + slot.count;
      const state: TestState = {
        mapId: game.map.id,
        x: game.player.x,
        y: game.player.y,
        facing: game.player.facing,
        playTimeMs: game.playTimeMs,
        paused: game.isPaused,
        dialog: game.dialog === undefined ? null : game.dialog.title,
        saveCount: this.saveCount,
        day: game.clock.day,
        money: game.money,
        summaryOpen: game.summary !== undefined,
        selected: game.inventory.selectedStack()?.id ?? null,
        inventory,
        soil: game.farm.soil.size,
        cropStages: [...game.farm.crops.values()].map((crop) => crop.stage),
        canWater: game.canWater,
        fishing: game.fishing?.phase ?? null,
        nodes: game.map.nodes.size,
        placed: game.map.extras.size,
        weather: game.weather,
        festival: game.festivalNow()?.id ?? null,
        festivalScore: game.festivalStatus()?.score ?? 0,
        eggsLeft: game.huntEggs.length,
        requestsDone: game.requestsToday().filter((r) => r.done).length,
        creatures: game.creaturesHere().length,
        creaturesSeen: game.bestiary.seenCount,
        creatureFriends: game.bestiary.friendCount,
        audioUnlocked: this.audio.unlocked,
      };
      this.host.send({ type: 'testState', id: message.id, state });
    }
  }

  internals(): { readonly game: Game; readonly renderer: GameRenderer } {
    return { game: this.game, renderer: this.renderer };
  }

  dispose(): void {
    for (const timer of this.timers.splice(0)) clearInterval(timer);
    for (const off of this.offs.splice(0)) off();
    this.autosave();
    void this.saves.flush();
    void this.prefs.flush();
    this.audio.dispose();
    this.renderer.destroy();
  }
}

type ZoomChoice = 1 | 2 | 3 | 4 | 5 | 6;

/** Whether to hold still: the player's own choice, or else the computer's reduced-motion setting. */
function wantsReducedMotion(motion: Preferences['motion']): boolean {
  return motion === 'reduced' || (motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const NEWER_VERSION_NOTICE =
  'This save was made by a newer version of Developer Farm. To protect it, this session will not save over it. Update the extension to continue that farm.';

/** The message to show when a save could not be used exactly as it was. */
function noticeFor(outcome: LoadOutcome): string | undefined {
  switch (outcome.kind) {
    case 'loaded':
      return outcome.source === 'backup'
        ? 'Your latest save was damaged, so the one before it was loaded. The damaged file was kept, not deleted.'
        : undefined;
    case 'unreadable':
      return 'Your saved game could not be read, so a new game was started. The damaged file was kept, not deleted.';
    case 'newer-version':
      return NEWER_VERSION_NOTICE;
    case 'empty':
      return undefined;
  }
}

function summaryView(summary: DaySummary): SummaryView {
  return {
    date: summary.date,
    cause: summary.cause,
    earned: summary.earned,
    shipped: summary.shipped.map((line) => ({ name: line.name, count: line.count, quality: line.quality, total: line.total })),
    grown: summary.grown,
    withered: summary.withered,
    ripe: summary.ripe,
    eggs: summary.eggs,
    readyQuests: summary.readyQuests,
    built: summary.built,
    weather: WEATHER_NAMES[summary.weather],
    weatherKey: summary.weather,
    forecast: WEATHER_NAMES[summary.forecast],
    festival: summary.festival,
    festivalPrize: summary.festivalPrize,
  };
}
