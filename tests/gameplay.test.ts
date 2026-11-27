import { describe, expect, it } from "vitest";
import { CFG, SIM_DT } from "../src/game/config";
import { difficultyFor } from "../src/game/difficulty";
import { parseLevel } from "../src/game/level";
import { nextStepToNearest } from "../src/game/pathfinding";
import { NO_INPUT, World } from "../src/game/world";
import { LEVEL_DEFS, TOTAL_LEVELS } from "../src/levels/all";
import { makeWorld, run, tick } from "./helpers";

// Floor on row 15, so characters stand on row 14.

describe("hero movement", () => {
  it("runs right and is blocked by a wall", () => {
    const w = makeWorld({ 14: "P....#" });
    run(w, 2, { dx: 1 });
    expect(w.hero.x).toBeCloseTo(4, 1);
    expect(w.hero.pose).toBe("idle");
  });

  it("falls off a ledge and lands", () => {
    const w = makeWorld({ 10: "P.", 11: "#", 14: "" });
    // hero starts at row 0 in helper default; place explicitly
    w.hero.x = 0;
    w.hero.y = 10;
    run(w, 0.2, { dx: 1 });
    run(w, 1.5);
    expect(w.hero.mode).toBe("ground");
    expect(w.hero.y).toBe(14);
  });

  it("climbs a ladder up and stands on top", () => {
    const w = makeWorld({ 11: "####H", 12: "....H", 13: "....H", 14: "....H" });
    w.hero.x = 4;
    w.hero.y = 14;
    run(w, 2, { dy: -1 });
    expect(w.hero.y).toBe(10);
    expect(w.hero.mode).toBe("ground");
    run(w, 0.3, { dy: -1 });
    expect(w.hero.y).toBe(10);
  });

  it("descends a ladder", () => {
    const w = makeWorld({ 11: "....H", 12: "....H", 13: "....H", 14: "....H" });
    w.hero.x = 4;
    w.hero.y = 10;
    run(w, 2, { dy: 1 });
    expect(w.hero.y).toBe(14);
  });

  it("hangs on a rope, crosses a gap, and drops with down", () => {
    const w = makeWorld({ 10: ".-----", 11: "#######" });
    w.hero.x = 1;
    w.hero.y = 10;
    // gap below the rope: floor on row 11 only to col 0..6, so remove it
    for (let x = 1; x <= 5; x++) w.tiles[11][x] = "empty";
    run(w, 0.5);
    expect(w.hero.mode).toBe("ground");
    expect(w.hero.pose).toBe("hang");
    run(w, 0.4, { dx: 1 });
    expect(w.hero.y).toBe(10);
    run(w, 1, { dy: 1 });
    expect(w.hero.y).toBe(14);
  });

  it("slides along a zip-line and gets off at the end", () => {
    const w = makeWorld({ 10: ".>>>>>>", 11: "#......." });
    w.hero.x = 0;
    w.hero.y = 10;
    for (let x = 1; x <= 6; x++) w.tiles[11][x] = "empty";
    w.tiles[11][7] = "ground";
    run(w, 0.3, { dx: 1 });
    expect(w.hero.mode).toBe("zip");
    run(w, 1.5);
    expect(w.hero.mode).toBe("ground");
    expect(Math.round(w.hero.x)).toBe(7);
    expect(w.hero.y).toBe(10);
  });
});

describe("digging and pits", () => {
  it("digs diagonally, pit opens then refills on schedule", () => {
    const w = makeWorld({ 14: ".P", 15: "#".repeat(28) });
    w.hero.x = 1;
    w.hero.y = 14;
    // dig into row 15 ground at col 2
    tick(w, { digRight: true });
    expect(w.pits).toHaveLength(1);
    expect(w.tileAt(2, 15)).toBe("ground");
    run(w, CFG.digTime + 0.1);
    expect(w.tileAt(2, 15)).toBe("empty");
    run(w, CFG.pitOpenTime);
    run(w, CFG.refillTime + 0.1);
    expect(w.tileAt(2, 15)).toBe("ground");
    expect(w.pits).toHaveLength(0);
  });

  it("cannot dig stone", () => {
    const w = makeWorld({ 14: ".P", 15: "@".repeat(28) });
    w.hero.x = 1;
    w.hero.y = 14;
    tick(w, { digRight: true });
    expect(w.pits).toHaveLength(0);
  });

  it("laser has a cooldown", () => {
    const w = makeWorld({ 14: ".P..", 15: "#".repeat(28) });
    w.hero.x = 1;
    w.hero.y = 14;
    tick(w, { digRight: true });
    tick(w, { digLeft: true });
    expect(w.pits).toHaveLength(1);
    run(w, CFG.laserCooldown + 0.05);
    tick(w, { digLeft: true });
    expect(w.pits).toHaveLength(2);
  });

  it("a guard falls in, escapes after the escape time", () => {
    const w = makeWorld({ 14: "P..G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    // Open a pit under the guard's path directly.
    w.pits.push({ x: 2, y: 15, state: "open", t: 0 });
    run(w, 1.5);
    const g = w.guards[0];
    expect(g.mode).toBe("pit");
    run(w, CFG.guardEscape + 0.2);
    expect(g.mode).not.toBe("pit");
  });

  it("refilling a pit with a guard in it kills him, then he respawns", () => {
    const w = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    const g = w.guards.length ? w.guards[0] : undefined;
    expect(g).toBeUndefined();
    // Build a world with a guard and a distant spawn.
    const w2 = makeWorld({ 14: "P.......G.....", 15: "#".repeat(28) });
    w2.hero.x = 0;
    w2.hero.y = 14;
    const guard = w2.guards[0];
    guard.mode = "pit";
    guard.trapX = 5;
    guard.trapY = 15;
    guard.x = 5;
    guard.y = 15;
    w2.pits.push({ x: 5, y: 15, state: "refilling", t: CFG.refillTime - 0.01 });
    run(w2, 0.1);
    expect(guard.alive).toBe(false);
    run(w2, CFG.guardRespawn + 0.2);
    expect(guard.alive).toBe(true);
  });

  it("hero standing on a trapped guard pins him; pit then kills the guard", () => {
    const w = makeWorld({ 14: "...G", 15: "#".repeat(28) });
    const g = w.guards[0];
    w.hero.x = 3;
    w.hero.y = 14;
    g.x = 3;
    g.y = 15;
    g.mode = "pit";
    g.trapX = 3;
    g.trapY = 15;
    w.pits.push({ x: 3, y: 15, state: "open", t: 0 });
    run(w, CFG.guardEscape + 1);
    expect(g.mode).toBe("pit");
    expect(w.hero.y).toBe(14);
    expect(w.status).toBe("playing");
    run(w, CFG.pitOpenTime + CFG.refillTime);
    expect(g.alive).toBe(false);
    expect(w.status).toBe("playing");
  });

  it("hero buried in a refilling pit dies", () => {
    const w = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w.hero.x = 4;
    w.hero.y = 15;
    w.hero.mode = "pit";
    w.hero.trapX = 4;
    w.hero.trapY = 15;
    w.pits.push({ x: 4, y: 15, state: "refilling", t: CFG.refillTime - 0.01 });
    run(w, 0.1);
    expect(w.status).toBe("dying");
  });
});

describe("guards and hero", () => {
  it("guard chases and kills the hero on contact", () => {
    const w = makeWorld({ 14: "P.........G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    run(w, 5);
    expect(["dying", "dead"]).toContain(w.status);
  });

  it("guard climbs a ladder to reach the hero", () => {
    const w = makeWorld({
      11: "#####H####",
      12: ".....H....",
      13: ".....H....",
      14: ".....H..G.",
    });
    w.hero.x = 6;
    w.hero.y = 10;
    w.guards[0].x = 7;
    w.guards[0].y = 14;
    run(w, 3);
    expect(w.guards[0].y).toBeLessThan(14);
  });

  it("collecting all gold opens the door and reaching it wins", () => {
    const w = makeWorld({ 14: "P.$....E" });
    w.hero.x = 0;
    w.hero.y = 14;
    // keep original helper gold out of the way: remove all gold except the one at col 2
    w.gold.clear();
    w.gold.add(14 * 28 + 2);
    run(w, 0.8, { dx: 1 });
    expect(w.goldLeft).toBe(0);
    expect(w.doorOpen).toBe(true);
    expect(w.score).toBe(CFG.goldScore);
    run(w, 2, { dx: 1 });
    expect(w.status).toBe("won");
  });

  it("guards do not pick up gold", () => {
    const w = makeWorld({ 14: "P..$..G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    const before = w.goldLeft;
    w.guards[0].x = 3;
    w.guards[0].y = 14;
    run(w, 0.5);
    expect(w.goldLeft).toBe(before);
  });
});

describe("tools", () => {
  it("shock trap stuns a guard for 5 seconds and is harmless to touch", () => {
    const w = makeWorld({
      14: ".P.S....................G",
      15: "#".repeat(28),
    });
    w.hero.x = 1;
    w.hero.y = 14;
    w.guards[0].x = 12;
    w.guards[0].y = 14;
    run(w, 0.6, { dx: 1 });
    expect(w.held).toBe("shock");
    tick(w, { useTool: true });
    expect(w.traps).toHaveLength(1);
    expect(w.held).toBeNull();
    // Hero steps away; the guard walks over the trap.
    run(w, 0.6, { dx: -1 });
    run(w, 6);
    const g = w.guards[0];
    expect(g.stun).toBeGreaterThan(0);
    expect(w.traps).toHaveLength(0);
    const stunAfter = g.stun;
    expect(stunAfter).toBeLessThanOrEqual(CFG.shockStun);
    expect(w.status).toBe("playing");
  });

  it("only one tool can be held at a time", () => {
    const w = makeWorld({ 14: "PSM", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    run(w, 0.6, { dx: 1 });
    expect(w.held).toBe("shock");
    expect(w.items.size).toBe(1);
  });

  it("EMP freezes guards in radius only", () => {
    const w = makeWorld({
      14: "PM..G.....................G",
      15: "#".repeat(28),
    });
    w.hero.x = 0;
    w.hero.y = 14;
    w.guards[1].x = 26;
    run(w, 0.3, { dx: 1 });
    expect(w.held).toBe("emp");
    tick(w, { useTool: true });
    expect(w.guards[0].stun).toBeGreaterThan(0);
    expect(w.guards[1].stun).toBe(0);
  });

  it("boots speed the hero up temporarily", () => {
    const w = makeWorld({ 14: "PB", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    run(w, 0.3, { dx: 1 });
    tick(w, { useTool: true });
    expect(w.bootsT).toBeGreaterThan(7);
    const x0 = w.hero.x;
    run(w, 0.5, { dx: 1 });
    const fast = w.hero.x - x0;
    expect(fast).toBeGreaterThan(CFG.heroRun * 0.5 * 1.3);
    run(w, CFG.bootsTime);
    expect(w.bootsT).toBe(0);
  });

  it("decoy attracts guards in line of sight", () => {
    const w = makeWorld({ 14: "P.D....................G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    w.guards[0].x = 24;
    w.guards[0].y = 14;
    run(w, 0.6, { dx: 1 });
    expect(w.held).toBe("decoy");
    tick(w, { useTool: true });
    expect(w.decoy).not.toBeNull();
    const dx = w.decoy!.x;
    const hx = w.hero.x;
    // Hero walks left, away from the decoy; the guard should head for the decoy and stop near it.
    run(w, 0.4, { dx: -1 });
    expect(w.hero.x).toBeLessThan(hx);
    run(w, 4);
    expect(Math.abs(w.guards[0].x - dx)).toBeLessThan(Math.abs(24 - dx));
  });
});

describe("debug switches", () => {
  it("with guards disabled, guards neither move nor hurt the hero", () => {
    const w = makeWorld({ 14: "P.........G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    w.debug.guards = false;
    const gx = w.guards[0].x;
    run(w, 5);
    expect(w.guards[0].x).toBe(gx);
    expect(w.status).toBe("playing");
    // Walk straight into the guard: still alive.
    run(w, 3, { dx: 1 });
    expect(w.status).toBe("playing");
  });

  it("an invincible hero survives guard contact and pit burial", () => {
    const w = makeWorld({ 14: "P.G", 15: "#".repeat(28) });
    w.hero.x = 0;
    w.hero.y = 14;
    w.guards[0].x = 1;
    w.guards[0].y = 14;
    w.debug.invincible = true;
    run(w, 1);
    expect(w.status).toBe("playing");

    const w2 = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w2.debug.invincible = true;
    w2.hero.x = 4;
    w2.hero.y = 15;
    w2.hero.mode = "pit";
    w2.hero.trapX = 4;
    w2.hero.trapY = 15;
    w2.pits.push({ x: 4, y: 15, state: "refilling", t: CFG.refillTime - 0.01 });
    run(w2, 0.1);
    expect(w2.status).toBe("playing");
    expect(w2.hero.mode).toBe("ground");
    expect(w2.hero.y).toBe(14);
  });

  it("debugCollectAll clears gold and opens the door", () => {
    const w = makeWorld({ 14: "P.$" });
    w.debugCollectAll();
    expect(w.goldLeft).toBe(0);
    expect(w.doorOpen).toBe(true);
  });
});

describe("pits on upper floors", () => {
  const upper = (): ReturnType<typeof makeWorld> =>
    makeWorld({ 9: "#".repeat(28), 14: "" });

  it("a guard is held by a pit in a thin floor instead of falling through", () => {
    const w = upper();
    w.hero.x = 10;
    w.hero.y = 8;
    w.guards.push(...makeWorld({ 8: "G" }).guards);
    const g = w.guards[0];
    g.x = 3;
    g.y = 8;
    w.pits.push({ x: 5, y: 9, state: "open", t: 0 });
    run(w, 1.5);
    expect(g.mode).toBe("pit");
    expect(g.y).toBe(9);
    expect(g.x).toBe(5);
    // escapes onto the same level
    run(w, CFG.guardEscape + 0.3);
    expect(g.mode).not.toBe("pit");
    expect(g.y).toBeLessThanOrEqual(8);
  });

  it("the hero falls through a pit in a thin floor to the level below", () => {
    const w = upper();
    w.hero.x = 3;
    w.hero.y = 8;
    w.pits.push({ x: 5, y: 9, state: "open", t: 0 });
    run(w, 1, { dx: 1 });
    run(w, 1);
    expect(w.hero.mode).toBe("ground");
    expect(w.hero.y).toBe(14);
    expect(w.status).toBe("playing");
  });

  it("the hero can walk over a guard held in an upper pit", () => {
    const w = upper();
    w.hero.x = 3;
    w.hero.y = 8;
    const g = w.guards[0] ?? makeWorld({ 8: "G" }).guards[0];
    if (!w.guards.length) w.guards.push(g);
    g.x = 5;
    g.y = 9;
    g.mode = "pit";
    g.trapX = 5;
    g.trapY = 9;
    w.pits.push({ x: 5, y: 9, state: "open", t: 0 });
    run(w, 0.8, { dx: 1 });
    expect(w.hero.x).toBeGreaterThan(5.5);
    expect(w.hero.y).toBe(8);
    expect(w.status).toBe("playing");
  });
});

describe("diamonds", () => {
  it("give bonus points but are not needed to open the door", () => {
    const w = makeWorld({ 14: "P.V.$" });
    w.hero.x = 0;
    w.hero.y = 14;
    expect(w.level.diamonds).toHaveLength(1);
    run(w, 0.6, { dx: 1 });
    expect(w.diamondsTaken).toBe(1);
    expect(w.score).toBe(CFG.diamondScore);
    expect(w.doorOpen).toBe(false);
    run(w, 0.6, { dx: 1 });
    expect(w.doorOpen).toBe(true);
    expect(w.score).toBe(CFG.diamondScore + CFG.goldScore);
  });
});

describe("guard strategy", () => {
  it("guards do not stack on top of each other while chasing", () => {
    const w = makeWorld({
      14: "P..........................",
      15: "#".repeat(28),
    });
    w.hero.x = 8;
    w.hero.y = 14;
    const [a] = makeWorld({ 14: "G" }).guards;
    const [b] = makeWorld({ 14: "G" }).guards;
    w.guards.push(a, b);
    a.x = 20;
    a.y = 14;
    b.x = 21;
    b.y = 14;
    let minGap = Infinity;
    for (let i = 0; i < 60 * 4; i++) {
      tick(w);
      if (a.alive && b.alive) minGap = Math.min(minGap, Math.abs(a.x - b.x));
    }
    expect(minGap).toBeGreaterThan(0.7);
    expect(a.x).toBeLessThan(20); // still chasing
  });

  it("a second guard takes a different ladder when the first one blocks the route", () => {
    // Two ladders lead up to the hero's floor; guards start together under the left one.
    const w = makeWorld({
      11: "#####H####H####",
      12: ".....H....H....",
      13: ".....H....H....",
      14: "",
      15: "#".repeat(28),
    });
    w.hero.x = 7;
    w.hero.y = 10;
    const [a] = makeWorld({ 14: "G" }).guards;
    const [b] = makeWorld({ 14: "G" }).guards;
    w.guards.push(a, b);
    a.x = 6;
    a.y = 14;
    b.x = 7;
    b.y = 14;
    run(w, 0.8);
    // They should not both be crowding the same cell.
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.7);
  });
});

describe("new tools: smoke bomb, glue, bomb", () => {
  const FLOOR = "#".repeat(28);
  const withGuard = (w: ReturnType<typeof makeWorld>, x: number, y = 14) => {
    const [g] = makeWorld({ 14: "G" }).guards;
    w.guards.push(g);
    g.x = x;
    g.y = y;
    return g;
  };

  it("parses the new item characters", () => {
    const w = makeWorld({ 14: "POUX", 15: FLOOR });
    expect(w.level.items.map((i) => i.kind).sort()).toEqual([
      "bomb",
      "glue",
      "smoke",
    ]);
  });

  describe("smoke bomb", () => {
    it("makes nearby guards cough and shields the hero from them", () => {
      const w = makeWorld({ 14: "PO", 15: FLOOR });
      w.hero.x = 0;
      w.hero.y = 14;
      const g = withGuard(w, 12);
      run(w, 0.4, { dx: 1 });
      expect(w.held).toBe("smoke");
      g.x = w.hero.x + 2;
      tick(w, { useTool: true });
      expect(w.smokes).toHaveLength(1);
      expect(w.invulnT).toBeGreaterThan(CFG.smokeInvuln - 0.1);
      expect(g.cough).toBeGreaterThan(0);
      expect(w.events.some((e) => e.type === "cough")).toBe(true);
      // a coughing guard stands still...
      const gx = g.x;
      run(w, 1);
      expect(g.x).toBe(gx);
      // ...and even a guard on top of the hero cannot catch him while shielded
      g.cough = 0;
      g.x = w.hero.x;
      run(w, 0.3);
      expect(w.status).toBe("playing");
    });

    it("wears off: afterwards guards can catch the hero again", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 3;
      w.hero.y = 14;
      w.held = "smoke";
      const g = withGuard(w, 20);
      tick(w, { useTool: true });
      run(w, CFG.smokeInvuln + 0.2);
      expect(w.invulnT).toBe(0);
      expect(w.smokes).toHaveLength(1); // the cloud itself lingers a little longer
      run(w, CFG.smokeTime);
      expect(w.smokes).toHaveLength(0);
      g.x = 3.2;
      g.cough = 0;
      run(w, 0.3);
      expect(["dying", "dead"]).toContain(w.status);
    });

    it("guards walking into the lingering cloud start coughing", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 5;
      w.hero.y = 14;
      w.held = "smoke";
      tick(w, { useTool: true });
      const g = withGuard(w, 5);
      g.x = 5 + CFG.smokeRadius - 0.5;
      g.cough = 0;
      run(w, 0.1);
      expect(g.cough).toBeGreaterThan(0);
    });
  });

  describe("glue", () => {
    it("spills a puddle under and beside the hero that lasts the whole stage", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 6;
      w.hero.y = 14;
      w.held = "glue";
      tick(w, { useTool: true });
      expect(w.glue.size).toBe(3);
      expect(w.events.some((e) => e.type === "glue")).toBe(true);
      run(w, 60);
      expect(w.glue.size).toBe(3);
    });

    it("slows guards that cross it", () => {
      const travel = (glued: boolean): number => {
        const w = makeWorld({ 14: "P", 15: FLOOR });
        w.hero.x = 14;
        w.hero.y = 14;
        const g = withGuard(w, 24);
        if (glued) for (let x = 10; x <= 26; x++) w.glue.add(14 * 28 + x);
        const x0 = g.x;
        run(w, 1);
        return x0 - g.x;
      };
      const free = travel(false);
      const stuck = travel(true);
      expect(free).toBeGreaterThan(2);
      expect(stuck).toBeLessThan(free * (CFG.glueSlow + 0.1));
      expect(stuck).toBeGreaterThan(0);
    });

    it("does not slow the hero", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 0;
      w.hero.y = 14;
      for (let x = 0; x <= 20; x++) w.glue.add(14 * 28 + x);
      run(w, 1, { dx: 1 });
      expect(w.hero.x).toBeGreaterThan(CFG.heroRun - 0.5);
    });
  });

  describe("bomb", () => {
    it("lights, then explodes after the fuse: kills the hero standing next to it", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 6;
      w.hero.y = 14;
      w.held = "bomb";
      tick(w, { useTool: true });
      expect(w.bombs).toHaveLength(1);
      expect(w.events.some((e) => e.type === "bombLit")).toBe(true);
      run(w, CFG.bombFuse - 0.3);
      expect(w.status).toBe("playing");
      expect(w.events.some((e) => e.type === "boom")).toBe(false);
      run(w, 0.5);
      expect(w.events.some((e) => e.type === "boom")).toBe(true);
      expect(["dying", "dead"]).toContain(w.status);
      expect(w.bombs).toHaveLength(0);
    });

    it("spares a hero who runs out of the blast radius", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 4;
      w.hero.y = 14;
      w.held = "bomb";
      tick(w, { useTool: true });
      run(w, CFG.bombFuse + 0.5, { dx: 1 });
      expect(w.events.some((e) => e.type === "boom")).toBe(true);
      expect(w.status).toBe("playing");
    });

    it("kills guards in the radius, who respawn as usual, and spares distant ones", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 0;
      w.hero.y = 14;
      const near = withGuard(w, 8);
      const far = withGuard(w, 20);
      near.stun = 99;
      far.stun = 99;
      w.bombs.push({ x: 9, y: 14, t: 0.1 });
      run(w, 0.3);
      expect(near.alive).toBe(false);
      expect(far.alive).toBe(true);
      // respawns at one of the level's guard spawns
      w.level.guards.push({ x: 24, y: 14 });
      run(w, CFG.guardRespawn + 0.5);
      expect(near.alive).toBe(true);
    });

    it("blasts the ground into pits that heal back, but leaves stone alone", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 0;
      w.hero.y = 14;
      w.tiles[15][11] = "stone";
      w.bombs.push({ x: 9, y: 14, t: 0.05 });
      run(w, 0.2);
      const crater = w.pits.map((p) => p.x).sort((a, b) => a - b);
      expect(crater.length).toBeGreaterThanOrEqual(3);
      expect(crater).toContain(9);
      expect(w.pitAt(11, 15)).toBeUndefined(); // stone is not destroyed
      expect(w.tileAt(9, 15)).toBe("empty");
      run(w, CFG.pitOpenTime + CFG.refillTime + 0.5);
      expect(w.pits).toHaveLength(0);
      expect(w.tileAt(9, 15)).toBe("ground");
    });

    it("an invincible hero (debug) survives the blast", () => {
      const w = makeWorld({ 14: "P", 15: FLOOR });
      w.hero.x = 5;
      w.hero.y = 14;
      w.debug.invincible = true;
      w.bombs.push({ x: 5, y: 14, t: 0.05 });
      run(w, 0.2);
      expect(w.status).toBe("playing");
    });
  });
});

describe("guards patrol when the hero is far away", () => {
  const FLOOR = "#".repeat(28);
  const addGuard = (w: ReturnType<typeof makeWorld>, x: number, y = 14) => {
    const [g] = makeWorld({ 14: "G" }).guards;
    w.guards.push(g);
    g.x = x;
    g.y = y;
    return g;
  };

  it("a distant guard sweeps its own platform end to end instead of chasing", () => {
    // Walls at 12 and 24 fence a platform (13..23); the hero is on the other side, far away.
    const w = makeWorld({ 14: "P...........#..........#....", 15: FLOOR });
    w.hero.x = 2;
    w.hero.y = 14;
    const g = addGuard(w, 18);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 60 * 14; i++) {
      tick(w);
      min = Math.min(min, g.x);
      max = Math.max(max, g.x);
    }
    expect(min).toBeGreaterThanOrEqual(12.9);
    expect(max).toBeLessThanOrEqual(23.1);
    expect(min).toBeLessThan(14.2); // reached the left end
    expect(max).toBeGreaterThan(21.8); // and the right end
    expect(w.status).toBe("playing");
  });

  it("notices the hero inside the aggro radius and chases", () => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = 10;
    w.hero.y = 14;
    const g = addGuard(w, 18);
    run(w, 1.5);
    expect(g.x).toBeLessThan(15);
  });

  it("keeps patrolling just outside the radius, and chases once the hero steps in", () => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = 4;
    w.hero.y = 14;
    const g = addGuard(w, 22);
    run(w, 1); // 18 columns away: patrolling (heading to the right end)
    expect(g.x).toBeGreaterThan(22);
    w.hero.x = 14; // 8 columns away now
    run(w, 1.5);
    expect(g.x).toBeLessThan(21);
  });

  it("gives up the chase when the hero gets far away", () => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = 10;
    w.hero.y = 14;
    const g = addGuard(w, 18);
    run(w, 1);
    expect(g.x).toBeLessThan(18);
    w.hero.x = 0; // far enough: beyond aggro + hysteresis
    g.x = 26;
    run(w, 3);
    // heads back towards the spot it was posted at (18), not towards the hero
    expect(g.x).toBeLessThan(26);
    expect(g.x).toBeGreaterThan(17);
  });

  it("a guard on an upper floor does not come down to the hero's level when he is far", () => {
    const w = makeWorld({
      12: "#########H#################",
      13: ".........H..................",
      14: "P........H..................",
      15: FLOOR,
    });
    w.hero.x = 0;
    w.hero.y = 14;
    const g = addGuard(w, 25, 11);
    run(w, 12);
    expect(g.y).toBe(11);
  });

  it("never chases through a decoy-free level when the hero is dead", () => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = 10;
    w.hero.y = 14;
    const g = addGuard(w, 14);
    w.debug.invincible = false;
    run(w, 3);
    expect(["dying", "dead"]).toContain(w.status);
    const x = g.x;
    run(w, 1);
    expect(Math.abs(g.x - x)).toBeLessThan(0.01);
  });
});

describe("digging at any position", () => {
  const FLOOR = "#".repeat(28);
  const dig = (x: number, dir: -1 | 1) => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = x;
    w.hero.y = 14;
    tick(w, dir > 0 ? { digRight: true } : { digLeft: true });
    return w;
  };

  it("aligned on a cell: digs the neighbouring cell as before", () => {
    expect(dig(5, 1).pits.map((p) => p.x)).toEqual([6]);
    expect(dig(5, -1).pits.map((p) => p.x)).toEqual([4]);
  });

  it("standing between two cells: shoots past the cells his body covers", () => {
    // The hero at 5.45 covers columns 5 and 6, so the clear cells are 4 and 7.
    expect(dig(5.45, 1).pits.map((p) => p.x)).toEqual([7]);
    expect(dig(5.45, -1).pits.map((p) => p.x)).toEqual([4]);
  });

  it("never opens a pit under the hero, at any sub-cell position", () => {
    for (let i = 0; i <= 40; i++) {
      const x = 5 + i / 40;
      for (const dir of [-1, 1] as const) {
        const w = dig(x, dir);
        expect(w.pits, `x=${x} dir=${dir}`).toHaveLength(1);
        const px = w.pits[0].x;
        const covers = (c: number) => c + 1 > x + 1e-3 && c < x + 1 - 1e-3;
        expect(covers(px), `x=${x} dir=${dir} pit=${px}`).toBe(false);
        expect(w.pits[0].y).toBe(15);
      }
    }
  });

  it("the hero stays standing after a shot taken between cells", () => {
    const w = dig(5.45, 1);
    run(w, 1);
    expect(w.hero.mode).toBe("ground");
    expect(w.hero.y).toBe(14);
  });

  it("still refuses to dig stone or a covered cell", () => {
    const w = makeWorld({ 14: "P", 15: FLOOR });
    w.hero.x = 5.45;
    w.hero.y = 14;
    w.tiles[15][7] = "stone";
    tick(w, { digRight: true });
    expect(w.pits).toHaveLength(0);
    w.tiles[15][7] = "ground";
    w.tiles[14][7] = "ladder";
    run(w, 0.3);
    tick(w, { digRight: true });
    expect(w.pits).toHaveLength(0);
  });
});

describe("guards: no lure-downstairs, close range, chasing upwards", () => {
  const FLOOR = "#".repeat(28);
  const addGuard = (w: ReturnType<typeof makeWorld>, x: number, y: number) => {
    const [g] = makeWorld({ 14: "G" }).guards;
    w.guards.push(g);
    g.x = x;
    g.y = y;
    return g;
  };
  const row = (len: number, marks: Record<number, string>): string => {
    const r = Array<string>(len).fill(".");
    for (const [i, c] of Object.entries(marks)) r[Number(i)] = c;
    return r.join("");
  };
  /** Upper floor (row 12) with a ladder at column 9; the exit is on the bottom row (or nowhere near). */
  const twoFloors = (exitCol: number | null) =>
    makeWorld({
      12: "#########H#################",
      13: ".........H..................",
      14: row(28, exitCol === null ? { 9: "H" } : { 9: "H", [exitCol]: "E" }),
      15: FLOOR,
    });
  /** Bottom floor plus an upper floor (row 12) reached by a ladder at column 5; exit upstairs at `exitCol`. */
  const exitUpstairs = (exitCol: number) =>
    makeWorld({
      11: row(28, { [exitCol]: "E" }),
      12: "#####H######################",
      13: ".....H......................",
      14: ".....H......................",
      15: FLOOR,
    });

  describe("not lured downstairs", () => {
    it("a guard stays on its floor when the hero is below it and not close", () => {
      const w = twoFloors(null);
      w.hero.x = 4; // 5 columns and 3 rows away, behind the guard (it sweeps away from him): outside the close range
      w.hero.y = 14;
      const g = addGuard(w, 9, 11);
      run(w, 2.5);
      expect(g.y).toBe(11);
      expect(w.status).toBe("playing");
    });

    it("stops chasing when the hero drops to a lower floor and is no longer close", () => {
      const w = twoFloors(null);
      w.hero.x = 14;
      w.hero.y = 11;
      const g = addGuard(w, 20, 11);
      run(w, 1);
      expect(g.x).toBeLessThan(20);
      w.hero.x = 8;
      w.hero.y = 14;
      g.x = 17;
      run(w, 1.5);
      expect(g.y).toBe(11);
    });

    it("guards still chase a hero on their own floor, or above it", () => {
      const w = twoFloors(null);
      w.hero.x = 3;
      w.hero.y = 11;
      const g = addGuard(w, 12, 11);
      run(w, 1.5);
      expect(g.x).toBeLessThan(10);
    });
  });

  describe("close range ignores floors", () => {
    it("a guard within about a floor and a half chases even a hero below it", () => {
      const w = twoFloors(null);
      w.hero.x = 11;
      w.hero.y = 14; // 2 columns, 3 rows away: 3.6 tiles
      const g = addGuard(w, 9, 11);
      run(w, 2);
      expect(g.y).toBeGreaterThan(11.5); // coming down the ladder
    });

    it("the close range is a radius, not a whole floor: just outside it the guard stays up", () => {
      const w = twoFloors(null);
      w.hero.x = 3; // 6 columns, 3 rows: 6.7 tiles, behind the guard
      w.hero.y = 14;
      const g = addGuard(w, 9, 11);
      run(w, 2);
      expect(g.y).toBe(11);
    });
  });

  describe("a hero above them", () => {
    it("a far-away guard on a lower floor climbs to the hero's floor, wherever the exit is", () => {
      const w = exitUpstairs(27); // the exit has nothing to do with it
      w.hero.x = 12;
      w.hero.y = 11;
      const g = addGuard(w, 3, 14);
      run(w, 3);
      expect(g.y).toBeLessThan(12.5);
    });

    it("goes up first, then closes in along the hero's floor", () => {
      const w = exitUpstairs(27);
      w.hero.x = 25;
      w.hero.y = 11;
      const g = addGuard(w, 3, 14);
      let xWhenUp = -1;
      for (let i = 0; i < 60 * 6; i++) {
        tick(w);
        if (xWhenUp < 0 && g.y <= 11.01) xWhenUp = g.x;
        if (w.status !== "playing") break;
      }
      expect(xWhenUp).toBeGreaterThan(0); // it did get up
      expect(xWhenUp).toBeLessThan(7); // by the nearest ladder (column 5), not by running across first
      expect(g.x).toBeGreaterThan(xWhenUp + 3); // and then it ran towards him
    });

    it("keeps going floor by floor, up to the hero", () => {
      const w = makeWorld({
        9: "#####H######################",
        10: ".....H......................",
        11: ".....H......................",
        12: "#####H######################",
        13: ".....H......................",
        14: ".....H......................",
        15: FLOOR,
      });
      w.hero.x = 14;
      w.hero.y = 8;
      const g = addGuard(w, 8, 14);
      run(w, 6);
      expect(g.y).toBeLessThanOrEqual(8.1);
    });

    it("with no way up it sweeps its floor instead of freezing", () => {
      const w = makeWorld({ 12: FLOOR, 14: "", 15: FLOOR });
      w.hero.x = 10;
      w.hero.y = 11;
      const g = addGuard(w, 20, 14);
      run(w, 0.5);
      const x = g.x;
      run(w, 2);
      expect(g.y).toBe(14);
      expect(Math.abs(g.x - x)).toBeGreaterThan(1);
    });

    it("a hero below and far away, even near the exit, does not draw a guard down", () => {
      const w = makeWorld({
        12: "#########H#################",
        13: ".........H..................",
        14: row(28, { 9: "H", 20: "E" }),
        15: FLOOR,
      });
      w.hero.x = 19;
      w.hero.y = 14;
      const g = addGuard(w, 3, 11);
      run(w, 3);
      expect(g.y).toBe(11);
    });

    it("a far guard on the hero's own floor just sweeps", () => {
      const w = makeWorld({ 14: ".P.E", 15: FLOOR });
      w.hero.x = 1;
      w.hero.y = 14;
      const g = addGuard(w, 27, 14); // 26 columns away
      run(w, 1.5);
      expect(g.x).toBeGreaterThan(25);
    });

    it("guards go back to their posts when the hero drops below them and away", () => {
      const w = exitUpstairs(22);
      w.hero.x = 20;
      w.hero.y = 11;
      const g = addGuard(w, 3, 14);
      run(w, 1.5);
      expect(g.y).toBeLessThan(14); // on its way up
      w.hero.x = 26; // far away and now below the guard
      w.hero.y = 14;
      run(w, 4);
      expect(g.y).toBe(14); // back at its post
    });
  });
});

describe("guards never end up stranded or jammed", () => {
  it("with the hero parked at the exit, every guard that has a way up reaches his floor", () => {
    const stranded: string[] = [];
    LEVEL_DEFS.forEach((def, i) => {
      const level = parseLevel(def);
      const w = new World(level, difficultyFor(i, TOTAL_LEVELS));
      w.debug.invincible = true;
      for (let t = 0; t < 60 * 45; t++) {
        w.hero.x = level.exit.x;
        w.hero.y = level.exit.y;
        w.update(SIM_DT, NO_INPUT);
      }
      for (const [gi, g] of w.guards.entries()) {
        if (!g.alive) continue;
        const cur = { x: Math.round(g.x), y: Math.round(g.y) };
        if (cur.y <= level.exit.y + 1) continue; // already on his floor (or on the ladder up to it)
        const wayUp = nextStepToNearest(
          w,
          cur,
          (x, y) => y < cur.y && (w.tileAt(x, y) === "ladder" || w.supported(x, y)),
        );
        if (wayUp) stranded.push(`${def.name} guard ${gi} at ${cur.x},${cur.y}`);
      }
    });
    expect(stranded).toEqual([]);
  }, 180_000);
});
