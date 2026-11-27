import { describe, expect, it } from "vitest";
import { GameFlow } from "../src/core/flow";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  unlockAfter,
} from "../src/core/progress";
import { RunStats, formatTime, rankFor } from "../src/core/stats";
import { CFG } from "../src/game/config";
import { difficultyFor, endlessDifficulty } from "../src/game/difficulty";
import { TRACKS } from "../src/audio/tracks";

const store = (initial?: string) => {
  let v = initial;
  return {
    getItem: () => v ?? null,
    setItem: (_k: string, val: string) => {
      v = val;
    },
  };
};

describe("progress", () => {
  it("starts empty and survives bad data", () => {
    expect(loadProgress(store())).toEqual(DEFAULT_PROGRESS);
    expect(loadProgress(store("{{"))).toEqual(DEFAULT_PROGRESS);
    expect(loadProgress(store('{"furthest":"x","cleared":1}'))).toEqual(
      DEFAULT_PROGRESS,
    );
  });

  it("round-trips and clamps to the level count", () => {
    const s = store();
    saveProgress({ furthest: 12, cleared: true }, s);
    expect(loadProgress(s, 60)).toEqual({ furthest: 12, cleared: true });
    expect(loadProgress(store('{"furthest":999}'), 60).furthest).toBe(59);
    expect(loadProgress(store('{"furthest":-5}'), 60).furthest).toBe(0);
  });

  it("unlocks the next level and marks the game cleared after the last one", () => {
    let p = unlockAfter(DEFAULT_PROGRESS, 0, 60);
    expect(p).toEqual({ furthest: 1, cleared: false });
    p = unlockAfter(p, 0, 60); // replaying an earlier level never goes backwards
    expect(p.furthest).toBe(1);
    p = unlockAfter(p, 58, 60);
    expect(p).toEqual({ furthest: 59, cleared: false });
    p = unlockAfter(p, 59, 60);
    expect(p).toEqual({ furthest: 59, cleared: true });
  });
});

describe("run stats and rank", () => {
  it("records the events it cares about", () => {
    const s = new RunStats();
    for (const e of [
      "gold",
      "gold",
      "diamond",
      "guardTrapped",
      "toolUse",
      "death",
      "laser",
    ] as const)
      s.record(e);
    s.tick(2.5);
    expect(s).toMatchObject({
      gold: 2,
      diamonds: 1,
      guardsTrapped: 1,
      toolsUsed: 1,
      deaths: 1,
      seconds: 2.5,
    });
    s.reset();
    expect(s.gold + s.deaths + s.seconds).toBe(0);
  });

  it("ranks by deaths and thoroughness", () => {
    expect(rankFor({ deaths: 0, diamonds: 100 }, 100)).toBe("S");
    expect(rankFor({ deaths: 1, diamonds: 80 }, 100)).toBe("S");
    expect(rankFor({ deaths: 0, diamonds: 40 }, 100)).toBe("B");
    expect(rankFor({ deaths: 4, diamonds: 50 }, 100)).toBe("A");
    expect(rankFor({ deaths: 10, diamonds: 0 }, 100)).toBe("B");
    expect(rankFor({ deaths: 11, diamonds: 100 }, 100)).toBe("C");
    expect(rankFor({ deaths: 0, diamonds: 0 }, 0)).toBe("S");
  });

  it("formats time", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(75.9)).toBe("01:15");
    expect(formatTime(3725)).toBe("1:02:05");
  });
});

describe("ending flow", () => {
  it("winning the last campaign level plays cinematic, results, credits, then the title", () => {
    const f = new GameFlow(3);
    f.start("campaign", 2);
    f.levelCompleted(100);
    expect(f.state).toBe("win");
    f.advanceEnding();
    expect(f.state).toBe("results");
    f.advanceEnding();
    expect(f.state).toBe("credits");
    f.advanceEnding();
    expect(f.state).toBe("title");
  });

  it("a campaign can start from an unlocked level", () => {
    const f = new GameFlow(60);
    f.start("campaign", 24);
    expect(f.levelIndex).toBe(24);
    expect(f.lives).toBe(CFG.startLives);
  });

  it("awards an extra life every few cleared levels, up to the cap", () => {
    const f = new GameFlow(60);
    f.start();
    for (let i = 0; i < CFG.extraLifeEvery - 1; i++) {
      f.levelCompleted(0);
      f.nextLevel();
    }
    expect(f.lives).toBe(CFG.startLives);
    f.levelCompleted(0); // the 5th cleared level
    expect(f.lives).toBe(CFG.startLives + 1);
    f.lives = CFG.maxLives;
    f.nextLevel();
    for (let i = 0; i < CFG.extraLifeEvery; i++) {
      f.levelCompleted(0);
      f.nextLevel();
    }
    expect(f.lives).toBe(CFG.maxLives);
  });

  it("endless mode begins after the campaign and never ends in a win", () => {
    const f = new GameFlow(60);
    f.start("endless");
    expect(f.levelIndex).toBe(60);
    f.levelCompleted(0);
    expect(f.state).toBe("levelClear");
    f.nextLevel();
    expect(f.levelIndex).toBe(61);
  });
});

describe("endless difficulty and music", () => {
  it("starts at the hardest campaign setting and keeps tightening up to a cap", () => {
    const top = difficultyFor(59, 60);
    const e0 = endlessDifficulty(0);
    expect(e0.guardSpeed).toBeCloseTo(top.guardSpeed);
    expect(endlessDifficulty(10).guardSpeed).toBeGreaterThan(e0.guardSpeed);
    expect(endlessDifficulty(10_000).guardSpeed).toBe(1.3);
    expect(endlessDifficulty(10_000).pitOpen).toBe(3);
    expect(endlessDifficulty(5).stars).toBe(5);
  });

  it("has a victory track for the ending", () => {
    expect(TRACKS.victory.lead).toHaveLength(8);
    expect(TRACKS.victory.bass).toHaveLength(8);
  });
});

describe("endless levels", () => {
  it("always generate, are valid, and use the hardest profile", async () => {
    const { endlessLevel, profileFor } =
      await import("../src/levels/generator");
    const { parseLevel } = await import("../src/game/level");
    const max = profileFor(1);
    for (let n = 0; n < 40; n++) {
      const def = endlessLevel(n);
      const l = parseLevel(def);
      expect(l.guards.length, def.name).toBe(max.guards);
      expect(l.diamonds.length).toBe(max.diamonds);
      expect(def.name).toContain(`Endless ${n + 1}`);
    }
    expect(endlessLevel(3)).toEqual(endlessLevel(3));
    expect(endlessLevel(3).map).not.toEqual(endlessLevel(4).map);
  });
});
