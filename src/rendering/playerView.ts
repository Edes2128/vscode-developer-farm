import { Container, Sprite } from 'pixi.js';
import { SWING_SECONDS, type ToolSwing } from '../engine/game';
import { DIRECTION_VECTORS, type Direction, type Vec2 } from '../engine/math/coords';
import { walkFrame, type PlayerState } from '../engine/player/player';
import type { Atlas } from './atlas';
import { INTERACT_ARROW_FRAME, playerFrame, SHADOW_PLAYER_FRAME, toolFrame } from './frameNames';

/** Where the tool is held at one moment of a swing, from the farmer's feet; rotation in quarter turns. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly quarterTurns: number;
}

interface ToolPoses {
  /** Drawn behind the farmer (they face away from the viewer). */
  readonly behind: boolean;
  /** Mirrored left to right. */
  readonly flip: boolean;
  /** Wind-up, strike, follow-through. */
  readonly steps: readonly [Pose, Pose, Pose];
}

/**
 * The farmer's swing is the standing picture plus a tool moved through three poses and a small lean: simple, but
 * it reads as a swing and needs no new character art. Proper swing frames are a later art job.
 */
const POSES: Readonly<Record<'hoe' | 'watering_can', Readonly<Record<Direction, ToolPoses>>>> = {
  hoe: {
    down: { behind: false, flip: false, steps: [{ x: 7, y: -21, quarterTurns: 0 }, { x: 5, y: -4, quarterTurns: 1 }, { x: 7, y: -10, quarterTurns: 0 }] },
    up: { behind: true, flip: false, steps: [{ x: 6, y: -22, quarterTurns: 0 }, { x: 4, y: -29, quarterTurns: 0 }, { x: 6, y: -24, quarterTurns: 0 }] },
    right: { behind: false, flip: false, steps: [{ x: 8, y: -20, quarterTurns: 0 }, { x: 11, y: -8, quarterTurns: 1 }, { x: 9, y: -13, quarterTurns: 0 }] },
    left: { behind: false, flip: true, steps: [{ x: -8, y: -20, quarterTurns: 0 }, { x: -11, y: -8, quarterTurns: -1 }, { x: -9, y: -13, quarterTurns: 0 }] },
  },
  watering_can: {
    down: { behind: false, flip: false, steps: [{ x: 8, y: -11, quarterTurns: 0 }, { x: 8, y: -9, quarterTurns: -1 }, { x: 8, y: -11, quarterTurns: 0 }] },
    up: { behind: true, flip: false, steps: [{ x: 8, y: -16, quarterTurns: 0 }, { x: 5, y: -24, quarterTurns: 1 }, { x: 8, y: -17, quarterTurns: 0 }] },
    right: { behind: false, flip: true, steps: [{ x: 11, y: -10, quarterTurns: 0 }, { x: 11, y: -9, quarterTurns: 1 }, { x: 11, y: -10, quarterTurns: 0 }] },
    left: { behind: false, flip: false, steps: [{ x: -11, y: -10, quarterTurns: 0 }, { x: -11, y: -9, quarterTurns: -1 }, { x: -11, y: -10, quarterTurns: 0 }] },
  },
};

/** The farmer on screen: a body that joins the depth-sorted entities, a shadow on the ground, and the tool in hand. */
export class PlayerView {
  readonly body: Sprite;
  readonly shadow: Sprite;
  /** The bobbing arrow shown over whatever the player can interact with. */
  readonly arrow: Sprite;
  /** The tool while it is being swung. Shares the entities' layer with the body. */
  readonly tool: Sprite;

  constructor(private readonly atlas: Atlas) {
    this.body = new Sprite(atlas.texture(playerFrame('down', false, 0)));
    this.body.anchor.set(0.5, 1);
    this.shadow = new Sprite(atlas.texture(SHADOW_PLAYER_FRAME));
    this.shadow.anchor.set(0.5, 0.5);
    this.arrow = new Sprite(atlas.texture(INTERACT_ARROW_FRAME));
    this.arrow.anchor.set(0.5, 1);
    this.arrow.visible = false;
    this.tool = new Sprite(atlas.texture(toolFrame('hoe')));
    this.tool.anchor.set(0.5, 0.5);
    this.tool.visible = false;
  }

  /** Moves the farmer into the layers of the map now showing. */
  attach(layers: { readonly entities: Container; readonly shadows: Container; readonly effects: Container }): void {
    layers.shadows.addChild(this.shadow);
    layers.entities.addChild(this.body, this.tool);
    layers.effects.addChild(this.arrow);
  }

  /** Puts the sprites where the player is. `at` is the interpolated feet position in world pixels. */
  update(player: PlayerState, at: Vec2, swing: ToolSwing | undefined, fishing = false): void {
    // Whole pixels only: a sprite between pixels would shimmer when the world is scaled up.
    let x = Math.round(at.x);
    let y = Math.round(at.y);
    this.shadow.position.set(x, y - 2);
    this.body.texture = this.atlas.texture(playerFrame(player.facing, player.moving, walkFrame(player.stride)));

    if (swing === undefined && fishing) {
      // Holding the rod out over the water while the line is down.
      const poses = POSES.watering_can[player.facing];
      const pose = poses.steps[2];
      this.tool.texture = this.atlas.texture(toolFrame('fishing_rod'));
      this.tool.visible = true;
      this.tool.scale.x = poses.flip ? -1 : 1;
      this.tool.rotation = (pose.quarterTurns * Math.PI) / 2;
      this.tool.position.set(Math.round(at.x) + pose.x, Math.round(at.y) + pose.y);
      this.tool.zIndex = Math.round(at.y) + (poses.behind ? -1 : 1);
    } else if (swing === undefined) {
      this.tool.visible = false;
    } else {
      const progress = Math.min(0.999, swing.elapsed / SWING_SECONDS[swing.kind]);
      const step = progress < 0.35 ? 0 : progress < 0.7 ? 1 : 2;
      // Lean back for the wind-up, forward for the strike.
      const lean = step === 0 ? -1 : step === 1 ? 1 : 0;
      const direction = DIRECTION_VECTORS[player.facing];
      x += direction.x * lean;
      y += direction.y * lean;

      if (swing.kind === 'seed') {
        this.tool.visible = false;
      } else {
        // The pickaxe swings like the hoe; the rod is raised and cast like the can is tipped.
        const poses = POSES[swing.kind === 'pickaxe' ? 'hoe' : swing.kind === 'fishing_rod' ? 'watering_can' : swing.kind][player.facing];
        const pose = poses.steps[step];
        this.tool.texture = this.atlas.texture(toolFrame(swing.kind));
        this.tool.visible = true;
        this.tool.scale.x = poses.flip ? -1 : 1;
        this.tool.rotation = (pose.quarterTurns * Math.PI) / 2;
        this.tool.position.set(Math.round(at.x) + pose.x, Math.round(at.y) + pose.y);
        // In front of the body, or behind it when the farmer faces away; just either side of the body's sort key.
        this.tool.zIndex = Math.round(at.y) + (poses.behind ? -1 : 1);
      }
    }

    this.body.position.set(x, y);
    // In front of anything whose base is above the player's feet, behind anything below them.
    this.body.zIndex = Math.round(at.y);
  }

  /** Shows the interaction arrow over a cell, bobbing with `seconds`. Pass undefined to hide it. */
  showArrow(cell: { x: number; y: number } | undefined, seconds: number): void {
    this.arrow.visible = cell !== undefined;
    if (cell === undefined) return;
    this.arrow.position.set(cell.x * 16 + 8, cell.y * 16 - 1 - Math.round(1.5 + Math.sin(seconds * 6) * 1.5));
  }
}
