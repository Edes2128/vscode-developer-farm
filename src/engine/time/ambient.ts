import { WAKE_MINUTE } from './clock';

/**
 * The colour the whole world is tinted with at a time of day. White leaves everything as drawn; the renderer
 * multiplies the picture by this colour. A soft first pass: warm at dawn, clear by day, amber at dusk,
 * blue at night. Real dynamic lighting comes later.
 */
export type Rgb = readonly [number, number, number];

const KEYFRAMES: readonly (readonly [number, Rgb])[] = [
  [WAKE_MINUTE, [255, 222, 196]], // 6:00 am: warm dawn
  [8 * 60, [255, 255, 255]], // 8:00 am: clear
  [17 * 60, [255, 255, 255]], // 5:00 pm: clear
  [19 * 60, [255, 196, 150]], // 7:00 pm: amber dusk
  [21 * 60, [120, 128, 186]], // 9:00 pm: evening blue
  [26 * 60, [78, 88, 146]], // 2:00 am: deep night
];

export function ambientColor(minutes: number): Rgb {
  const first = KEYFRAMES[0] as readonly [number, Rgb];
  const last = KEYFRAMES[KEYFRAMES.length - 1] as readonly [number, Rgb];
  if (minutes <= first[0]) return first[1];
  if (minutes >= last[0]) return last[1];
  for (let i = 1; i < KEYFRAMES.length; i += 1) {
    const [t1, c1] = KEYFRAMES[i] as readonly [number, Rgb];
    if (minutes > t1) continue;
    const [t0, c0] = KEYFRAMES[i - 1] as readonly [number, Rgb];
    const f = (minutes - t0) / (t1 - t0);
    return [Math.round(c0[0] + (c1[0] - c0[0]) * f), Math.round(c0[1] + (c1[1] - c0[1]) * f), Math.round(c0[2] + (c1[2] - c0[2]) * f)];
  }
  return last[1];
}
