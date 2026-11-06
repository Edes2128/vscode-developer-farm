import { Container, Sprite, Texture } from 'pixi.js';
import type { EffectKind, UseCursor } from '../engine/game';
import { TILE_SIZE } from '../engine/math/coords';
import type { Atlas } from './atlas';
import { CURSOR_FRAME_NO, CURSOR_FRAME_OK } from './frameNames';

interface Particle {
  readonly sprite: Sprite;
  alive: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
}

interface Burst {
  readonly count: number;
  readonly colors: readonly number[];
  readonly speed: number;
  /** Initial upward push, in pixels per second. */
  readonly lift: number;
  readonly gravity: number;
  readonly life: number;
  /** Where in the cell the burst starts, from the top, as a fraction. */
  readonly originY: number;
}

const BURSTS: Readonly<Record<EffectKind, Burst>> = {
  till: { count: 9, colors: [0x6b4a35, 0x8a6244, 0x4e3624], speed: 26, lift: 38, gravity: 150, life: 0.45, originY: 0.5 },
  water: { count: 7, colors: [0x86adbd, 0x668fa1, 0xcfe3e8], speed: 10, lift: -6, gravity: 130, life: 0.5, originY: 0.1 },
  refill: { count: 8, colors: [0x86adbd, 0xcfe3e8], speed: 16, lift: 30, gravity: 120, life: 0.5, originY: 0.5 },
  plant: { count: 6, colors: [0x8faf69, 0x527b50, 0xb7d08f], speed: 14, lift: 24, gravity: 90, life: 0.4, originY: 0.6 },
  harvest: { count: 10, colors: [0xf2d16b, 0xfff6dc, 0xd9b76c], speed: 24, lift: 44, gravity: 110, life: 0.6, originY: 0.5 },
  mine: { count: 5, colors: [0xcfc8bb, 0x9a948a, 0xfff6dc], speed: 24, lift: 26, gravity: 140, life: 0.35, originY: 0.5 },
  break: { count: 12, colors: [0x9a948a, 0x6d675f, 0xcfc8bb], speed: 32, lift: 38, gravity: 150, life: 0.5, originY: 0.5 },
  splash: { count: 9, colors: [0x86adbd, 0xcfe3e8, 0xffffff], speed: 20, lift: 48, gravity: 130, life: 0.55, originY: 0.4 },
  dig: { count: 8, colors: [0x6b4a35, 0x8a6244, 0xd9c9a0], speed: 22, lift: 34, gravity: 140, life: 0.45, originY: 0.5 },
  place: { count: 6, colors: [0xfff6dc, 0xf2d16b, 0xd9b76c], speed: 12, lift: 20, gravity: 60, life: 0.5, originY: 0.5 },
  pet: { count: 5, colors: [0xe9a0a0, 0xf4c6c6, 0xfff6dc], speed: 12, lift: 34, gravity: 60, life: 0.7, originY: 0.2 },
  ship: { count: 8, colors: [0xf2d16b, 0xd9b76c, 0xfff6dc], speed: 20, lift: 40, gravity: 120, life: 0.55, originY: 0.3 },
};

const POOL_LIMIT = 160;

/**
 * Small effects on top of the world: the placement cursor and the bursts of particles when something happens
 * on a cell. Particles are 2 x 2 pixel squares, so they stay as crisp as the rest of the art.
 */
export class EffectsLayer {
  readonly container = new Container({ label: 'farm effects' });
  private readonly cursorOk: Sprite;
  private readonly cursorNo: Sprite;
  private readonly particles: Particle[] = [];
  private random = 1;

  constructor(atlas: Atlas) {
    this.cursorOk = new Sprite(atlas.texture(CURSOR_FRAME_OK));
    this.cursorNo = new Sprite(atlas.texture(CURSOR_FRAME_NO));
    this.cursorOk.visible = false;
    this.cursorNo.visible = false;
    this.container.addChild(this.cursorOk, this.cursorNo);
  }

  /** Shows the cursor on a cell, or hides it. `seconds` makes it breathe a little. */
  showCursor(cursor: UseCursor | undefined, seconds: number, animate: boolean): void {
    this.cursorOk.visible = cursor !== undefined && cursor.valid;
    this.cursorNo.visible = cursor !== undefined && !cursor.valid;
    if (cursor === undefined) return;
    const sprite = cursor.valid ? this.cursorOk : this.cursorNo;
    sprite.position.set(cursor.x * TILE_SIZE, cursor.y * TILE_SIZE);
    sprite.alpha = animate ? 0.78 + Math.sin(seconds * 5) * 0.2 : 0.9;
  }

  /** A little burst on a cell. */
  burst(kind: EffectKind, cellX: number, cellY: number): void {
    const burst = BURSTS[kind];
    for (let i = 0; i < burst.count; i += 1) {
      const particle = this.particles.find((p) => !p.alive) ?? this.newParticle();
      if (particle === undefined) return;
      const angle = this.rand() * Math.PI * 2;
      particle.alive = true;
      particle.age = 0;
      particle.life = burst.life * (0.7 + this.rand() * 0.6);
      particle.x = cellX * TILE_SIZE + 4 + this.rand() * 8;
      particle.y = cellY * TILE_SIZE + burst.originY * TILE_SIZE;
      particle.vx = Math.cos(angle) * burst.speed * (0.4 + this.rand() * 0.6);
      particle.vy = -burst.lift * (0.6 + this.rand() * 0.6) + Math.sin(angle) * burst.speed * 0.3;
      particle.gravity = burst.gravity;
      particle.sprite.tint = burst.colors[Math.floor(this.rand() * burst.colors.length)] ?? 0xffffff;
      particle.sprite.alpha = 1;
      particle.sprite.visible = true;
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.sprite.visible = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.position.set(Math.round(p.x), Math.round(p.y));
      p.sprite.alpha = Math.min(1, (1 - p.age / p.life) * 1.6);
    }
  }

  private newParticle(): Particle | undefined {
    if (this.particles.length >= POOL_LIMIT) return undefined;
    const sprite = new Sprite(Texture.WHITE);
    sprite.width = 2;
    sprite.height = 2;
    sprite.visible = false;
    this.container.addChild(sprite);
    const particle: Particle = { sprite, alive: false, age: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0, gravity: 0 };
    this.particles.push(particle);
    return particle;
  }

  /** Cheap deterministic noise: effects do not need real randomness, and this keeps them reproducible. */
  private rand(): number {
    this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0;
    return this.random / 4294967296;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
