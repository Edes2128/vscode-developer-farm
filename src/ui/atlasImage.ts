import type { CSSProperties } from 'react';
import atlasUrl from '../assets/generated/world.png?url';
import manifest from '../assets/generated/world.json';

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const frames = manifest.frames as Readonly<Record<string, Frame>>;

/**
 * Style that shows one frame of the sprite atlas in an element, scaled by a CSS length (`3`, `var(--hb)`).
 * The HUD uses the same atlas as the game, so item icons are drawn once and look identical in both.
 * Returns undefined for a frame that does not exist, so a missing icon is an empty box rather than a crash.
 */
export function frameStyle(name: string, scale: string): CSSProperties | undefined {
  const f = frames[name];
  if (f === undefined) return undefined;
  return {
    width: `calc(${f.w}px * ${scale})`,
    height: `calc(${f.h}px * ${scale})`,
    backgroundImage: `url(${atlasUrl})`,
    backgroundSize: `calc(${manifest.size.w}px * ${scale}) calc(${manifest.size.h}px * ${scale})`,
    backgroundPosition: `calc(${-f.x}px * ${scale}) calc(${-f.y}px * ${scale})`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}
