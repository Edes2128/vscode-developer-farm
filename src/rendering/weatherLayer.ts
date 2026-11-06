import { Container, Sprite, Texture } from 'pixi.js';
import type { Weather } from '../engine/weather/types';

/**
 * Rain, storms and snow, drawn over the world as a screen of falling specks. Everything here is cosmetic: it reads the day's
 * weather from the game and never changes the simulation, so it may use its own dice. Specks are sized in art pixels (so they
 * match the world's pixels at any zoom) and live in screen space, so they keep falling as the camera moves.
 *
 * Reduced motion: nothing falls and nothing flashes (the dimmer light and the HUD's weather icon still tell the player).
 */

interface Speck {
  readonly sprite: Sprite;
  /** Position in art pixels, within the screen. */
  x: number;
  y: number;
  /** Per-speck variation: speed, and for snow the sway phase. */
  speed: number;
  phase: number;
}

const RAIN_COLOR = 0xb9d3e6;
const SNOW_COLOR = 0xffffff;

/** A small deterministic generator, so a given weather looks the same on every start. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class WeatherLayer {
  readonly container = new Container({ label: 'weather' });
  private readonly specks: Speck[] = [];
  private readonly flash = new Sprite(Texture.WHITE);
  private readonly random = makeRandom(0x5eed);
  private weather: Weather = 'sun';
  private width = 1;
  private height = 1;
  private scale = 3;
  private clock = 0;
  private nextFlash = 6;
  private flashLeft = 0;
  /** Called each time lightning flashes, so the thunder can be heard (the renderer passes it on; nothing here makes sound). */
  onThunder: (() => void) | undefined;

  constructor() {
    this.flash.tint = 0xf4f0ff;
    this.flash.alpha = 0;
    this.flash.label = 'lightning';
    this.container.addChild(this.flash);
    this.container.eventMode = 'none';
  }

  /** @param pixelScale screen pixels (in the stage's units) per art pixel */
  resize(width: number, height: number, pixelScale: number): void {
    this.width = width;
    this.height = height;
    this.scale = Math.max(1, pixelScale);
    this.flash.width = width;
    this.flash.height = height;
    this.fit();
  }

  /**
   * @param weather today's weather  @param visible false indoors, in caves and on any map the sky cannot be seen from
   * @param dt seconds since the last frame (0 while paused)  @param animate false for reduced motion
   * @param audible false where nothing of the sky is heard (a cave): thunder is still heard indoors and with motion calmed, only the flash is not
   */
  update(weather: Weather, visible: boolean, dt: number, animate: boolean, audible = true): void {
    const falling = weather === 'rain' || weather === 'storm' || weather === 'snow';
    const show = visible && falling && animate;
    if (weather !== this.weather) {
      this.weather = weather;
      this.fit();
    }
    this.container.visible = show;
    if (!show) {
      // No rain on screen, but a storm still rumbles (for the ears only): the flash stays off.
      if (weather === 'storm' && audible && dt > 0) this.thunder(dt, false);
      this.flash.alpha = 0;
      return;
    }
    this.clock += dt;
    const widthArt = this.width / this.scale;
    const heightArt = this.height / this.scale;
    for (const speck of this.specks) {
      if (this.weather === 'snow') {
        speck.y += speck.speed * dt;
        speck.x += Math.sin(this.clock * 1.3 + speck.phase) * 6 * dt + 3 * dt;
      } else {
        const fall = speck.speed * dt;
        speck.y += fall;
        speck.x -= fall * (this.weather === 'storm' ? 0.45 : 0.2); // blown a little sideways by the wind
      }
      if (speck.y > heightArt) {
        speck.y -= heightArt + 8;
        speck.x = this.random() * widthArt;
      }
      if (speck.x < -4) speck.x += widthArt + 8;
      else if (speck.x > widthArt + 4) speck.x -= widthArt + 8;
      speck.sprite.position.set(Math.round(speck.x) * this.scale, Math.round(speck.y) * this.scale);
    }
    this.thunder(dt, true);
  }

  /** An occasional flash during a storm: a quick white wash that fades out. */
  private thunder(dt: number, flash: boolean): void {
    if (this.weather !== 'storm') {
      this.flash.alpha = 0;
      return;
    }
    this.nextFlash -= dt;
    if (this.nextFlash <= 0) {
      this.flashLeft = flash ? 0.35 : 0;
      this.onThunder?.();
      this.nextFlash = 7 + this.random() * 9;
    }
    if (this.flashLeft > 0) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      this.flash.alpha = 0.45 * (this.flashLeft / 0.35) ** 2;
    } else this.flash.alpha = 0;
  }

  /** The number of specks follows the size of the screen and the kind of weather; their shapes follow the weather. */
  private fit(): void {
    const area = (this.width / this.scale) * (this.height / this.scale);
    const wanted = this.weather === 'rain' ? area / 260 : this.weather === 'storm' ? area / 130 : this.weather === 'snow' ? area / 380 : 0;
    const count = Math.min(420, Math.floor(wanted));
    const widthArt = this.width / this.scale;
    const heightArt = this.height / this.scale;
    while (this.specks.length > count) this.specks.pop()?.sprite.destroy();
    while (this.specks.length < count) {
      const sprite = new Sprite(Texture.WHITE);
      this.container.addChildAt(sprite, this.container.children.length - 1); // under the lightning
      this.specks.push({ sprite, x: this.random() * widthArt, y: this.random() * heightArt, speed: 0, phase: this.random() * 6.28 });
    }
    for (const speck of this.specks) {
      const jitter = this.random();
      if (this.weather === 'snow') {
        speck.speed = 14 + jitter * 12;
        speck.sprite.tint = SNOW_COLOR;
        speck.sprite.alpha = 0.85;
        const size = jitter > 0.7 ? 2 : 1;
        speck.sprite.width = size * this.scale;
        speck.sprite.height = size * this.scale;
      } else {
        const storm = this.weather === 'storm';
        speck.speed = (storm ? 170 : 120) + jitter * 60;
        speck.sprite.tint = RAIN_COLOR;
        speck.sprite.alpha = storm ? 0.8 : 0.7;
        speck.sprite.width = this.scale;
        speck.sprite.height = (storm ? 7 : 5) * this.scale;
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
