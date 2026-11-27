export interface Settings {
  music: boolean;
  sfx: boolean;
  /** 0..10, 5 is the default level. */
  musicVolume: number;
  /** Use the golden robot skin (unlocked by clearing the game). */
  golden: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  sfx: true,
  musicVolume: 5,
  golden: false,
};
export const MAX_VOLUME = 10;
const KEY = "robo-runner.settings";

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem">;

export const clampVolume = (n: number): number =>
  Math.max(0, Math.min(MAX_VOLUME, Math.round(n)));

/** Reads saved options; anything missing or invalid falls back to the defaults. */
export function loadSettings(store?: ReadStore): Settings {
  try {
    const raw = (store ?? window.localStorage).getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      music: typeof p.music === "boolean" ? p.music : DEFAULT_SETTINGS.music,
      sfx: typeof p.sfx === "boolean" ? p.sfx : DEFAULT_SETTINGS.sfx,
      musicVolume:
        typeof p.musicVolume === "number" && Number.isFinite(p.musicVolume)
          ? clampVolume(p.musicVolume)
          : DEFAULT_SETTINGS.musicVolume,
      golden:
        typeof p.golden === "boolean" ? p.golden : DEFAULT_SETTINGS.golden,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings, store?: WriteStore): void {
  try {
    (store ?? window.localStorage).setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage can be unavailable (private mode); options simply will not persist.
  }
}
