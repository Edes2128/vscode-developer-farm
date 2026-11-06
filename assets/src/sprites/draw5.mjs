// Small drawing helpers shared by the Phase 5 sprite modules (home, buildings, cooking, museum).
import { mix, PAL, ramp } from '../color.mjs';

export const WARM = [255, 240, 176];
export const COOL = [40, 44, 84];
export const INK = PAL.ink;
export const INK_WARM = PAL.inkWarm;

/** A colour nudged towards warm light, or towards cool shadow. */
export const lit = (c, t = 0.25) => mix(c, WARM, t);
export const shade = (c, t = 0.3) => mix(c, COOL, t);

/** Wraps a coordinate onto the 16-pixel torus (for seamless tiles). */
export const wrap = (v) => ((v % 16) + 16) % 16;

/**
 * Paints a turned shape (jar, vase, pot, column) row by row from half-widths, lit from the left.
 * `cx` is the pixel boundary the shape is symmetric about: a half-width of 3 covers cx-3 .. cx+2.
 */
export function lathe(img, cx, y0, halves, colors) {
  halves.forEach((hw, i) => {
    if (hw <= 0) return;
    const left = cx - hw;
    const width = hw * 2;
    for (let k = 0; k < width; k += 1) {
      const rel = (k + 0.5) / width;
      const t = rel < 0.15 ? 4 : rel < 0.4 ? 3 : rel < 0.68 ? 2 : rel < 0.88 ? 1 : 0;
      img.set(left + k, y0 + i, colors[t]);
    }
  });
}

/** A rolling horizontal band painted over a lathe shape: `hw` is the half-width of that row. */
export function band(img, cx, y, hw, color, lightColor = color) {
  const left = cx - hw;
  for (let k = 0; k < hw * 2; k += 1) img.set(left + k, y, k < Math.ceil(hw * 0.6) ? lightColor : color);
}

/** A glowing, soft-edged halo: opacity falls away in a few clear steps. Only touches clear pixels. */
export function halo(img, cx, cy, r, color, { steps = [60, 38, 18] } = {}) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if (img.alphaAt(x, y) > 0) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const a = d < 0.45 ? steps[0] : d < 0.72 ? steps[1] : steps[2];
      img.set(x, y, color, a);
    }
  }
}

/** A filled convex polygon (points are [x, y] in pixel space), painted by `colorAt(x, y)`. */
export function polygon(img, points, colorAt) {
  const ys = points.map((p) => p[1]);
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x += 1) {
        const c = colorAt(x, y);
        if (c) img.set(x, y, c);
      }
    }
  }
}

/** A Bresenham line of one-pixel width. */
export function line(img, x0, y0, x1, y1, color) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    img.set(x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** A spiral of single pixels from `r0` out to `r1`, winding `turns` times: the ammonite's coil. */
export function spiral(img, cx, cy, r0, r1, turns, colorAt, { squash = 1, start = 0 } = {}) {
  const steps = Math.ceil(turns * 40);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = start + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    img.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * squash), colorAt(t));
  }
}

export { mix, PAL, ramp };
