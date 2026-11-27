/**
 * Guard-AI probe for Robo Runner. Not a test: `probe.sh` copies it into tests/ for one run.
 *
 *   PROBE=trace  LEVEL=21|"Bone Hall"  GUARD=2  HERO=exit|start|x,y  SECONDS=40  FROM=20  EVERY=6
 *   PROBE=census HERO=exit|start  SECONDS=45
 *
 * trace:  one guard, frame by frame: position, mode, alert, the input the AI actually used, and which
 *         branch produced it (climb / chase / patrol). Lines that repeat are collapsed.
 * census: every level; flags guards that are stuck (alert but not moving), jittering (moving but
 *         going nowhere), stranded (a way up exists but they are below the hero), and lured (posted
 *         above a far-away hero, but came down to his floor).
 * The hero is invincible and parked at HERO for the whole run.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CFG, SIM_DT } from "../src/game/config";
import { difficultyFor } from "../src/game/difficulty";
import { parseLevel } from "../src/game/level";
import { nextStepToNearest } from "../src/game/pathfinding";
import type { Pos } from "../src/game/types";
import { NO_INPUT, World } from "../src/game/world";
import { LEVEL_DEFS } from "../src/levels/all";

const env = process.env;
const mode = env.PROBE ?? "census";
const seconds = Number(env.SECONDS ?? 45);
/** Vitest hides console output of passing tests, so the report goes to a file that probe.sh prints. */
const lines: string[] = [];
const log = (s: string): void => {
  lines.push(s);
};

function levelIndex(spec: string | undefined): number {
  if (!spec) return 0;
  const n = Number(spec);
  if (Number.isInteger(n) && n >= 1 && n <= LEVEL_DEFS.length) return n - 1;
  const i = LEVEL_DEFS.findIndex((d) => d.name.toLowerCase() === spec.toLowerCase());
  if (i < 0) throw new Error(`no level "${spec}"`);
  return i;
}

function heroSpot(w: World, spec: string | undefined): Pos {
  const lvl = w.level;
  if (!spec || spec === "exit") return lvl.exit;
  if (spec === "start") return lvl.hero;
  const [x, y] = spec.split(",").map(Number);
  return { x, y };
}

function makeWorld(i: number): World {
  const w = new World(parseLevel(LEVEL_DEFS[i]), difficultyFor(i, LEVEL_DEFS.length));
  w.debug.invincible = true;
  return w;
}

// Private members are read on purpose: this is a diagnostic tool, not game code.
type Internals = {
  brains: { alert: boolean; holdT: number; home: Pos }[];
  guardInput(g: unknown, idx: number): { dx: number; dy: number };
  climbInput(g: unknown, idx: number, cur: Pos): unknown;
  patrolInput(g: unknown, idx: number, b: unknown): unknown;
  floorRow(c: unknown): number;
};

it("probe", () => {
  try {
    if (mode === "trace") trace();
    else census();
  } finally {
    writeFileSync(env.PROBE_OUT ?? "/tmp/ai-probe.txt", lines.join("\n") + "\n");
  }
}, 600_000);

function trace(): void {
  const li = levelIndex(env.LEVEL);
  const gi = Number(env.GUARD ?? 0);
  const from = Number(env.FROM ?? 0) * 60;
  const every = Number(env.EVERY ?? 1);
  const w = makeWorld(li);
  const spot = heroSpot(w, env.HERO);
  const ai = w as unknown as Internals;
  let used: { dx: number; dy: number } | null = null;
  let branch = "";
  const gInput = ai.guardInput.bind(w);
  const cInput = ai.climbInput.bind(w);
  const pInput = ai.patrolInput.bind(w);
  ai.climbInput = (g, idx, cur) => {
    if (idx === gi) branch = "climb";
    return cInput(g, idx, cur);
  };
  ai.patrolInput = (g, idx, b) => {
    if (idx === gi && branch !== "climb") branch = "patrol";
    return pInput(g, idx, b);
  };
  ai.guardInput = (g, idx) => {
    if (idx === gi) branch = "chase";
    const r = gInput(g, idx);
    if (idx === gi) used = r;
    return r;
  };
  log(`trace: #${li + 1} ${w.level.name}, guard ${gi}, hero parked at ${spot.x},${spot.y}`);
  log(w.level.tiles.length ? LEVEL_DEFS[li].map.map((r, y) => `${String(y).padStart(2)} ${r}`).join("\n") : "");
  let last = "";
  let repeats = 0;
  for (let t = 0; t < seconds * 60; t++) {
    w.hero.x = spot.x;
    w.hero.y = spot.y;
    used = null;
    branch = "";
    w.update(SIM_DT, NO_INPUT);
    w.events.length = 0;
    if (t < from || t % every !== 0) continue;
    const g = w.guards[gi];
    const b = ai.brains[gi];
    const line = !g.alive
      ? "dead"
      : `(${g.x.toFixed(2)},${g.y.toFixed(2)}) ${g.mode} floor=${ai.floorRow(g)} ${b?.alert ? "ALERT" : "patrol"} ` +
        `branch=${branch || "-"} in=${used ? `${used.dx}/${used.dy}` : "-"} hold=${b?.holdT.toFixed(2)} stun=${g.stun.toFixed(1)} cough=${g.cough.toFixed(1)}`;
    if (line === last) {
      repeats++;
      continue;
    }
    if (repeats) log(`        ... same x${repeats}`);
    repeats = 0;
    last = line;
    log(`${(t / 60).toFixed(2)}s ${line}`);
  }
  if (repeats) log(`        ... same x${repeats}`);
}

function census(): void {
  const issues: string[] = [];
  let guards = 0;
  let onHeroFloor = 0;
  let caught = 0;
  let ms = 0;
  LEVEL_DEFS.forEach((def, li) => {
    const w = makeWorld(li);
    const spot = heroSpot(w, env.HERO);
    const ai = w as unknown as Internals;
    const n = w.guards.length;
    const path = Array.from({ length: n }, () => 0);
    const prev = w.guards.map((g) => ({ x: g.x, y: g.y }));
    const lastSec = seconds * 60 - 5 * 60; // measure movement in the last 5 seconds
    const startPos: (Pos | null)[] = Array.from({ length: n }, () => null);
    const t0 = performance.now();
    for (let t = 0; t < seconds * 60; t++) {
      w.hero.x = spot.x;
      w.hero.y = spot.y;
      w.update(SIM_DT, NO_INPUT);
      w.events.length = 0;
      if (t === lastSec) w.guards.forEach((g, i) => (startPos[i] = { x: g.x, y: g.y }));
      if (t > lastSec) {
        w.guards.forEach((g, i) => {
          path[i] += Math.hypot(g.x - prev[i].x, g.y - prev[i].y);
        });
      }
      w.guards.forEach((g, i) => (prev[i] = { x: g.x, y: g.y }));
    }
    ms += performance.now() - t0;
    const heroFloor = Math.round(spot.y);
    w.guards.forEach((g, i) => {
      if (!g.alive) return;
      guards++;
      const b = ai.brains[i];
      const home = def.map ? w.level.guards[i] : null;
      const at = `#${li + 1} ${def.name} g${i} at ${g.x.toFixed(1)},${g.y.toFixed(1)}`;
      const floor = ai.floorRow(g);
      // Touching the (invincible) hero means it caught him: e.g. a guard at the top of a ladder that
      // ends right under the hero is half a tile below his floor but has done its job.
      if (Math.hypot(g.x - spot.x, g.y - spot.y) <= 1) {
        caught++;
        return;
      }
      if (floor === heroFloor) onHeroFloor++;
      const net = startPos[i] ? Math.hypot(g.x - startPos[i]!.x, g.y - startPos[i]!.y) : 0;
      if (b?.alert && g.stun <= 0 && g.cough <= 0 && path[i] < 0.2 && floor !== heroFloor) issues.push(`STUCK    ${at} (alert, not moving)`);
      else if (b?.alert && path[i] > 4 && net < 0.3 && floor !== heroFloor) issues.push(`JITTER   ${at} (moved ${path[i].toFixed(1)} tiles, got nowhere)`);
      const cur = { x: Math.round(g.x), y: Math.round(g.y) };
      if (floor > heroFloor + 1) {
        const up = nextStepToNearest(w, cur, (x, y) => y <= heroFloor && (w.tileAt(x, y) === "ladder" || w.supported(x, y)));
        if (up) issues.push(`STRANDED ${at} (a way up exists, hero is on row ${heroFloor})`);
      }
      if (home && spot.y > home.y && Math.hypot(home.x - spot.x, home.y - spot.y) > CFG.closeChase + 3 && floor > home.y + 1) {
        issues.push(`LURED?   ${at} (posted at ${home.x},${home.y} above a far hero; check whether its patrol passes within closeChase)`);
      }
    });
  });
  log(`census: hero parked at "${env.HERO ?? "exit"}" for ${seconds}s on ${LEVEL_DEFS.length} levels`);
  log(`guards alive ${guards}: caught the hero ${caught}, on his floor ${onHeroFloor}; AI+sim cost ${((ms / (LEVEL_DEFS.length * seconds * 60)) * 1000).toFixed(0)} us/frame`);
  log(issues.length ? issues.join("\n") : "no issues");
}
