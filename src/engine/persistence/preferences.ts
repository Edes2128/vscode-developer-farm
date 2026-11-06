import { sanitizeAudioSettings } from '../audio/audio';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../audio/types';
import type { StorageBackend } from './storage';
import { WriteQueue } from './writeQueue';

/**
 * The player's preferences. They live apart from the saved game so starting a new game never resets them,
 * and they are read leniently: a missing or invalid field falls back to its default.
 */
export interface Preferences {
  /** `auto` picks a whole-number zoom that suits the window. */
  readonly zoom: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  readonly hudVisible: boolean;
  /** The "how to play" hints were dismissed. */
  readonly hintsDismissed: boolean;
  /** Volumes and mute. */
  readonly audio: AudioSettings;
  /** Bigger text in the interface. */
  readonly textSize: 'normal' | 'large';
  /** A starker interface: pure black text on the parchment, brighter highlights. */
  readonly highContrast: boolean;
  /** `system` follows the computer's reduced-motion setting; the others force it off (`full`) or on (`reduced`). */
  readonly motion: 'system' | 'reduced' | 'full';
}

export const DEFAULT_PREFERENCES: Preferences = {
  zoom: 'auto',
  hudVisible: true,
  hintsDismissed: false,
  audio: DEFAULT_AUDIO_SETTINGS,
  textSize: 'normal',
  highContrast: false,
  motion: 'system',
};

export const PREFERENCES_KEY = 'preferences';

export function sanitizePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES;
  const raw = value as Record<string, unknown>;
  const zoom = raw['zoom'];
  return {
    zoom: zoom === 'auto' || (typeof zoom === 'number' && Number.isInteger(zoom) && zoom >= 1 && zoom <= 6) ? (zoom as Preferences['zoom']) : DEFAULT_PREFERENCES.zoom,
    hudVisible: typeof raw['hudVisible'] === 'boolean' ? raw['hudVisible'] : DEFAULT_PREFERENCES.hudVisible,
    hintsDismissed: typeof raw['hintsDismissed'] === 'boolean' ? raw['hintsDismissed'] : DEFAULT_PREFERENCES.hintsDismissed,
    audio: sanitizeAudioSettings(raw['audio']),
    textSize: raw['textSize'] === 'large' ? 'large' : 'normal',
    highContrast: raw['highContrast'] === true,
    motion: raw['motion'] === 'reduced' || raw['motion'] === 'full' ? raw['motion'] : 'system',
  };
}

export class PreferencesStore {
  private current: Preferences = DEFAULT_PREFERENCES;
  private readonly queue: WriteQueue<Preferences>;

  constructor(
    private readonly backend: StorageBackend,
    onError: (message: string, error?: unknown) => void = () => undefined,
  ) {
    this.queue = new WriteQueue(
      (value) => this.backend.write(PREFERENCES_KEY, JSON.stringify(value)),
      (error) => onError('Saving preferences failed', error),
    );
  }

  get value(): Preferences {
    return this.current;
  }

  async load(): Promise<Preferences> {
    try {
      const text = await this.backend.read(PREFERENCES_KEY);
      this.current = text === null ? DEFAULT_PREFERENCES : sanitizePreferences(JSON.parse(text));
    } catch {
      this.current = DEFAULT_PREFERENCES;
    }
    return this.current;
  }

  update(patch: Partial<Preferences>): Preferences {
    this.current = sanitizePreferences({ ...this.current, ...patch });
    this.queue.schedule(this.current);
    return this.current;
  }

  flush(): Promise<void> {
    return this.queue.flush();
  }
}
