import type { Preferences } from '../engine/persistence/preferences';

export type ZoomPreference = Preferences['zoom'];

/** Roughly how much world the player sees by default: 18 x 12 cells at the automatic zoom. */
const AUTO_TARGET_WIDTH = 18 * 16;
const AUTO_TARGET_HEIGHT = 12 * 16;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/** The whole-number zoom to use for a viewport of `width` x `height` logical pixels. */
export function chooseZoom(preference: ZoomPreference, width: number, height: number): number {
  if (preference !== 'auto') return preference;
  const fit = Math.floor(Math.min(width / AUTO_TARGET_WIDTH, height / AUTO_TARGET_HEIGHT));
  return Math.min(5, Math.max(2, fit));
}

/**
 * Pixel art stays crisp only if one art pixel covers a whole number of device pixels. On a 1.25x display
 * a zoom of 3 would be 3.75 device pixels per art pixel and shimmer; this rounds it to 4 and reports the
 * matching logical zoom (4 / 1.25 = 3.2) to use for the camera.
 */
export function crispScale(zoom: number, devicePixelRatio: number): { devicePixelsPerPixel: number; logicalZoom: number } {
  const devicePixelsPerPixel = Math.max(1, Math.round(zoom * devicePixelRatio));
  return { devicePixelsPerPixel, logicalZoom: devicePixelsPerPixel / devicePixelRatio };
}

/** The next zoom stop up or down from the current zoom, within limits. */
export function stepZoom(current: number, direction: 1 | -1): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(current) + direction));
}
