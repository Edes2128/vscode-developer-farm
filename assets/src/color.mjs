// Colour helpers. Colours are [r, g, b] (0-255) arrays; alpha is handled by the canvas.
import { readFileSync } from 'node:fs';

const palette = JSON.parse(
  readFileSync(new URL('../../src/data/palette.json', import.meta.url), 'utf8'),
);

export const hex = (value) => {
  const v = value.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

export const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Shadows lean cool and deep, highlights lean warm: the hue-shifted ramps that keep pixel art lively. */
const SHADOW_TINT = [40, 44, 84];
const LIGHT_TINT = [255, 240, 176];

/**
 * A ramp of `steps` colours from darkest to lightest, with `base` in the middle.
 * @param {number[]} base @param {number} steps
 */
export function ramp(base, steps = 5, { dark = 0.55, light = 0.5 } = {}) {
  const out = [];
  const mid = (steps - 1) / 2;
  for (let i = 0; i < steps; i += 1) {
    const t = (i - mid) / mid;
    out.push(t < 0 ? mix(base, SHADOW_TINT, -t * dark) : mix(base, LIGHT_TINT, t * light));
  }
  return out;
}

export const BRAND = Object.fromEntries(
  Object.entries(palette.brand).map(([name, value]) => [name, hex(value)]),
);
export const DERIVED = Object.fromEntries(
  Object.entries(palette.derived).map(([name, value]) => [name, hex(value)]),
);

export const PAL = {
  grass: ramp(BRAND.sageGreen, 5),
  forest: ramp(BRAND.forestGreen, 5),
  gold: ramp(BRAND.wheatGold, 5),
  clay: ramp(BRAND.terracotta, 5),
  water: ramp(BRAND.riverBlue, 5),
  // Packed earth: terracotta pulled towards wheat and greyed a little so paths read as dirt, not clay.
  dirt: ramp(mix(mix(BRAND.wheatGold, BRAND.terracotta, 0.42), [150, 130, 100], 0.25), 5),
  sand: ramp(mix(BRAND.wheatGold, [255, 245, 220], 0.4), 5),
  bark: ramp(mix(DERIVED.wood, DERIVED.woodDark, 0.15), 5),
  plank: ramp(DERIVED.woodLight, 5),
  stone: ramp(DERIVED.stone, 5),
  parchment: ramp(DERIVED.parchment, 5, { dark: 0.3, light: 0.3 }),
  skin: ramp([232, 182, 142], 3, { dark: 0.3, light: 0.2 }),
  hair: ramp([110, 70, 48], 3),
  berry: ramp(DERIVED.berry, 3),
  blossom: ramp(DERIVED.blossom, 3),
  sun: ramp(DERIVED.sun, 3),
  violet: ramp(DERIVED.violet, 3),
  sky: ramp(DERIVED.sky, 3),
  white: ramp(DERIVED.cream, 3, { dark: 0.2, light: 0.1 }),
  ink: DERIVED.ink,
  inkWarm: DERIVED.inkWarm,
};
