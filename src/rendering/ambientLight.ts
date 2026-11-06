import { Sprite, Texture } from 'pixi.js';
import { ambientColor } from '../engine/time/ambient';
import type { Season } from '../engine/time/calendar';

/**
 * The time of day, as a colour the whole picture is multiplied by: warm at dawn, clear by day, amber at dusk,
 * blue at night. A single screen-sized sprite, so it costs almost nothing. It tints the world, never the HUD.
 */
/** What the light is like where the player is: the time of day outdoors, a steady lamp indoors, a dim cool dark in a cave. */
export type AmbientMode = 'outdoor' | 'indoor' | 'cave';

const FIXED: Readonly<Record<'indoor' | 'cave', readonly [number, number, number]>> = {
  indoor: [255, 232, 196],
  cave: [178, 188, 218],
};

/**
 * The colour of the season, multiplied into the daylight outdoors: fresh in spring, warm in summer, amber in autumn, cool and pale in
 * winter. This is colour grading, not new ground: the same tiles are drawn in every season (the oaks turn in autumn; see `seasonal`).
 */
const SEASON_GRADE: Readonly<Record<Season, readonly [number, number, number]>> = {
  spring: [250, 255, 244],
  summer: [255, 251, 236],
  autumn: [255, 230, 198],
  winter: [212, 226, 252],
};

/** What the sky is doing outdoors: the season's colour, and how much of the light the weather lets through (0 to 1). */
export interface Sky {
  readonly season: Season;
  readonly brightness: number;
}

export class AmbientLight {
  readonly sprite = new Sprite(Texture.WHITE);
  private lastKey = -1;
  private lastMode: AmbientMode | undefined;
  private lastSky = '';

  constructor() {
    this.sprite.blendMode = 'multiply';
    this.sprite.label = 'ambient light';
  }

  resize(width: number, height: number): void {
    this.sprite.width = width;
    this.sprite.height = height;
  }

  update(minutes: number, mode: AmbientMode = 'outdoor', sky?: Sky): void {
    // The colour only changes every few game minutes; no need to touch the sprite more often.
    const key = mode === 'outdoor' ? Math.floor(minutes / 2) : 0;
    const skyKey = mode === 'outdoor' && sky !== undefined ? `${sky.season}:${sky.brightness}` : '';
    if (key === this.lastKey && mode === this.lastMode && skyKey === this.lastSky) return;
    this.lastKey = key;
    this.lastMode = mode;
    this.lastSky = skyKey;
    let [r, g, b] = mode === 'outdoor' ? ambientColor(minutes) : FIXED[mode];
    if (mode === 'outdoor' && sky !== undefined) {
      const [gr, gg, gb] = SEASON_GRADE[sky.season];
      const k = Math.min(1, Math.max(0, sky.brightness));
      r = Math.round((r * gr * k) / 255);
      g = Math.round((g * gg * k) / 255);
      b = Math.round((b * gb * k) / 255);
    }
    this.sprite.tint = (r << 16) | (g << 8) | b;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
