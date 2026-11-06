/** What the sky does on a day. Decided by the day alone (src/engine/weather/weather.ts): nothing about weather is ever stored. */
export type Weather = 'sun' | 'cloud' | 'rain' | 'storm' | 'snow';

export const WEATHERS: readonly Weather[] = ['sun', 'cloud', 'rain', 'storm', 'snow'];
