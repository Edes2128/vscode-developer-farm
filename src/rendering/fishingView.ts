import { Container, Sprite, Texture } from 'pixi.js';
import type { FishingSession } from '../engine/fishing/session';
import { TILE_SIZE, type Vec2 } from '../engine/math/coords';
import type { Atlas } from './atlas';

/** The bar's inside, in pixels, between its two borders. */
const BAR_WIDTH = 48;
const BAR_INSET = 2;
const INNER = BAR_WIDTH - BAR_INSET * 2;

/**
 * What fishing looks like: a line from the rod to a float on the water, rings spreading round it while you wait, an exclamation
 * mark when something bites, and the timing bar over the farmer's head while you reel. It only reads the session.
 */
export class FishingView {
  readonly container = new Container({ label: 'fishing' });
  private readonly line = new Sprite(Texture.WHITE);
  private readonly bobber: Sprite;
  private readonly ripple: Sprite;
  private readonly bite: Sprite;
  private readonly bar: Sprite;
  private readonly zone: Sprite;
  private readonly marker: Sprite;

  constructor(private readonly atlas: Atlas) {
    this.line.tint = 0xf1e3bc;
    this.line.alpha = 0.85;
    this.bobber = new Sprite(atlas.texture('fx/bobber_0'));
    this.bobber.anchor.set(0.5, 0.75);
    this.ripple = new Sprite(atlas.texture('fx/ripple_0'));
    this.ripple.anchor.set(0.5, 0.5);
    this.bite = new Sprite(atlas.texture('fx/bite_mark'));
    this.bite.anchor.set(0.5, 1);
    this.bar = new Sprite(atlas.texture('fx/fish_bar'));
    this.zone = new Sprite(atlas.texture('fx/fish_zone'));
    this.marker = new Sprite(atlas.texture('fx/fish_marker'));
    this.marker.anchor.set(0.5, 0.5);
    this.container.addChild(this.line, this.ripple, this.bobber, this.bite, this.bar, this.zone, this.marker);
    this.container.visible = false;
  }

  /** @param feet the farmer's interpolated feet position  @param seconds the animation clock */
  update(session: FishingSession | undefined, feet: Vec2, seconds: number, animate: boolean): void {
    if (session === undefined) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    const bx = session.cell.x * TILE_SIZE + TILE_SIZE / 2;
    const by = session.cell.y * TILE_SIZE + TILE_SIZE / 2;

    // The float: still while waiting (with a gentle bob), dipped when something bites.
    const biting = session.phase === 'bite' || session.phase === 'reeling';
    this.bobber.texture = this.atlas.texture(biting ? 'fx/bobber_1' : 'fx/bobber_0');
    this.bobber.position.set(bx, Math.round(by + (animate && !biting ? Math.sin(seconds * 3) * 0.8 : 0)));

    this.ripple.visible = session.phase === 'waiting' || biting;
    this.ripple.position.set(bx, by + 1);
    this.ripple.texture = this.atlas.texture(`fx/ripple_${animate ? Math.floor(seconds * 2.5) % 3 : 0}`);

    // The line runs from about the rod tip to the float.
    const rodX = feet.x;
    const rodY = feet.y - 18;
    const dx = bx - rodX;
    const dy = by - rodY;
    this.line.position.set(rodX, rodY);
    this.line.width = Math.hypot(dx, dy);
    this.line.height = 1;
    this.line.rotation = Math.atan2(dy, dx);

    this.bite.visible = session.phase === 'bite';
    this.bite.position.set(bx, by - 8 - Math.round(animate ? Math.abs(Math.sin(seconds * 10)) * 2 : 0));

    const reeling = session.phase === 'reeling';
    this.bar.visible = reeling;
    this.zone.visible = reeling;
    this.marker.visible = reeling;
    if (reeling) {
      const left = Math.round(feet.x - BAR_WIDTH / 2);
      const top = Math.round(feet.y - 44);
      this.bar.position.set(left, top);
      this.zone.position.set(left + BAR_INSET + Math.round(INNER * session.zone.from), top + 2);
      this.zone.width = Math.max(2, Math.round(INNER * (session.zone.to - session.zone.from)));
      this.zone.height = 4;
      this.marker.position.set(left + BAR_INSET + Math.round(INNER * session.marker), top + 4);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
