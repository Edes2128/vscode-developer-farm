// Pixi builds some shaders with `new Function`, which the webview's content security policy forbids.
// This module swaps in versions that need no `eval`. It must be imported before Pixi creates anything.
import 'pixi.js/unsafe-eval';
import { Application, Container, type Ticker } from 'pixi.js';
import type { Game } from '../engine/game';
import type { GameMap } from '../engine/world/gameMap';
import { ActorLayer } from './actorLayer';
import { AmbientLight } from './ambientLight';
import type { Atlas } from './atlas';
import { EffectsLayer } from './effectsLayer';
import { FishingView } from './fishingView';
import { MapView } from './mapView';
import { PlayerView } from './playerView';
import { CreatureLayer } from './creatureLayer';
import { TokenLayer } from './tokenLayer';
import { WeatherLayer } from './weatherLayer';
import { dimming } from '../engine/weather/weather';
import type { Season } from '../engine/time/calendar';
import { chooseZoom, crispScale, type ZoomPreference } from './viewport';

/** Background shown outside the map and while loading: the deep forest green of the UI frame. Indoors and in caves it is darker. */
const BACKGROUND = '#1b2a1f';
const BACKGROUNDS = { outdoor: 0x1b2a1f, indoor: 0x0f0b08, cave: 0x07090b } as const;

/** Maps kept built at once, so walking back and forth across an exit costs nothing. The least recently shown is freed. */
const MAX_MAP_VIEWS = 3;

export interface RendererStats {
  readonly fps: number;
  readonly zoom: number;
  readonly pixelRatio: number;
  readonly visibleChunks: number;
  readonly builtChunks: number;
  readonly visibleObjects: number;
  readonly backend: string;
}

export interface RendererOptions {
  readonly host: HTMLElement;
  readonly game: Game;
  readonly atlas: Atlas;
  readonly zoom: ZoomPreference;
  readonly reducedMotion: boolean;
  /** Lightning flashed: the webview plays thunder. */
  readonly onThunder?: () => void;
}

/**
 * Draws a `Game` with Pixi. It only reads game state: it never changes the simulation, except to tell
 * it how big the view is, because only the renderer knows the display's pixel density.
 */
export class GameRenderer {
  private readonly world = new Container({ label: 'world' });
  private readonly resizeObserver: ResizeObserver;
  private time = 0;
  private frameCount = 0;
  private devicePixelsPerPixel = 3;
  private zoomPreference: ZoomPreference;
  private reducedMotion: boolean;
  private chosenZoom = 3;
  private destroyed = false;
  private readonly views = new Map<string, MapView>();
  private view: MapView;
  private readonly actors: ActorLayer;
  private readonly fishing: FishingView;
  private readonly effects: EffectsLayer;
  private readonly light: AmbientLight;
  private readonly sky: WeatherLayer;
  private readonly tokens: TokenLayer;
  private readonly creatures: CreatureLayer;
  /** The season the maps were drawn for: a new season draws them again. */
  private season: Season;
  private readonly stopEffects: () => void;

  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly game: Game,
    private readonly player: PlayerView,
    private readonly atlas: Atlas,
    options: RendererOptions,
  ) {
    this.zoomPreference = options.zoom;
    this.reducedMotion = options.reducedMotion;

    this.effects = new EffectsLayer(atlas);
    this.actors = new ActorLayer(atlas);
    this.fishing = new FishingView(atlas);
    this.light = new AmbientLight();
    this.sky = new WeatherLayer();
    this.sky.onThunder = options.onThunder;
    this.tokens = new TokenLayer(atlas);
    this.creatures = new CreatureLayer(atlas);
    this.season = game.season;

    this.view = this.buildView(game.map);
    app.renderer.background.color = BACKGROUNDS[game.map.ambient];
    this.world.addChild(this.view.root, this.fishing.container, this.effects.container);
    this.attachActors();
    // The weather is under the light, so a storm at dusk is dark too; the HUD is not on the canvas at all.
    app.stage.addChild(this.world, this.sky.container, this.light.sprite);

    this.stopEffects = game.events.on('effect', ({ kind, x, y }) => {
      if (!this.reducedMotion) this.effects.burst(kind, x, y);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    app.ticker.add(this.onTick);
  }

  static async create(options: RendererOptions): Promise<GameRenderer> {
    const { host, game, atlas } = options;
    const app = new Application();
    const rect = host.getBoundingClientRect();
    await app.init({
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
      roundPixels: true,
      background: BACKGROUND,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';

    return new GameRenderer(app, host, game, new PlayerView(atlas), atlas, options);
  }

  /** The whole-number zoom currently in use. */
  get zoomLevel(): number {
    return this.chosenZoom;
  }

  get stats(): RendererStats {
    return {
      fps: this.app.ticker.FPS,
      zoom: this.chosenZoom,
      pixelRatio: this.app.renderer.resolution,
      visibleChunks: this.view.terrain.visibleChunks,
      builtChunks: this.view.terrain.builtChunks,
      visibleObjects: this.view.objects.visibleObjects,
      backend: this.app.renderer.name,
    };
  }

  setZoom(preference: ZoomPreference): void {
    this.zoomPreference = preference;
    this.resize();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.ticker.remove(this.onTick);
    this.resizeObserver.disconnect();
    this.stopEffects();
    this.actors.destroy();
    this.tokens.destroy();
    this.creatures.destroy();
    this.sky.destroy();
    this.fishing.destroy();
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.effects.destroy();
    this.light.destroy();
    this.app.destroy({ removeView: true }, { children: true });
  }

  /** The view of a map, built the first time it is needed. The most recently shown ones are kept. */
  private buildView(map: GameMap): MapView {
    const known = this.views.get(map.id);
    if (known !== undefined && known.map === map) {
      this.views.delete(map.id); // re-inserted below: the map's order is "least recently shown first"
      this.views.set(map.id, known);
      return known;
    }
    // The game built this map again (the mine's floors come back whole each morning): the old picture of it is out of date.
    if (known !== undefined) {
      known.root.removeFromParent();
      known.destroy();
      this.views.delete(map.id);
    }
    const view = new MapView(map, this.atlas, (id) => this.game.crop(id), this.season);
    this.views.set(map.id, view);
    return view;
  }

  /** Puts the farmer, villagers and animals into the layers of the map showing. */
  private attachActors(): void {
    const { entities, shadows, effects } = this.view.objects;
    this.player.attach({ entities, shadows, effects });
    this.actors.attach(entities, shadows);
    this.tokens.attach(entities);
    this.creatures.attach(entities);
  }

  /** A new season: every map is drawn again, so what changes with the season (the oaks) does. */
  private redrawForSeason(): void {
    this.season = this.game.season;
    const old = [...this.views.values()];
    this.views.clear();
    const next = this.buildView(this.game.map);
    this.world.addChildAt(next.root, 0);
    this.view.root.removeFromParent();
    this.view = next;
    this.attachActors(); // before the old pictures are freed, so no actor goes with them
    for (const view of old) view.destroy();
  }

  /** The player went somewhere else: show that map, and free the maps shown longest ago. */
  private showMap(map: GameMap): void {
    const next = this.buildView(map);
    this.world.addChildAt(next.root, 0);
    this.view.root.removeFromParent();
    this.view = next;
    this.attachActors(); // before anything is freed, so no actor is destroyed with its old map
    this.app.renderer.background.color = BACKGROUNDS[map.ambient];
    for (const [id, old] of this.views) {
      if (this.views.size <= MAX_MAP_VIEWS) break;
      if (id === map.id) continue;
      old.destroy();
      this.views.delete(id);
    }
  }

  /** Re-reads the host's size and the display's pixel density, then lays the view out again. */
  private resize(): void {
    if (this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const ratio = window.devicePixelRatio || 1;
    if (this.app.renderer.resolution !== ratio) this.app.renderer.resolution = ratio;
    this.app.renderer.resize(width, height);
    this.light.resize(width, height);

    this.chosenZoom = chooseZoom(this.zoomPreference, width, height);
    const { devicePixelsPerPixel, logicalZoom } = crispScale(this.chosenZoom, ratio);
    this.devicePixelsPerPixel = devicePixelsPerPixel;
    this.sky.resize(width, height, devicePixelsPerPixel / ratio);
    this.game.setViewport(width, height, logicalZoom);
  }

  private readonly onTick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.25);
    const alpha = this.game.frame(dt);
    if (this.game.map !== this.view.map) this.showMap(this.game.map);
    if (this.game.season !== this.season) this.redrawForSeason();
    const paused = this.game.isPaused;
    if (!paused) this.time += dt;

    // Scale and move the world in whole device pixels, so every art pixel is the same size on screen.
    const camera = this.game.camera;
    const ratio = this.app.renderer.resolution;
    const scale = this.devicePixelsPerPixel;
    this.world.scale.set(scale / ratio);
    this.world.position.set(-Math.round(camera.x * scale) / ratio, -Math.round(camera.y * scale) / ratio);

    const view = camera.bounds();
    const animationClock = this.reducedMotion ? 0 : this.time;
    this.frameCount += 1;
    this.view.update(this.game.farm, view, animationClock, this.frameCount, paused ? 0 : dt, !this.reducedMotion && !paused);
    this.actors.update(this.game, animationClock);

    const feet = this.game.renderPosition(alpha);
    this.player.update(this.game.player, feet, this.game.swing, this.game.fishing !== undefined);
    this.fishing.update(this.game.fishing, feet, animationClock, !this.reducedMotion);
    const quiet = this.game.dialog !== undefined || this.game.summary !== undefined;
    const prompt = quiet ? undefined : this.game.prompt;
    this.player.showArrow(prompt === undefined ? undefined : { x: prompt.x, y: prompt.y }, this.reducedMotion ? 0 : this.time);
    this.effects.showCursor(quiet || this.game.fishing !== undefined ? undefined : this.game.cursor, this.time, !this.reducedMotion);
    if (!paused) this.effects.update(dt);
    this.tokens.update(this.game.huntEggs, animationClock, !this.reducedMotion);
    this.creatures.update(this.game.creaturesHere(), (id) => this.game.world.index.creatureById.get(id)?.sprite, feet, animationClock, !this.reducedMotion);
    const weather = this.game.weather;
    const outdoors = this.game.map.ambient === 'outdoor';
    this.sky.update(weather, outdoors && !this.game.map.sheltered, paused ? 0 : dt, !this.reducedMotion, this.game.map.ambient !== 'cave');
    this.light.update(this.game.clock.minutes, this.game.map.ambient, outdoors ? { season: this.game.season, brightness: dimming(weather) } : undefined);
  };
}
