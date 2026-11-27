import type { FlowState } from "../core/flow";
import { CFG, HUD_H, ROWS, COLS, TILE, VIEW_H, VIEW_W } from "../game/config";
import type { Char } from "../game/movement";
import type { World } from "../game/world";
import type { AssetProvider } from "./assets";
import { buildPortrait } from "./portrait";
import { rng } from "./sprites";
import {
  PIT_COLORS,
  THEME_SURFACE,
  spriteKeyGround,
  spriteKeyStone,
} from "./surfaces";
import type { Particles } from "./particles";

const FONT = 'bold 10px "Courier New", monospace';

export interface TitleView {
  heading: string;
  items: string[];
  index: number;
  hint: string;
  /** Audio is still locked by the browser; show a hint. */
  soundBlocked: boolean;
}

export interface ResultsView {
  rank: string;
  note: string;
  lines: [string, string][];
  /** First time the game was cleared: announce the unlocked rewards. */
  unlocked: boolean;
}

/** Placeholder entry in `CREDITS`: the pixel-art portrait is drawn here (it takes five lines of space). */
const PHOTO_MARKER = "[photo]";

export const CREDITS: string[] = [
  "ROBO RUNNER",
  "",
  "DIG  \u2022  RUN  \u2022  ESCAPE",
  "",
  "",
  "BROUGHT TO YOU BY",
  "Luka Kancheli",
  "https://github.com/l-u-k-a",
  "",
  "",
  PHOTO_MARKER,
  "",
  "",
  "",
  "",
  "MJ ❤️",
  "",
  "",
  "",
  "THANK YOU FOR PLAYING!",
];
const CREDIT_SPEED = 28; // pixels per second
const CREDIT_LINE = 24;
/** Seconds for the credits to scroll completely off screen. */
export const CREDITS_DURATION =
  (VIEW_H + CREDITS.length * CREDIT_LINE) / CREDIT_SPEED + 1;

export interface HudInfo {
  score: number;
  lives: number;
  levelIndex: number;
  totalLevels: number;
}

export class Renderer {
  private g: CanvasRenderingContext2D;
  shake = 0;
  /** Bright flash after an explosion, fades by itself (seconds). */
  flash = 0;
  /** Draw the hero with the unlocked golden skin. */
  goldenHero = false;
  private vault: HTMLCanvasElement | null = null;
  private portrait: HTMLCanvasElement | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: AssetProvider,
  ) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.g = canvas.getContext("2d")!;
    this.g.imageSmoothingEnabled = false;
    window.addEventListener("resize", () => this.fit());
    this.fit();
  }

  /** Integer pixel scaling keeps the sprites crisp. */
  fit(): void {
    const maxW = window.innerWidth - 60;
    const maxH = window.innerHeight - 60;
    const scale = Math.max(
      1,
      Math.floor(Math.min(maxW / VIEW_W, maxH / VIEW_H)),
    );
    this.canvas.style.width = `${VIEW_W * scale}px`;
    this.canvas.style.height = `${VIEW_H * scale}px`;
  }

  private spr(key: string, x: number, y: number, flip = false): void {
    const g = this.g;
    const img = this.assets.sprite(key);
    if (flip) {
      g.save();
      g.translate(Math.round(x) + TILE, Math.round(y));
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    } else {
      g.drawImage(img, Math.round(x), Math.round(y));
    }
  }

  private text(
    s: string,
    x: number,
    y: number,
    color = "#ffe9b0",
    align: CanvasTextAlign = "left",
  ): void {
    const g = this.g;
    g.font = FONT;
    g.textBaseline = "top";
    g.textAlign = align;
    g.fillStyle = "#000";
    g.fillText(s, x + 1, y + 1);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private bigText(
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    const g = this.g;
    g.font = `bold ${size}px "Courier New", monospace`;
    g.textBaseline = "top";
    g.textAlign = "center";
    g.fillStyle = "#000";
    g.fillText(s, x + 2, y + 2);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  // ---- play field ---------------------------------------------------------

  drawPlay(
    world: World,
    hud: HudInfo,
    particles: Particles,
    time: number,
  ): void {
    const g = this.g;
    g.save();
    g.fillStyle = "#000";
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawHud(world, hud);
    const sx =
      this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 6) : 0;
    const sy =
      this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 6) : 0;
    g.translate(sx, HUD_H + sy);
    g.beginPath();
    g.rect(-sx, -sy, VIEW_W, ROWS * TILE);
    g.clip();

    g.drawImage(this.assets.background(world.level.theme), 0, 0);
    this.drawTiles(world);
    this.drawPits(world);
    this.drawDoor(world, time);
    this.drawPickups(world, time);
    this.drawDevices(world, time);
    if (world.debug.guards) {
      for (const guard of world.guards) {
        if (guard.alive)
          this.drawChar(guard, "guard", time, { glued: world.isGlued(guard) });
      }
    }
    if (world.hero.alive)
      this.drawChar(world.hero, "hero", time, { ghost: world.invulnT > 0 });
    this.drawBombs(world, time);
    this.drawSmoke(world, time);
    this.drawBeam(world);
    particles.draw(g);
    if (this.flash > 0) {
      g.fillStyle = `rgba(255, 240, 200, ${Math.min(0.85, this.flash * 2.5)})`;
      g.fillRect(-sx, -sy, VIEW_W, ROWS * TILE);
    }
    g.restore();
  }

  private drawTiles(world: World): void {
    const surface = THEME_SURFACE[world.level.theme];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = world.tiles[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (t === "ground") {
          if (world.pitAt(x, y)) continue; // drawn in drawPits
          const above = y > 0 ? world.tileAt(x, y - 1) : "empty";
          const covered = above === "ground" || above === "stone";
          this.spr(spriteKeyGround(surface.ground, !covered), px, py);
        } else if (t === "stone")
          this.spr(spriteKeyStone(surface.stone), px, py);
        else if (t === "ladder") this.spr("tile.ladder", px, py);
        else if (t === "rope") this.spr("tile.rope", px, py);
        else if (t === "zipR") this.spr("tile.zipR", px, py);
        else if (t === "zipL") this.spr("tile.zipL", px, py);
      }
    }
  }

  private drawPits(world: World): void {
    const g = this.g;
    const style = THEME_SURFACE[world.level.theme].ground;
    const colors = PIT_COLORS[style];
    for (const p of world.pits) {
      const px = p.x * TILE;
      const py = p.y * TILE;
      const grass = world.tileAt(p.x, p.y - 1) === "empty";
      if (p.state === "digging") {
        this.spr(spriteKeyGround(style, grass), px, py);
        g.fillStyle = "#ffd9a0";
        const k = Math.min(1, p.t / CFG.digTime);
        g.fillRect(px + 2, py + 2, Math.round(16 * k), 2);
        g.fillStyle = "#2a1608";
        g.fillRect(px + 8, py + 4, 4, Math.round(10 * k));
        continue;
      }
      // cavity
      g.fillStyle = colors.cavity;
      g.fillRect(px, py, TILE, TILE);
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(px, py, 2, TILE);
      g.fillRect(px + TILE - 2, py, 2, TILE);
      if (p.state === "open") {
        // flicker as it is about to close
        const left = world.diff.pitOpen - p.t;
        if (left < 1.2 && Math.floor(p.t * 8) % 2 === 0) {
          g.fillStyle = colors.fill;
          g.fillRect(px, py + TILE - 3, TILE, 3);
        }
      } else {
        const k = Math.min(1, p.t / CFG.refillTime);
        const h = Math.round(TILE * k);
        g.fillStyle = colors.fill;
        g.fillRect(px, py + TILE - h, TILE, h);
      }
    }
  }

  /**
   * The exit is a swirling portal. Sealed, it is a dark, dead ring; once every coin is collected it
   * flares up in acid green, spiralling, with sparks drifting out of it.
   */
  private drawDoor(world: World, time: number): void {
    const g = this.g;
    const { x, y } = world.level.exit;
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2 - 0.5;
    const rx = 8;
    const ry = 11;
    const open = world.doorOpen;
    const ellipse = (rxx: number, ryy: number, col: string, a = 1): void => {
      g.globalAlpha = a;
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(cx, cy, rxx, ryy, 0, 0, Math.PI * 2);
      g.fill();
    };
    if (open) {
      const pulse = 0.18 + 0.08 * Math.sin(time * 5);
      ellipse(rx + 9, ry + 9, "#7aff3a", pulse);
      ellipse(rx + 5, ry + 5, "#b8ff5a", pulse);
    }
    ellipse(rx + 1.5, ry + 1.5, open ? "#0b3a12" : "#1c241c"); // outer rim shadow
    ellipse(rx, ry, open ? "#d0ff70" : "#59675a"); // ring
    ellipse(rx - 2, ry - 2, open ? "#0f5a1a" : "#0a110a"); // inside
    if (open) {
      // spiral arms
      const colors = ["#b8ff5a", "#7aff3a", "#2ad03a", "#c8fff0"];
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 26; i++) {
          const k = i / 26;
          const a = arm * 2.094 + k * 6.2 - time * 4;
          const px = cx + Math.cos(a) * (rx - 2) * k;
          const py = cy + Math.sin(a) * (ry - 2) * k;
          g.globalAlpha = 0.35 + 0.65 * (1 - k * 0.5);
          g.fillStyle = colors[(i + arm) % colors.length];
          g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
        }
      }
      g.globalAlpha = 1;
      ellipse(2.5, 3.5, "#f4fff0"); // bright core
      // sparks drifting out of the portal
      for (let i = 0; i < 5; i++) {
        const t = (time * 0.7 + i * 0.2) % 1;
        const a = i * 1.9 + Math.floor(time * 0.7 + i * 0.2) * 3.1;
        g.globalAlpha = 1 - t;
        g.fillStyle = i % 2 ? "#d0ff70" : "#7aff3a";
        g.fillRect(
          Math.round(cx + Math.cos(a) * (8 + t * 10)),
          Math.round(cy + Math.sin(a) * (11 + t * 8)),
          2,
          2,
        );
      }
    } else {
      // dead ring: a few faint static pixels and a red "sealed" lamp
      g.globalAlpha = 0.5;
      g.fillStyle = "#3a4a3a";
      for (let i = 0; i < 6; i++) {
        g.fillRect(
          Math.round(cx - 4 + ((i * 7 + Math.floor(time * 4)) % 9)),
          Math.round(cy - 6 + ((i * 5) % 12)),
          1,
          1,
        );
      }
      g.globalAlpha = 1;
      if (Math.floor(time * 1.5) % 2 === 0) {
        g.fillStyle = "#ff3a2a";
        g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
      }
    }
    g.globalAlpha = 1;
  }

  private drawPickups(world: World, time: number): void {
    const frame = Math.floor(time * 8) % 4;
    for (const k of world.gold) {
      const x = k % COLS;
      const y = Math.floor(k / COLS);
      this.spr(`gold.${frame}`, x * TILE, y * TILE);
    }
    for (const k of world.diamonds) {
      const x = k % COLS;
      const y = Math.floor(k / COLS);
      this.spr(`diamond.${Math.floor(time * 5 + x) % 4}`, x * TILE, y * TILE);
    }
    for (const [k, kind] of world.items) {
      const x = k % COLS;
      const y = Math.floor(k / COLS);
      const bob = Math.round(Math.sin(time * 4 + x) * 1);
      this.spr(`item.${kind}`, x * TILE, y * TILE + bob);
    }
  }

  /** Lit bombs are drawn over the characters so the hero cannot hide them. */
  private drawBombs(world: World, time: number): void {
    const g = this.g;
    for (const b of world.bombs) {
      const rate = 4 + (1 - b.t / CFG.bombFuse) * 22;
      const flash = Math.floor(time * rate) % 2 === 0;
      this.spr("item.bomb", b.x * TILE, b.y * TILE);
      if (flash) {
        g.globalAlpha = 0.55;
        g.fillStyle = "#ff3a2a";
        g.fillRect(b.x * TILE + 5, b.y * TILE + 9, 10, 9);
        g.globalAlpha = 1;
      }
      g.fillStyle = flash ? "#fff" : "#ffd23a";
      g.fillRect(
        b.x * TILE + 12 + (Math.floor(time * 30) % 2),
        b.y * TILE + 1,
        2,
        2,
      );
    }
  }

  private drawSmoke(world: World, time: number): void {
    const g = this.g;
    for (const s of world.smokes) {
      const life = Math.min(1, s.t / 1.2);
      const cx = (s.x + 0.5) * TILE;
      const cy = (s.y + 0.5) * TILE;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + time * 0.8;
        const rad = 14 + (i % 3) * 14 + Math.sin(time * 2 + i) * 4;
        g.globalAlpha = 0.5 * life;
        g.fillStyle = i % 2 ? "#c4cbd3" : "#dfe4ea";
        g.beginPath();
        g.arc(
          cx + Math.cos(a) * rad * 0.9,
          cy + Math.sin(a * 1.3) * rad * 0.55 - 4,
          10 + (i % 4) * 3,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  private drawDevices(world: World, time: number): void {
    const g = this.g;
    for (const k of world.glue) {
      const x = k % COLS;
      const y = Math.floor(k / COLS);
      const px = x * TILE;
      const py = (y + 1) * TILE;
      g.fillStyle = "#6aa82a";
      g.fillRect(px, py - 4, TILE, 4);
      g.fillStyle = "#8bd13a";
      g.fillRect(px, py - 5, TILE, 2);
      g.fillStyle = "#c8f56a";
      g.fillRect(px + 3, py - 5, 3, 1);
      if (Math.floor(time * 3 + x) % 3 === 0) g.fillRect(px + 12, py - 7, 2, 2); // bubble
    }

    for (const t of world.traps) {
      this.spr("item.shock", t.x * TILE, t.y * TILE);
      if (Math.floor(time * 10) % 2 === 0) {
        g.fillStyle = "#fff";
        g.fillRect(
          t.x * TILE + 4 + Math.floor((time * 40) % 10),
          t.y * TILE + 13,
          2,
          1,
        );
      }
    }
    if (world.decoy) {
      const d = world.decoy;
      g.globalAlpha = 0.5 + 0.3 * Math.sin(time * 12);
      this.spr("hero.idle.0", d.x * TILE, d.y * TILE);
      g.globalAlpha = 1;
      g.fillStyle = "#5df0ff";
      g.fillRect(d.x * TILE + 4, d.y * TILE + 19, 12, 1);
    }
  }

  private drawChar(
    c: Char,
    who: "hero" | "guard",
    time: number,
    opts: { glued?: boolean; ghost?: boolean } = {},
  ): void {
    const frames: Record<string, number> = {
      idle: 1,
      run: 4,
      climb: 2,
      hang: 2,
      fall: 1,
      zip: 2,
      pit: 1,
    };
    const pose = c.pose;
    const n = frames[pose] ?? 1;
    const f = Math.floor(c.animT * (pose === "run" ? 12 : 8)) % n;
    // Glued guards strain on the spot, coughing guards shake a little.
    const jitter =
      opts.glued || c.cough > 0
        ? Math.floor(time * 18) % 2 === 0
          ? 1
          : -1
        : 0;
    const px = c.x * TILE + jitter;
    const py = c.y * TILE;
    const prefix = who === "hero" && this.goldenHero ? "herogold" : who;
    const g = this.g;
    if (opts.ghost) g.globalAlpha = 0.45 + 0.3 * Math.sin(time * 16);
    this.spr(`${prefix}.${pose}.${f}`, px, py, c.facing < 0);
    g.globalAlpha = 1;
    if (c.cough > 0) {
      g.fillStyle = "#cfd3d8";
      for (let i = 0; i < 3; i++) {
        const t = (time * 2 + i / 3) % 1;
        g.fillRect(
          Math.round(px + 6 + i * 4),
          Math.round(py - 2 - t * 8),
          2,
          2,
        );
      }
    }
    if (c.stun > 0) {
      g.fillStyle = Math.floor(time * 20) % 2 === 0 ? "#fff36b" : "#8ff";
      for (let i = 0; i < 4; i++) {
        const sx = px + 2 + ((i * 5 + Math.floor(time * 30)) % 16);
        const sy = py + 2 + ((i * 7 + Math.floor(time * 17)) % 16);
        g.fillRect(sx, sy, 2, 2);
      }
    }
  }

  private drawBeam(world: World): void {
    const b = world.beam;
    if (!b) return;
    const g = this.g;
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (b.x0 + (b.x1 - b.x0) * t) * TILE;
      const y = (b.y0 + (b.y1 - b.y0) * t) * TILE;
      g.fillStyle = "#ff2a2a";
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle = "#fff";
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  private drawHud(world: World, hud: HudInfo): void {
    const g = this.g;
    g.fillStyle = "#1a0f08";
    g.fillRect(0, 0, VIEW_W, HUD_H);
    g.fillStyle = "#6b4423";
    g.fillRect(0, HUD_H - 2, VIEW_W, 2);
    const score = String(hud.score + world.score).padStart(6, "0");
    this.text(`SCORE ${score}`, 8, 6);
    this.text(`LIVES ${"\u2665".repeat(hud.lives)}`, 150, 6, "#ff6b6b");
    this.text(
      `LEVEL ${hud.levelIndex + 1}${hud.totalLevels > 0 ? `/${hud.totalLevels}` : ""}`,
      270,
      6,
    );
    this.text(`GOLD ${world.goldLeft}`, 360, 6, "#ffd23a");
    this.text(
      `GEM ${world.diamondsTaken}/${world.level.diamonds.length}`,
      420,
      6,
      "#7ff0ff",
    );
    this.text("TOOL", 490, 6);
    g.fillStyle = "#000";
    g.fillRect(524, 2, 20, 20);
    g.strokeStyle = "#6b4423";
    g.strokeRect(524.5, 2.5, 19, 19);
    if (world.held)
      g.drawImage(
        this.assets.sprite(`item.${world.held}`) as CanvasImageSource,
        524,
        2,
      );
    if (world.bootsT > 0)
      this.text(`${world.bootsT.toFixed(0)}s`, 548, 6, "#7be88a");
    if (world.invulnT > 0)
      this.text(
        `SMOKE SHIELD ${world.invulnT.toFixed(0)}s`,
        8,
        VIEW_H - 14,
        "#cfd3d8",
      );
    const flags = [
      world.debug.guards ? "" : "NO GUARDS",
      world.debug.invincible ? "GOD" : "",
    ].filter(Boolean);
    if (flags.length)
      this.text(
        `DEBUG: ${flags.join(" ")}`,
        VIEW_W - 8,
        VIEW_H - 14,
        "#ff9a1f",
        "right",
      );
  }

  // ---- screens ------------------------------------------------------------

  private dim(alpha: number): void {
    this.g.fillStyle = `rgba(0,0,0,${alpha})`;
    this.g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private drawMenuItems(
    items: string[],
    index: number,
    top: number,
    time: number,
  ): void {
    const g = this.g;
    items.forEach((label, i) => {
      const sel = i === index;
      const y = top + i * 26;
      if (sel) {
        g.fillStyle = "rgba(255, 210, 58, 0.14)";
        g.fillRect(VIEW_W / 2 - 130, y - 5, 260, 24);
        g.fillStyle = "#ffd23a";
        g.fillRect(VIEW_W / 2 - 130, y - 5, 3, 24);
      }
      g.font = 'bold 15px "Courier New", monospace';
      g.textBaseline = "top";
      g.textAlign = "center";
      g.fillStyle = "#000";
      g.fillText(label, VIEW_W / 2 + 1, y + 1);
      g.fillStyle = sel ? "#ffd23a" : "#c9b38a";
      g.fillText(label, VIEW_W / 2, y);
      if (sel && Math.floor(time * 3) % 2 === 0) {
        g.fillText("\u25B6", VIEW_W / 2 - 112, y);
        g.fillText("\u25C0", VIEW_W / 2 + 112, y);
      }
    });
  }

  /** A menu laid over the dimmed game: used by the pause menu and its options. */
  drawPanel(
    title: string,
    items: string[],
    index: number,
    hint: string,
    time: number,
  ): void {
    this.dim(0.84);
    this.bigText(title, VIEW_W / 2, 52, 30, "#ffe9b0");
    this.drawMenuItems(items, index, 118, time);
    this.text(hint, VIEW_W / 2, VIEW_H - 24, "#7be88a", "center");
  }

  drawTitle(time: number, view: TitleView): void {
    const g = this.g;
    g.fillStyle = "#1a0f08";
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.drawImage(this.assets.background("temple"), 0, 0);
    this.dim(0.5);

    this.bigText("ROBO RUNNER", VIEW_W / 2, 18, 34, "#ffd23a");
    this.text(
      "DIG  \u2022  RUN  \u2022  ESCAPE",
      VIEW_W / 2,
      58,
      "#ffe9b0",
      "center",
    );

    // Small chase scene: the robot runs along a strip of ground with two guards close behind.
    const floorY = 118;
    for (let x = 0; x < VIEW_W; x += TILE)
      this.spr("tile.groundTop", x, floorY);
    const span = VIEW_W + 200;
    const hx = ((time * 60) % span) - 100;
    const frame = Math.floor(time * 10) % 4;
    g.save();
    g.scale(1, 1);
    g.drawImage(
      this.assets.sprite(`hero.run.${frame}`) as CanvasImageSource,
      Math.round(hx),
      floorY - TILE,
    );
    g.drawImage(
      this.assets.sprite(`guard.run.${(frame + 2) % 4}`) as CanvasImageSource,
      Math.round(hx - 38),
      floorY - TILE,
    );
    g.drawImage(
      this.assets.sprite(`guard.run.${(frame + 1) % 4}`) as CanvasImageSource,
      Math.round(hx - 66),
      floorY - TILE,
    );
    g.restore();

    // Menu
    if (view.heading)
      this.text(view.heading, VIEW_W / 2, 150, "#c9b38a", "center");
    const top = view.heading ? 172 : 156;
    this.drawMenuItems(view.items, view.index, top, time);

    this.text(view.hint, VIEW_W / 2, VIEW_H - 34, "#7be88a", "center");
    if (view.soundBlocked && Math.floor(time * 2) % 2 === 0) {
      this.text(
        "PRESS ANY KEY OR CLICK FOR SOUND",
        VIEW_W / 2,
        80,
        "#ff9a1f",
        "center",
      );
    }
    this.text(
      "ARROWS move   Z/X dig   SPACE tool   P pause   M mute   F fullscreen",
      VIEW_W / 2,
      VIEW_H - 18,
      "#a89a78",
      "center",
    );
  }

  // ---- ending ---------------------------------------------------------------

  /** Treasure vault used behind the victory, results and credits screens. */
  private vaultBackdrop(): HTMLCanvasElement {
    if (this.vault) return this.vault;
    const c = document.createElement("canvas");
    c.width = VIEW_W;
    c.height = VIEW_H;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < VIEW_H; y += 8) {
      const t = y / VIEW_H;
      g.fillStyle = `rgb(${Math.round(30 + 90 * t)},${Math.round(16 + 55 * t)},${Math.round(8 + 10 * t)})`;
      g.fillRect(0, y, VIEW_W, 8);
    }
    for (const x of [30, 110, 430, 510]) {
      g.fillStyle = "#4a2a12";
      g.fillRect(x, 40, 20, 220);
      g.fillStyle = "#6a3e1a";
      g.fillRect(x, 40, 4, 220);
      g.fillStyle = "#4a2a12";
      g.fillRect(x - 4, 36, 28, 8);
      g.fillRect(x - 4, 252, 28, 8);
    }
    g.globalAlpha = 0.14;
    g.fillStyle = "#ffe9a0";
    g.beginPath();
    g.moveTo(240, 0);
    g.lineTo(320, 0);
    g.lineTo(440, 260);
    g.lineTo(120, 260);
    g.fill();
    g.globalAlpha = 1;
    // floor
    const floorY = 250;
    for (let x = 0; x < VIEW_W; x += TILE) {
      g.drawImage(
        this.assets.sprite("tile.groundTop") as CanvasImageSource,
        x,
        floorY,
      );
      for (let y = floorY + TILE; y < VIEW_H; y += TILE) {
        g.drawImage(
          this.assets.sprite("tile.groundMid") as CanvasImageSource,
          x,
          y,
        );
      }
    }
    // gold pile
    for (let i = 0; i < 14; i++) {
      const w = Math.round(250 * (1 - i / 14));
      g.fillStyle = i % 2 ? "#ffd23a" : "#e6b422";
      g.fillRect(Math.round(VIEW_W / 2 - w / 2), floorY - (i + 1) * 6, w, 6);
    }
    const r = rng(5);
    for (let i = 0; i < 30; i++) {
      const row = Math.floor(r() * 12);
      const w = 250 * (1 - row / 14);
      const x = VIEW_W / 2 - w / 2 + r() * (w - 14);
      g.drawImage(
        this.assets.sprite(`gold.${i % 4}`) as CanvasImageSource,
        Math.round(x - 3),
        floorY - (row + 1) * 6 - 12,
      );
    }
    this.vault = c;
    return c;
  }

  /** The ending cinematic: the robot walks into the vault and the guards cheer. */
  drawVictory(time: number, particles: Particles, levelCount: number): void {
    const g = this.g;
    g.drawImage(this.vaultBackdrop(), 0, 0);
    const floorY = 250;
    const heroX = Math.min(time * 90 - 24, VIEW_W / 2 - 110);
    const arrived = time * 90 - 24 >= VIEW_W / 2 - 110;
    const prefix = this.goldenHero ? "herogold" : "hero";

    // guards line up and bounce once the hero arrives
    const spots: [number, boolean][] = [
      [40, false],
      [78, false],
      [VIEW_W - 60, true],
      [VIEW_W - 98, true],
    ];
    spots.forEach(([x, flip], i) => {
      const bob = arrived
        ? Math.round(Math.abs(Math.sin(time * 5 + i)) * 5)
        : 0;
      this.spr(`guard.idle.0`, x, floorY - TILE - bob, flip);
    });

    const frame = Math.floor(time * 10) % 4;
    if (arrived) {
      const hop = Math.round(Math.abs(Math.sin(time * 6)) * 6);
      this.spr(
        `${prefix}.zip.${Math.floor(time * 4) % 2}`,
        heroX,
        floorY - TILE - hop,
      );
    } else {
      this.spr(`${prefix}.run.${frame}`, heroX, floorY - TILE);
    }

    particles.draw(g);

    const fade = Math.max(0, Math.min(1, (time - 0.8) / 1.2));
    g.globalAlpha = fade;
    this.bigText("YOU ESCAPED!", VIEW_W / 2, 24, 34, "#ffd23a");
    this.text(
      `ALL ${levelCount} LEVELS COMPLETE`,
      VIEW_W / 2,
      66,
      "#fff3b0",
      "center",
    );
    g.globalAlpha = 1;
    if (time > 2 && Math.floor(time * 2) % 2 === 0) {
      this.text("PRESS ENTER", VIEW_W / 2, VIEW_H - 20, "#7be88a", "center");
    }
  }

  drawResults(view: ResultsView, time: number): void {
    const g = this.g;
    g.drawImage(this.vaultBackdrop(), 0, 0);
    this.dim(0.84);
    this.bigText("RESULTS", VIEW_W / 2, 14, 26, "#ffe9b0");

    const colors: Record<string, string> = {
      S: "#ffd23a",
      A: "#7be88a",
      B: "#5aa9ff",
      C: "#c9b38a",
    };
    const col = colors[view.rank] ?? "#ffffff";
    const bx = 40;
    const by = 62;
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(bx, by, 110, 130);
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.strokeRect(bx + 1, by + 1, 108, 128);
    this.text("RANK", bx + 55, by + 8, "#c9b38a", "center");
    g.font = 'bold 76px "Courier New", monospace';
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = "#000";
    g.fillText(view.rank, bx + 58, by + 28);
    g.fillStyle = col;
    g.fillText(view.rank, bx + 55, by + 25);

    view.lines.forEach(([label, value], i) => {
      const y = 66 + i * 20;
      this.text(label, 190, y, "#c9b38a");
      this.text(value, VIEW_W - 40, y, "#fff3b0", "right");
      g.fillStyle = "rgba(255,233,176,0.18)";
      g.fillRect(190, y + 14, VIEW_W - 230, 1);
    });
    this.text(view.note, VIEW_W / 2, 238, col, "center");
    if (view.unlocked) {
      this.text(
        "UNLOCKED: GOLDEN ROBOT, ENDLESS MODE, LEVEL SELECT",
        VIEW_W / 2,
        262,
        "#ff9a1f",
        "center",
      );
    }
    if (Math.floor(time * 2) % 2 === 0)
      this.text("PRESS ENTER", VIEW_W / 2, VIEW_H - 24, "#7be88a", "center");
  }

  /** The pixel-art portrait in a wooden frame, top edge at `y`, centred. */
  private drawPortrait(y: number): void {
    const g = this.g;
    this.portrait ??= buildPortrait();
    const p = this.portrait;
    const w = p.width * 2;
    const h = p.height * 2;
    const x = Math.round(VIEW_W / 2 - w / 2);
    g.fillStyle = "#000";
    g.fillRect(x - 8, y - 8, w + 16, h + 16);
    g.fillStyle = "#6b4423";
    g.fillRect(x - 7, y - 7, w + 14, h + 14);
    g.fillStyle = "#2a1a10";
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.drawImage(p, x, y, w, h);
    g.fillStyle = "#c9a060"; // corner studs
    for (const [cx, cy] of [[-6, -6], [w + 3, -6], [-6, h + 3], [w + 3, h + 3]] as const) {
      g.fillRect(x + cx, y + cy, 3, 3);
    }
  }

  drawCredits(time: number, particles: Particles): void {
    const g = this.g;
    g.drawImage(this.vaultBackdrop(), 0, 0);
    this.dim(0.7);
    particles.draw(g);
    CREDITS.forEach((line, i) => {
      const y = VIEW_H - time * CREDIT_SPEED + i * CREDIT_LINE;
      if (line === PHOTO_MARKER) {
        if (y > -110 && y < VIEW_H) this.drawPortrait(y);
        return;
      }
      if (y < -30 || y > VIEW_H || !line) return;
      if (i === 0) this.bigText(line, VIEW_W / 2, y, 30, "#ffd23a");
      else if (line === "Luka Kancheli")
        this.bigText(line, VIEW_W / 2, y - 2, 22, "#fff3b0");
      else
        this.text(
          line,
          VIEW_W / 2,
          y,
          line.startsWith("github") ? "#7be88a" : "#ffe9b0",
          "center",
        );
    });
    if (time > 1.5 && Math.floor(time * 2) % 2 === 0)
      this.text("ENTER: SKIP", VIEW_W - 8, VIEW_H - 14, "#a89a78", "right");
  }

  drawBanner(
    state: FlowState,
    hud: HudInfo,
    extra: string,
    time: number,
  ): void {
    this.dim(0.62);
    const cy = VIEW_H / 2 - 40;
    const blink = Math.floor(time * 2) % 2 === 0;
    switch (state) {
      case "levelClear":
        this.bigText("LEVEL CLEAR!", VIEW_W / 2, cy, 30, "#7be88a");
        this.text(
          `SCORE ${String(hud.score).padStart(6, "0")}`,
          VIEW_W / 2,
          cy + 44,
          "#ffe9b0",
          "center",
        );
        if (blink)
          this.text(
            "PRESS ENTER FOR NEXT LEVEL",
            VIEW_W / 2,
            cy + 64,
            "#ffd23a",
            "center",
          );
        break;
      case "gameOver":
        this.bigText("GAME OVER", VIEW_W / 2, cy, 30, "#ff6b6b");
        this.text(
          `FINAL SCORE ${String(hud.score).padStart(6, "0")}`,
          VIEW_W / 2,
          cy + 44,
          "#ffe9b0",
          "center",
        );
        if (blink)
          this.text("PRESS ENTER", VIEW_W / 2, cy + 64, "#ffd23a", "center");
        break;
      case "win":
        this.bigText("YOU ESCAPED!", VIEW_W / 2, cy, 30, "#ffd23a");
        this.text(
          `ALL ${hud.totalLevels} LEVELS COMPLETE`,
          VIEW_W / 2,
          cy + 40,
          "#7be88a",
          "center",
        );
        this.text(
          `FINAL SCORE ${String(hud.score).padStart(6, "0")}`,
          VIEW_W / 2,
          cy + 56,
          "#ffe9b0",
          "center",
        );
        if (blink)
          this.text("PRESS ENTER", VIEW_W / 2, cy + 78, "#ffd23a", "center");
        break;
      default:
        break;
    }
    if (extra) this.text(extra, VIEW_W / 2, VIEW_H - 20, "#c9b38a", "center");
  }

  drawIntro(name: string, index: number, time: number, stars: number): void {
    this.dim(0.7);
    this.bigText(
      `LEVEL ${index + 1}`,
      VIEW_W / 2,
      VIEW_H / 2 - 36,
      28,
      "#ffe9b0",
    );
    this.text(
      name.toUpperCase(),
      VIEW_W / 2,
      VIEW_H / 2 + 4,
      "#ffd23a",
      "center",
    );
    this.text(
      `DIFFICULTY ${"\u2605".repeat(stars)}${"\u2606".repeat(5 - stars)}`,
      VIEW_W / 2,
      VIEW_H / 2 + 22,
      "#ff9a1f",
      "center",
    );
    if (Math.floor(time * 4) % 2 === 0)
      this.text("GET READY", VIEW_W / 2, VIEW_H / 2 + 44, "#7be88a", "center");
  }
}
