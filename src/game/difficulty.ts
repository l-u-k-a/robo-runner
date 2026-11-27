import { CFG } from "./config";

/** Per-level tuning applied by the World. The hero's own speed never changes. */
export interface Difficulty {
  /** Multiplier on guard run/climb speed. */
  guardSpeed: number;
  /** Seconds a guard needs to climb out of a pit. */
  guardEscape: number;
  /** Seconds a pit stays open. */
  pitOpen: number;
  /** Seconds before a dead guard comes back. */
  guardRespawn: number;
  /** Awareness radius in "steps" (columns, rows count triple): guards farther away just patrol. */
  aggro: number;
  /** 1..5, shown to the player. */
  stars: number;
}

/** The base game feel: what unit tests and manual worlds use. */
export const NEUTRAL: Difficulty = {
  guardSpeed: 1,
  guardEscape: CFG.guardEscape,
  pitOpen: CFG.pitOpenTime,
  guardRespawn: CFG.guardRespawn,
  aggro: 13,
  stars: 1,
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 for the first level, 1 for the last. */
export function progress(index: number, total: number): number {
  return total <= 1 ? 0 : Math.max(0, Math.min(1, index / (total - 1)));
}

export function difficultyFor(index: number, total: number): Difficulty {
  const t = progress(index, total);
  return {
    guardSpeed: lerp(0.9, 1.14, t),
    guardEscape: lerp(2.2, 1.3, t),
    pitOpen: lerp(5.2, 3.8, t),
    guardRespawn: lerp(5, 2.5, t),
    aggro: lerp(11, 16, t),
    stars: 1 + Math.min(4, Math.floor(t * 5)),
  };
}

/** Endless mode starts at the hardest campaign setting and keeps tightening, up to a cap. */
export function endlessDifficulty(n: number): Difficulty {
  const top = difficultyFor(1, 2); // t = 1
  const k = Math.max(0, n);
  return {
    guardSpeed: Math.min(1.3, top.guardSpeed + 0.012 * k),
    guardEscape: Math.max(0.9, top.guardEscape - 0.02 * k),
    pitOpen: Math.max(3, top.pitOpen - 0.03 * k),
    guardRespawn: Math.max(1.5, top.guardRespawn - 0.04 * k),
    aggro: Math.min(20, top.aggro + 0.05 * k),
    stars: 5,
  };
}
