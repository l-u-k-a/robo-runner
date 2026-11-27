import { ROWS, TILE, VIEW_W } from "../game/config";
import type { Theme } from "../game/types";
import { rng } from "./sprites";

type Ctx = CanvasRenderingContext2D;
const W = VIEW_W;
const H = ROWS * TILE;

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

function lerpColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Banded (retro) vertical gradient. */
function sky(g: Ctx, top: string, bottom: string): void {
  const band = 8;
  for (let y = 0; y < H; y += band)
    rect(g, lerpColor(top, bottom, y / H), 0, y, W, band);
}

function silhouette(
  g: Ctx,
  col: string,
  base: number,
  amp: number,
  period: number,
  seed: number,
): void {
  const r = rng(seed);
  const phase = r() * 6;
  for (let x = 0; x < W; x += 4) {
    const h = amp * (0.6 + 0.4 * Math.sin(x / period + phase)) + r() * 3;
    rect(g, col, x, base - h, 4, H);
  }
}

function column(
  g: Ctx,
  x: number,
  y: number,
  h: number,
  w: number,
  col: string,
  hi: string,
): void {
  rect(g, col, x, y, w, h);
  rect(g, hi, x, y, 2, h);
  rect(g, col, x - 3, y, w + 6, 5);
  rect(g, hi, x - 3, y, w + 6, 1);
  rect(g, col, x - 3, y + h - 5, w + 6, 5);
}

function bricks(
  g: Ctx,
  col: string,
  line: string,
  y0: number,
  y1: number,
): void {
  rect(g, col, 0, y0, W, y1 - y0);
  for (let y = y0; y < y1; y += 10) {
    rect(g, line, 0, y, W, 1);
    const off = ((y - y0) / 10) % 2 === 0 ? 0 : 10;
    for (let x = off; x < W; x += 20) rect(g, line, x, y, 1, 10);
  }
}

function torch(g: Ctx, x: number, y: number, t: number): void {
  rect(g, "#4a3220", x, y + 6, 3, 9);
  rect(g, "#ff9a1f", x - 1, y + 1 + t, 5, 6);
  rect(g, "#ffe066", x, y + 3 + t, 3, 3);
  g.globalAlpha = 0.12;
  rect(g, "#ffb347", x - 14, y - 12, 31, 31);
  g.globalAlpha = 1;
}

function temple(g: Ctx): void {
  sky(g, "#f2a65a", "#7d3b2a");
  rect(g, "#ffe3a3", 220, 36, 40, 40);
  rect(g, "#fff4cf", 226, 42, 28, 28);
  silhouette(g, "#a8552f", 200, 40, 40, 3);
  // stepped pyramid
  for (let i = 0; i < 9; i++)
    rect(g, "#7a3a22", 340 - i * 22, 120 + i * 14, 44 + i * 44, 14);
  silhouette(g, "#5a2a1a", 300, 30, 30, 7);
  for (let x = 20; x < W; x += 90)
    column(g, x, 40, 280, 14, "#8a4a2a", "#b36a40");
  const r = rng(5);
  for (let i = 0; i < 60; i++)
    rect(g, "#5a2a1a", Math.floor(r() * W), 60 + Math.floor(r() * 240), 4, 1);
}

function ruins(g: Ctx): void {
  sky(g, "#8fc3e8", "#f0dcb0");
  rect(g, "#fff8e0", 60, 30, 28, 28);
  silhouette(g, "#d9b97a", 210, 50, 60, 9);
  silhouette(g, "#b8935a", 260, 36, 35, 4);
  // broken columns and scaffolding
  for (const [x, h] of [
    [60, 120],
    [150, 70],
    [250, 150],
    [420, 90],
    [500, 140],
  ] as const) {
    column(g, x, 310 - h, h, 16, "#c9b38a", "#e8d9b0");
  }
  for (let x = 330; x < 420; x += 30) rect(g, "#6b4a26", x, 150, 3, 170);
  rect(g, "#6b4a26", 330, 170, 93, 3);
  rect(g, "#6b4a26", 330, 230, 93, 3);
  // tents
  for (const x of [470, 40]) {
    for (let i = 0; i < 14; i++)
      rect(g, "#e8dcc0", x - i, 292 - i * 2, i * 2 + 20, 2);
  }
}

function fortress(g: Ctx): void {
  sky(g, "#12102a", "#3a2a5a");
  const r = rng(13);
  for (let i = 0; i < 70; i++)
    rect(g, "#fff", Math.floor(r() * W), Math.floor(r() * 120), 1, 1);
  rect(g, "#dfe6ff", 480, 30, 22, 22);
  rect(g, "#12102a", 488, 28, 20, 20);
  silhouette(g, "#1a1636", 220, 40, 50, 21);
  bricks(g, "#2c2748", "#1e1a36", 90, H);
  for (let x = 0; x < W; x += 28) rect(g, "#2c2748", x, 76, 16, 16);
  for (let x = 60; x < W; x += 120) {
    torch(g, x, 130, 0);
    rect(g, "#7a1f17", x + 40, 100, 18, 50);
    rect(g, "#d4a017", x + 44, 112, 10, 10);
    rect(g, "#7a1f17", x + 40, 150, 6, 8);
    rect(g, "#7a1f17", x + 52, 150, 6, 8);
  }
}

function crypt(g: Ctx): void {
  sky(g, "#07191c", "#12353a");
  bricks(g, "#14292d", "#0b1b1e", 0, H);
  for (let x = 40; x < W; x += 110) {
    // arches
    rect(g, "#0b1b1e", x, 70, 40, 250);
    for (let i = 0; i < 10; i++)
      rect(g, "#0b1b1e", x + i, 60 + i * 0 + (9 - i), 40 - i * 2, 4);
    rect(g, "#1b4a50", x + 4, 90, 32, 1);
  }
  const r = rng(8);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(r() * W);
    rect(g, "#4a6a70", x, 0, 1, 40 + Math.floor(r() * 80));
  }
  g.globalAlpha = 0.18;
  rect(g, "#43ffb0", 0, H - 90, W, 90);
  g.globalAlpha = 1;
  for (let x = 80; x < W; x += 150) torch(g, x, 180, 1);
}

function sanctum(g: Ctx): void {
  sky(g, "#1a0b3a", "#5a1f6a");
  const r = rng(77);
  for (let i = 0; i < 50; i++)
    rect(g, "#e8b8ff", Math.floor(r() * W), Math.floor(r() * H), 1, 1);
  // gears
  const gear = (cx: number, cy: number, rad: number, col: string): void => {
    g.fillStyle = col;
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      g.fillRect(
        Math.round(cx + Math.cos(ang) * rad) - 3,
        Math.round(cy + Math.sin(ang) * rad) - 3,
        7,
        7,
      );
    }
    g.beginPath();
    g.arc(cx, cy, rad - 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1a0b3a";
    g.beginPath();
    g.arc(cx, cy, rad / 2.5, 0, Math.PI * 2);
    g.fill();
  };
  gear(100, 120, 60, "#3a1a5a");
  gear(210, 200, 36, "#4a2470");
  gear(430, 110, 70, "#3a1a5a");
  gear(520, 230, 40, "#4a2470");
  gear(330, 270, 30, "#5a2a80");
  for (let x = 30; x < W; x += 70)
    rect(g, "#b05cff", x, 300 - (x % 3) * 8, 2, 6);
  g.globalAlpha = 0.15;
  rect(g, "#e0a0ff", 0, H - 100, W, 100);
  g.globalAlpha = 1;
}

/** Pixel triangle pointing up (apex at top) or down. */
function tri(
  g: Ctx,
  col: string,
  cx: number,
  y0: number,
  h: number,
  halfW: number,
  down = false,
): void {
  g.fillStyle = col;
  for (let i = 0; i < h; i += 2) {
    const k = down ? h - i : i;
    const w = Math.max(1, Math.round((halfW * k) / h));
    g.fillRect(cx - w, y0 + i, w * 2, 2);
  }
}

function disc(g: Ctx, col: string, cx: number, cy: number, r: number): void {
  g.fillStyle = col;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

function jungle(g: Ctx): void {
  sky(g, "#3d8a5a", "#0c2a1c");
  // light shafts
  g.globalAlpha = 0.09;
  for (const x of [80, 200, 330, 470]) {
    g.fillStyle = "#e8ffb0";
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 30, 0);
    g.lineTo(x + 90, H);
    g.lineTo(x + 20, H);
    g.fill();
  }
  g.globalAlpha = 1;
  silhouette(g, "#1c5a36", 230, 40, 25, 31);
  // waterfall
  rect(g, "#9fe0e8", 410, 60, 26, 260);
  const r = rng(14);
  for (let i = 0; i < 30; i++)
    rect(
      g,
      "#fff",
      411 + Math.floor(r() * 24),
      60 + Math.floor(r() * 250),
      1,
      8,
    );
  rect(g, "#d8fbff", 400, 300, 46, 20);
  // trunks, canopy, vines
  for (const x of [30, 150, 290, 520]) {
    rect(g, "#4a3220", x, 0, 22, H);
    rect(g, "#6a4a2e", x, 0, 4, H);
    disc(g, "#1f6b3a", x + 11, 30, 46);
    disc(g, "#2a8a48", x + 30, 10, 30);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * W);
    const len = 40 + Math.floor(r() * 120);
    rect(g, "#2f8a3a", x, 0, 2, len);
    for (let y = 10; y < len; y += 14) rect(g, "#5fd060", x + 2, y, 4, 2);
  }
  silhouette(g, "#0e3a22", 330, 30, 18, 3);
}

function ice(g: Ctx): void {
  sky(g, "#071533", "#3a7aa8");
  const r = rng(22);
  for (let i = 0; i < 60; i++)
    rect(g, "#fff", Math.floor(r() * W), Math.floor(r() * 150), 1, 1);
  // aurora
  g.globalAlpha = 0.28;
  for (let x = 0; x < W; x += 4) {
    const y = 50 + Math.sin(x / 40) * 22;
    rect(g, "#5dffb0", x, y, 4, 70);
    rect(g, "#b05cff", x, y + 30 + Math.sin(x / 25) * 10, 4, 40);
  }
  g.globalAlpha = 1;
  silhouette(g, "#bcd8ee", 240, 50, 55, 3);
  silhouette(g, "#7aa4c8", 290, 34, 38, 8);
  // crystals
  for (const [x, h] of [
    [70, 110],
    [190, 80],
    [360, 130],
    [480, 90],
    [550, 120],
  ] as const) {
    tri(g, "#9fe8ff", x, 320 - h, h, 14);
    tri(g, "#e8fdff", x - 4, 320 - h + 10, h - 10, 4);
  }
  // icicles
  for (let x = 6; x < W; x += 22)
    tri(g, "#cfeaff", x, 0, 20 + ((x * 7) % 30), 6, true);
}

function volcano(g: Ctx): void {
  sky(g, "#1c0606", "#9a3008");
  const r = rng(9);
  // volcano cone
  for (let i = 0; i < 20; i++)
    rect(g, "#2a0d0a", 190 + i * 7, 90 + i * 11, 220 - i * 14, 11);
  rect(g, "#ff7a1a", 296, 86, 28, 8);
  rect(g, "#ffd23a", 304, 84, 12, 5);
  g.globalAlpha = 0.25;
  rect(g, "#ff6a00", 270, 20, 80, 70);
  g.globalAlpha = 1;
  silhouette(g, "#1a0808", 290, 40, 30, 5);
  // chains and anvils
  for (const x of [50, 160, 470, 560]) {
    for (let y = 0; y < 150; y += 8)
      rect(g, "#5a5a66", x + (y % 16 === 0 ? 0 : 2), y, 4, 6);
    rect(g, "#3a3a46", x - 8, 150, 20, 8);
    rect(g, "#5a5a66", x - 4, 158, 12, 6);
  }
  // lava river and embers
  for (let y = 290; y < H; y += 6)
    rect(g, y % 12 === 2 ? "#ffb02a" : "#ff5a0a", 0, y, W, 6);
  for (let i = 0; i < 40; i++)
    rect(g, "#ffb02a", Math.floor(r() * W), Math.floor(r() * 280), 2, 2);
}

function atlantis(g: Ctx): void {
  sky(g, "#06527a", "#021c2e");
  g.globalAlpha = 0.1;
  for (const x of [60, 220, 380, 500]) {
    g.fillStyle = "#c8f6ff";
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 40, 0);
    g.lineTo(x - 30, H);
    g.lineTo(x - 90, H);
    g.fill();
  }
  g.globalAlpha = 1;
  silhouette(g, "#073a52", 270, 30, 40, 11);
  for (const [x, h] of [
    [40, 140],
    [180, 90],
    [300, 170],
    [450, 110],
    [540, 150],
  ] as const) {
    column(g, x, 320 - h, h, 16, "#1f6a82", "#46a0b8");
  }
  // arch
  rect(g, "#1f6a82", 220, 150, 70, 8);
  const r = rng(31);
  // seaweed
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * W);
    const h = 30 + Math.floor(r() * 60);
    for (let y = 0; y < h; y += 4)
      rect(
        g,
        "#2f9a5a",
        x + Math.round(Math.sin(y / 8 + i) * 3),
        320 - y,
        3,
        4,
      );
  }
  // bubbles + fish
  g.strokeStyle = "#bff3ff";
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.arc(
      Math.floor(r() * W),
      Math.floor(r() * H),
      1 + Math.floor(r() * 3),
      0,
      Math.PI * 2,
    );
    g.stroke();
  }
  for (const [x, y] of [
    [90, 90],
    [350, 60],
    [470, 200],
  ] as const) {
    rect(g, "#ffb02a", x, y, 10, 4);
    rect(g, "#ffb02a", x - 4, y - 2, 4, 8);
  }
}

function desert(g: Ctx): void {
  sky(g, "#07072a", "#6a2e4a");
  const r = rng(45);
  for (let i = 0; i < 90; i++)
    rect(g, "#fff", Math.floor(r() * W), Math.floor(r() * 170), 1, 1);
  disc(g, "#fff3c0", 90, 60, 22);
  disc(g, "#07072a", 100, 54, 20);
  silhouette(g, "#7a3a50", 230, 36, 55, 17);
  // pyramids
  tri(g, "#4a2038", 400, 140, 130, 120);
  tri(g, "#5a2a44", 520, 190, 90, 80);
  // sphinx
  rect(g, "#2f1428", 160, 262, 120, 30);
  rect(g, "#2f1428", 236, 238, 32, 30);
  rect(g, "#2f1428", 230, 230, 14, 14);
  rect(g, "#3a1a32", 226, 236, 8, 3);
  silhouette(g, "#3a1a32", 300, 30, 40, 22);
  silhouette(g, "#240f1e", 330, 22, 30, 5);
}

function cyber(g: Ctx): void {
  sky(g, "#04010c", "#1f0650");
  const r = rng(61);
  // skyline
  for (let x = 0; x < W; x += 28) {
    const h = 60 + Math.floor(r() * 130);
    rect(g, "#120a30", x, 230 - h, 26, h + 90);
    for (let y = 230 - h + 6; y < 300; y += 10) {
      for (let wx = x + 3; wx < x + 22; wx += 6) {
        if (r() > 0.55) rect(g, r() > 0.5 ? "#ff2ad4" : "#2af0ff", wx, y, 3, 4);
      }
    }
  }
  // neon signs
  rect(g, "#ff2ad4", 70, 40, 90, 3);
  rect(g, "#ff2ad4", 70, 70, 90, 3);
  rect(g, "#ff2ad4", 70, 40, 3, 33);
  rect(g, "#ff2ad4", 157, 40, 3, 33);
  rect(g, "#2af0ff", 400, 60, 70, 3);
  rect(g, "#2af0ff", 400, 60, 3, 40);
  // perspective grid floor
  g.strokeStyle = "#7a2aff";
  g.globalAlpha = 0.6;
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * 12, 250);
    g.lineTo(W / 2 + i * 70, H);
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const y = 250 + i * i * 3 + i * 4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  // circuit traces
  for (let i = 0; i < 6; i++) {
    const y = 20 + i * 10;
    rect(g, "#2af0ff", 300 + i * 20, y, 80, 1);
    rect(g, "#2af0ff", 380 + i * 20, y, 1, 14);
    rect(g, "#fff", 380 + i * 20 - 1, y + 13, 3, 3);
  }
}

function mansion(g: Ctx): void {
  sky(g, "#0a0814", "#261a3a");
  rect(g, "#1c1430", 0, 0, W, H);
  for (let x = 0; x < W; x += 20) rect(g, "#241a3c", x, 0, 8, H); // wallpaper stripes
  disc(g, "#e8e8ff", 470, 80, 30);
  disc(g, "#241a3c", 482, 72, 26);
  // arched windows
  for (const x of [50, 190, 330]) {
    rect(g, "#0a0814", x, 60, 56, 150);
    disc(g, "#0a0814", x + 28, 60, 28);
    g.globalAlpha = 0.45;
    rect(g, "#9ab0ff", x + 4, 64, 22, 142);
    rect(g, "#9ab0ff", x + 30, 64, 22, 142);
    disc(g, "#9ab0ff", x + 28, 60, 24);
    g.globalAlpha = 1;
    rect(g, "#0a0814", x + 26, 36, 4, 170);
    rect(g, "#0a0814", x, 120, 56, 4);
  }
  // cobwebs
  g.strokeStyle = "#8a86a8";
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(60 - i * 10, i * 18 + 10);
    g.stroke();
    g.beginPath();
    g.moveTo(W, 0);
    g.lineTo(W - 60 + i * 10, i * 18 + 10);
    g.stroke();
  }
  // floating candles
  const r = rng(71);
  for (let i = 0; i < 8; i++) {
    const x = 20 + Math.floor(r() * (W - 40));
    const y = 120 + Math.floor(r() * 160);
    rect(g, "#e8e0c0", x, y, 3, 8);
    rect(g, "#ffb02a", x, y - 3, 3, 3);
    g.globalAlpha = 0.14;
    disc(g, "#ffb02a", x + 1, y, 14);
    g.globalAlpha = 1;
  }
}

function skyCitadel(g: Ctx): void {
  sky(g, "#3a9ae8", "#d8f0ff");
  disc(g, "#fffbd0", 500, 60, 26);
  const r = rng(88);
  // clouds
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(r() * W);
    const y = 30 + Math.floor(r() * 240);
    g.globalAlpha = 0.85;
    rect(g, "#fff", x, y, 60, 10);
    rect(g, "#fff", x + 10, y - 6, 34, 8);
    rect(g, "#fff", x + 20, y - 10, 20, 6);
    g.globalAlpha = 1;
  }
  // floating islands
  for (const [x, y, w] of [
    [70, 150, 90],
    [260, 90, 70],
    [440, 190, 110],
  ] as const) {
    tri(g, "#7a5a3a", x + w / 2, y + 6, 40, w / 2, true);
    rect(g, "#4aa83a", x, y, w, 8);
    rect(g, "#7fd35a", x, y, w, 2);
    rect(g, "#e8dcc0", x + w / 2 - 8, y - 26, 16, 26); // little tower
    rect(g, "#d4a017", x + w / 2 - 10, y - 30, 20, 4);
  }
  // wind turbines
  for (const x of [190, 360, 560]) {
    rect(g, "#e8eef5", x, 180, 3, 140);
    rect(g, "#e8eef5", x - 22, 178, 46, 3);
    rect(g, "#e8eef5", x, 156, 3, 46);
    rect(g, "#9aa7b5", x - 1, 177, 5, 5);
  }
  silhouette(g, "#a8d0ec", 320, 20, 40, 4);
}

function matrix(g: Ctx): void {
  sky(g, "#010a04", "#06301a");
  const r = rng(101);
  // Distant, dim rain first, then brighter columns in front.
  const glyph = (x: number, y: number, col: string): void => {
    g.fillStyle = col;
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (r() > 0.58) g.fillRect(x + gx, y + gy, 1, 1);
      }
    }
  };
  for (let layer = 0; layer < 2; layer++) {
    const step = layer === 0 ? 7 : 12;
    const shades =
      layer === 0
        ? ["#0b3a1c", "#0f5a28", "#14803a"]
        : ["#0f6a2c", "#1fae4a", "#4aff80"];
    for (let x = 2; x < W; x += step) {
      const trail = 6 + Math.floor(r() * 16);
      const head = 20 + Math.floor(r() * (H - 20));
      for (let i = 0; i < trail; i++) {
        const y = head - i * 11;
        if (y < -8) break;
        const fade = i / trail;
        glyph(
          x,
          y,
          i === 0 ? "#d8ffe0" : shades[fade < 0.35 ? 2 : fade < 0.7 ? 1 : 0],
        );
      }
    }
  }
  // Big faint glyphs and a glowing horizon.
  g.globalAlpha = 0.12;
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "#4aff80";
    for (let gy = 0; gy < 9; gy++)
      for (let gx = 0; gx < 6; gx++)
        if (r() > 0.5)
          g.fillRect(40 + i * 110 + gx * 6, 60 + gy * 6 + (i % 2) * 90, 5, 5);
  }
  g.globalAlpha = 0.22;
  rect(g, "#2aff7a", 0, H - 50, W, 50);
  g.globalAlpha = 1;
  // CRT scanlines
  g.globalAlpha = 0.16;
  for (let y = 0; y < H; y += 4) rect(g, "#000", 0, y, W, 1);
  g.globalAlpha = 1;
}

const DRAW: Record<Theme, (g: Ctx) => void> = {
  temple,
  ruins,
  fortress,
  crypt,
  sanctum,
  jungle,
  ice,
  volcano,
  atlantis,
  desert,
  cyber,
  mansion,
  sky: skyCitadel,
  matrix,
};

export function buildBackground(theme: Theme): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  DRAW[theme](g);
  // Darken so gameplay tiles stay readable.
  g.globalAlpha = 0.38;
  rect(g, "#000", 0, 0, W, H);
  g.globalAlpha = 1;
  return c;
}
