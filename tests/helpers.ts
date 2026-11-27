import { COLS, ROWS, SIM_DT } from "../src/game/config";
import { parseLevel } from "../src/game/level";
import { World, NO_INPUT, type HeroInput } from "../src/game/world";

/** Builds a 28x16 map: empty air, ground floor on row 15, plus row overrides (padded with '.'). */
export function buildMap(overrides: Record<number, string>): string[] {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    const base = y === ROWS - 1 ? "#".repeat(COLS) : ".".repeat(COLS);
    const o = overrides[y];
    rows.push(
      o === undefined ? base : o.padEnd(COLS, y === ROWS - 1 ? "#" : "."),
    );
  }
  return rows;
}

export function makeWorld(overrides: Record<number, string>): World {
  const merged = { 14: "", ...overrides };
  const map = buildMap(merged);
  // Ensure a hero exists and at least one gold (parser requirements) if the test did not add them.
  const joined = map.join("");
  if (!joined.includes("P")) map[0] = "P" + map[0].slice(1);
  if (!joined.includes("E")) map[0] = map[0].slice(0, 27) + "E";
  if (!joined.includes("$") && !joined.includes("*"))
    map[1] = map[1].slice(0, 26) + "$" + map[1][27];
  return new World(parseLevel({ name: "t", theme: "temple", map }));
}

export function run(
  w: World,
  seconds: number,
  inp: Partial<HeroInput> = {},
): void {
  const full: HeroInput = { ...NO_INPUT, ...inp };
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n; i++) w.update(SIM_DT, full);
}

/** Runs one step per entry, useful for single-shot actions. */
export function tick(w: World, inp: Partial<HeroInput> = {}): void {
  w.update(SIM_DT, { ...NO_INPUT, ...inp });
}
