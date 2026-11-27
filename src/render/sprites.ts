import { TILE } from "../game/config";
import {
  GROUND_STYLES,
  spriteKeyGround,
  spriteKeyStone,
  type GroundStyle,
} from "./surfaces";

type Ctx = CanvasRenderingContext2D;

function make(w = TILE, h = TILE): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

const rect = (
  g: Ctx,
  col: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

/** Small deterministic PRNG so generated art is identical every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---- characters -----------------------------------------------------------

interface Palette {
  outline: string;
  body: string;
  dark: string;
  light: string;
  eye: string;
  accent: string;
}

const HERO: Palette = {
  outline: "#0e1a2e",
  body: "#5aa9ff",
  dark: "#2f6cc0",
  light: "#c4e4ff",
  eye: "#2dfcff",
  accent: "#ffd23f",
};

const GUARD: Palette = {
  outline: "#2a0a0a",
  body: "#c0392b",
  dark: "#7a1f17",
  light: "#ff9a7a",
  eye: "#ffe34d",
  accent: "#d4a017",
};

const GOLDEN: Palette = {
  outline: "#3a2600",
  body: "#ffd23a",
  dark: "#c58a00",
  light: "#fff3b0",
  eye: "#2dfcff",
  accent: "#ff4a2a",
};

type CharPose = "idle" | "run" | "climb" | "hang" | "fall" | "zip" | "pit";

function drawCharacter(
  g: Ctx,
  p: Palette,
  guard: boolean,
  pose: CharPose,
  f: number,
): void {
  const back = pose === "climb";
  const up = pose === "hang" || pose === "zip";
  const swing = f % 2;

  // legs
  const legY = 15;
  let legs: [number, number, number, number][];
  if (pose === "run") {
    legs = [
      [
        [6, legY, 3, 5],
        [11, legY, 3, 5],
      ],
      [
        [8, legY, 3, 4],
        [9, legY + 1, 3, 4],
      ],
      [
        [7, legY, 3, 5],
        [10, legY, 3, 5],
      ],
      [
        [9, legY + 1, 3, 4],
        [8, legY, 3, 4],
      ],
    ][f % 4] as [number, number, number, number][];
  } else if (pose === "climb") {
    legs = swing
      ? [
          [6, legY, 3, 4],
          [11, legY - 1, 3, 4],
        ]
      : [
          [6, legY - 1, 3, 4],
          [11, legY, 3, 5],
        ];
  } else if (pose === "fall") {
    legs = [
      [4, legY, 3, 4],
      [13, legY, 3, 4],
    ];
  } else if (up) {
    legs = swing
      ? [
          [7, 16, 3, 4],
          [10, 17, 3, 3],
        ]
      : [
          [7, 17, 3, 3],
          [10, 16, 3, 4],
        ];
  } else {
    legs = [
      [6, legY, 3, 5],
      [11, legY, 3, 5],
    ];
  }
  for (const [x, y, w, h] of legs) {
    rect(g, p.outline, x - 1, y, w + 2, h);
    rect(g, p.dark, x, y, w, h - 1);
  }

  // torso
  rect(g, p.outline, 4, 8, 12, 8);
  rect(g, p.body, 5, 9, 10, 6);
  rect(g, p.light, 5, 9, 10, 1);
  if (back) {
    rect(g, p.dark, 7, 10, 6, 4);
  } else {
    rect(g, p.accent, 8, 11, 4, 2);
  }

  // arms
  let armL: [number, number, number, number];
  let armR: [number, number, number, number];
  if (up) {
    armL = [5, 0, 2, 9];
    armR = [13, 0, 2, 9];
  } else if (pose === "climb") {
    armL = swing ? [3, 3, 2, 7] : [3, 7, 2, 6];
    armR = swing ? [15, 7, 2, 6] : [15, 3, 2, 7];
  } else if (pose === "fall") {
    armL = [2, 3, 2, 6];
    armR = [16, 3, 2, 6];
  } else if (pose === "run") {
    armL = [3, 9 + (f % 2), 2, 5];
    armR = [15, 9 + ((f + 1) % 2), 2, 5];
  } else {
    armL = [3, 9, 2, 5];
    armR = [15, 9, 2, 5];
  }
  for (const [x, y, w, h] of [armL, armR]) {
    rect(g, p.outline, x - 1, y - 1, w + 2, h + 2);
    rect(g, p.dark, x, y, w, h);
  }

  // head
  rect(g, p.outline, 5, 1, 10, 8);
  rect(g, p.body, 6, 2, 8, 6);
  rect(g, p.light, 6, 2, 8, 1);
  if (back) {
    rect(g, p.dark, 7, 3, 6, 4);
  } else {
    // face looks to the right; sprite is mirrored for left
    rect(g, p.outline, 8, 3, 6, 4);
    rect(g, p.eye, 10, 4, 3, 2);
    if (guard) rect(g, p.eye, 9, 4, 1, 2);
  }
  if (guard) {
    // horned helmet
    rect(g, p.outline, 3, 0, 3, 4);
    rect(g, p.accent, 4, 0, 1, 3);
    rect(g, p.outline, 14, 0, 3, 4);
    rect(g, p.accent, 15, 0, 1, 3);
    rect(g, p.accent, 7, 1, 6, 1);
  } else {
    // antenna
    rect(g, p.outline, 9, 0, 2, 2);
    rect(g, p.accent, 9, 0, 2, 1);
  }
}

function charSprite(
  p: Palette,
  guard: boolean,
  pose: CharPose,
  f: number,
): HTMLCanvasElement {
  const { c, g } = make();
  if (pose === "pit") {
    g.translate(0, 8);
    drawCharacter(g, p, guard, "idle", 0);
  } else {
    drawCharacter(g, p, guard, pose, f);
  }
  return c;
}

// ---- tiles ---------------------------------------------------------------

function groundTile(grass: boolean, seed: number): HTMLCanvasElement {
  const { c, g } = make();
  const r = rng(seed);
  rect(g, "#7b4a24", 0, 0, TILE, TILE);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * TILE);
    const y = Math.floor(r() * TILE);
    rect(g, r() > 0.5 ? "#5e3517" : "#9a6232", x, y, r() > 0.7 ? 2 : 1, 1);
  }
  // pebbles
  for (let i = 0; i < 3; i++) {
    rect(
      g,
      "#b8956a",
      Math.floor(r() * 16) + 2,
      Math.floor(r() * 12) + 6,
      2,
      2,
    );
  }
  rect(g, "#3a210e", 0, TILE - 1, TILE, 1);
  rect(g, "#3a210e", TILE - 1, 0, 1, TILE);
  if (grass) {
    rect(g, "#3f9a2e", 0, 0, TILE, 4);
    for (let x = 0; x < TILE; x++) {
      const h = 3 + Math.floor(r() * 3);
      rect(g, r() > 0.5 ? "#4fae3a" : "#7fd35a", x, 0, 1, h);
    }
    rect(g, "#2d6e20", 0, 4, TILE, 1);
  }
  return c;
}

function stoneTile(): HTMLCanvasElement {
  const { c, g } = make();
  rect(g, "#8a8a99", 0, 0, TILE, TILE);
  rect(g, "#5d5d6b", 0, 9, TILE, 2);
  rect(g, "#5d5d6b", 0, 19, TILE, 1);
  rect(g, "#5d5d6b", 6, 0, 2, 10);
  rect(g, "#5d5d6b", 14, 10, 2, 10);
  rect(g, "#b4b4c4", 0, 0, TILE, 1);
  rect(g, "#b4b4c4", 8, 11, 6, 1);
  rect(g, "#b4b4c4", 0, 11, 14, 1);
  rect(g, "#6e6e7d", 1, 4, 3, 1);
  rect(g, "#6e6e7d", 11, 14, 3, 1);
  rect(g, "#46465a", TILE - 1, 0, 1, TILE);
  return c;
}

function ladderTile(): HTMLCanvasElement {
  const { c, g } = make();
  for (const x of [3, 15]) {
    rect(g, "#6b3f18", x, 0, 3, TILE);
    rect(g, "#b87a3a", x, 0, 1, TILE);
  }
  for (const y of [1, 5, 9, 13, 17]) {
    rect(g, "#6b3f18", 3, y, 15, 3);
    rect(g, "#d9a05b", 6, y, 9, 1);
  }
  return c;
}

function ropeTile(): HTMLCanvasElement {
  const { c, g } = make();
  for (let x = 0; x < TILE; x++) {
    const a = Math.floor(x / 2) % 2 === 0;
    rect(g, a ? "#e0bc72" : "#8c6a2e", x, a ? 2 : 3, 1, 3);
  }
  rect(g, "#5a431c", 0, 5, TILE, 1);
  return c;
}

function zipTile(right: boolean): HTMLCanvasElement {
  const { c, g } = make();
  rect(g, "#6c7a89", 0, 2, TILE, 3);
  rect(g, "#d6dfe8", 0, 2, TILE, 1);
  rect(g, "#3d4854", 0, 5, TILE, 1);
  // direction chevrons
  g.fillStyle = "#ff9a1f";
  for (const x0 of [3, 11]) {
    for (let i = 0; i < 4; i++) {
      const x = right ? x0 + i : x0 + 3 - i;
      g.fillRect(x, 8 + i, 2, 1);
      g.fillRect(x, 16 - i, 2, 1);
    }
  }
  return c;
}

function goldSprite(frame: number): HTMLCanvasElement {
  const { c, g } = make();
  const widths = [12, 9, 4, 9];
  const w = widths[frame % 4];
  const x = Math.floor((TILE - w) / 2);
  rect(g, "#8a5a00", x - 1, 7, w + 2, 10);
  rect(g, "#8a5a00", x, 6, w, 12);
  rect(g, "#ffd23a", x, 7, w, 10);
  rect(g, "#ffef9a", x + 1, 8, Math.max(1, Math.floor(w / 3)), 6);
  if (w > 6) rect(g, "#d49a00", x + w - 3, 12, 2, 4);
  return c;
}

function diamondSprite(frame: number): HTMLCanvasElement {
  const { c, g } = make();
  const row = (y: number, x0: number, x1: number, col: string): void =>
    rect(g, col, x0, y, x1 - x0 + 1, 1);
  // crown
  row(5, 7, 12, "#9ff6ff");
  row(6, 5, 14, "#7ff0ff");
  row(7, 4, 15, "#5adcf5");
  row(8, 3, 16, "#2ab8e0");
  row(9, 3, 16, "#1478a8");
  // pavilion
  row(10, 4, 15, "#2ab8e0");
  row(11, 5, 14, "#2ab8e0");
  row(12, 6, 13, "#1f9cc8");
  row(13, 7, 12, "#1f9cc8");
  row(14, 8, 11, "#1478a8");
  row(15, 9, 10, "#1478a8");
  // facets
  rect(g, "#d8fcff", 6, 6, 2, 2);
  rect(g, "#d8fcff", 9, 6, 2, 1);
  rect(g, "#7ff0ff", 7, 10, 2, 2);
  // outline
  rect(g, "#0b4a68", 2, 8, 1, 2);
  rect(g, "#0b4a68", 17, 8, 1, 2);
  // sparkle moves between frames
  const spots: [number, number][] = [
    [4, 4],
    [15, 5],
    [13, 11],
    [5, 12],
  ];
  const [sx, sy] = spots[frame % 4];
  rect(g, "#ffffff", sx, sy - 1, 1, 3);
  rect(g, "#ffffff", sx - 1, sy, 3, 1);
  return c;
}

function itemSprite(
  kind: "shock" | "decoy" | "emp" | "boots" | "smoke" | "glue" | "bomb",
): HTMLCanvasElement {
  const { c, g } = make();
  if (kind === "shock") {
    for (let x = 2; x < 18; x += 4) {
      rect(g, "#ffd23f", x, 15, 2, 4);
      rect(g, "#222", x + 2, 15, 2, 4);
    }
    rect(g, "#222", 2, 14, 16, 1);
    // spark
    rect(g, "#ffffff", 10, 6, 2, 3);
    rect(g, "#ffe34d", 8, 8, 3, 2);
    rect(g, "#ffffff", 9, 10, 2, 4);
    rect(g, "#ffe34d", 11, 10, 2, 2);
  } else if (kind === "decoy") {
    rect(g, "#2b3550", 4, 16, 12, 3);
    rect(g, "#5a6a90", 5, 16, 10, 1);
    g.globalAlpha = 0.75;
    rect(g, "#5df0ff", 7, 4, 6, 4);
    rect(g, "#5df0ff", 6, 8, 8, 5);
    rect(g, "#aaffff", 8, 5, 4, 2);
    g.globalAlpha = 1;
  } else if (kind === "emp") {
    rect(g, "#3b2060", 6, 16, 8, 3);
    rect(g, "#b05cff", 6, 7, 8, 8);
    rect(g, "#b05cff", 5, 8, 10, 6);
    rect(g, "#e6c2ff", 7, 8, 3, 3);
    rect(g, "#6d2fb0", 5, 13, 10, 1);
  } else if (kind === "smoke") {
    rect(g, "#3d4650", 6, 7, 8, 11);
    rect(g, "#6a7480", 7, 8, 6, 9);
    rect(g, "#9aa7b5", 7, 8, 2, 9);
    rect(g, "#ffd23a", 7, 12, 6, 2);
    rect(g, "#c9d1d9", 9, 4, 2, 4);
    g.globalAlpha = 0.85;
    rect(g, "#dfe4ea", 4, 1, 5, 4);
    rect(g, "#dfe4ea", 9, 0, 6, 4);
    rect(g, "#c4cbd3", 7, 2, 5, 3);
    g.globalAlpha = 1;
  } else if (kind === "glue") {
    rect(g, "#2a6a8a", 4, 7, 12, 12);
    rect(g, "#9fdcff", 5, 8, 10, 10);
    rect(g, "#8bd13a", 5, 12, 10, 6);
    rect(g, "#c8f56a", 6, 13, 3, 2);
    rect(g, "#d4a017", 5, 4, 10, 4);
    rect(g, "#8a6a10", 5, 7, 10, 1);
    rect(g, "#8bd13a", 9, 18, 2, 2);
    rect(g, "#ffffff", 6, 9, 2, 2);
  } else if (kind === "bomb") {
    rect(g, "#0a0a10", 5, 9, 10, 9);
    rect(g, "#1a1a22", 4, 10, 12, 7);
    rect(g, "#1a1a22", 6, 8, 8, 11);
    rect(g, "#5a5a6a", 6, 10, 2, 3);
    rect(g, "#4a4a58", 8, 6, 4, 3);
    rect(g, "#c9a46a", 11, 4, 2, 3);
    rect(g, "#ffd23a", 12, 2, 3, 3);
    rect(g, "#ff7a1a", 13, 3, 1, 1);
  } else {
    rect(g, "#1e7a2c", 3, 16, 12, 3);
    rect(g, "#37c24a", 5, 8, 6, 9);
    rect(g, "#37c24a", 5, 13, 10, 4);
    rect(g, "#7be88a", 5, 8, 2, 8);
    rect(g, "#ffffff", 11, 5, 5, 2);
    rect(g, "#d8e8ff", 12, 7, 4, 2);
  }
  return c;
}

// ---- surface styles -----------------------------------------------------------

type Rand = () => number;
const px1 = (g: Ctx, col: string, x: number, y: number): void =>
  rect(g, col, x, y, 1, 1);

function drawMud(g: Ctx, r: Rand, top: boolean): void {
  rect(g, "#4a3320", 0, 0, TILE, TILE);
  for (let i = 0; i < 44; i++) {
    const x = Math.floor(r() * TILE);
    const y = Math.floor(r() * TILE);
    rect(g, r() > 0.5 ? "#6a4a2c" : "#33220f", x, y, r() > 0.7 ? 3 : 1, 1);
  }
  // wet patches that catch the light
  for (let i = 0; i < 3; i++)
    rect(
      g,
      "#5d6a58",
      2 + Math.floor(r() * 13),
      6 + Math.floor(r() * 11),
      3,
      1,
    );
  rect(g, "#2a1a0c", 0, TILE - 1, TILE, 1);
  if (top) {
    rect(g, "#2f1f10", 0, 0, TILE, 3);
    for (let x = 0; x < TILE; x++)
      if (r() > 0.55) rect(g, "#2f1f10", x, 3, 1, 1 + Math.floor(r() * 3));
    for (let i = 0; i < 4; i++) px1(g, "#8a7a5a", Math.floor(r() * TILE), 1);
  }
}

function drawSand(g: Ctx, r: Rand, top: boolean): void {
  rect(g, "#dcbc72", 0, 0, TILE, TILE);
  for (const y of [5, 10, 15]) {
    const x = Math.floor(r() * 10);
    rect(g, "#c9a458", x, y, 8, 1);
    rect(g, "#efd994", x + 3, y - 1, 6, 1);
  }
  for (let i = 0; i < 30; i++)
    px1(
      g,
      r() > 0.5 ? "#efd994" : "#c4a052",
      Math.floor(r() * TILE),
      Math.floor(r() * TILE),
    );
  rect(g, "#b8924a", 0, TILE - 1, TILE, 1);
  if (top) {
    rect(g, "#f2dc9a", 0, 0, TILE, 3);
    rect(g, "#e6c878", 0, 3, TILE, 1);
    for (let x = 0; x < TILE; x += 5)
      rect(g, "#fff0b8", x + Math.floor(r() * 3), 1, 2, 1);
  }
}

interface TilePalette {
  base: string;
  hi: string;
  lo: string;
  grout: string;
}

const TILE_PALETTES: Record<"tile" | "tileIce" | "tileDark", TilePalette> = {
  tile: { base: "#d9a85a", hi: "#f0c880", lo: "#b88438", grout: "#6a4a22" },
  tileIce: { base: "#bfe6f5", hi: "#effcff", lo: "#8cc4dc", grout: "#5a8aa6" },
  tileDark: { base: "#3e4a4c", hi: "#5e6e70", lo: "#2a3436", grout: "#161e20" },
};

function drawTiles(g: Ctx, r: Rand, top: boolean, p: TilePalette): void {
  rect(g, p.grout, 0, 0, TILE, TILE);
  for (const qy of [0, 10]) {
    for (const qx of [0, 10]) {
      rect(g, p.base, qx + 1, qy + 1, 8, 8);
      rect(g, p.hi, qx + 1, qy + 1, 8, 1);
      rect(g, p.hi, qx + 1, qy + 1, 1, 8);
      rect(g, p.lo, qx + 1, qy + 8, 8, 1);
      rect(g, p.lo, qx + 8, qy + 1, 1, 8);
      if (r() > 0.6)
        px1(
          g,
          p.lo,
          qx + 3 + Math.floor(r() * 4),
          qy + 3 + Math.floor(r() * 4),
        ); // chip
    }
  }
  if (top) rect(g, p.hi, 0, 0, TILE, 1);
}

function drawRedBrick(g: Ctx, r: Rand, top: boolean): void {
  rect(g, "#8a7a68", 0, 0, TILE, TILE);
  const shades = ["#a63e28", "#b84a30", "#9c3824", "#b0442c"];
  for (let row = 0; row < 4; row++) {
    const y = row * 5;
    const off = row % 2 ? 5 : 0;
    for (let x = -10 + off; x < TILE; x += 10) {
      const x0 = Math.max(0, x);
      const x1 = Math.min(TILE, x + 9);
      if (x1 <= x0) continue;
      rect(g, shades[Math.floor(r() * shades.length)], x0, y, x1 - x0, 4);
      rect(g, "#d0634a", x0, y, x1 - x0, 1);
      rect(g, "#7a2a1a", x0, y + 3, x1 - x0, 1);
    }
  }
  if (top) rect(g, "#d8886a", 0, 0, TILE, 1);
}

function drawIron(g: Ctx, r: Rand, top: boolean): void {
  rect(g, "#5c6672", 0, 0, TILE, TILE);
  rect(g, "#3a424c", 0, TILE - 1, TILE, 1);
  rect(g, "#3a424c", TILE - 1, 0, 1, TILE);
  rect(g, "#8a96a4", 0, 0, TILE - 1, 1);
  rect(g, "#8a96a4", 0, 0, 1, TILE - 1);
  rect(g, "#4a525c", 3, 3, TILE - 6, TILE - 6);
  rect(g, "#6a7480", 4, 4, TILE - 8, TILE - 8);
  for (const [x, y] of [
    [1, 1],
    [17, 1],
    [1, 17],
    [17, 17],
  ] as const) {
    rect(g, "#2a3038", x, y + 1, 2, 2);
    rect(g, "#c9d2dc", x, y, 2, 2);
  }
  for (let i = 0; i < 6; i++)
    px1(g, "#8a5a3a", 4 + Math.floor(r() * 12), 4 + Math.floor(r() * 12)); // rust
  if (top) {
    rect(g, "#aab6c4", 0, 0, TILE, 3);
    rect(g, "#dce4ec", 0, 0, TILE, 1);
  }
}

const CIRCUIT_ACCENT: Record<
  "circuit" | "circuitGreen" | "circuitViolet",
  string
> = {
  circuit: "#2af0ff",
  circuitGreen: "#2aff7a",
  circuitViolet: "#b05cff",
};

function drawCircuit(g: Ctx, r: Rand, top: boolean, accent: string): void {
  rect(g, "#1a222c", 0, 0, TILE, TILE);
  rect(g, "#0e141c", 0, TILE - 1, TILE, 1);
  rect(g, "#0e141c", TILE - 1, 0, 1, TILE);
  rect(g, "#2a3644", 0, 0, TILE - 1, 1);
  // a couple of glowing traces with solder nodes
  const trace = (pts: [number, number][]): void => {
    g.globalAlpha = 0.28;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      rect(
        g,
        accent,
        Math.min(x0, x1) - 1,
        Math.min(y0, y1) - 1,
        Math.abs(x1 - x0) + 3,
        Math.abs(y1 - y0) + 3,
      );
    }
    g.globalAlpha = 1;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      rect(
        g,
        accent,
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.abs(x1 - x0) + 1,
        Math.abs(y1 - y0) + 1,
      );
    }
    const [lx, ly] = pts[pts.length - 1];
    rect(g, "#ffffff", lx - 1, ly - 1, 3, 3);
  };
  const a = 3 + Math.floor(r() * 4);
  const b = 10 + Math.floor(r() * 6);
  trace([
    [1, a],
    [9, a],
    [9, b],
    [18, b],
  ]);
  trace([
    [3, 18],
    [3, b - 3],
    [6, b - 3],
  ]);
  if (top) {
    rect(g, accent, 0, 0, TILE, 2);
    rect(g, "#ffffff", 0, 0, TILE, 1);
  }
}

/** Heavy plating for undiggable tech floors: dark steel with hazard stripes. */
function armorTile(): HTMLCanvasElement {
  const { c, g } = make();
  rect(g, "#2a3038", 0, 0, TILE, TILE);
  rect(g, "#161a20", 0, 0, TILE, 1);
  rect(g, "#161a20", 0, 0, 1, TILE);
  rect(g, "#3a424c", 1, 1, TILE - 2, 1);
  rect(g, "#3a424c", 1, 1, 1, TILE - 2);
  rect(g, "#161a20", 0, TILE - 1, TILE, 1);
  rect(g, "#161a20", TILE - 1, 0, 1, TILE);
  rect(g, "#1c2026", 4, 4, TILE - 8, 7);
  rect(g, "#4a525c", 5, 5, TILE - 10, 1);
  for (const [x, y] of [
    [3, 3],
    [15, 3],
  ] as const)
    rect(g, "#9aa7b5", x, y, 2, 2);
  for (let row = 0; row < 5; row++) {
    for (let x = 0; x < TILE; x++) {
      const yellow = (x + row) % 8 < 4;
      rect(g, yellow ? "#ffd23a" : "#14161a", x, 14 + row, 1, 1);
    }
  }
  return c;
}

function surfaceTile(
  style: GroundStyle,
  top: boolean,
  seed: number,
): HTMLCanvasElement {
  if (style === "earth") return groundTile(top, seed);
  const { c, g } = make();
  const r = rng(seed);
  switch (style) {
    case "mud":
      drawMud(g, r, top);
      break;
    case "sand":
      drawSand(g, r, top);
      break;
    case "tile":
    case "tileIce":
    case "tileDark":
      drawTiles(g, r, top, TILE_PALETTES[style]);
      break;
    case "redbrick":
      drawRedBrick(g, r, top);
      break;
    case "iron":
      drawIron(g, r, top);
      break;
    case "circuit":
    case "circuitGreen":
    case "circuitViolet":
      drawCircuit(g, r, top, CIRCUIT_ACCENT[style]);
      break;
  }
  return c;
}

export function buildSprites(): Map<string, HTMLCanvasElement> {
  const m = new Map<string, HTMLCanvasElement>();
  const poses: [CharPose, number][] = [
    ["idle", 1],
    ["run", 4],
    ["climb", 2],
    ["hang", 2],
    ["fall", 1],
    ["zip", 2],
    ["pit", 1],
  ];
  for (const [name, p, guard] of [
    ["hero", HERO, false],
    ["herogold", GOLDEN, false],
    ["guard", GUARD, true],
  ] as const) {
    for (const [pose, n] of poses) {
      for (let f = 0; f < n; f++)
        m.set(`${name}.${pose}.${f}`, charSprite(p, guard, pose, f));
    }
  }
  m.set("tile.groundTop", groundTile(true, 11)); // legacy earth keys, used by the title and vault scenes
  m.set("tile.groundMid", groundTile(false, 23));
  GROUND_STYLES.forEach((style, i) => {
    m.set(spriteKeyGround(style, true), surfaceTile(style, true, 11 + i * 7));
    m.set(spriteKeyGround(style, false), surfaceTile(style, false, 23 + i * 7));
  });
  m.set(spriteKeyStone("stone"), stoneTile());
  m.set(spriteKeyStone("armor"), armorTile());
  m.set("tile.ladder", ladderTile());
  m.set("tile.rope", ropeTile());
  m.set("tile.zipR", zipTile(true));
  m.set("tile.zipL", zipTile(false));
  for (let f = 0; f < 4; f++) m.set(`gold.${f}`, goldSprite(f));
  for (let f = 0; f < 4; f++) m.set(`diamond.${f}`, diamondSprite(f));
  for (const k of [
    "shock",
    "decoy",
    "emp",
    "boots",
    "smoke",
    "glue",
    "bomb",
  ] as const)
    m.set(`item.${k}`, itemSprite(k));
  return m;
}
