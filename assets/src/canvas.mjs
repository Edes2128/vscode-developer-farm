// A tiny RGBA pixel canvas with just the drawing operations pixel art needs.
// Coordinates are integers; colours are [r, g, b] arrays plus an optional alpha (0-255).

export class Img {
  /** @param {number} w @param {number} h */
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Opaque or translucent write (replaces the pixel). */
  set(x, y, color, alpha = 255) {
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = alpha;
  }

  /** Alpha-over blend onto what is already there. */
  over(x, y, color, alpha = 255) {
    if (!this.inside(x, y) || alpha <= 0) return;
    const i = (y * this.w + x) * 4;
    const da = this.data[i + 3] / 255;
    const sa = alpha / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (let c = 0; c < 3; c += 1) {
      this.data[i + c] = (color[c] * sa + this.data[i + c] * da * (1 - sa)) / oa;
    }
    this.data[i + 3] = oa * 255;
  }

  alphaAt(x, y) {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0;
  }

  colorAt(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  fillRect(x, y, w, h, color, alpha = 255) {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) this.set(xx, yy, color, alpha);
  }

  fill(color, alpha = 255) {
    this.fillRect(0, 0, this.w, this.h, color, alpha);
  }

  hline(x, y, length, color, alpha = 255) {
    for (let i = 0; i < length; i += 1) this.set(x + i, y, color, alpha);
  }

  vline(x, y, length, color, alpha = 255) {
    for (let i = 0; i < length; i += 1) this.set(x, y + i, color, alpha);
  }

  /** Filled ellipse centred on (cx, cy), radii in pixels. */
  ellipse(cx, cy, rx, ry, color, alpha = 255, blend = false) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) (blend ? this.over : this.set).call(this, x, y, color, alpha);
      }
    }
  }

  /** Draws `src` with its top-left at (dx, dy), alpha-over. */
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y += 1) {
      for (let x = 0; x < src.w; x += 1) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3];
        if (a > 0) this.over(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2]], a);
      }
    }
  }

  /** A copy of the rectangle (x, y, w, h). */
  crop(x, y, w, h) {
    const out = new Img(w, h);
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        const sx = x + xx;
        const sy = y + yy;
        if (!this.inside(sx, sy)) continue;
        const i = (sy * this.w + sx) * 4;
        const o = (yy * w + xx) * 4;
        out.data[o] = this.data[i];
        out.data[o + 1] = this.data[i + 1];
        out.data[o + 2] = this.data[i + 2];
        out.data[o + 3] = this.data[i + 3];
      }
    }
    return out;
  }

  flipH() {
    const out = new Img(this.w, this.h);
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const i = (y * this.w + (this.w - 1 - x)) * 4;
        const o = (y * this.w + x) * 4;
        out.data[o] = this.data[i];
        out.data[o + 1] = this.data[i + 1];
        out.data[o + 2] = this.data[i + 2];
        out.data[o + 3] = this.data[i + 3];
      }
    }
    return out;
  }

  /**
   * Adds a one-pixel outline: every transparent pixel next to an opaque one takes `color`.
   * Leave a one-pixel margin around the artwork or the outline is clipped.
   */
  outline(color, { diagonals = false } = {}) {
    const marks = [];
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (this.alphaAt(x, y) > 0) continue;
        const near =
          this.alphaAt(x - 1, y) > 200 ||
          this.alphaAt(x + 1, y) > 200 ||
          this.alphaAt(x, y - 1) > 200 ||
          this.alphaAt(x, y + 1) > 200 ||
          (diagonals &&
            (this.alphaAt(x - 1, y - 1) > 200 ||
              this.alphaAt(x + 1, y - 1) > 200 ||
              this.alphaAt(x - 1, y + 1) > 200 ||
              this.alphaAt(x + 1, y + 1) > 200));
        if (near) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.set(x, y, color);
    return this;
  }

  /** Paints a sprite described by an ASCII picture. `key` maps characters to colours ('.' is clear). */
  static fromAscii(rows, key) {
    const h = rows.length;
    const w = Math.max(...rows.map((row) => row.length));
    const img = new Img(w, h);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        const color = key[ch];
        if (color === undefined) throw new Error(`Unknown ASCII sprite key "${ch}"`);
        img.set(x, y, color);
      });
    });
    return img;
  }

  /** Repeats every pixel `scale` times in both directions. */
  scaled(scale) {
    const out = new Img(this.w * scale, this.h * scale);
    for (let y = 0; y < out.h; y += 1) {
      for (let x = 0; x < out.w; x += 1) {
        const i = (Math.floor(y / scale) * this.w + Math.floor(x / scale)) * 4;
        const o = (y * out.w + x) * 4;
        out.data[o] = this.data[i];
        out.data[o + 1] = this.data[i + 1];
        out.data[o + 2] = this.data[i + 2];
        out.data[o + 3] = this.data[i + 3];
      }
    }
    return out;
  }
}
