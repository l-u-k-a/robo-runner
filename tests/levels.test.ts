import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "../src/game/config";
import { LevelError, parseLevel } from "../src/game/level";
import { cellIndex, reachable } from "../src/game/pathfinding";
import { World } from "../src/game/world";
import { TRACKS } from "../src/audio/tracks";
import { difficultyFor } from "../src/game/difficulty";
import { LEVEL_DEFS, TOTAL_LEVELS } from "../src/levels/all";
import {
  generateLevels,
  mulberry32,
  profileFor,
} from "../src/levels/generator";
import { HANDMADE_LEVELS } from "../src/levels/levels";
import { patrolIssues } from "../src/levels/patrol";

describe("parseLevel", () => {
  const ok = (): string[] => {
    const m = Array.from({ length: ROWS }, () => ".".repeat(COLS));
    m[2] = "P" + ".".repeat(COLS - 3) + "$E";
    m[ROWS - 1] = "#".repeat(COLS);
    return m;
  };

  it("extracts entities", () => {
    const map = ok();
    map[5] = "G" + "S" + ".".repeat(COLS - 2);
    const l = parseLevel({ name: "x", theme: "temple", map });
    expect(l.hero).toEqual({ x: 0, y: 2 });
    expect(l.guards).toEqual([{ x: 0, y: 5 }]);
    expect(l.items).toEqual([{ x: 1, y: 5, kind: "shock" }]);
    expect(l.gold).toHaveLength(1);
    expect(l.exit).toEqual({ x: COLS - 1, y: 2 });
  });

  it("rejects bad maps", () => {
    const short = ok().slice(1);
    expect(() =>
      parseLevel({ name: "x", theme: "temple", map: short }),
    ).toThrow(LevelError);
    const wide = ok();
    wide[0] += ".";
    expect(() => parseLevel({ name: "x", theme: "temple", map: wide })).toThrow(
      LevelError,
    );
    const unknown = ok();
    unknown[0] = "?" + unknown[0].slice(1);
    expect(() =>
      parseLevel({ name: "x", theme: "temple", map: unknown }),
    ).toThrow(LevelError);
    const noHero = ok();
    noHero[2] = "." + noHero[2].slice(1);
    expect(() =>
      parseLevel({ name: "x", theme: "temple", map: noHero }),
    ).toThrow(LevelError);
  });
});

describe("bundled levels", () => {
  it("has the full set of levels and uses every theme", () => {
    expect(LEVEL_DEFS).toHaveLength(TOTAL_LEVELS);
    expect(TOTAL_LEVELS).toBeGreaterThanOrEqual(60);
    expect(LEVEL_DEFS.slice(0, HANDMADE_LEVELS.length)).toEqual(
      HANDMADE_LEVELS,
    );
    expect(new Set(LEVEL_DEFS.map((d) => d.theme)).size).toBe(
      Object.keys(TRACKS).filter((k) => k !== "title" && k !== "victory")
        .length,
    );
  });

  it("has no duplicate maps", () => {
    expect(new Set(LEVEL_DEFS.map((d) => d.map.join("\n"))).size).toBe(
      LEVEL_DEFS.length,
    );
  });

  LEVEL_DEFS.forEach((def, i) => {
    it(`level ${i + 1} (${def.name}) is solvable: gold and exit are reachable`, () => {
      const level = parseLevel(def);
      const w = new World(level);
      const seen = reachable(w, level.hero, { dig: true, heroZip: true });
      for (const g of level.gold) {
        expect(seen.has(cellIndex(g.x, g.y)), `gold at ${g.x},${g.y}`).toBe(
          true,
        );
      }
      expect(seen.has(cellIndex(level.exit.x, level.exit.y)), "exit").toBe(
        true,
      );
      expect(level.diamonds.length).toBeGreaterThanOrEqual(1);
      expect(level.diamonds.length).toBeLessThanOrEqual(2);
      for (const d of level.diamonds) {
        expect(seen.has(cellIndex(d.x, d.y)), `diamond at ${d.x},${d.y}`).toBe(
          true,
        );
      }
      for (const it of level.items) {
        expect(seen.has(cellIndex(it.x, it.y)), `item at ${it.x},${it.y}`).toBe(
          true,
        );
      }
      expect(level.guards.length).toBeGreaterThan(0);
    });
  });
});

describe("difficulty progression", () => {
  it("guard count and gold never decrease across generated levels", () => {
    const first = HANDMADE_LEVELS.length;
    const stats = LEVEL_DEFS.slice(first).map((d) => {
      const l = parseLevel(d);
      return { guards: l.guards.length, gold: l.gold.length };
    });
    // Per-level randomness (a coin on a rope etc.) is tiny; compare the start, middle and end.
    const avg = (xs: number[]): number =>
      xs.reduce((a, b) => a + b, 0) / xs.length;
    const third = Math.floor(stats.length / 3);
    const part = (i: number) => stats.slice(i * third, (i + 1) * third);
    expect(avg(part(2).map((s) => s.guards))).toBeGreaterThan(
      avg(part(1).map((s) => s.guards)),
    );
    expect(avg(part(1).map((s) => s.guards))).toBeGreaterThan(
      avg(part(0).map((s) => s.guards)),
    );
    expect(avg(part(2).map((s) => s.gold))).toBeGreaterThan(
      avg(part(0).map((s) => s.gold)),
    );
    expect(stats[stats.length - 1].guards).toBeGreaterThanOrEqual(5);
  });

  it("the profile gets harder with progress", () => {
    const easy = profileFor(0);
    const hard = profileFor(1);
    expect(hard.guards).toBeGreaterThan(easy.guards);
    expect(hard.holes).toBeGreaterThan(easy.holes);
    expect(hard.ladders[1]).toBeLessThan(easy.ladders[1]);
    expect(hard.stone).toBeGreaterThan(easy.stone);
  });

  it("guards move faster and pits close sooner on later levels", () => {
    const early = difficultyFor(0, TOTAL_LEVELS);
    const late = difficultyFor(TOTAL_LEVELS - 1, TOTAL_LEVELS);
    expect(late.guardSpeed).toBeGreaterThan(early.guardSpeed);
    expect(late.pitOpen).toBeLessThan(early.pitOpen);
    expect(late.guardEscape).toBeLessThan(early.guardEscape);
    expect(late.guardRespawn).toBeLessThan(early.guardRespawn);
    expect(early.stars).toBe(1);
    expect(late.stars).toBe(5);
    let prev = 0;
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const d = difficultyFor(i, TOTAL_LEVELS);
      expect(d.guardSpeed).toBeGreaterThanOrEqual(prev);
      prev = d.guardSpeed;
    }
  });

  it("generation is deterministic", () => {
    const a = generateLevels(
      HANDMADE_LEVELS.length,
      HANDMADE_LEVELS.length + 3,
    );
    const b = generateLevels(
      HANDMADE_LEVELS.length,
      HANDMADE_LEVELS.length + 3,
    );
    expect(a).toEqual(b);
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it("every generated level keeps the hero away from the guards at the start", () => {
    for (const d of LEVEL_DEFS.slice(HANDMADE_LEVELS.length)) {
      const l = parseLevel(d);
      for (const g of l.guards) {
        expect(
          Math.abs(g.x - l.hero.x) + Math.abs(g.y - l.hero.y),
          d.name,
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe("guard patrol platforms", () => {
  it("every guard in every level stands on a fair platform", () => {
    const problems = LEVEL_DEFS.flatMap((d) => patrolIssues(d));
    expect(problems).toEqual([]);
  });

  it("the validator catches a guard sealed on a stone ledge", () => {
    const base = HANDMADE_LEVELS[0];
    const map = base.map.slice();
    // A 3-cell stone pocket with the guard inside it on the top band.
    map[2] = "..@G.@..........E..$......";
    map[2] = map[2].padEnd(28, ".");
    map[3] = "@".repeat(28);
    const issues = patrolIssues({ name: "sealed", theme: "temple", map });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("aggro radius grows with the level number", () => {
    const early = difficultyFor(0, TOTAL_LEVELS);
    const late = difficultyFor(TOTAL_LEVELS - 1, TOTAL_LEVELS);
    expect(late.aggro).toBeGreaterThan(early.aggro);
    expect(early.aggro).toBeGreaterThan(8);
  });
});
