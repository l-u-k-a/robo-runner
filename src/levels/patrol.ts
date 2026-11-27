import { COLS } from "../game/config";
import { parseLevel } from "../game/level";
import { isHang, type LevelDef } from "../game/types";
import { World } from "../game/world";

/** Smallest platform a guard may be posted on (shorter ledges leave no room to play). */
export const MIN_PATROL_CELLS = 4;
/** Ways off a short guard platform (ladders, ropes, zips, open drops at its ends). */
export const MIN_PATROL_EXITS = 2;
/** Platforms at least this long have room to dodge in, so one way off is enough. */
export const WIDE_PATROL_CELLS = 12;
/** Diggable floor cells under a guard's platform, so the hero always has a pit to set. */
export const MIN_PATROL_DIGGABLE = 2;

export interface PatrolInfo {
  guard: { x: number; y: number };
  cells: number;
  exits: number;
  diggable: number;
}

/** Measures the platform each guard sweeps (see `World.patrolRange`). */
export function patrolInfo(def: LevelDef): PatrolInfo[] {
  const level = parseLevel(def);
  const w = new World(level);
  return level.guards.map((g) => {
    const seg = w.patrolRange(g);
    let exits = 0;
    let diggable = 0;
    for (let x = seg.x0; x <= seg.x1; x++) {
      const t = w.tileAt(x, seg.y);
      if (t === "ladder" || isHang(t) || w.tileAt(x, seg.y + 1) === "ladder") exits++;
      if (w.baseTile(x, seg.y + 1) === "ground") diggable++;
    }
    // An open end (a gap, not a wall) is a drop the hero can use to leave.
    if (seg.x0 > 0 && !w.solid(seg.x0 - 1, seg.y)) exits++;
    if (seg.x1 < COLS - 1 && !w.solid(seg.x1 + 1, seg.y)) exits++;
    return { guard: { x: g.x, y: g.y }, cells: seg.x1 - seg.x0 + 1, exits, diggable };
  });
}

/**
 * A guard that stays on one platform must never leave the hero with no fair answer. Every posted
 * platform therefore needs room to move, enough ways off it (two on a short ledge, one on a wide
 * floor; so the hero is never pinned between the guard and a wall) and floor that can be dug (so a pit is always possible, but is
 * never the *only* way, since there are exits and tools too). Returns a list of problems.
 */
export function patrolIssues(def: LevelDef): string[] {
  const out: string[] = [];
  for (const p of patrolInfo(def)) {
    const at = `${def.name}: guard at ${p.guard.x},${p.guard.y}`;
    if (p.cells < MIN_PATROL_CELLS) out.push(`${at} patrols only ${p.cells} cells`);
    const needExits = p.cells >= WIDE_PATROL_CELLS ? 1 : MIN_PATROL_EXITS;
    if (p.exits < needExits) out.push(`${at} has only ${p.exits} way(s) off its platform`);
    if (p.diggable < MIN_PATROL_DIGGABLE) out.push(`${at} has only ${p.diggable} diggable floor cell(s)`);
  }
  return out;
}
