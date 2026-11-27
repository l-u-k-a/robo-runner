import { describe, expect, it } from "vitest";
import { GameFlow } from "../src/core/flow";
import { Input } from "../src/core/input";
import { Accumulator } from "../src/core/loop";
import { CFG, SIM_DT } from "../src/game/config";

describe("Accumulator", () => {
  it("returns whole steps and keeps the remainder", () => {
    const a = new Accumulator(SIM_DT);
    expect(a.add(SIM_DT * 0.5)).toBe(0);
    expect(a.add(SIM_DT * 0.5)).toBe(1);
    expect(a.add(SIM_DT * 2)).toBe(2);
  });

  it("clamps huge frames", () => {
    const a = new Accumulator(SIM_DT, 5);
    expect(a.add(10)).toBe(5);
  });
});

describe("Input", () => {
  it("tracks down state and consumes presses once", () => {
    const i = new Input();
    i.press("Space");
    expect(i.isDown("Space")).toBe(true);
    expect(i.take("Space")).toBe(true);
    expect(i.take("Space")).toBe(false);
    expect(i.isDown("Space")).toBe(true);
    i.release("Space");
    expect(i.isDown("Space")).toBe(false);
  });
});

describe("GameFlow", () => {
  it("starts, pauses and resumes", () => {
    const f = new GameFlow(5);
    expect(f.state).toBe("title");
    f.start();
    expect(f.state).toBe("playing");
    f.togglePause();
    expect(f.state).toBe("paused");
    f.togglePause();
    expect(f.state).toBe("playing");
  });

  it("loses a life per death and ends the game on the last one", () => {
    const f = new GameFlow(5);
    f.start();
    expect(f.heroDied()).toBe("retry");
    expect(f.heroDied()).toBe("retry");
    expect(f.lives).toBe(CFG.startLives - 2);
    expect(f.heroDied()).toBe("gameOver");
    expect(f.state).toBe("gameOver");
  });

  it("advances levels and wins after the last", () => {
    const f = new GameFlow(2);
    f.start();
    f.levelCompleted(300);
    expect(f.state).toBe("levelClear");
    expect(f.score).toBe(300 + CFG.levelScore);
    f.nextLevel();
    expect(f.levelIndex).toBe(1);
    expect(f.state).toBe("playing");
    f.levelCompleted(0);
    expect(f.state).toBe("win");
  });
});
