import { COLS, ROWS } from "./config";
import { isHang, type Pos, type Tile } from "./types";

export interface GridView {
  tileAt(x: number, y: number): Tile;
  solid(x: number, y: number): boolean;
  supported(x: number, y: number): boolean;
}

export interface NeighborOpts {
  /** Hero-only: allow edges created by digging a pit. */
  dig?: boolean;
  /** Hero-only: zip-lines are one-way slides. */
  heroZip?: boolean;
}

/** Emits every cell reachable in one "move" from (x, y). */
export function forEachNeighbor(
  g: GridView,
  x: number,
  y: number,
  opts: NeighborOpts,
  emit: (x: number, y: number) => void,
): void {
  // A solid cell can only be reached as a freshly dug pit.
  if (g.solid(x, y)) {
    if (!g.solid(x, y + 1)) emit(x, y + 1);
    for (const d of [-1, 1]) if (!g.solid(x + d, y - 1)) emit(x + d, y - 1);
    return;
  }
  const t = g.tileAt(x, y);
  const hang = isHang(t);
  const standable = t === "ladder" || hang || g.supported(x, y);
  if (!standable) {
    if (!g.solid(x, y + 1)) emit(x, y + 1);
    return;
  }
  if (opts.heroZip && (t === "zipR" || t === "zipL")) {
    const d = t === "zipR" ? 1 : -1;
    if (!g.solid(x + d, y)) emit(x + d, y);
    if (!g.solid(x, y + 1)) emit(x, y + 1);
    return;
  }
  for (const d of [-1, 1]) if (!g.solid(x + d, y)) emit(x + d, y);
  if (t === "ladder" && y > 0 && !g.solid(x, y - 1)) emit(x, y - 1);
  if (!g.solid(x, y + 1)) emit(x, y + 1);
  if (opts.dig && !hang && t !== "ladder" && g.supported(x, y)) {
    for (const d of [-1, 1]) {
      if (g.tileAt(x + d, y) === "empty" && g.tileAt(x + d, y + 1) === "ground")
        emit(x + d, y + 1);
    }
  }
}

const idx = (x: number, y: number): number => y * COLS + x;

/** Breadth-first search. Returns the first step from `from` towards `to`, or null. */
export function nextStep(
  g: GridView,
  from: Pos,
  to: Pos,
  opts: NeighborOpts = {},
  blocked?: ReadonlySet<number>,
): Pos | null {
  if (from.x === to.x && from.y === to.y) return null;
  const prev = new Int16Array(COLS * ROWS).fill(-2);
  const queue: number[] = [];
  const start = idx(from.x, from.y);
  const goal = idx(to.x, to.y);
  prev[start] = -1;
  queue.push(start);
  let found = false;
  for (let head = 0; head < queue.length && !found; head++) {
    const cur = queue[head];
    const cx = cur % COLS;
    const cy = (cur - cx) / COLS;
    forEachNeighbor(g, cx, cy, opts, (nx, ny) => {
      if (found || nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
      const ni = idx(nx, ny);
      if (prev[ni] !== -2) return;
      if (blocked && ni !== goal && blocked.has(ni)) return;
      prev[ni] = cur;
      if (ni === goal) found = true;
      queue.push(ni);
    });
  }
  if (!found) return null;
  let cur = goal;
  while (prev[cur] !== start) cur = prev[cur];
  return { x: cur % COLS, y: (cur - (cur % COLS)) / COLS };
}

/** Set of cell indices reachable from `from` (used by level validation and tests). */
export function reachable(
  g: GridView,
  from: Pos,
  opts: NeighborOpts,
): Set<number> {
  const seen = new Set<number>([idx(from.x, from.y)]);
  const queue = [idx(from.x, from.y)];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % COLS;
    const cy = (cur - cx) / COLS;
    forEachNeighbor(g, cx, cy, opts, (nx, ny) => {
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
      const ni = idx(nx, ny);
      if (seen.has(ni)) return;
      seen.add(ni);
      queue.push(ni);
    });
  }
  return seen;
}

export const cellIndex = idx;

/**
 * Breadth-first search to the *nearest* cell for which `isGoal` is true (not a fixed target).
 * Returns the first step on the way there, or null when no such cell can be reached.
 * Used by guards that must first get up to the hero's floor, by whichever ladder is closest.
 */
export function nextStepToNearest(
  g: GridView,
  from: Pos,
  isGoal: (x: number, y: number) => boolean,
  opts: NeighborOpts = {},
  blocked?: ReadonlySet<number>,
): Pos | null {
  const prev = new Int16Array(COLS * ROWS).fill(-2);
  const queue: number[] = [];
  const start = idx(from.x, from.y);
  prev[start] = -1;
  queue.push(start);
  let goal = -1;
  for (let head = 0; head < queue.length && goal < 0; head++) {
    const cur = queue[head];
    const cx = cur % COLS;
    const cy = (cur - cx) / COLS;
    forEachNeighbor(g, cx, cy, opts, (nx, ny) => {
      if (goal >= 0 || nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
      const ni = idx(nx, ny);
      if (prev[ni] !== -2) return;
      if (blocked && blocked.has(ni)) return;
      prev[ni] = cur;
      if (isGoal(nx, ny)) goal = ni;
      queue.push(ni);
    });
  }
  if (goal < 0) return null;
  let cur = goal;
  while (prev[cur] !== start) cur = prev[cur];
  return { x: cur % COLS, y: (cur - (cur % COLS)) / COLS };
}
