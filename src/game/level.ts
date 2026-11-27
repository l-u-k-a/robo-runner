import { COLS, ROWS } from "./config";
import type { LevelDef, ParsedLevel, Tile, ToolKind } from "./types";

export class LevelError extends Error {}

const TILE_CHARS: Record<string, Tile> = {
  ".": "empty",
  " ": "empty",
  "#": "ground",
  "@": "stone",
  H: "ladder",
  "-": "rope",
  ">": "zipR",
  "<": "zipL",
  "*": "rope", // rope with gold on it
};

const ITEM_CHARS: Record<string, ToolKind> = {
  S: "shock",
  D: "decoy",
  M: "emp",
  B: "boots",
  O: "smoke",
  U: "glue",
  X: "bomb",
};

/** Parses an ASCII level. Legend: see README. */
export function parseLevel(def: LevelDef): ParsedLevel {
  const { map } = def;
  if (map.length !== ROWS) {
    throw new LevelError(
      `${def.name}: expected ${ROWS} rows, got ${map.length}`,
    );
  }
  const out: ParsedLevel = {
    name: def.name,
    theme: def.theme,
    tiles: [],
    gold: [],
    diamonds: [],
    items: [],
    hero: { x: -1, y: -1 },
    guards: [],
    exit: { x: -1, y: -1 },
  };
  let heroCount = 0;
  let exitCount = 0;

  map.forEach((line, y) => {
    if (line.length !== COLS) {
      throw new LevelError(
        `${def.name}: row ${y} has ${line.length} columns, expected ${COLS}`,
      );
    }
    const row: Tile[] = [];
    for (let x = 0; x < COLS; x++) {
      const ch = line[x];
      let tile: Tile = "empty";
      if (ch in TILE_CHARS) {
        tile = TILE_CHARS[ch];
        if (ch === "*") out.gold.push({ x, y });
      } else if (ch === "$") {
        out.gold.push({ x, y });
      } else if (ch === "V") {
        out.diamonds.push({ x, y });
      } else if (ch === "P") {
        out.hero = { x, y };
        heroCount++;
      } else if (ch === "G") {
        out.guards.push({ x, y });
      } else if (ch === "E") {
        out.exit = { x, y };
        exitCount++;
      } else if (ch in ITEM_CHARS) {
        out.items.push({ x, y, kind: ITEM_CHARS[ch] });
      } else {
        throw new LevelError(
          `${def.name}: unknown character '${ch}' at ${x},${y}`,
        );
      }
      row.push(tile);
    }
    out.tiles.push(row);
  });

  if (heroCount !== 1)
    throw new LevelError(`${def.name}: needs exactly one hero spawn 'P'`);
  if (exitCount !== 1)
    throw new LevelError(`${def.name}: needs exactly one exit door 'E'`);
  if (out.gold.length === 0)
    throw new LevelError(`${def.name}: needs at least one gold coin`);
  return out;
}
