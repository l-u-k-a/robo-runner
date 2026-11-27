import type { LevelDef } from "../game/types";
import { generateLevels } from "./generator";
import { HANDMADE_LEVELS } from "./levels";

/** Total number of levels in the game. */
export const TOTAL_LEVELS = 60;

/**
 * Levels 1-13 are hand-made (one per theme). Levels 14-60 are generated deterministically with a
 * difficulty that keeps rising, and every one is checked for fairness by the test suite.
 */
export const LEVEL_DEFS: LevelDef[] = [
  ...HANDMADE_LEVELS,
  ...generateLevels(HANDMADE_LEVELS.length, TOTAL_LEVELS),
];
