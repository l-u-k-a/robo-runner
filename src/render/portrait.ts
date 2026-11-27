import { rng } from "./sprites";

type Ctx = CanvasRenderingContext2D;

export const PORTRAIT_W = 64;
export const PORTRAIT_H = 48;

const px = (g: Ctx, col: string, x: number, y: number): void => {
  g.fillStyle = col;
  g.fillRect(x, y, 1, 1);
};

const rect = (g: Ctx, col: string, x: number, y: number, w: number, h: number): void => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

/** Pixel ellipse (no anti-aliasing). */
function ell(g: Ctx, col: string, cx: number, cy: number, rx: number, ry: number): void {
  g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}

function ellOutlined(g: Ctx, col: string, outline: string, cx: number, cy: number, rx: number, ry: number): void {
  ell(g, outline, cx, cy, rx + 1, ry + 1);
  ell(g, col, cx, cy, rx, ry);
}

/** Thick pixel line. */
function line(g: Ctx, col: string, x0: number, y0: number, x1: number, y1: number, th: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  g.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    g.fillRect(Math.round(x - th / 2), Math.round(y - th / 2), th, th);
  }
}

/**
 * A pixel-art portrait for the credits, in the same chunky style as the rest of the game: a smiling
 * woman with long dark hair and a light tee, her hand on the cheek of a smiling bald, bearded man in
 * a dark jacket, in front of a wooden panel and a slate wall. Drawn in code, 64x48 pixels.
 */
export function buildPortrait(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PORTRAIT_W;
  c.height = PORTRAIT_H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const r = rng(7);

  const OUT = "#0b0e16";
  const SKIN_M = "#ecbf92";
  const SKIN_M_SH = "#d9a678";
  const SKIN_W = "#f2c8a2";
  const SKIN_W_SH = "#d9a47c";
  const HAIR_W = "#2a1c26";
  const HAIR_OUT = "#120b12";

  // ---- backdrop: slate wall on the right, wooden panel on the left ---------------------
  rect(g, "#59647a", 0, 0, PORTRAIT_W, PORTRAIT_H);
  rect(g, "#667188", 50, 0, 14, PORTRAIT_H);
  ell(g, "#434c5e", 54, 30, 9, 24); // the man's shadow on the wall
  rect(g, "#b98a58", 0, 0, 30, PORTRAIT_H);
  for (let x = 1; x < 30; x += 2) {
    const y0 = Math.floor(r() * PORTRAIT_H);
    const len = 8 + Math.floor(r() * 24);
    rect(g, r() > 0.5 ? "#a97a4a" : "#c99a68", x, y0, 1, len);
  }
  rect(g, "#3a2a1c", 30, 0, 1, PORTRAIT_H);
  rect(g, "#d8b27a", 0, 0, 30, 1);

  // ---- the man: ear, jacket, tee, neck, head -------------------------------------------
  ellOutlined(g, SKIN_M_SH, OUT, 49, 18, 2, 3);

  rect(g, OUT, 29, 27, 33, 1);
  for (let y = 28; y < PORTRAIT_H; y++) {
    const xl = Math.round(29 - (y - 29) * 0.17);
    const xr = Math.round(61 + (y - 29) * 0.17);
    rect(g, OUT, xl - 1, y, xr - xl + 3, 1);
  }
  for (let y = 28; y < PORTRAIT_H; y++) {
    const xl = Math.round(29 - (y - 29) * 0.17);
    const xr = Math.round(61 + (y - 29) * 0.17);
    rect(g, "#1d2538", xl, y, xr - xl + 1, 1);
    rect(g, "#33405c", xl, y, 2, 1); // lit shoulder
    if (y % 6 === 0) rect(g, "#2a3550", xl + 4, y, 6, 1); // fabric folds
  }
  rect(g, SKIN_M_SH, 36, 26, 7, 4); // neck
  for (let y = 30; y <= 41; y++) {
    const half = Math.max(0, 4 - Math.floor((y - 30) * 0.34));
    rect(g, "#f2eee0", 39 - half, y, half * 2 + 1, 1); // white tee in the open jacket
    px(g, "#cfc8b4", 39 - half, y);
    px(g, "#0e1420", 38 - half, y);
    px(g, "#0e1420", 40 + half, y);
  }

  ellOutlined(g, SKIN_M, OUT, 39, 17, 9, 10);
  ell(g, "#f8d8b4", 35, 10, 3, 1); // shine on the bald head
  // beard
  for (let y = 19; y <= 28; y++) {
    const half = Math.round(8 - (y - 19) * 0.5);
    for (let x = 39 - half; x <= 39 + half; x++) {
      const dx = (x + 0.5 - 39) / 9;
      const dy = (y + 0.5 - 17) / 10;
      if (dx * dx + dy * dy <= 1.05) px(g, "#3b2a22", x, y);
    }
  }
  rect(g, "#2a1c18", 34, 20, 11, 1); // moustache
  rect(g, "#7a3a32", 35, 21, 9, 1);
  rect(g, "#ffffff", 36, 22, 7, 2); // big smile
  px(g, "#d8d0c0", 39, 22);
  px(g, "#d8d0c0", 39, 23);
  rect(g, "#7a3a32", 37, 24, 5, 1);
  // eyes (squinting from laughing), brows, nose, cheeks
  rect(g, "#1a1218", 35, 14, 3, 1);
  rect(g, "#1a1218", 41, 14, 3, 1);
  px(g, "#c88c64", 34, 15);
  px(g, "#c88c64", 44, 15);
  rect(g, "#3b2a22", 34, 12, 4, 1);
  rect(g, "#3b2a22", 41, 12, 4, 1);
  px(g, "#c88c64", 39, 16);
  px(g, "#c88c64", 39, 17);
  px(g, "#b87c58", 40, 18);
  px(g, "#e0a080", 34, 18);
  px(g, "#e0a080", 44, 18);

  // ---- the woman: long hair behind, tee, head, hair in front ------------------------
  ellOutlined(g, HAIR_W, HAIR_OUT, 23, 21, 10, 13);
  rect(g, HAIR_OUT, 12, 26, 24, 14);
  rect(g, HAIR_W, 13, 26, 22, 13);
  for (let i = 0; i < 7; i++) rect(g, "#4a3444", 14 + i * 3, 24 + (i % 3) * 3, 1, 7);

  for (let y = 31; y < PORTRAIT_H; y++) {
    const xl = Math.round(12 - (y - 31) * 0.3);
    const xr = Math.round(34 + (y - 31) * 0.3);
    rect(g, "#2a2a30", xl - 1, y, xr - xl + 3, 1);
  }
  rect(g, "#2a2a30", 12, 30, 23, 1);
  for (let y = 31; y < PORTRAIT_H; y++) {
    const xl = Math.round(12 - (y - 31) * 0.3);
    const xr = Math.round(34 + (y - 31) * 0.3);
    rect(g, "#f1ecdc", xl, y, xr - xl + 1, 1);
    rect(g, "#cdc6b2", xr - 3, y, 4, 1); // shaded side
    if (y % 5 === 0) rect(g, "#dcd5c2", xl + 3, y, 8, 1); // cloth folds
  }
  rect(g, SKIN_W_SH, 21, 26, 5, 6); // neck
  ell(g, "#e8e2d0", 23, 32, 3, 1); // round neckline

  // hair falling over her shoulders
  rect(g, HAIR_OUT, 13, 29, 6, 12);
  rect(g, HAIR_W, 14, 29, 4, 11);
  rect(g, HAIR_OUT, 28, 29, 4, 9);
  rect(g, HAIR_W, 29, 29, 2, 8);

  ellOutlined(g, SKIN_W, HAIR_OUT, 23, 19, 6, 8);
  for (let y = 10; y <= 26; y++) {
    for (let x = 16; x <= 30; x++) {
      const dx = (x + 0.5 - 23) / 6;
      const dy = (y + 0.5 - 19) / 8;
      if (dx * dx + dy * dy > 1) continue;
      const cap = y <= 13;
      const framing = Math.abs(x + 0.5 - 23) >= 4.6 && y <= 23;
      if (cap || framing) px(g, HAIR_W, x, y);
    }
  }
  px(g, "#4a3444", 22, 11);
  px(g, "#4a3444", 21, 12);
  // eyes, brows, nose, big smile
  rect(g, "#ffffff", 20, 16, 3, 2);
  rect(g, "#ffffff", 25, 16, 3, 2);
  rect(g, "#1a1218", 21, 16, 1, 2);
  rect(g, "#1a1218", 26, 16, 1, 2);
  rect(g, HAIR_W, 19, 14, 4, 1);
  rect(g, HAIR_W, 25, 14, 4, 1);
  px(g, SKIN_W_SH, 23, 18);
  px(g, SKIN_W_SH, 23, 19);
  px(g, "#e8a090", 19, 20);
  px(g, "#e8a090", 28, 20);
  rect(g, "#b8504c", 20, 21, 8, 1);
  rect(g, "#ffffff", 21, 22, 6, 2);
  px(g, "#d8d0c0", 24, 22);
  px(g, "#d8d0c0", 24, 23);
  rect(g, "#b8504c", 22, 24, 4, 1);

  // ---- her arm: short sleeve, forearm, hand on his cheek --------------------------------
  ellOutlined(g, "#f1ecdc", "#2a2a30", 31, 35, 4, 3);
  line(g, HAIR_OUT, 30, 36, 34, 27, 5);
  line(g, SKIN_W, 30, 36, 34, 27, 3);
  ellOutlined(g, SKIN_W, HAIR_OUT, 35, 25, 3, 3);
  px(g, SKIN_W_SH, 34, 23);
  px(g, SKIN_W_SH, 36, 23);
  px(g, SKIN_W_SH, 37, 25);
  px(g, "#ffd23a", 33, 28); // ring

  // little sparkles, like the gold coins
  for (const [x, y] of [[5, 6], [58, 8], [8, 40], [57, 42]] as const) {
    px(g, "#ffffff", x, y);
    px(g, "#fff3b0", x - 1, y);
    px(g, "#fff3b0", x + 1, y);
    px(g, "#fff3b0", x, y - 1);
    px(g, "#fff3b0", x, y + 1);
  }
  return c;
}
