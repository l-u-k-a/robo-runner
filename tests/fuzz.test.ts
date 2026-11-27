import { describe, expect, it } from "vitest";
import { CFG, SIM_DT } from "../src/game/config";
import { difficultyFor } from "../src/game/difficulty";
import { parseLevel } from "../src/game/level";
import type { Char } from "../src/game/movement";
import { World, type HeroInput } from "../src/game/world";
import { LEVEL_DEFS } from "../src/levels/all";
import { mulberry32 } from "../src/levels/generator";
import { makeWorld, run, tick } from "./helpers";

/** True when a live character overlaps a solid tile, i.e. it is stuck inside the floor. */
function embedded(w: World, c: Char): boolean {
  if (!c.alive || c.mode === "pit") return false;
  const y0 = Math.floor(c.y + 1e-3);
  const y1 = Math.floor(c.y + 1 - 1e-3);
  const x0 = Math.floor(c.x + 1e-3);
  const x1 = Math.floor(c.x + 1 - 1e-3);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.solid(x, y)) return true;
  return false;
}

describe("nobody ends up inside the floor", () => {
  it("a hero part-way into a pit when it finishes refilling is buried (dies)", () => {
    // The sequence from the bug report: walk onto a pit that is just about to close.
    const w = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w.hero.x = 0.6; // already over the pit, so he starts to drop into it right away
    w.hero.y = 14;
    w.pits.push({ x: 1, y: 15, state: "refilling", t: CFG.refillTime - 0.05 });
    tick(w);
    expect(w.hero.mode).toBe("fall");
    run(w, 0.3);
    expect(w.pits).toHaveLength(0);
    expect(["dying", "dead"]).toContain(w.status);
  });

  it("the same with debug invincibility: he is lifted out onto the floor, not left inside it", () => {
    const w = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w.hero.x = 0.6;
    w.hero.y = 14;
    w.debug.invincible = true;
    w.pits.push({ x: 1, y: 15, state: "refilling", t: CFG.refillTime - 0.05 });
    run(w, 0.8);
    expect(w.status).toBe("playing");
    expect(embedded(w, w.hero)).toBe(false);
    expect(w.hero.y).toBeLessThanOrEqual(14);
  });

  it("standing on the floor above a closing pit, a full tile up, is still safe", () => {
    const w = makeWorld({ 14: "P", 15: "#".repeat(28) });
    w.hero.x = 2;
    w.hero.y = 14;
    // A pit next to him closes; he never stepped over it.
    w.pits.push({ x: 3, y: 15, state: "refilling", t: CFG.refillTime - 0.05 });
    tick(w);
    run(w, 0.2);
    expect(w.status).toBe("playing");
  });

  it("random play on many levels never leaves the hero or a guard inside solid floor", () => {
    const found: string[] = [];
    for (let r = 0; r < 150 && found.length === 0; r++) {
      const li = (r * 7) % LEVEL_DEFS.length;
      const w = new World(parseLevel(LEVEL_DEFS[li]), difficultyFor(li, LEVEL_DEFS.length));
      w.debug.guards = r % 3 !== 0;
      w.debug.invincible = r % 4 === 1;
      const rand = mulberry32(r * 977 + 13);
      let inp: HeroInput = { dx: 0, dy: 0, digLeft: false, digRight: false, useTool: false };
      for (let t = 0; t < 60 * 30 && w.status === "playing"; t++) {
        if (t % 9 === 0) {
          const x = rand();
          inp = {
            dx: x < 0.35 ? -1 : x < 0.7 ? 1 : 0,
            dy: rand() < 0.2 ? -1 : rand() < 0.2 ? 1 : 0,
            digLeft: rand() < 0.12,
            digRight: rand() < 0.12,
            useTool: rand() < 0.03,
          };
        }
        w.update(SIM_DT, inp);
        w.events.length = 0;
        const who = [w.hero, ...w.guards].find((c) => embedded(w, c));
        if (who) {
          found.push(`${LEVEL_DEFS[li].name} run ${r} t=${t}: ${who.kind} at ${who.x.toFixed(2)},${who.y.toFixed(2)} ${who.mode}`);
          break;
        }
      }
    }
    expect(found).toEqual([]);
  }, 120_000);
});
