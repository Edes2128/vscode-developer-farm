import { Camera } from './camera/camera';
import { Conversations, type ConversationHost } from './conversations';
import { Emitter } from './core/emitter';
import type { BuildingDef, BuildSite } from './buildings/types';
import { hash2 } from './core/random';
import { Bestiary } from './creatures/bestiary';
import type { CreaturePlacement } from './creatures/types';
import { stepSoundFor } from './audio/audio';
import type { SoundId } from './audio/types';
import { digSpots, pickArtifact } from './digging/digging';
import type { FestivalDef } from './festivals/types';
import { FixedStepLoop } from './core/fixedStep';
import { ShippingBin } from './economy/bin';
import { advanceFarm, completeHarvest, harvestStack, isRipe, MapFarm } from './farming/farm';
import { CAN_CAPACITY, failureMessage, planUse, type UseEffect } from './farming/tools';
import type { CropDef, FarmSave } from './farming/types';
import { GAMEPLAY_ACTIONS, SLOT_ACTIONS, type InputState } from './input/actions';
import {
  facingCell,
  isChoosing,
  moveSelection,
  nextPage,
  openDialog,
  type DialogState,
} from './interaction';
import { biting } from './fishing/rules';
import { FishingSession, type FishingPhase } from './fishing/session';
import { Inventory } from './inventory/inventory';
import { LivingWorld, type FestivalProgress, type LivingWorldHost } from './living/livingWorld';
import { canAddAll, takeItems } from './inventory/take';
import { Museum } from './museum/museum';
import { isGoods, QUALITY_NAMES, unitPrice, type ItemDef, type Quality } from './items/types';
import { clamp, TILE_SIZE, worldToTile, type Direction, type Vec2 } from './math/coords';
import type { GameSaveState, PlacedSave } from './persistence/saveFormat';
import { parseMineFloor } from './mine/surface';
import type { NodeDef } from './nodes/types';
import { createPlayerAt, playerBox, updatePlayer, walkFrame, type PlayerState } from './player/player';
import type { Request } from './requests/types';
import { QuestLog } from './quests/questLog';
import type { QuestEvent } from './quests/types';
import { Ranch, type Animal } from './ranch/ranch';
import type { RanchSave } from './ranch/types';
import { holds, type Facts } from './social/conditions';
import { heartsOf } from './social/friendship';
import { cellOf, Villagers, type MapAccess, type NpcState } from './social/villagers';
import { dateLabel, seasonOf, type Season } from './time/calendar';
import { watersFields } from './weather/weather';
import { Wildlife, type WildlifeHost } from './wildlife/wildlife';
import type { Weather } from './weather/types';
import { BEDTIME_MINUTE, WAKE_MINUTE, WorldClock } from './time/clock';
import type { GameMap, Interactable, PlacedObject } from './world/gameMap';
import type { World } from './world/world';

/** Why the simulation is stopped. It runs only while no reason is active. */
export type PauseReason = 'menu' | 'journal' | 'blur' | 'hidden' | 'summary';

/** What the player is looking at and could do with `E`: read a sign, talk, pet a hen, pick a ripe crop. */
export interface Prompt {
  readonly verb: string;
  readonly name: string;
  /** The cell it is on, where the arrow is drawn. */
  readonly x: number;
  readonly y: number;
}

/** The tool animation in progress: the effect lands partway through. */
export interface ToolSwing {
  readonly kind: 'hoe' | 'watering_can' | 'seed' | 'pickaxe' | 'fishing_rod';
  readonly cell: { readonly x: number; readonly y: number };
  readonly effect: UseEffect;
  /** The slot and item the swing started with, so the effect only lands on the same thing. */
  readonly slot: number;
  readonly itemId: string;
  elapsed: number;
  applied: boolean;
}

/** How long each swing lasts, and when in it the effect lands. */
/** How many bites a water gives in a day unless its zone says otherwise (two more in the rain). */
export const DEFAULT_FISH_STOCK = 5;

export const SWING_SECONDS = { hoe: 0.42, watering_can: 0.42, seed: 0.28, pickaxe: 0.5, fishing_rod: 0.45 } as const;
export const SWING_IMPACT = 0.45;

/** The cursor on the cell a tool or seed would act on, green when it would work. */
export interface UseCursor {
  readonly x: number;
  readonly y: number;
  readonly valid: boolean;
}

/** The morning report after a night. */
export interface DaySummary {
  /** The new day. */
  readonly day: number;
  readonly date: string;
  readonly cause: 'slept' | 'exhausted';
  readonly earned: number;
  readonly shipped: readonly { readonly name: string; readonly count: number; readonly quality: Quality; readonly total: number }[];
  readonly grown: number;
  readonly withered: number;
  readonly ripe: number;
  /** Eggs waiting in the coop's basket. */
  readonly eggs: number;
  /** Titles of quests that are ready to report. */
  readonly readyQuests: readonly string[];
  /** Names of buildings the carpenter finished overnight. */
  readonly built: readonly string[];
  /** Today's weather and tomorrow's. */
  readonly weather: Weather;
  readonly forecast: Weather;
  /** The festival held today, if any (its name). */
  readonly festival: string | undefined;
  /** A festival prize the player had earned but not collected, brought round in the night. */
  readonly festivalPrize: string | undefined;
}

export type EffectKind = 'till' | 'water' | 'plant' | 'harvest' | 'refill' | 'ship' | 'pet' | 'mine' | 'break' | 'splash' | 'dig' | 'place';

export interface GameEvents {
  /** What the player is facing and could use with `E` changed. */
  promptChanged: Prompt | undefined;
  /** A message box opened, turned a page, changed its options, or closed. */
  dialogChanged: DialogState | undefined;
  /** The simulation stopped or resumed. */
  pausedChanged: boolean;
  /** Pockets, money, quests or the clock changed in a way the HUD shows. */
  statusChanged: undefined;
  /** A short line for the player: what was gained, or why something did not work. */
  hint: { readonly text: string; readonly tone: 'info' | 'warn' };
  /** Something happened on a cell, for a little burst of particles. */
  effect: { readonly kind: EffectKind; readonly x: number; readonly y: number };
  /** A night passed (the report), or the report was dismissed (undefined). */
  daySummary: DaySummary | undefined;
  /** Something the player should hear: a footstep, a bite, a coin. The webview turns it into sound (src/webview/audio); nothing here makes any. */
  sound: { readonly id: SoundId };
  /** The player went to another map. */
  mapChanged: { readonly map: GameMap };
}

const opposite: Readonly<Record<Direction, Direction>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * The game: the one object that owns the running simulation. It has no idea how it is drawn, how
 * input reaches it, or where it is saved. The platform feeds it input and time, and reads state back.
 */
export class Game implements ConversationHost, LivingWorldHost, WildlifeHost {
  readonly events = new Emitter<GameEvents>();
  readonly camera = new Camera();
  readonly clock: WorldClock;
  readonly inventory: Inventory;
  readonly bin: ShippingBin;
  readonly villagers: Villagers;
  readonly quests: QuestLog;
  /** Things that have happened ("visited:willowbrook.village_green"). */
  readonly flags: Set<string>;

  map: GameMap;
  player: PlayerState;
  playTimeMs: number;
  money: number;
  /** Water left in the watering can. */
  canWater: number;
  prompt: Prompt | undefined;
  dialog: DialogState | undefined;
  swing: ToolSwing | undefined;
  /** The line in the water, while the player is fishing. */
  fishing: FishingSession | undefined;
  /** How many of each fish and mineral the player has caught or dug up (item id → count). */
  readonly collection: Record<string, number>;
  /** The deepest floor of the old mine reached. */
  mineDeepest: number;
  /** The village museum, if the content has one. */
  readonly museum: Museum | undefined;
  /** The rare creatures the player has seen and befriended. */
  readonly bestiary: Bestiary;
  /** Buildings the carpenter has finished (`BuildingDef.id`). */
  readonly built: Set<string>;
  /** What he is working on: the site, and the morning it is ready. */
  readonly pending: { site: string; readyDay: number }[];
  cursor: UseCursor | undefined;
  summary: DaySummary | undefined;

  /** Where the player was at the start of the last simulation step, for interpolating while rendering. */
  private previous: Vec2;
  private readonly loop: FixedStepLoop;
  private readonly pauseReasons = new Set<PauseReason>();
  private readonly farms = new Map<string, MapFarm>();
  /** Saved farms of maps not built yet (or no longer present): kept so nothing is lost. */
  private readonly farmSaves: Record<string, FarmSave>;
  private readonly ranches = new Map<string, Ranch>();
  private readonly ranchSaves: Record<string, RanchSave>;
  private readonly conversations: Conversations;
  private viewportReady = false;
  private target: Interactable | undefined;
  private facingNpc: NpcState | undefined;
  private facingAnimal: Animal | undefined;
  private facingCreature: CreaturePlacement | undefined;
  /** For footsteps: the last picture of the walk cycle that was drawn, and the money the HUD last saw (for the sound of a coin). */
  private lastStepFrame = -1;
  private lastMoney = -1;
  private statusKey = '';
  /** The weather, the festivals and the notice board. */
  private readonly living: LivingWorld;
  /** The rare creatures and the night's sprinklers. */
  private readonly wildlife: Wildlife;
  private facingFurniture: PlacedObject | undefined;
  /** The day the "used up today" records below belong to (0: none). */
  private spentDay = 0;
  /** Rocks broken and dig spots dug today, by map id (cells as `y * 1000 + x`): reloading the game must not bring them back. */
  private readonly spent = new Map<string, Set<number>>();
  /** Bites each water has given today (key: map id and water): the fish have had enough after a few. */
  private readonly fished = new Map<string, number>();
  /** The furniture the player has put down, by map id, for maps that are not built right now. */
  private readonly placedSaves: Record<string, PlacedSave[]>;
  /** Maps whose placed furniture, buildings and dig spots have been laid out (by id, with the instance they were laid out on). */
  private readonly prepared = new Map<string, GameMap>();
  /** Ids of the objects that furniture items place: the only placed objects that are saved as furniture. */
  private readonly furnitureObjects: ReadonlySet<string>;
  private fishingPhase: FishingPhase | undefined;
  /** Just arrived on a map: the exits are shut to the player until they let go of the movement keys, so a held key cannot carry them straight back. */
  private arrivalLock = false;
  /** Play time before which a "the way is closed" note is not repeated. */
  private closedNoticeAt = 0;

  constructor(
    readonly world: World,
    readonly input: InputState,
    saved?: GameSaveState,
  ) {
    const { content } = world.index;
    const mapId = saved !== undefined && world.hasMap(saved.mapId) ? saved.mapId : world.startMapId;
    this.map = world.map(mapId);
    this.playTimeMs = saved?.playTimeMs ?? 0;

    this.clock = new WorldClock(saved?.time);
    this.money = saved?.money ?? content.newGame.money;
    this.lastMoney = this.money;
    this.inventory = new Inventory((id) => this.item(id), saved?.inventory);
    if (saved === undefined) for (const stack of content.newGame.items) this.inventory.add({ id: stack.id, count: stack.count, quality: 0 });
    this.inventory.version = 0;
    this.canWater = saved === undefined ? CAN_CAPACITY : clamp(saved.inventory.canWater, 0, CAN_CAPACITY);
    this.bin = new ShippingBin(saved?.bin, (id) => this.item(id));
    this.farmSaves = { ...(saved?.farms ?? {}) };
    this.ranchSaves = { ...(saved?.ranches ?? {}) };

    this.furnitureObjects = new Set(content.items.flatMap((i) => (i.places === undefined ? [] : [i.places])));
    this.placedSaves = Object.fromEntries(Object.entries(saved?.placed ?? {}).map(([id, list]) => [id, [...list]]));
    this.museum = content.museum === undefined ? undefined : new Museum(content.museum, saved?.museum);
    this.bestiary = new Bestiary(content.creatures, saved?.bestiary);
    this.wildlife = new Wildlife(this);
    this.built = new Set((saved?.buildings.built ?? []).filter((id) => world.index.buildingById.has(id)));
    this.pending = (saved?.buildings.pending ?? []).filter((p) => content.maps.some((m) => (m.sites ?? []).some((site) => site.id === p.site))).map((p) => ({ ...p }));
    if (saved !== undefined && saved.spent.day === saved.time.day) {
      this.spentDay = saved.spent.day;
      for (const [id, cells] of Object.entries(saved.spent.cells)) this.spent.set(id, new Set(cells));
      for (const [id, count] of Object.entries(saved.spent.fished)) this.fished.set(id, count);
    }
    this.living = new LivingWorld(this, saved);
    this.collection = { ...(saved?.collection ?? {}) };
    this.mineDeepest = saved?.mine.deepest ?? 0;
    this.flags = new Set(saved?.flags ?? []);
    this.flags.add(`visited:${mapId}`);
    this.mineDeepest = Math.max(this.mineDeepest, parseMineFloor(mapId) ?? 0);
    this.quests = new QuestLog(content.quests, saved?.quests);

    const grids = new Map<string, { width: number; height: number; walkable(x: number, y: number): boolean }>();
    const maps: MapAccess = {
      grid: (id) => {
        let grid = grids.get(id);
        if (grid === undefined) {
          const map = world.map(id);
          grid = { width: map.width, height: map.height, walkable: (x, y) => map.isWalkable(x, y) };
          grids.set(id, grid);
        }
        return grid;
      },
      exits: (id) => world.mapDef(id)?.exits ?? [],
    };
    this.villagers = new Villagers(content.npcs, maps, saved?.npcs, this.clock.minutes, this.living.dayContext());
    this.conversations = new Conversations(this);

    // Lay out what has been put down and built, then find the player a place to stand (furniture may have taken it).
    this.prepare(this.map);
    this.player = this.restorePlayer(saved, mapId);
    this.previous = { x: this.player.x, y: this.player.y };

    this.loop = new FixedStepLoop((dt) => this.step(dt));
  }

  // ------------------------------------------------------------------------------------------ queries

  get isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  /** Is the game stopped for this particular reason (the window lost focus, a menu is open)? */
  pausedFor(reason: PauseReason): boolean {
    return this.pauseReasons.has(reason);
  }

  /** The region the current map belongs to, for the location banner. */
  get regionName(): string {
    return this.world.region(this.map.regionId)?.name ?? '';
  }

  get season(): Season {
    return seasonOf(this.clock.day);
  }

  get date(): string {
    return dateLabel(this.clock.day);
  }

  /** The worked soil and crops of the current map. */
  get farm(): MapFarm {
    return this.farmOf(this.map.id);
  }

  item(id: string): ItemDef | undefined {
    return this.world.index.itemById.get(id);
  }

  crop(id: string): CropDef | undefined {
    return this.world.index.cropById.get(id);
  }

  /** What dialogue conditions can ask about. */
  facts(): Facts {
    return {
      day: this.clock.day,
      minutes: this.clock.minutes,
      flags: this.flags,
      hearts: (id) => heartsOf(this.villagers.record(id).friendship),
      questStatus: (id) => this.quests.status(id),
      met: (id) => this.villagers.record(id).met,
      npc: (id) => this.world.index.npcById.get(id),
    };
  }

  /** The animals, trough and basket of the current map, if it has any. */
  ranchHere(): Ranch | undefined {
    return this.ranchOf(this.map.id);
  }

  /** The ranch that stocks the farm's coop: on the first map that has one. */
  mainRanch(): Ranch | undefined {
    const map = this.world.index.content.maps.find((m) => m.ranch !== undefined);
    return map === undefined ? undefined : this.ranchOf(map.id);
  }

  /** Villagers standing on the current map, for drawing. */
  villagersHere(): NpcState[] {
    return this.villagers.onMap(this.map.id);
  }

  setPaused(reason: PauseReason, paused: boolean): void {
    const wasPaused = this.isPaused;
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    if (wasPaused === this.isPaused) return;
    if (!this.isPaused) {
      // Whatever was pressed while stopped must not fire the moment we resume.
      this.loop.reset();
      this.input.discardPressed(GAMEPLAY_ACTIONS);
    }
    this.events.emit('pausedChanged', this.isPaused);
  }

  /** Sets the size of the view in screen pixels and the zoom. Call on resize and when the zoom changes. */
  setViewport(screenWidth: number, screenHeight: number, zoom: number): void {
    this.camera.setViewport(screenWidth, screenHeight, zoom);
    if (!this.viewportReady) {
      this.snapCamera();
      this.viewportReady = true;
    } else {
      this.camera.clampTo(this.map.width, this.map.height);
    }
  }

  /**
   * Advances by one rendered frame of `frameSeconds`: runs as many fixed simulation steps as that time pays
   * for, then moves the camera. Returns the interpolation alpha (0 to 1) to draw the player with.
   */
  frame(frameSeconds: number): number {
    let alpha = 1;
    if (this.isPaused) this.loop.reset();
    else alpha = this.loop.advance(frameSeconds);
    const at = this.renderPosition(alpha);
    this.camera.follow(at.x, at.y - 10, this.map.width, this.map.height, frameSeconds);
    return alpha;
  }

  /** The player's feet, blended between the last two steps so motion is smooth at any frame rate. */
  renderPosition(alpha: number): Vec2 {
    return {
      x: this.previous.x + (this.player.x - this.previous.x) * alpha,
      y: this.previous.y + (this.player.y - this.previous.y) * alpha,
    };
  }

  toSaveState(): GameSaveState {
    const farms: Record<string, FarmSave> = { ...this.farmSaves };
    for (const [id, farm] of this.farms) {
      const save = farm.toSave();
      if (save.soil.length > 0 || save.crops.length > 0) farms[id] = save;
      else delete farms[id];
    }
    const ranches: Record<string, RanchSave> = { ...this.ranchSaves };
    for (const [id, ranch] of this.ranches) {
      const save = ranch.toSave();
      if (save.animals.length > 0 || save.feed > 0 || save.basket.length > 0) ranches[id] = save;
      else delete ranches[id];
    }
    return {
      mapId: this.map.id,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      playTimeMs: Math.floor(this.playTimeMs),
      time: this.clock.toState(),
      money: this.money,
      inventory: { ...this.inventory.toSave(), canWater: this.canWater },
      bin: this.bin.items.map((stack) => ({ ...stack })),
      farms,
      npcs: this.villagers.toSave(),
      ranches,
      quests: this.quests.toSave(),
      flags: [...this.flags],
      collection: { ...this.collection },
      mine: { deepest: this.mineDeepest },
      placed: this.placedToSave(),
      buildings: { built: [...this.built], pending: this.pending.map((p) => ({ ...p })) },
      museum: this.museum?.toSave() ?? { donated: [], claimed: [] },
      bestiary: this.bestiary.toSave(),
      spent: this.spentToSave(),
      ...this.living.toSave(),
    };
  }

  // ------------------------------------------------------------------------------------------ commands from the HUD and the conversations

  hint(text: string, tone: 'info' | 'warn'): void {
    this.events.emit('hint', { text, tone });
  }

  /** Shows a message box. Direction presses made while walking must not move its highlight the moment it opens. */
  showDialog(dialog: DialogState): void {
    this.dialog = dialog;
    this.input.discardPressed(['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'use', 'interact']);
    this.events.emit('dialogChanged', dialog);
  }

  setDialog(dialog: DialogState | undefined): void {
    this.dialog = dialog;
    this.events.emit('dialogChanged', dialog);
  }

  /** Closes the message box without finishing it (when the menu opens, for example). */
  closeDialog(): void {
    if (this.dialog === undefined) return;
    this.setDialog(undefined);
  }

  /** Selects a hotbar slot (a click on it). */
  selectSlot(index: number): void {
    this.inventory.select(index);
    this.syncStatus();
  }

  /** Picks an option in the message box (a click on it). */
  chooseOption(index: number): void {
    const dialog = this.dialog;
    if (dialog === undefined || !isChoosing(dialog) || !dialog.options[index]?.enabled) return;
    this.dialog = { ...dialog, selected: index };
    this.events.emit('sound', { id: 'ui_choose' });
    this.conversations.choose(this.dialog);
  }

  /** Tells the quest log something happened, and lets the player know about any quest that is now ready. */
  notifyQuests(event: QuestEvent): void {
    const change = this.quests.notify(event);
    for (const quest of change.ready) this.hint(`Quest ready: ${quest.title}`, 'info');
    if (change.progressed.length > 0) this.syncStatus();
  }

  /** Closes the morning report and lets the day begin. */
  dismissSummary(): void {
    if (this.summary === undefined) return;
    this.summary = undefined;
    this.events.emit('daySummary', undefined);
    this.setPaused('summary', false);
  }

  /**
   * The night passes: the bin is paid for, crops grow, hens lay, the soil dries, and a new morning begins at the
   * farmhouse door. Called when the player goes to bed, and by the clock at 2:00 am.
   */
  endDay(cause: 'slept' | 'exhausted'): void {
    this.closeDialog();
    this.swing = undefined;
    this.fishing = undefined;
    this.fishingPhase = undefined;

    for (const stack of this.bin.items) this.notifyQuests({ kind: 'ship', item: stack.id, count: stack.count });
    const shipped = this.bin.describe((id) => this.item(id));
    const earned = this.bin.total((id) => this.item(id));
    this.money += earned;
    this.bin.clear();

    // A prize that was earned but never asked for is brought round in the night: nothing taken may go unpaid.
    const festivalPrize = this.living.settleFestival();
    this.events.emit('sound', { id: 'sleep' });

    this.clock.startNextDay();
    this.villagers.setDay(this.living.dayContext());
    const built = this.finishBuildings();
    const season = seasonOf(this.clock.day);
    let grown = 0;
    let withered = 0;
    let ripe = 0;
    // (A save may mention a map the game no longer has: those are kept in the save, but there is nothing to grow on them.)
    for (const id of [...new Set([...this.farms.keys(), ...Object.keys(this.farmSaves)])].filter((id) => this.world.hasMap(id))) {
      // Under glass the seasons do not matter: nothing withers, and everything keeps growing.
      const report = advanceFarm(this.farmOf(id), (cropId) => this.crop(cropId), season, this.world.mapDef(id)?.sheltered === true, watersFields(this.weather));
      grown += report.grown;
      withered += report.withered;
      ripe += report.ripe;
    }

    // Rain waters every outdoor field by morning (under glass it never rains).
    if (watersFields(this.weather)) {
      for (const id of [...new Set([...this.farms.keys(), ...Object.keys(this.farmSaves)])].filter((id) => this.world.hasMap(id) && this.world.mapDef(id)?.sheltered !== true)) this.farmOf(id).waterAll();
    }

    this.wildlife.sprinkle();

    let eggs = 0;
    let fed = 0;
    for (const id of [...new Set([...this.ranches.keys(), ...Object.keys(this.ranchSaves)])].filter((id) => this.world.hasMap(id))) {
      const ranch = this.ranchOf(id);
      if (ranch === undefined) continue;
      fed += ranch.nightly(this.clock.day).fed;
      eggs += ranch.eggCount();
    }
    if (fed > 0) this.notifyQuests({ kind: 'feed', count: fed });

    this.canWater = CAN_CAPACITY;

    // Wake at home, on the farm, and let the villagers start their day.
    const home = this.world.map(this.world.startMapId);
    this.moveTo(home, home.spawn.x, home.spawn.y, home.spawn.facing);
    // Every rock in the mine is whole again by morning (the player is home, so nobody is standing in a floor being forgotten).
    this.world.resetGenerated();
    this.world.restoreNodes();
    this.villagers.placeAll(WAKE_MINUTE);
    this.refreshPrompt();

    const readyQuests = this.quests
      .open()
      .filter((q) => this.quests.status(q.id) === 'ready')
      .map((q) => q.title);
    this.summary = { day: this.clock.day, date: dateLabel(this.clock.day), cause, earned, shipped, grown, withered, ripe, eggs, readyQuests, built, weather: this.weather, forecast: this.forecast, festival: this.festivalToday?.name, festivalPrize };
    this.setPaused('summary', true);
    this.events.emit('daySummary', this.summary);
    this.syncStatus();
  }

  /** Tells the HUD when something it shows changed. Cheap enough to call every step. */
  syncStatus(): void {
    const key = `${this.inventory.version}|${this.money}|${this.canWater}|${this.bin.version}|${this.clock.day}|${Math.floor(this.clock.minutes / 10)}|${this.quests.version}|${this.festivalProgress.day === this.clock.day ? this.festivalProgress.score : 0}|${this.bestiary.version}`;
    if (key === this.statusKey) return;
    this.statusKey = key;
    if (this.lastMoney >= 0 && this.money > this.lastMoney) this.events.emit('sound', { id: 'coin' });
    this.lastMoney = this.money;
    this.events.emit('statusChanged', undefined);
  }

  // ------------------------------------------------------------------------------------------ simulation

  private step(dt: number): void {
    this.previous = { x: this.player.x, y: this.player.y };
    this.playTimeMs += dt * 1000;

    if (this.dialog !== undefined) {
      this.player.moving = false;
      this.player.stride = 0;
      this.stepDialog();
      this.syncStatus();
      return;
    }

    // Time passes only while the player is out in the world, not while reading or choosing.
    this.clock.advance(dt);
    if (this.clock.minutes >= BEDTIME_MINUTE) {
      this.endDay('exhausted');
      return;
    }

    if (this.swing !== undefined) {
      this.player.moving = false;
      this.player.stride = 0;
      this.stepSwing(dt);
      this.input.discardPressed(['use', 'interact']);
    } else if (this.fishing !== undefined) {
      this.player.moving = false;
      this.player.stride = 0;
      this.stepFishing(this.fishing, dt);
    } else {
      const from = { x: this.player.x, y: this.player.y };
      const wasTouching = this.touchesVillager();
      updatePlayer(
        this.player,
        this.map,
        { move: this.input.moveVector(), run: this.input.isDown('run'), facing: this.input.facingIntent() },
        dt,
      );
      if (!wasTouching) this.keepOutOfVillagers(from);
      const holding = this.input.moveVector();
      if (holding.x === 0 && holding.y === 0) this.arrivalLock = false;
      else if (this.arrivalLock && Villagers.exitAt(this.map.exits, { x: worldToTile(this.player.x), y: worldToTile(this.player.y - 3) }) !== undefined) {
        this.player.x = from.x;
        this.player.y = from.y;
        this.player.moving = false;
      }
      if (this.checkExits()) return;
      this.living.collectEgg();
      this.wildlife.spotCreatures();
      this.footstep();
    }
    this.living.syncDecorations();

    this.villagers.update(dt, this.clock.minutes, this.map.id);
    this.ranchHere()?.update(dt);

    if (this.swing === undefined && this.fishing === undefined) {
      this.refreshPrompt();
      this.refreshCursor();
      this.handleActions();
    }
    this.syncStatus();
  }

  /** Is the player's body inside a villager's? */
  private touchesVillager(): boolean {
    const box = playerBox(this.player);
    return this.villagers.onMap(this.map.id).some((v) => box.x < v.x + 5 && box.x + box.w > v.x - 5 && box.y < v.y && box.y + box.h > v.y - 6);
  }

  /**
   * Villagers are solid for the player: a step that would walk into one is undone, keeping whichever axis still works so
   * the player slides along them. (A player already inside one, because they walked up to a spot just as the villager
   * arrived, is never held: this only runs when the step started clear.) Villagers do not step around the player; they
   * simply pass through, so nobody can be stuck.
   */
  private keepOutOfVillagers(from: Vec2): void {
    if (!this.touchesVillager()) return;
    const to = { x: this.player.x, y: this.player.y };
    this.player.x = to.x;
    this.player.y = from.y;
    if (!this.touchesVillager()) return;
    this.player.x = from.x;
    this.player.y = to.y;
    if (!this.touchesVillager()) return;
    this.player.x = from.x;
    this.player.y = from.y;
    this.player.moving = false;
  }

  /** Walks off the edge of the map onto another. Returns true if the player left. */
  private checkExits(): boolean {
    const cell = { x: worldToTile(this.player.x), y: worldToTile(this.player.y - 3) };
    const exit = Villagers.exitAt(this.map.exits, cell);
    if (exit === undefined) return false;
    const closed = this.closedBecause(exit.to.map);
    if (closed !== undefined) {
      // The way is shut for now: step back out of the exit and say why (not on every step).
      this.player.x = this.previous.x;
      this.player.y = this.previous.y;
      this.player.moving = false;
      if (this.playTimeMs >= this.closedNoticeAt) {
        this.closedNoticeAt = this.playTimeMs + 3000;
        this.hint(closed, 'info');
      }
      return false;
    }
    this.moveTo(this.world.map(exit.to.map), exit.to.x, exit.to.y, exit.to.facing);
    return true;
  }

  /** Why an exit into this map is closed for now, or undefined if it is open. Only a way into another region can be closed. */
  private closedBecause(mapId: string): string | undefined {
    const regionId = this.world.mapDef(mapId)?.regionId;
    if (regionId === undefined || regionId === this.map.regionId) return undefined;
    const unlock = this.world.region(regionId)?.unlock;
    if (unlock === undefined || unlock.kind === 'always') return undefined;
    const facts = this.facts();
    return unlock.all.every((condition) => holds(condition, facts, '')) ? undefined : unlock.message;
  }

  /** Puts the player on a map (this one or another) at a cell, and tells everyone. */
  private moveTo(map: GameMap, x: number, y: number, facing: Direction): void {
    const changed = map !== this.map;
    this.closeDialog();
    this.swing = undefined;
    this.fishing = undefined;
    this.fishingPhase = undefined;
    this.arrivalLock = changed;
    this.prepare(map);
    this.map = map;
    this.player = createPlayerAt(x, y, facing);
    this.previous = { x: this.player.x, y: this.player.y };
    this.snapCamera();
    if (changed) {
      this.flags.add(`visited:${map.id}`);
      this.mineDeepest = Math.max(this.mineDeepest, parseMineFloor(map.id) ?? 0);
      this.events.emit('mapChanged', { map });
      this.notifyQuests({ kind: 'visit', map: map.id });
    }
    this.refreshPrompt();
  }

  private handleActions(): void {
    if (this.input.consumePressed('hotbarNext')) this.inventory.selectNext(1);
    if (this.input.consumePressed('hotbarPrev')) this.inventory.selectNext(-1);
    SLOT_ACTIONS.forEach((action, index) => {
      if (this.input.consumePressed(action)) this.inventory.select(index);
    });

    if (this.input.consumePressed('interact')) {
      if (this.facingFurniture !== undefined) this.pickUpFurniture(this.facingFurniture);
      else if (this.target !== undefined) this.interactWith(this.target);
      else if (this.facingNpc !== undefined) this.talkTo(this.facingNpc);
      else if (this.facingAnimal !== undefined) this.petAnimal(this.facingAnimal);
      else if (this.facingCreature !== undefined) this.wildlife.watchCreature(this.facingCreature);
      else this.tryHarvest();
    }
    if (this.input.consumePressed('use')) this.startUse();
  }

  // ------------------------------------------------------------------------------------------ tools and seeds

  private useContext(): Parameters<typeof planUse>[0] {
    return {
      map: this.map,
      farm: this.farm,
      items: (id) => this.item(id),
      crops: (id) => this.crop(id),
      season: this.season,
      canWater: this.canWater,
      objects: (id) => this.world.index.objectById.get(id),
      occupied: (x, y) => this.occupied(x, y),
      creatureAt: (x, y) => this.wildlife.creatureAt(x, y),
    };
  }

  /** Is somebody standing in this cell: the player (the box around their feet touches it), or a villager on this map? */
  occupied(x: number, y: number): boolean {
    const box = playerBox(this.player);
    const touches = box.x < (x + 1) * TILE_SIZE && box.x + box.w > x * TILE_SIZE && box.y < (y + 1) * TILE_SIZE && box.y + box.h > y * TILE_SIZE;
    return touches || this.villagers.onMap(this.map.id).some((v) => {
      const cell = cellOf(v);
      return cell.x === x && cell.y === y;
    });
  }

  private startUse(): void {
    const stack = this.inventory.selectedStack();
    if (stack === null) return;
    const def = this.item(stack.id);
    if (def === undefined) return;
    const cell = facingCell(this.player);
    const outcome = planUse(this.useContext(), stack, cell.x, cell.y);
    if (!outcome.ok) {
      const text = outcome.reason === 'not-usable' && isGoods(def) ? 'Take that to the shipping bin to sell it.' : failureMessage(outcome);
      this.hint(text, 'warn');
      return;
    }
    const kind = def.tool ?? 'seed';
    this.swing = { kind, cell, effect: outcome.effect, slot: this.inventory.selected, itemId: stack.id, elapsed: 0, applied: false };
  }

  private stepSwing(dt: number): void {
    const swing = this.swing;
    if (swing === undefined) return;
    swing.elapsed += dt;
    const duration = SWING_SECONDS[swing.kind];
    if (!swing.applied && swing.elapsed >= duration * SWING_IMPACT) {
      swing.applied = true;
      this.applyUse(swing);
    }
    if (swing.elapsed >= duration) this.swing = undefined;
  }

  /** The tool lands. The rules are checked again, in case anything changed during the swing. */
  private applyUse(swing: ToolSwing): void {
    const stack = this.inventory.slots[swing.slot];
    if (stack === null || stack === undefined || stack.id !== swing.itemId) return;
    const { x, y } = swing.cell;
    const outcome = planUse(this.useContext(), stack, x, y);
    if (!outcome.ok) {
      this.hint(failureMessage(outcome), 'warn');
      return;
    }
    const farm = this.farm;
    switch (outcome.effect) {
      case 'till':
        farm.till(x, y);
        this.events.emit('effect', { kind: 'till', x, y });
        break;
      case 'water':
        farm.water(x, y);
        this.canWater -= 1;
        this.events.emit('effect', { kind: 'water', x, y });
        break;
      case 'refill':
        this.canWater = CAN_CAPACITY;
        this.events.emit('effect', { kind: 'refill', x, y });
        this.hint('The watering can is full.', 'info');
        break;
      case 'plant': {
        const crop = this.item(stack.id)?.plants;
        if (crop === undefined || !farm.plant(x, y, crop, this.clock.day)) break;
        this.inventory.take(swing.slot, 1);
        this.events.emit('effect', { kind: 'plant', x, y });
        break;
      }
      case 'mine':
        this.mineNode(x, y);
        break;
      case 'cast':
        this.castLine(x, y);
        break;
      case 'dig':
        this.digSpot(x, y);
        break;
      case 'place':
        this.placeFurniture(swing, x, y);
        break;
      case 'fertilize':
        if (!farm.fertilize(x, y)) break;
        this.inventory.take(swing.slot, 1);
        this.events.emit('effect', { kind: 'plant', x, y });
        this.hint('The soil is rich now.', 'info');
        this.syncStatus();
        break;
      case 'befriend':
        this.wildlife.befriend(swing.slot, x, y);
        break;
    }
    this.refreshCursor();
  }

  // ------------------------------------------------------------------------------------------ the mine

  /** What a node gives this morning: a hash of the cell and the day decides each drop, so nothing random is stored. */
  private dropsOf(node: NodeDef, x: number, y: number): { item: string; count: number }[] {
    const out: { item: string; count: number }[] = [];
    node.drops.forEach((drop, index) => {
      const seed = this.clock.day * 31 + index * 7;
      if (hash2(x, y, seed) >= drop.chance) return;
      const count = drop.min + Math.floor(hash2(x, y, seed + 1) * (drop.max - drop.min + 1));
      if (count > 0) out.push({ item: drop.item, count });
    });
    return out;
  }

  /** One swing of the pickaxe at the node in front. The last hit breaks it and its stone and ore go to the pockets. */
  private mineNode(x: number, y: number): void {
    const node = this.map.nodeAt(x, y);
    if (node === undefined) return;
    const drops = this.dropsOf(node.def, x, y);
    if (node.hits <= 1 && !canAddAll(this.inventory, drops.map((d) => ({ id: d.item, count: d.count, quality: 0 as const })), (id) => this.item(id))) {
      this.hint('Your pockets are too full to carry what falls out.', 'warn');
      return;
    }
    const hit = this.map.hitNode(x, y);
    if (hit === undefined) return;
    this.events.emit('effect', { kind: hit.broken ? 'break' : 'mine', x, y });
    if (!hit.broken) return;
    this.markSpent(this.map, x, y);
    const parts: string[] = [];
    for (const drop of drops) {
      this.inventory.add({ id: drop.item, count: drop.count, quality: 0 });
      this.collection[drop.item] = (this.collection[drop.item] ?? 0) + drop.count;
      parts.push(`${drop.count} ${this.item(drop.item)?.name ?? drop.item}`);
      this.notifyQuests({ kind: 'mine', item: drop.item, count: drop.count });
    }
    if (parts.length > 0) this.hint(`+${parts.join(', ')}`, 'info');
    this.syncStatus();
  }

  // ------------------------------------------------------------------------------------------ furniture, buildings and digging

  /**
   * Lays out what belongs on a map the first time it is entered (and again if it was built afresh): the furniture the player put
   * there, a finished building and its door, or the scaffolding of one being built, and today's dig spots.
   */
  private prepare(map: GameMap): void {
    if (this.prepared.get(map.id) !== map) {
      this.prepared.set(map.id, map);
      for (const placed of this.placedSaves[map.id] ?? []) {
        const def = this.world.index.objectById.get(placed.def);
        // Only furniture is saved, and only rooms to decorate take it: a hand-edited save cannot put a kitchen anywhere.
        if (def !== undefined && this.furnitureObjects.has(def.id) && (map.decorate || def.sprinkles !== undefined)) map.addObject(def, placed.x, placed.y);
      }
      for (const site of map.sites) {
        const building = this.world.index.buildingById.get(site.building);
        if (building === undefined) continue;
        if (this.built.has(building.id)) this.raise(map, site, building);
        else if (this.pending.some((p) => p.site === site.id)) this.scaffold(map, site, building);
      }
    }
    this.refreshDigSpots(map);
    this.dailyReset();
    for (const cell of this.spent.get(map.id) ?? []) map.clearNode(cell % 1000, Math.floor(cell / 1000));
  }

  /** The records of what was used up today belong to today only. */
  private dailyReset(): void {
    if (this.spentDay === this.clock.day) return;
    this.spentDay = this.clock.day;
    this.spent.clear();
    this.fished.clear();
  }

  private markSpent(map: GameMap, x: number, y: number): void {
    this.dailyReset();
    const cells = this.spent.get(map.id) ?? new Set<number>();
    cells.add(y * 1000 + x);
    this.spent.set(map.id, cells);
  }

  private spentToSave(): GameSaveState['spent'] {
    if (this.spentDay !== this.clock.day) return { day: 0, cells: {}, fished: {} };
    return {
      day: this.spentDay,
      cells: Object.fromEntries([...this.spent].filter(([, cells]) => cells.size > 0).map(([id, cells]) => [id, [...cells]])),
      fished: Object.fromEntries(this.fished),
    };
  }

  /** Today's dig spots, if the map has any and they have not been laid out today. */
  private refreshDigSpots(map: GameMap): void {
    const dig = map.dig;
    const mark = this.world.index.content.nodes.find((n) => n.tool === 'hoe');
    if (dig === undefined || mark === undefined || map.digDay === this.clock.day) return;
    const candidates: { x: number; y: number }[] = [];
    for (const area of dig.areas) {
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) {
          // Yesterday's spots that nobody dug do not count: the layout must be the same whether the map was kept overnight or built afresh.
          const there = map.nodeAt(x, y);
          const free = map.isWalkable(x, y) && (there === undefined || there.def.tool === 'hoe') && map.extraAt(x, y) === undefined && map.interactableAt(x, y) === undefined && !map.isFloorObjectCell(x, y);
          if (free && !map.isTillable(x, y) && !map.exits.some((e) => x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h)) candidates.push({ x, y });
        }
      }
    }
    map.setDigSpots(digSpots(map.id, this.clock.day, candidates, dig.count), mark, this.clock.day);
  }

  /** One swing of the hoe at a dig spot: it gives up what was buried there. */
  private digSpot(x: number, y: number): void {
    const spot = this.map.nodeAt(x, y);
    if (spot === undefined || spot.def.tool !== 'hoe') return;
    const item = pickArtifact(this.map.dig?.artifacts ?? [], this.map.id, x, y, this.clock.day);
    if (item !== undefined && !this.inventory.canAdd({ id: item, count: 1, quality: 0 })) {
      this.hint('Your pockets are too full to carry what is buried here.', 'warn');
      return;
    }
    const hit = this.map.hitNode(x, y);
    if (hit === undefined) return;
    this.events.emit('effect', { kind: 'dig', x, y });
    if (!hit.broken) return;
    this.markSpent(this.map, x, y);
    if (item !== undefined) {
      this.inventory.add({ id: item, count: 1, quality: 0 });
      this.collection[item] = (this.collection[item] ?? 0) + 1;
      this.hint(`Dug up ${this.item(item)?.name ?? item}!`, 'info');
    }
    this.notifyQuests({ kind: 'dig' });
    this.syncStatus();
  }

  /** Puts the selected piece of furniture down on the cell in front, and uses it up. */
  private placeFurniture(swing: ToolSwing, x: number, y: number): void {
    const item = this.item(swing.itemId);
    const object = item?.places === undefined ? undefined : this.world.index.objectById.get(item.places);
    if (object === undefined || this.map.addObject(object, x, y) === undefined) return;
    this.inventory.take(swing.slot, 1);
    this.events.emit('effect', { kind: 'place', x, y });
    this.notifyQuests({ kind: 'place', placed: this.placedCount() });
    this.syncStatus();
  }

  /** How many pieces of furniture are put out in the whole house and farm right now. */
  placedCount(): number {
    // Furniture is what stands in a room made for it: a sprinkler out in the field is not a piece of furniture.
    return Object.entries(this.placedToSave()).reduce((total, [id, list]) => total + (this.world.mapDef(id)?.decorate === true ? list.length : 0), 0);
  }

  /** Picks up the furniture in front of the player, back into the pockets. */
  private pickUpFurniture(furniture: PlacedObject): void {
    const item = this.world.index.content.items.find((i) => i.places === furniture.def.id);
    if (item === undefined) return;
    if (!this.inventory.canAdd({ id: item.id, count: 1, quality: 0 })) {
      this.hint('Your pockets are full.', 'warn');
      return;
    }
    this.map.removeObject(furniture.uid);
    this.inventory.add({ id: item.id, count: 1, quality: 0 });
    this.events.emit('effect', { kind: 'place', x: furniture.x, y: furniture.y });
    this.hint(`+1 ${item.name}`, 'info');
    this.refreshPrompt();
    this.syncStatus();
  }

  /** The furniture that is saved (not buildings or their scaffolding), for every map that has some. */
  placedToSave(): Record<string, PlacedSave[]> {
    const out: Record<string, PlacedSave[]> = {};
    for (const [id, list] of Object.entries(this.placedSaves)) if (this.prepared.get(id) === undefined && list.length > 0) out[id] = [...list];
    for (const [id, map] of this.prepared) {
      const list = [...map.extras.values()].filter((o) => this.furnitureObjects.has(o.def.id)).map((o) => ({ def: o.def.id, x: o.x, y: o.y }));
      if (list.length > 0) out[id] = list;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------ the carpenter

  /** The site for a building, and the map it is on. */
  siteOf(buildingId: string): { map: GameMap; site: BuildSite } | undefined {
    for (const def of this.world.index.content.maps) {
      const site = (def.sites ?? []).find((s) => s.building === buildingId);
      if (site !== undefined) return { map: this.world.map(def.id), site };
    }
    return undefined;
  }

  buildingStatus(buildingId: string): 'available' | 'ordered' | 'built' {
    if (this.built.has(buildingId)) return 'built';
    const site = this.siteOf(buildingId)?.site;
    return site !== undefined && this.pending.some((p) => p.site === site.id) ? 'ordered' : 'available';
  }

  /** What is still missing for a building: money and items the player does not have. */
  buildingShortfall(building: BuildingDef): { money: number; items: { id: string; count: number }[] } {
    return {
      money: Math.max(0, building.cost.money - this.money),
      items: building.cost.items.map((i) => ({ id: i.id, count: Math.max(0, i.count - this.inventory.count(i.id)) })).filter((i) => i.count > 0),
    };
  }

  /** Orders a building: takes the money and materials, puts up the scaffolding, and sets the day it is done. */
  orderBuilding(buildingId: string): { ok: true; readyDay: number } | { ok: false; note: string } {
    const building = this.world.index.buildingById.get(buildingId);
    const place = this.siteOf(buildingId);
    if (building === undefined || place === undefined) return { ok: false, note: 'There is nowhere to build that.' };
    if (this.buildingStatus(buildingId) !== 'available') return { ok: false, note: 'That is already done, or already under way.' };
    const short = this.buildingShortfall(building);
    if (short.money > 0 || short.items.length > 0) return { ok: false, note: 'You do not have everything it needs yet.' };
    this.money -= building.cost.money;
    for (const i of building.cost.items) takeItems(this.inventory, i.id, i.count);
    const readyDay = this.clock.day + building.cost.days;
    this.pending.push({ site: place.site.id, readyDay });
    if (this.prepared.get(place.map.id) === place.map) this.scaffold(place.map, place.site, building);
    this.syncStatus();
    return { ok: true, readyDay };
  }

  private scaffold(map: GameMap, site: BuildSite, building: BuildingDef): void {
    const def = this.world.index.objectById.get(building.scaffolding);
    if (def !== undefined) map.addObject(def, site.x, site.y);
  }

  private raise(map: GameMap, site: BuildSite, building: BuildingDef): void {
    const scaffolding = [...map.extras.values()].find((o) => o.def.id === building.scaffolding && o.x === site.x && o.y === site.y);
    if (scaffolding !== undefined) map.removeObject(scaffolding.uid);
    const def = this.world.index.objectById.get(building.object);
    if (def !== undefined) map.addObject(def, site.x, site.y);
    map.addExit(building.door);
  }

  /** Called each morning: the carpenter's finished work stands. Returns the names of what was finished. */
  private finishBuildings(): string[] {
    const done: string[] = [];
    for (const order of [...this.pending]) {
      if (order.readyDay > this.clock.day) continue;
      const found = this.world.index.content.maps.flatMap((m) => (m.sites ?? []).map((site) => ({ mapId: m.id, site }))).find((c) => c.site.id === order.site);
      const building = found === undefined ? undefined : this.world.index.buildingById.get(found.site.building);
      this.pending.splice(this.pending.indexOf(order), 1);
      if (found === undefined || building === undefined) continue;
      this.built.add(building.id);
      const map = this.prepared.get(found.mapId);
      if (map !== undefined) this.raise(map, found.site, building);
      done.push(building.name);
      this.notifyQuests({ kind: 'build', building: building.id });
    }
    return done;
  }

  // ------------------------------------------------------------------------------------------ rare creatures and the field (wildlife/wildlife.ts)

  /** The rare creatures about on this map right now. Where they stand follows from the day and the map alone: it is never saved. */
  creaturesHere(): readonly CreaturePlacement[] {
    return this.wildlife.creaturesHere();
  }

  // ------------------------------------------------------------------------------------------ weather, festivals and the notice board (living/livingWorld.ts)

  /** How the player is doing at today's festival (it only counts for the day it was made on). */
  get festivalProgress(): FestivalProgress {
    return this.living.festivalProgress;
  }

  /** Requests handed in to the notice board today. */
  get boardDone(): LivingWorld['boardDone'] {
    return this.living.boardDone;
  }

  /** The days festivals fall on: the sky is always clear on them. */
  get clearDays(): Set<number> {
    return this.living.clearDays;
  }

  /** The weather today: decided by the day alone (festival days are always clear). */
  get weather(): Weather {
    return this.living.weather;
  }

  /** Tomorrow's weather, which the player can be told today. */
  get forecast(): Weather {
    return this.living.forecast;
  }

  /** The festival held today (open or not), if any. */
  get festivalToday(): FestivalDef | undefined {
    return this.living.festivalToday;
  }

  /** The festival that is open right now, wherever it is held. */
  festivalNow(): FestivalDef | undefined {
    return this.living.festivalNow();
  }

  /** The festival of today once it has begun, open or closed: what its host will still settle (a prize earned before it ended is still owed). */
  festivalClaimable(): FestivalDef | undefined {
    return this.living.festivalClaimable();
  }

  /** The painted eggs still hidden on this map today (a hunt, while it is open), as cells. */
  get huntEggs(): readonly { x: number; y: number }[] {
    return this.living.huntEggs;
  }

  /** How much a festival entry is worth: its price, quality included, in the fair's steps. Nothing when there is no fair today. */
  fairScore(itemId: string, quality: Quality): number {
    return this.living.fairScore(itemId, quality);
  }

  /** Gives the harvest fair the best of one kind of thing the player holds. Only one entry a day. */
  enterFair(itemId: string): { ok: true; score: number } | { ok: false; note: string } {
    return this.living.enterFair(itemId);
  }

  /** Speaking to someone on Lantern Night counts (once for each of them): the extra friendship points it is worth. */
  festivalChat(npcId: string): number {
    return this.living.festivalChat(npcId);
  }

  /** How the player is doing at today's festival (once it has begun), in words, and whether they can ask for the prize. */
  festivalStatus(): { festival: FestivalDef; score: number; line: string; canClaim: boolean; claimed: boolean } | undefined {
    return this.living.festivalStatus();
  }

  /** Asks the host how the player did: the rank among the rivals decides the prize, which is given once. */
  claimFestival(): { ok: true; rank: number; of: number; message: string; given: string } | { ok: false; note: string } {
    return this.living.claimFestival();
  }

  /** The notice board's requests for today that have not been handed in. */
  requestsToday(): { request: Request; done: boolean }[] {
    return this.living.requestsToday();
  }

  /** Hands in a request: takes what it asks for, pays (a little more for a friend), and the giver likes you more for it. */
  fulfilRequest(id: string): { ok: true; paid: number; giver: string } | { ok: false; note: string } {
    return this.living.fulfilRequest(id);
  }

  /** A footstep each time a foot lands (the walk cycle's first and third pictures), by what is underfoot. */
  private footstep(): void {
    if (!this.player.moving) {
      this.lastStepFrame = -1;
      return;
    }
    const frame = walkFrame(this.player.stride);
    if (frame === this.lastStepFrame) return;
    this.lastStepFrame = frame;
    if (frame !== 0 && frame !== 2) return;
    const x = worldToTile(this.player.x);
    const y = worldToTile(this.player.y - 3);
    this.events.emit('sound', { id: stepSoundFor(this.map.terrainAt(x, y)?.footstep, this.map.isFloorObjectCell(x, y)) });
  }

  // ------------------------------------------------------------------------------------------ fishing

  /** Casts the line at a water cell: what could bite depends on the water, the season and the hour. */
  private castLine(x: number, y: number): void {
    const zone = this.map.fishingZoneAt(x, y);
    if (zone === undefined) return;
    const water = zone.water;
    this.dailyReset();
    const key = `${this.map.id}:${water}`;
    if ((this.fished.get(key) ?? 0) >= (zone.stock ?? DEFAULT_FISH_STOCK) + (watersFields(this.weather) ? 2 : 0)) {
      this.hint('The fish have had enough of you for today. Try again tomorrow.', 'info');
      return;
    }
    const candidates = biting(this.world.index.content.fish, water, this.season, this.clock.minutes);
    // The cell, the day and the minute decide what happens: the same cast at the same moment always goes the same way.
    const seed = Math.floor(hash2(x, y, this.clock.day * 1440 + Math.floor(this.clock.minutes)) * 4294967296);
    this.fishing = new FishingSession({ cell: { x, y }, candidates, seed });
    this.fishingPhase = 'waiting';
  }

  private stepFishing(session: FishingSession, dt: number): void {
    const pressed = this.input.consumePressed('use');
    const moving = this.input.moveVector();
    // Walking away pulls the line in, but not once a fish is on the hook: a stray key must not cost the catch.
    if ((moving.x !== 0 || moving.y !== 0) && (session.phase === 'waiting' || session.phase === 'bite')) session.cancel();
    else session.update(dt, pressed);
    this.input.discardPressed(['interact', 'hotbarPrev', 'hotbarNext', ...SLOT_ACTIONS]);

    if (session.phase !== this.fishingPhase) {
      this.fishingPhase = session.phase;
      if (session.phase === 'bite') {
        // A bite uses up some of the water's fish for the day, whether or not it is landed.
        const key = `${this.map.id}:${this.map.fishingWater(session.cell.x, session.cell.y) ?? ''}`;
        this.fished.set(key, (this.fished.get(key) ?? 0) + 1);
        this.hint('Something bites! Hook it now!', 'info');
        this.events.emit('sound', { id: 'bite' });
      }
      else if (session.phase === 'reeling') {
        this.hint('Now: use it when the marker is in the green.', 'info');
        this.events.emit('sound', { id: 'reel' });
      }
    }
    if (session.finished) this.finishFishing(session);
  }

  private finishFishing(session: FishingSession): void {
    this.fishing = undefined;
    this.fishingPhase = undefined;
    const { x, y } = session.cell;
    switch (session.phase) {
      case 'caught': {
        const caught = session.caught;
        if (caught === undefined) break;
        const stack = { id: caught.fish.item, count: 1, quality: caught.quality };
        const name = this.item(stack.id)?.name ?? caught.fish.name;
        if (!this.inventory.canAdd(stack)) {
          this.hint(`Your pockets are full: the ${name.toLowerCase()} slips back into the water.`, 'warn');
          break;
        }
        this.inventory.add(stack);
        this.collection[stack.id] = (this.collection[stack.id] ?? 0) + 1;
        this.events.emit('effect', { kind: 'splash', x, y });
        const quality = caught.quality > 0 ? ` (${(QUALITY_NAMES[caught.quality] ?? '').toLowerCase()})` : '';
        this.hint(`Caught a ${name}!${quality}`, 'info');
        this.events.emit('sound', { id: 'catch' });
        this.notifyQuests({ kind: 'catch', item: stack.id });
        this.living.countContestFish();
        break;
      }
      case 'escaped':
        this.hint('It got away!', 'warn');
        break;
      case 'nothing':
        this.hint('Nothing is biting right now. Try another time of day, or another water.', 'info');
        break;
      default:
        this.hint('You reel in the line.', 'info');
    }
    this.syncStatus();
  }

  /** Picks the ripe crop in front of the player, if there is one. Returns whether there was. */
  private tryHarvest(): boolean {
    const cell = facingCell(this.player);
    const farm = this.farm;
    const crop = farm.cropAt(cell.x, cell.y);
    const def = crop === undefined ? undefined : this.crop(crop.crop);
    if (crop === undefined || def === undefined || !isRipe(def, crop)) return false;

    const stack = harvestStack(def, crop, this.clock.day, farm.soilAt(crop.x, crop.y)?.fertilized === true);
    if (!this.inventory.canAdd(stack)) {
      this.hint('Your pockets are full.', 'warn');
      return true;
    }
    this.inventory.add(stack);
    completeHarvest(farm, def, crop);
    this.events.emit('effect', { kind: 'harvest', x: cell.x, y: cell.y });
    const itemName = this.item(stack.id)?.name ?? stack.id;
    const quality = stack.quality > 0 ? ` (${(QUALITY_NAMES[stack.quality] ?? '').toLowerCase()})` : '';
    this.hint(`+1 ${itemName}${quality}`, 'info');
    this.notifyQuests({ kind: 'harvest', item: stack.id, count: 1 });
    this.refreshPrompt();
    return true;
  }

  // ------------------------------------------------------------------------------------------ interaction and dialogs

  private interactWith(target: Interactable): void {
    const { interact } = target;
    switch (interact.action?.kind) {
      case 'sleep':
        this.conversations.openSleep(interact.title, interact.lines);
        break;
      case 'shop': {
        const shop = this.world.index.shopById.get(interact.action.shop);
        if (shop === undefined) break;
        const keeper = shop.keeper === undefined ? undefined : this.villagers.servingShop(shop.id, this.map.id, this.clock.minutes);
        if (keeper !== undefined) this.talkTo(keeper);
        else if (shop.keeper !== undefined) this.conversations.openClosedStall(shop, interact.title);
        else this.conversations.openShop(shop);
        break;
      }
      case 'ship':
        this.ship(target);
        break;
      case 'bed':
        this.conversations.openSleep(interact.title, interact.lines);
        break;
      case 'craft':
        this.conversations.openCraft(interact.action.station, interact.title);
        break;
      case 'museum':
        this.conversations.openMuseum(interact.title);
        break;
      case 'board':
        this.conversations.openBoard(interact.title);
        break;
      case 'coop':
        this.conversations.openCoop(interact.title);
        break;
      case 'trough':
        this.conversations.openTrough(interact.title);
        break;
      default:
        this.showDialog(openDialog(interact.title, interact.lines));
    }
  }

  private talkTo(npc: NpcState): void {
    // They turn to face whoever is talking to them.
    npc.facing = opposite[this.player.facing];
    this.conversations.openNpc(npc.id);
  }

  private petAnimal(animal: Animal): void {
    const ranch = this.ranchHere();
    if (ranch === undefined) return;
    const gained = ranch.pet(animal, this.clock.day);
    const cell = { x: worldToTile(animal.x), y: worldToTile(animal.y - 3) };
    if (gained > 0) {
      this.events.emit('effect', { kind: 'pet', x: cell.x, y: cell.y });
      this.hint(`${animal.name} clucks happily. (${heartsOf(animal.friendship)}♥)`, 'info');
    } else {
      this.hint(`${animal.name} has had plenty of attention today.`, 'info');
    }
  }

  private ship(target: Interactable): void {
    const stack = this.inventory.selectedStack();
    const def = stack === null ? undefined : this.item(stack.id);
    if (stack === null || def === undefined || def.sellPrice <= 0) {
      this.showDialog(openDialog(target.interact.title, ['Nothing to ship.', 'Select something you grew, then try again.']));
      return;
    }
    const taken = this.inventory.take(this.inventory.selected, stack.count);
    if (taken === undefined) return;
    this.bin.add(taken);
    const worth = unitPrice(def, taken.quality) * taken.count;
    const quality = taken.quality > 0 ? ` (${(QUALITY_NAMES[taken.quality] ?? '').toLowerCase()})` : '';
    this.events.emit('effect', { kind: 'ship', x: target.cellX, y: target.cellY });
    this.showDialog(
      openDialog(target.interact.title, [`Shipped ${taken.count} ${def.name}${quality}, worth ${worth}g.`, 'You will be paid in the morning.']),
    );
  }

  private stepDialog(): void {
    const dialog = this.dialog;
    if (dialog === undefined) return;
    if (isChoosing(dialog)) {
      if (this.input.consumePressed('moveUp')) {
        this.events.emit('sound', { id: 'ui_move' });
        this.setDialog(moveSelection(dialog, -1));
      }
      if (this.input.consumePressed('moveDown')) {
        this.events.emit('sound', { id: 'ui_move' });
        this.setDialog(moveSelection(this.dialog ?? dialog, 1));
      }
      if (this.input.consumePressed('interact') && this.dialog !== undefined) {
        if (this.dialog.options[this.dialog.selected]?.enabled === true) this.events.emit('sound', { id: 'ui_choose' });
        this.conversations.choose(this.dialog);
      }
    } else if (this.input.consumePressed('interact')) {
      this.events.emit('sound', { id: 'ui_move' });
      this.setDialog(nextPage(dialog));
    }
    // Direction presses only mean something while choosing: forget the ones made earlier, so they cannot
    // move the highlight the moment the choices appear.
    const now = this.dialog;
    if (now === undefined || !isChoosing(now)) this.input.discardPressed(['moveUp', 'moveDown']);
    this.input.discardPressed(['use', 'moveLeft', 'moveRight', 'hotbarPrev', 'hotbarNext']);
  }

  // ------------------------------------------------------------------------------------------ bookkeeping

  private refreshPrompt(): void {
    const cell = facingCell(this.player);
    this.target = this.map.interactableAt(cell.x, cell.y);
    this.facingNpc = this.villagers.onMap(this.map.id).find((s) => {
      const at = cellOf(s);
      return at.x === cell.x && at.y === cell.y;
    });
    this.facingAnimal = this.ranchHere()?.animalAt(cell);
    this.facingCreature = this.creaturesHere().find((c) => c.x === cell.x && c.y === cell.y);
    const extra = this.map.extraAt(cell.x, cell.y);
    this.facingFurniture = extra !== undefined && this.furnitureObjects.has(extra.def.id) ? extra : undefined;

    let next: Prompt | undefined;
    if (this.facingFurniture !== undefined) {
      next = { verb: 'Pick up', name: this.facingFurniture.def.name, x: cell.x, y: cell.y };
    } else if (this.target !== undefined) {
      next = { verb: this.target.interact.verb, name: this.target.name, x: this.target.cellX, y: this.target.cellY };
    } else if (this.facingNpc !== undefined) {
      next = { verb: 'Talk to', name: this.world.index.npcById.get(this.facingNpc.id)?.name ?? '', x: cell.x, y: cell.y };
    } else if (this.facingAnimal !== undefined) {
      next = { verb: 'Pet', name: this.facingAnimal.name, x: cell.x, y: cell.y };
    } else if (this.facingCreature !== undefined) {
      next = { verb: 'Watch', name: this.world.index.creatureById.get(this.facingCreature.creature)?.name ?? '', x: cell.x, y: cell.y };
    } else {
      const crop = this.farm.cropAt(cell.x, cell.y);
      const def = crop === undefined ? undefined : this.crop(crop.crop);
      if (crop !== undefined && def !== undefined && isRipe(def, crop)) next = { verb: 'Pick', name: def.name, x: cell.x, y: cell.y };
    }
    const prev = this.prompt;
    const changed = prev?.verb !== next?.verb || prev?.name !== next?.name || prev?.x !== next?.x || prev?.y !== next?.y;
    this.prompt = next;
    if (changed) this.events.emit('promptChanged', next);
  }

  private refreshCursor(): void {
    const stack = this.inventory.selectedStack();
    const def = stack === null ? undefined : this.item(stack.id);
    if (stack === null || def === undefined) {
      this.cursor = undefined;
      return;
    }
    const cell = facingCell(this.player);
    const plan = planUse(this.useContext(), stack, cell.x, cell.y);
    // The cursor is for tools, seeds, furniture and fertilizer, and for something a creature in front of the player would take.
    const shown = def.kind === 'tool' || def.kind === 'seed' || def.kind === 'furniture' || def.fertilizes === true || (plan.ok && plan.effect === 'befriend');
    this.cursor = shown ? { x: cell.x, y: cell.y, valid: plan.ok } : undefined;
  }

  farmOf(mapId: string): MapFarm {
    let farm = this.farms.get(mapId);
    if (farm === undefined) {
      const map = this.world.map(mapId);
      farm = MapFarm.fromSave(map.width, map.height, this.farmSaves[mapId], (id) => this.crop(id));
      this.farms.set(mapId, farm);
    }
    return farm;
  }

  private ranchOf(mapId: string): Ranch | undefined {
    let ranch = this.ranches.get(mapId);
    if (ranch === undefined) {
      const map = this.world.map(mapId);
      if (map.ranch === undefined) return undefined;
      ranch = new Ranch(map.ranch, (id) => this.world.index.animalById.get(id), { width: map.width, height: map.height, walkable: (x, y) => map.isWalkable(x, y) }, this.ranchSaves[mapId]);
      this.ranches.set(mapId, ranch);
    }
    return ranch;
  }

  private snapCamera(): void {
    this.camera.snapTo(this.player.x, this.player.y - 10, this.map.width, this.map.height);
  }

  /** Puts the player where the save says, or on the nearest walkable ground if that spot is no longer valid. */
  private restorePlayer(saved: GameSaveState | undefined, mapId: string): PlayerState {
    const { spawn } = this.map;
    if (saved === undefined || saved.mapId !== mapId) return createPlayerAt(spawn.x, spawn.y, spawn.facing);

    const restored: PlayerState = {
      x: saved.player.x,
      y: saved.player.y,
      facing: saved.player.facing,
      moving: false,
      running: false,
      stride: 0,
    };
    const box = playerBox(restored);
    const inside = box.x >= 0 && box.y >= 0 && box.x + box.w <= this.map.width * TILE_SIZE && box.y + box.h <= this.map.height * TILE_SIZE;
    if (inside && !this.map.collision.boxHitsSolid(box)) return restored;

    const rescue = this.map.nearestWalkable(worldToTile(saved.player.x), worldToTile(saved.player.y - 1));
    return rescue === undefined
      ? createPlayerAt(spawn.x, spawn.y, spawn.facing)
      : createPlayerAt(rescue.x, rescue.y, saved.player.facing);
  }
}
