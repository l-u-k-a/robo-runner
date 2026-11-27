/** Unlock progress (not scores): how far the player got and whether the game was cleared. */
export interface Progress {
  /** Highest level index (0-based) the player may start from. */
  furthest: number;
  /** True once level 60 (the last campaign level) has been completed. */
  cleared: boolean;
}

export const DEFAULT_PROGRESS: Progress = { furthest: 0, cleared: false };
const KEY = "robo-runner.progress";

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem">;

export function loadProgress(store?: ReadStore, total = Infinity): Progress {
  try {
    const raw = (store ?? window.localStorage).getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const p = JSON.parse(raw) as Partial<Progress>;
    const furthest =
      typeof p.furthest === "number" && Number.isFinite(p.furthest)
        ? Math.max(0, Math.min(total - 1, Math.floor(p.furthest)))
        : 0;
    return { furthest, cleared: p.cleared === true };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(p: Progress, store?: WriteStore): void {
  try {
    (store ?? window.localStorage).setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress simply will not persist.
  }
}

/** The progress after the level at `completedIndex` (0-based) has been cleared. */
export function unlockAfter(
  p: Progress,
  completedIndex: number,
  total: number,
): Progress {
  return {
    furthest: Math.max(p.furthest, Math.min(completedIndex + 1, total - 1)),
    cleared: p.cleared || completedIndex >= total - 1,
  };
}
