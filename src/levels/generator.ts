import { COLS, ROWS } from "../game/config";
import { progress } from "../game/difficulty";
import { parseLevel } from "../game/level";
import { cellIndex, reachable } from "../game/pathfinding";
import type { LevelDef, Theme } from "../game/types";
import { World } from "../game/world";
import { patrolIssues } from "./patrol";

/** Small deterministic PRNG (mulberry32). Same seed, same level, on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a level of a given difficulty (0..1) contains. */
export interface Profile {
  guards: number;
  gold: number;
  diamonds: number;
  tools: number;
  /** Max holes per floor. */
  holes: number;
  /** Ladders per floor. */
  ladders: [number, number];
  /** Chance that a floor gets a stone (undiggable) stretch. */
  stone: number;
  /** Chance that a hole has no rope or zip over it. */
  bareHole: number;
}

export function profileFor(t: number): Profile {
  return {
    guards: Math.round(2 + 4 * t),
    gold: Math.round(7 + 6 * t),
    diamonds: t > 0.5 ? 2 : 1,
    tools: t < 0.3 ? 1 : t < 0.7 ? 2 : 3,
    holes: t < 0.15 ? 0 : t < 0.4 ? 1 : t < 0.75 ? 2 : 3,
    ladders: t < 0.5 ? [2, 3] : [1, 2],
    stone: 0.1 + 0.5 * t,
    bareHole: t < 0.6 ? 0.1 : 0.25,
  };
}

const FLOORS = [3, 6, 9, 12];
const STAND_ROWS = [2, 5, 8, 11, 14];

type Grid = string[][];

function shuffle<T>(rand: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const solidCh = (c: string): boolean => c === "#" || c === "@";

function layoutFloors(
  rand: () => number,
  p: Profile,
): { g: Grid; holes: Map<number, [number, number][]> } {
  const g: Grid = Array.from({ length: ROWS }, () =>
    Array<string>(COLS).fill("."),
  );
  g[ROWS - 1].fill("#");
  const holes = new Map<number, [number, number][]>();
  for (const r of FLOORS) {
    g[r].fill("#");
    if (rand() < p.stone) {
      const len = 4 + Math.floor(rand() * 8);
      const a = Math.floor(rand() * (COLS - len));
      for (let x = a; x < a + len; x++) g[r][x] = "@";
    }
    const list: [number, number][] = [];
    const n = Math.floor(rand() * (p.holes + 1));
    for (let i = 0; i < n; i++) {
      const w = 3 + Math.floor(rand() * 7);
      const a = 3 + Math.floor(rand() * (COLS - w - 6));
      if (list.some(([x0, x1]) => a <= x1 + 3 && a + w - 1 >= x0 - 3)) continue;
      for (let x = a; x < a + w; x++) g[r][x] = ".";
      list.push([a, a + w - 1]);
    }
    holes.set(r, list);
  }
  // Cross holes with a rope or a zip-line on the stand row above.
  for (const r of FLOORS) {
    for (const [a, b] of holes.get(r) ?? []) {
      if (rand() < p.bareHole) continue;
      const zip = b - a + 1 >= 6 && rand() < 0.45;
      const ch = zip ? (rand() < 0.5 ? ">" : "<") : "-";
      for (let x = a; x <= b; x++) g[r - 1][x] = ch;
    }
  }
  return { g, holes };
}

function placeLadders(rand: () => number, g: Grid, p: Profile): void {
  for (const r of FLOORS) {
    const want =
      p.ladders[0] + Math.floor(rand() * (p.ladders[1] - p.ladders[0] + 1));
    const cols: number[] = [];
    for (const c of shuffle(
      rand,
      Array.from({ length: COLS - 2 }, (_, i) => i + 1),
    )) {
      if (cols.length >= want) break;
      const ok =
        solidCh(g[r][c]) &&
        solidCh(g[r + 3][c]) &&
        g[r - 1][c] === "." &&
        g[r + 1][c] === "." &&
        g[r + 2][c] === "." &&
        cols.every((o) => Math.abs(o - c) >= 6);
      if (!ok) continue;
      cols.push(c);
      g[r][c] = "H";
      g[r + 1][c] = "H";
      g[r + 2][c] = "H";
    }
    if (cols.length === 0) return;
  }
}

interface Cell {
  x: number;
  y: number;
}

function standCells(g: Grid): Cell[] {
  const out: Cell[] = [];
  for (const y of STAND_ROWS) {
    for (let x = 0; x < COLS; x++) {
      const below = g[y + 1]?.[x];
      if (
        g[y][x] === "." &&
        below !== undefined &&
        (solidCh(below) || below === "H")
      )
        out.push({ x, y });
    }
  }
  return out;
}

/** Fills the grid with the hero, exit, gold, guards, tools and diamonds. Returns false if it does not fit. */
function populate(rand: () => number, g: Grid, p: Profile): boolean {
  let free = standCells(g);
  const take = (pred: (c: Cell) => boolean): Cell | null => {
    const options = shuffle(rand, free.filter(pred));
    const c = options[0];
    if (!c) return null;
    free = free.filter((f) => !(f.x === c.x && f.y === c.y));
    return c;
  };

  const hero = take((c) => c.y === 14 && (c.x <= 5 || c.x >= COLS - 6));
  if (!hero) return false;
  const exit = take((c) => c.y === 2 && Math.abs(c.x - hero.x) >= 8);
  if (!exit) return false;
  g[hero.y][hero.x] = "P";
  g[exit.y][exit.x] = "E";

  // Gold: spread over the bands, never right next to the start.
  const bands = shuffle(rand, STAND_ROWS);
  for (let i = 0; i < p.gold; i++) {
    const band = bands[i % bands.length];
    const c = take(
      (q) => q.y === band && (Math.abs(q.x - hero.x) > 3 || q.y !== hero.y),
    );
    if (!c) return false;
    g[c.y][c.x] = "$";
  }
  // A couple of the coins hang on ropes where possible.
  const ropes: Cell[] = [];
  for (const y of STAND_ROWS)
    for (let x = 0; x < COLS; x++) if (g[y][x] === "-") ropes.push({ x, y });
  for (const c of shuffle(rand, ropes).slice(0, 1 + Math.floor(rand() * 2)))
    g[c.y][c.x] = "*";

  // Guards start well away from the hero.
  for (let i = 0; i < p.guards; i++) {
    const c = take(
      (q) =>
        (q.y !== hero.y || Math.abs(q.x - hero.x) >= 9) &&
        Math.abs(q.x - hero.x) + Math.abs(q.y - hero.y) >= 8,
    );
    if (!c) return false;
    g[c.y][c.x] = "G";
  }
  const kinds = shuffle(rand, ["S", "D", "M", "B", "O", "U", "X"]);
  for (let i = 0; i < p.tools; i++) {
    const c = take(() => true);
    if (!c) return false;
    g[c.y][c.x] = kinds[i % kinds.length];
  }
  for (let i = 0; i < p.diamonds; i++) {
    const c = take((q) => q.y !== hero.y);
    if (!c) return false;
    g[c.y][c.x] = "V";
  }
  return true;
}

/**
 * True when every important cell can reach every other one without digging (so any order works)
 * and every guard's patrol platform is fair (see `patrolIssues`).
 */
function fair(def: LevelDef): boolean {
  const level = parseLevel(def);
  const w = new World(level);
  const opts = { heroZip: true };
  const targets = [
    level.hero,
    level.exit,
    ...level.gold,
    ...level.diamonds,
    ...level.items,
  ];
  const fromHero = reachable(w, level.hero, opts);
  if (!level.guards.every((g) => fromHero.has(cellIndex(g.x, g.y))))
    return false;
  for (const t of targets) {
    const seen = reachable(w, t, opts);
    for (const o of targets) if (!seen.has(cellIndex(o.x, o.y))) return false;
  }
  // Guards stay on their platform until the hero is near: each one needs a fair platform.
  return patrolIssues(def).length === 0;
}

export function generateLevel(
  name: string,
  theme: Theme,
  t: number,
  seed: number,
  maxAttempts = 400,
): LevelDef {
  const p = profileFor(t);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rand = mulberry32(seed + attempt * 104729);
    const { g } = layoutFloors(rand, p);
    placeLadders(rand, g, p);
    if (!populate(rand, g, p)) continue;
    const def: LevelDef = { name, theme, map: g.map((r) => r.join("")) };
    try {
      if (fair(def)) return def;
    } catch {
      // invalid layout (e.g. missing entity): try the next attempt
    }
  }
  throw new Error(
    `could not generate a fair level for "${name}" (seed ${seed})`,
  );
}

const THEME_ORDER: Theme[] = [
  "temple",
  "ruins",
  "jungle",
  "fortress",
  "ice",
  "desert",
  "crypt",
  "atlantis",
  "volcano",
  "mansion",
  "cyber",
  "sanctum",
  "sky",
  "matrix",
];

const NAMES: Record<Theme, string[]> = {
  temple: ["Sandstone Halls", "Pillar Court", "Golden Vault", "Altar Steps"],
  ruins: [
    "Broken Arches",
    "Dusty Trench",
    "Lost Terrace",
    "Scholar\u2019s Pit",
  ],
  jungle: ["Root Maze", "Hanging Gardens", "Mossy Falls", "Canopy Run"],
  fortress: ["Outer Wall", "Siege Tunnels", "Iron Gate", "Watch Tower"],
  ice: ["Glacier Steps", "Frost Hollow", "Crystal Rift", "Snowbound Keep"],
  desert: ["Dune Crossing", "Oasis Ruins", "Scorpion Pass", "Sun Obelisk"],
  crypt: ["Bone Hall", "Sunken Tomb", "Whisper Vault", "Grave Stairs"],
  atlantis: ["Coral Walk", "Pearl Cellar", "Drowned Forum", "Tide Gate"],
  volcano: ["Ash Ledge", "Magma Run", "Cinder Works", "Obsidian Hall"],
  mansion: ["Dusty Parlor", "Creaking Attic", "Candle Gallery", "Locked Wing"],
  cyber: ["Data Alley", "Circuit Vault", "Neon Docks", "Core Access"],
  sanctum: ["Cog Chamber", "Clockwork Pit", "Gear Stairs", "Prime Engine"],
  sky: ["Cloud Bridge", "Wind Garden", "Floating Court", "Storm Deck"],
  matrix: ["Code Alley", "Green Static", "Mainframe Stairs", "Null Sector"],
};

/**
 * Builds `count` levels that continue after the hand-made ones. Difficulty rises smoothly
 * with the level number (more guards, more gaps, fewer ladders, less diggable floor).
 */
export function generateLevels(firstIndex: number, total: number): LevelDef[] {
  const out: LevelDef[] = [];
  for (let index = firstIndex; index < total; index++) {
    const k = index - firstIndex;
    const theme = THEME_ORDER[k % THEME_ORDER.length];
    const variant = Math.floor(k / THEME_ORDER.length) % 4;
    const name = NAMES[theme][variant];
    out.push(
      generateLevel(name, theme, progress(index, total), 1000 + index * 7919),
    );
  }
  return out;
}

/** Level number `n` (0-based) of endless mode: always the hardest profile, a new seed each time. */
export function endlessLevel(n: number): LevelDef {
  const theme = THEME_ORDER[n % THEME_ORDER.length];
  const base = NAMES[theme][n % NAMES[theme].length];
  return generateLevel(`Endless ${n + 1}: ${base}`, theme, 1, 90000 + n * 7919);
}
