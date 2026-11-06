import { TILE_SIZE, worldToTile, type Rect } from '../math/coords';

/** Which cells of a map block movement. Anything outside the map blocks too, so nothing can leave the world. */
export class CollisionGrid {
  private readonly solid: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.solid = new Uint8Array(width * height);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  isSolid(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true;
    return (this.solid[ty * this.width + tx] ?? 1) !== 0;
  }

  setSolid(tx: number, ty: number, value: boolean): void {
    if (this.inBounds(tx, ty)) this.solid[ty * this.width + tx] = value ? 1 : 0;
  }

  /** True when any part of the box lies in a blocked cell. */
  boxHitsSolid(box: Rect): boolean {
    const x0 = worldToTile(box.x);
    const x1 = worldToTile(box.x + box.w - 1e-6);
    const y0 = worldToTile(box.y);
    const y1 = worldToTile(box.y + box.h - 1e-6);
    for (let ty = y0; ty <= y1; ty += 1) for (let tx = x0; tx <= x1; tx += 1) if (this.isSolid(tx, ty)) return true;
    return false;
  }
}

/** A corner is "forgiven" when the box only clips it by this many pixels: the player slides round it. */
export const SLIDE_ASSIST = 4;

/** Largest movement resolved in one go. Smaller than a tile, so a box can never skip over a wall. */
const MAX_STEP = 4;

export interface MoveResult {
  /** The box after moving. */
  readonly x: number;
  readonly y: number;
  /** Movement was cut short on that axis. */
  readonly blockedX: boolean;
  readonly blockedY: boolean;
}

/**
 * Moves a box by (dx, dy) against the grid, axis by axis, so the player slides along walls instead of
 * sticking to them. A box that only clips a corner is nudged round it.
 */
export function moveBox(grid: CollisionGrid, box: Rect, dx: number, dy: number): MoveResult {
  let x = box.x;
  let y = box.y;
  let blockedX = false;
  let blockedY = false;

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i < steps; i += 1) {
    if (sx !== 0) {
      const result = stepAxis(grid, { ...box, x, y }, sx, 'x');
      x = result.x;
      y = result.y;
      blockedX ||= result.blocked;
    }
    if (sy !== 0) {
      const result = stepAxis(grid, { ...box, x, y }, sy, 'y');
      x = result.x;
      y = result.y;
      blockedY ||= result.blocked;
    }
  }
  return { x, y, blockedX, blockedY };
}

function stepAxis(
  grid: CollisionGrid,
  box: Rect,
  delta: number,
  axis: 'x' | 'y',
): { x: number; y: number; blocked: boolean } {
  const moved: Rect = axis === 'x' ? { ...box, x: box.x + delta } : { ...box, y: box.y + delta };
  if (!grid.boxHitsSolid(moved)) return { x: moved.x, y: moved.y, blocked: false };

  // Blocked. First see whether we only clip a corner and can slide round it.
  const nudged = tryNudge(grid, box, delta, axis);
  if (nudged !== undefined) return { ...nudged, blocked: false };

  // Otherwise stop flush against the cell we ran into.
  if (axis === 'x') {
    const x =
      delta > 0
        ? worldToTile(box.x + box.w + delta - 1e-6) * TILE_SIZE - box.w
        : (worldToTile(box.x + delta) + 1) * TILE_SIZE;
    return { x, y: box.y, blocked: true };
  }
  const y =
    delta > 0
      ? worldToTile(box.y + box.h + delta - 1e-6) * TILE_SIZE - box.h
      : (worldToTile(box.y + delta) + 1) * TILE_SIZE;
  return { x: box.x, y, blocked: true };
}

/**
 * If moving along `axis` is blocked only by a sliver of one cell at the very edge of the box, shift the box
 * sideways past it (up to SLIDE_ASSIST pixels) and carry on. Returns the new position, or undefined.
 */
function tryNudge(
  grid: CollisionGrid,
  box: Rect,
  delta: number,
  axis: 'x' | 'y',
): { x: number; y: number } | undefined {
  const lead = axis === 'x' ? (delta > 0 ? box.x + box.w + delta : box.x + delta) : delta > 0 ? box.y + box.h + delta : box.y + delta;
  const leadCell = worldToTile(lead - (delta > 0 ? 1e-6 : 0));

  // The cells ahead of the box across its width (for axis x: the rows it spans).
  const lo = axis === 'x' ? box.y : box.x;
  const size = axis === 'x' ? box.h : box.w;
  const first = worldToTile(lo);
  const last = worldToTile(lo + size - 1e-6);
  const blockedAt = (cell: number): boolean => (axis === 'x' ? grid.isSolid(leadCell, cell) : grid.isSolid(cell, leadCell));

  const blockedCells: number[] = [];
  for (let c = first; c <= last; c += 1) if (blockedAt(c)) blockedCells.push(c);
  if (blockedCells.length !== 1) return undefined;

  const cell = blockedCells[0] as number;
  let shift: number;
  if (cell === last && cell !== first) {
    shift = -(lo + size - cell * TILE_SIZE); // clip on the far edge: move back towards the free side
  } else if (cell === first && cell !== last) {
    shift = (cell + 1) * TILE_SIZE - lo; // clip on the near edge: move on towards the free side
  } else {
    return undefined;
  }
  if (Math.abs(shift) > SLIDE_ASSIST) return undefined;

  const nudgedBox: Rect = axis === 'x' ? { ...box, y: box.y + shift } : { ...box, x: box.x + shift };
  if (grid.boxHitsSolid(nudgedBox)) return undefined;
  const advanced: Rect = axis === 'x' ? { ...nudgedBox, x: nudgedBox.x + delta } : { ...nudgedBox, y: nudgedBox.y + delta };
  if (grid.boxHitsSolid(advanced)) return undefined;
  return { x: advanced.x, y: advanced.y };
}
