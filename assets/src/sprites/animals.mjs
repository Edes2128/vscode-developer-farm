// Farm animals. Each is drawn facing right (the renderer mirrors it), in an idle pose, two walking frames and two pecking ones.
//
// Frame names: animal/<kind>_{idle|walk_0|walk_1|peck_0|peck_1}
import { Img } from '../canvas.mjs';
import { DERIVED, PAL, ramp } from '../color.mjs';

const FEATHERS = ramp(DERIVED.cream, 5, { dark: 0.25, light: 0.2 });

function chicken(pose) {
  const img = new Img(16, 16);
  const feathers = FEATHERS;
  const bob = pose === 'walk_1' ? 1 : 0;
  const peck = pose.startsWith('peck');
  const dip = peck ? (pose === 'peck_1' ? 4 : 2) : 0;

  // legs
  const stride = pose === 'walk_0' ? 1 : pose === 'walk_1' ? -1 : 0;
  img.vline(7 + stride, 12, 3, PAL.sun[1]);
  img.vline(10 - stride, 12, 3, PAL.sun[1]);
  img.hline(6 + stride, 14, 2, PAL.sun[2]);
  img.hline(9 - stride, 14, 2, PAL.sun[2]);

  // body: a plump oval with tail feathers
  img.ellipse(8, 9.5 - bob + (peck ? 1 : 0), 5.2, 3.8, feathers[2]);
  img.ellipse(7.2, 8.4 - bob + (peck ? 1 : 0), 3, 1.8, feathers[3]);
  img.fillRect(2, 5 - bob + (peck ? 1 : 0), 3, 4, feathers[1]);
  img.fillRect(1, 5 - bob + (peck ? 1 : 0), 2, 2, feathers[2]);
  // a wing
  img.ellipse(8, 10 - bob + (peck ? 1 : 0), 2.6, 1.6, PAL.parchment[1]);

  // head, comb, beak, eye
  const hx = 12 + (peck ? 1 : 0);
  const hy = 5 - bob + dip;
  img.ellipse(hx, hy, 2.4, 2.4, feathers[2]);
  img.fillRect(hx - 1, hy - 3, 3, 1, PAL.berry[2]);
  img.set(hx, hy - 4, PAL.berry[2]);
  img.set(hx + 2, hy + 1, PAL.berry[1]);
  img.fillRect(hx + 2, hy, 2, 1, PAL.sun[2]);
  img.set(hx + 1, hy - 1, PAL.ink);
  if (!peck) img.fillRect(10, 7 - bob, 3, 2, feathers[2]);
  else img.fillRect(10, 6, 3, 3 + dip / 2, feathers[2]);
  img.outline(PAL.inkWarm);
  return img;
}

/** @param {Map<string, Img>} frames */
export function buildAnimals(frames) {
  for (const pose of ['idle', 'walk_0', 'walk_1', 'peck_0', 'peck_1']) frames.set(`animal/chicken_${pose}`, chicken(pose));
}
