import { Music } from "../audio/music";
import { Sfx, type SfxName } from "../audio/sfx";
import { SIM_DT, TILE, VIEW_W } from "../game/config";
import { difficultyFor, endlessDifficulty } from "../game/difficulty";
import { parseLevel } from "../game/level";
import type { ParsedLevel } from "../game/types";
import { World, type GameEvent, type HeroInput } from "../game/world";
import { LEVEL_DEFS } from "../levels/all";
import { endlessLevel } from "../levels/generator";
import { GeneratedAssets, type AssetProvider } from "../render/assets";
import { Particles } from "../render/particles";
import {
  CREDITS_DURATION,
  Renderer,
  type HudInfo,
  type ResultsView,
  type TitleView,
} from "../render/renderer";
import { ALL_TOOLS, DebugPanel, type DebugState } from "./debug";
import { GameFlow, type GameMode } from "./flow";
import { Input } from "./input";
import { Accumulator } from "./loop";
import { Menu } from "./menu";
import {
  loadProgress,
  saveProgress,
  unlockAfter,
  type Progress,
} from "./progress";
import {
  MAX_VOLUME,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";
import { RANK_NOTE, RunStats, formatTime, rankFor } from "./stats";

const INTRO_TIME = 1.4;
/** The victory cinematic advances on its own after this long (Enter skips it). */
const VICTORY_TIME = 14;

const EVENT_SFX: Partial<Record<GameEvent["type"], SfxName>> = {
  laser: "laser",
  dig: "dig",
  denied: "denied",
  pitRefill: "pitRefill",
  guardTrapped: "guardTrapped",
  guardDied: "guardDied",
  gold: "gold",
  diamond: "diamond",
  tool: "tool",
  toolUse: "toolUse",
  shock: "shock",
  emp: "emp",
  smoke: "smoke",
  glue: "glue",
  bombLit: "bombLit",
  boom: "boom",
  cough: "cough",
  death: "death",
  doorOpen: "doorOpen",
};

type MainId =
  | "continue"
  | "start"
  | "select"
  | "endless"
  | "options"
  | "credits"
  | "fullscreen";
type Screen = "main" | "options" | "select" | "credits";
type PauseScreen = "menu" | "options" | "credits";

const PAUSE_ITEMS = ["RESUME", "OPTIONS", "CREDITS", "EXIT TO TITLE"];

export class Game {
  private levels = LEVEL_DEFS.map(parseLevel);
  private flow = new GameFlow(this.levels.length);
  private input = new Input();
  private sfx = new Sfx();
  private music = new Music(() => this.sfx.context);
  private renderer: Renderer;
  private particles = new Particles();
  private acc = new Accumulator(SIM_DT);
  private world: World | null = null;
  private introT = 0;
  private clock = 0;
  private last = 0;

  private debug: DebugPanel;
  private unlockHandler: (() => void) | null = null;
  private canvas: HTMLCanvasElement;
  private settings: Settings = loadSettings();
  private progress: Progress = loadProgress(undefined, LEVEL_DEFS.length);
  private stats = new RunStats();
  private totalDiamonds = this.levels.reduce(
    (n, l) => n + l.diamonds.length,
    0,
  );
  private endlessCache = new Map<number, ParsedLevel>();
  private screen: Screen = "main";
  private selectLevel = 0;
  private menu = new Menu(1);
  private pauseScreen: PauseScreen = "menu";
  private pauseMenu = new Menu(PAUSE_ITEMS.length);
  /** Seconds the credits screen has been scrolling (title and pause menus). */
  private creditsT = 0;
  /** Seconds spent in the current ending screen. */
  private endT = 0;
  private fireworkT = 0;
  /** True while the results screen belongs to the very first clear of the game. */
  private firstClear = false;

  constructor(
    canvas: HTMLCanvasElement,
    assets: AssetProvider = new GeneratedAssets(),
  ) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, assets);
    this.input.attach(window);
    this.menu.reset(this.mainEntries().length);
    this.debug = new DebugPanel({
      isSfxOn: () => this.settings.sfx,
      isMusicOn: () => this.settings.music,
      setSfx: (on) => this.changeSettings({ sfx: on }),
      setMusic: (on) => this.changeSettings({ music: on }),
      levelNames: this.levels.map((l) => l.name),
      currentLevel: () => this.flow.levelIndex,
      onChange: (s) => this.applyDebug(s),
      jumpToLevel: (i) => {
        this.flow.start("campaign", i);
        this.stats.reset();
        this.loadLevel();
        this.introT = 0;
      },
      restartLevel: () => {
        if (this.world) {
          this.loadLevel();
          this.introT = 0;
        }
      },
      collectAll: () => this.world?.debugCollectAll(),
      giveTool: (kind) => {
        if (this.world) this.world.held = kind;
      },
    });
    this.applySettings();
  }

  // ---- settings, progress ---------------------------------------------------

  private applySettings(): void {
    this.sfx.muted = !this.settings.sfx;
    this.music.setMuted(!this.settings.music);
    this.music.setVolume(this.settings.musicVolume);
    this.debug.sync();
  }

  private changeSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.applySettings();
  }

  private changeProgress(p: Progress): void {
    this.progress = p;
    saveProgress(p);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => undefined);
  }

  // ---- title menu ---------------------------------------------------------------

  private mainEntries(): { id: MainId; label: string }[] {
    const p = this.progress;
    const e: { id: MainId; label: string }[] = [];
    if (p.furthest > 0)
      e.push({ id: "continue", label: `CONTINUE: LEVEL ${p.furthest + 1}` });
    e.push({
      id: "start",
      label: p.furthest > 0 ? "START NEW GAME" : "START GAME",
    });
    if (p.furthest > 0 || p.cleared)
      e.push({ id: "select", label: "LEVEL SELECT" });
    if (p.cleared) e.push({ id: "endless", label: "ENDLESS MODE" });
    e.push({ id: "options", label: "OPTIONS" });
    e.push({ id: "credits", label: "CREDITS" });
    e.push({
      id: "fullscreen",
      label: `FULLSCREEN: ${document.fullscreenElement ? "ON" : "OFF"}`,
    });
    return e;
  }

  private optionItems(): string[] {
    const v = this.settings.musicVolume;
    return [
      `MUSIC: ${this.settings.music ? "ON" : "OFF"}`,
      `SOUND FX: ${this.settings.sfx ? "ON" : "OFF"}`,
      `VOLUME ${"\u2588".repeat(v)}${"\u2591".repeat(MAX_VOLUME - v)}`,
      `GOLDEN ROBOT: ${this.progress.cleared ? (this.settings.golden ? "ON" : "OFF") : "LOCKED"}`,
      "BACK",
    ];
  }

  private unlockedMax(): number {
    return this.progress.cleared
      ? this.levels.length - 1
      : Math.min(this.progress.furthest, this.levels.length - 1);
  }

  private selectItems(): string[] {
    return [
      `\u25C0 LEVEL ${this.selectLevel + 1}/${this.levels.length} \u25B6`,
      "PLAY",
      "BACK",
    ];
  }

  private titleView(): TitleView {
    if (this.screen === "options") {
      return {
        heading: "OPTIONS",
        items: this.optionItems(),
        index: this.menu.index,
        soundBlocked: !this.sfx.running,
        hint: "\u2191\u2193 SELECT   \u2190\u2192 ADJUST   ESC BACK",
      };
    }
    if (this.screen === "select") {
      return {
        heading: this.levels[this.selectLevel].name.toUpperCase(),
        items: this.selectItems(),
        index: this.menu.index,
        soundBlocked: !this.sfx.running,
        hint: "\u2190\u2192 LEVEL   PGUP/PGDN +-10   ENTER PLAY   ESC BACK",
      };
    }
    return {
      heading: "",
      items: this.mainEntries().map((e) => e.label),
      index: this.menu.index,
      soundBlocked: !this.sfx.running,
      hint: "\u2191\u2193 SELECT   ENTER CONFIRM",
    };
  }

  private openMain(focus?: MainId): void {
    this.screen = "main";
    const entries = this.mainEntries();
    this.menu.reset(entries.length);
    const i = focus ? entries.findIndex((e) => e.id === focus) : 0;
    this.menu.index = Math.max(0, i);
  }

  private beginRun(mode: GameMode, startIndex = 0): void {
    this.flow.start(mode, startIndex);
    this.stats.reset();
    this.loadLevel();
    this.sfx.play("start");
  }

  private updateTitle(confirm: boolean, dt: number): void {
    const inp = this.input;
    const up = inp.take("ArrowUp", "KeyW");
    const down = inp.take("ArrowDown", "KeyS");
    const left = inp.take("ArrowLeft", "KeyA");
    const right = inp.take("ArrowRight", "KeyD");
    const pgUp = inp.take("PageUp");
    const pgDown = inp.take("PageDown");
    const ok = confirm || inp.take("Space");
    const back = inp.take("Escape");
    if (this.screen === "credits") {
      this.creditsT += dt;
      if (ok || back || this.creditsT >= CREDITS_DURATION)
        this.openMain("credits");
      return;
    }
    if (up) this.menu.up();
    if (down) this.menu.down();
    if (up || down) this.sfx.play("menu");

    if (this.screen === "main") {
      if (!ok) return;
      this.sfx.play("menu");
      const entry = this.mainEntries()[this.menu.index];
      switch (entry?.id) {
        case "continue":
          this.beginRun("campaign", this.progress.furthest);
          break;
        case "start":
          this.beginRun("campaign", 0);
          break;
        case "endless":
          this.beginRun("endless");
          break;
        case "select":
          this.screen = "select";
          this.selectLevel = this.unlockedMax();
          this.menu.reset(3);
          break;
        case "options":
          this.screen = "options";
          this.menu.reset(5);
          break;
        case "credits":
          this.screen = "credits";
          this.creditsT = 0;
          this.particles.clear();
          break;
        case "fullscreen":
          this.toggleFullscreen();
          break;
        default:
          break;
      }
      return;
    }

    const step = right ? 1 : left ? -1 : 0;

    if (this.screen === "select") {
      if (back) {
        this.openMain("select");
        return;
      }
      const max = this.unlockedMax();
      const jump = pgUp ? 10 : pgDown ? -10 : 0;
      if (this.menu.index === 0 && (step || jump)) {
        this.selectLevel = Math.max(
          0,
          Math.min(max, this.selectLevel + step + jump),
        );
        this.sfx.play("menu");
      } else if (pgUp || pgDown) {
        this.selectLevel = Math.max(0, Math.min(max, this.selectLevel + jump));
      }
      if (ok && this.menu.index <= 1)
        this.beginRun("campaign", this.selectLevel);
      else if (ok) this.openMain("select");
      return;
    }

    this.handleOptions(ok, step, back, () => this.openMain("options"));
  }

  /** The options list, shared by the title menu and the pause menu. */
  private handleOptions(
    ok: boolean,
    step: number,
    back: boolean,
    onBack: () => void,
  ): void {
    if (back) {
      onBack();
      return;
    }
    const s = this.settings;
    switch (this.menu.index) {
      case 0:
        if (ok || step) this.changeSettings({ music: !s.music });
        break;
      case 1:
        if (ok || step) this.changeSettings({ sfx: !s.sfx });
        break;
      case 2:
        if (step)
          this.changeSettings({
            musicVolume: Math.max(
              0,
              Math.min(MAX_VOLUME, s.musicVolume + step),
            ),
          });
        else if (ok)
          this.changeSettings({
            musicVolume: s.musicVolume >= MAX_VOLUME ? 0 : s.musicVolume + 1,
          });
        break;
      case 3:
        if ((ok || step) && this.progress.cleared)
          this.changeSettings({ golden: !s.golden });
        break;
      default:
        if (ok) onBack();
    }
    if (ok || step) this.sfx.play("menu");
  }

  // ---- pause menu ---------------------------------------------------------------

  private openPause(): void {
    this.pauseScreen = "menu";
    this.pauseMenu.reset(PAUSE_ITEMS.length);
  }

  private updatePause(dt: number, confirm: boolean): void {
    const inp = this.input;
    const up = inp.take("ArrowUp", "KeyW");
    const down = inp.take("ArrowDown", "KeyS");
    const left = inp.take("ArrowLeft", "KeyA");
    const right = inp.take("ArrowRight", "KeyD");
    const ok = confirm || inp.take("Space");
    const esc = inp.take("Escape");
    const pKey = inp.take("KeyP");
    const back = esc || pKey;

    if (this.pauseScreen === "menu") {
      if (up) this.pauseMenu.up();
      if (down) this.pauseMenu.down();
      if (up || down) this.sfx.play("menu");
      if (back) {
        this.flow.togglePause(); // resume
        return;
      }
      if (!ok) return;
      this.sfx.play("menu");
      switch (this.pauseMenu.index) {
        case 0:
          this.flow.togglePause();
          break;
        case 1:
          this.pauseScreen = "options";
          this.menu.reset(5);
          break;
        case 2:
          this.pauseScreen = "credits";
          this.creditsT = 0;
          this.particles.clear();
          break;
        default:
          this.backToTitle();
      }
      return;
    }

    if (this.pauseScreen === "options") {
      if (up) this.menu.up();
      if (down) this.menu.down();
      if (up || down) this.sfx.play("menu");
      this.handleOptions(ok, right ? 1 : left ? -1 : 0, back, () => {
        this.pauseScreen = "menu";
        this.pauseMenu.index = 1;
      });
      return;
    }

    this.creditsT += dt;
    if (ok || back || this.creditsT >= CREDITS_DURATION) {
      this.pauseScreen = "menu";
      this.pauseMenu.index = 2;
    }
  }

  // ---- audio unlock -----------------------------------------------------------

  private applyDebug(s: DebugState): void {
    if (this.world) this.world.debug = { ...s };
  }

  /**
   * Browsers block sound until the user interacts. Try right away (works when the browser allows
   * autoplay), and otherwise start on the first key press, click or touch of any kind.
   */
  private armAudio(): void {
    this.sfx.unlock();
    if (this.sfx.running) return;
    const events = [
      "keydown",
      "pointerdown",
      "mousedown",
      "touchend",
      "click",
    ] as const;
    this.unlockHandler = () => this.sfx.unlock();
    for (const e of events)
      window.addEventListener(e, this.unlockHandler, true);
  }

  private disarmAudio(): void {
    if (!this.unlockHandler || !this.sfx.running) return;
    for (const e of [
      "keydown",
      "pointerdown",
      "mousedown",
      "touchend",
      "click",
    ]) {
      window.removeEventListener(e, this.unlockHandler, true);
    }
    this.unlockHandler = null;
  }

  // ---- lifecycle ---------------------------------------------------------------

  start(): void {
    this.armAudio();
    // Dev shortcuts: ?level=3 jumps into a level, ?ending[=results|credits] previews the finale.
    const params = new URLSearchParams(window.location.search);
    const lv = Number(params.get("level"));
    if (Number.isInteger(lv) && lv >= 1 && lv <= this.levels.length) {
      this.flow.start("campaign", lv - 1);
      this.loadLevel();
      this.introT = 0;
      if (this.world && params.has("collect")) this.world.debugCollectAll();
      const pause = params.get("pause");
      if (this.world && pause !== null) {
        this.flow.state = "paused";
        this.openPause();
        if (pause === "options") {
          this.pauseScreen = "options";
          this.menu.reset(5);
        }
      }
      // ?tool=bomb puts a tool in hand, adding &use fires it straight away.
      const tool = params.get("tool");
      if (this.world && tool && (ALL_TOOLS as string[]).includes(tool)) {
        this.world.held = tool as (typeof ALL_TOOLS)[number];
        if (params.has("use"))
          this.world.update(0, {
            dx: 0,
            dy: 0,
            digLeft: false,
            digRight: false,
            useTool: true,
          });
      }
    } else if (params.has("ending")) {
      const which = params.get("ending");
      this.previewEnding(
        which === "results" || which === "credits" ? which : "win",
      );
    }
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  private previewEnding(state: "win" | "results" | "credits"): void {
    this.flow.start("campaign", this.levels.length - 1);
    this.loadLevel();
    this.flow.state = state;
    this.firstClear = true;
    // Preview only (nothing is saved): show the cleared state, including the golden robot.
    this.progress = { furthest: this.levels.length - 1, cleared: true };
    this.settings = { ...this.settings, golden: true };
    this.endT =
      Number(new URLSearchParams(window.location.search).get("at")) || 0;
    Object.assign(this.stats, {
      deaths: 2,
      gold: 600,
      diamonds: 88,
      guardsTrapped: 140,
      toolsUsed: 61,
      seconds: 5461,
      levelsCleared: 60,
    });
  }

  private frame(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    const steps = this.acc.add(dt);
    for (let i = 0; i < steps; i++) this.update(SIM_DT);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** The level for an index. Indices past the campaign are generated on demand (endless mode). */
  private levelFor(index: number): ParsedLevel {
    if (index < this.levels.length) return this.levels[index];
    let l = this.endlessCache.get(index);
    if (!l) {
      l = parseLevel(endlessLevel(index - this.levels.length));
      this.endlessCache.set(index, l);
    }
    return l;
  }

  private loadLevel(): void {
    const i = this.flow.levelIndex;
    const diff =
      i < this.levels.length
        ? difficultyFor(i, this.levels.length)
        : endlessDifficulty(i - this.levels.length);
    this.world = new World(this.levelFor(i), diff);
    this.applyDebug(this.debug.state);
    this.debug.sync();
    this.introT = INTRO_TIME;
    this.particles.clear();
  }

  private heroInput(): HeroInput {
    const i = this.input;
    return {
      dx:
        (i.isDown("ArrowRight", "KeyD") ? 1 : 0) -
        (i.isDown("ArrowLeft", "KeyA") ? 1 : 0),
      dy:
        (i.isDown("ArrowDown", "KeyS") ? 1 : 0) -
        (i.isDown("ArrowUp", "KeyW") ? 1 : 0),
      digLeft: i.isDown("KeyZ"),
      digRight: i.isDown("KeyX"),
      useTool: i.take("Space", "KeyC"),
    };
  }

  private update(dt: number): void {
    const inp = this.input;
    this.clock += dt;
    if (inp.take("KeyM")) {
      this.sfx.unlock();
      const anyOn = this.settings.sfx || this.settings.music;
      this.changeSettings({ sfx: !anyOn, music: !anyOn });
    }
    if (inp.take("KeyN")) {
      this.sfx.unlock();
      this.changeSettings({ music: !this.settings.music });
    }
    if (inp.take("KeyF")) this.toggleFullscreen();
    this.disarmAudio();
    this.updateMusic();
    const confirm = inp.take("Enter");
    if (
      confirm ||
      inp.isDown("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space")
    )
      this.sfx.unlock();

    switch (this.flow.state) {
      case "title":
        this.updateTitle(confirm, dt);
        return;
      case "levelClear":
        if (confirm) {
          this.flow.nextLevel();
          this.loadLevel();
          this.sfx.play("start");
        }
        return;
      case "gameOver":
        if (confirm) this.backToTitle();
        return;
      case "win":
      case "results":
      case "credits":
        this.updateEnding(dt, confirm);
        return;
      case "paused":
        this.updatePause(dt, confirm);
        return;
      case "playing":
        break;
    }

    if (inp.take("KeyP", "Escape")) {
      this.flow.togglePause();
      this.openPause();
      return;
    }
    const world = this.world;
    if (!world) return;

    this.particles.update(dt);
    this.renderer.shake = Math.max(0, this.renderer.shake - dt * 3);
    this.renderer.flash = Math.max(0, this.renderer.flash - dt);
    if (this.introT > 0) {
      this.introT -= dt;
      inp.take("Space", "KeyC");
      return;
    }

    this.stats.tick(dt);
    world.update(dt, this.heroInput());
    for (const e of world.events.splice(0)) {
      this.stats.record(e.type);
      this.onEvent(e);
    }

    if (world.status === "won") this.onLevelWon(world);
    else if (world.status === "dead") {
      if (this.flow.heroDied() === "gameOver") this.sfx.play("gameOver");
      else this.loadLevel();
    }
  }

  private onLevelWon(world: World): void {
    const index = this.flow.levelIndex;
    this.stats.levelsCleared++;
    this.flow.levelCompleted(world.score);
    if (this.flow.mode === "campaign") {
      const wasCleared = this.progress.cleared;
      this.changeProgress(
        unlockAfter(this.progress, index, this.levels.length),
      );
      // Clearing the game for the first time hands the player the golden robot.
      this.firstClear = !wasCleared && this.progress.cleared;
      if (this.firstClear) this.changeSettings({ golden: true });
    }
    if (this.flow.state === "win") {
      this.endT = 0;
      this.fireworkT = 0;
      this.particles.clear();
    } else {
      this.sfx.play("levelClear");
    }
  }

  // ---- ending: cinematic, results, credits ---------------------------------------

  private updateEnding(dt: number, confirm: boolean): void {
    this.endT += dt;
    this.particles.update(dt);
    const state = this.flow.state;

    if (state === "win" || state === "credits") {
      // Fireworks: constant during the cinematic once the hero has arrived, lighter over the credits.
      this.fireworkT -= dt;
      const active = state === "win" ? this.endT > 3 : this.endT > 0.5;
      if (active && this.fireworkT <= 0) {
        this.fireworkT = state === "win" ? 0.45 : 1.1;
        const colors = [
          ["#ffd23a", "#fff3b0"],
          ["#ff6b6b", "#ffd2d2"],
          ["#5aa9ff", "#d2e8ff"],
          ["#7be88a", "#d8ffe0"],
        ];
        const c = colors[Math.floor(Math.random() * colors.length)];
        this.particles.burst(
          40 + Math.random() * (VIEW_W - 80),
          50 + Math.random() * 90,
          26,
          c,
          90,
          70,
          1.1,
        );
        this.sfx.play("start");
      }
    }

    const done =
      (state === "win" && this.endT >= VICTORY_TIME) ||
      (state === "credits" && this.endT >= CREDITS_DURATION);
    if (confirm || done) {
      this.flow.advanceEnding();
      this.endT = 0;
      this.fireworkT = 0;
      this.particles.clear();
      if (this.flow.state === "title") this.backToTitle();
    }
  }

  private resultsView(): ResultsView {
    const s = this.stats;
    const rank = rankFor(s, this.totalDiamonds);
    return {
      rank,
      note: RANK_NOTE[rank],
      unlocked: this.firstClear,
      lines: [
        ["FINAL SCORE", String(this.flow.score).padStart(6, "0")],
        ["LEVELS CLEARED", `${s.levelsCleared}/${this.levels.length}`],
        ["GOLD COLLECTED", String(s.gold)],
        ["DIAMONDS", `${s.diamonds}/${this.totalDiamonds}`],
        ["DEATHS", String(s.deaths)],
        ["GUARDS TRAPPED", String(s.guardsTrapped)],
        ["TOOLS USED", String(s.toolsUsed)],
        ["TIME", formatTime(s.seconds)],
      ],
    };
  }

  private backToTitle(): void {
    this.flow.toTitle();
    this.input.clearPressed(); // drop stale arrow presses from gameplay
    this.openMain();
  }

  /** Title and ending have their own tracks, a level plays its theme, jingle screens are silent. */
  private updateMusic(): void {
    const s = this.flow.state;
    if (s === "title") this.music.set("title");
    else if (s === "playing") this.music.set(this.world?.level.theme ?? null);
    else if (s === "paused")
      this.music.set(this.world?.level.theme ?? null, true);
    else if (s === "win" || s === "results" || s === "credits")
      this.music.set("victory");
    else this.music.set(null);
  }

  private onEvent(e: GameEvent): void {
    const sfx = EVENT_SFX[e.type];
    if (sfx) this.sfx.play(sfx);
    const px = (e.x + 0.5) * TILE;
    const py = (e.y + 0.5) * TILE;
    const p = this.particles;
    switch (e.type) {
      case "laser":
        p.burst(px, py + TILE, 8, ["#ff2a2a", "#fff"], 50, 0, 0.25);
        break;
      case "pitOpen":
        p.burst(px, py, 12, ["#7b4a24", "#5e3517", "#9a6232"], 60, 200, 0.5);
        this.renderer.shake = 0.15;
        break;
      case "pitRefill":
        p.burst(px, py, 6, ["#7b4a24", "#9a6232"], 30, 150, 0.4);
        break;
      case "gold":
        p.burst(px, py, 10, ["#ffd23a", "#fff6b0"], 50, 40, 0.5);
        break;
      case "diamond":
        p.burst(px, py, 22, ["#7ff0ff", "#ffffff", "#2ab8e0"], 80, 40, 0.7);
        break;
      case "shock":
        p.burst(px, py, 16, ["#fff36b", "#8ff", "#fff"], 80, 0, 0.5);
        break;
      case "emp":
        p.burst(px, py, 30, ["#b05cff", "#e6c2ff"], 140, 0, 0.6);
        break;
      case "smoke":
        p.burst(px, py, 26, ["#dfe4ea", "#c4cbd3", "#9aa7b5"], 70, -20, 1.2);
        break;
      case "glue":
        p.burst(px, py + 8, 14, ["#8bd13a", "#c8f56a"], 45, 120, 0.6);
        break;
      case "cough":
        p.burst(px, py - 6, 5, ["#cfd3d8"], 25, -30, 0.7);
        break;
      case "boom":
        p.burst(
          px,
          py,
          60,
          ["#ff7a1a", "#ffd23a", "#fff3b0", "#ff3a2a"],
          170,
          90,
          0.9,
        );
        p.burst(px, py, 26, ["#3a3a44", "#6a6a7a"], 80, -10, 1.2);
        this.renderer.shake = 0.9;
        this.renderer.flash = 0.3;
        break;
      case "death":
        p.burst(px, py, 30, ["#5aa9ff", "#ffd23f", "#fff"], 90, 160, 0.9);
        this.renderer.shake = 0.6;
        break;
      case "guardDied":
        p.burst(px, py, 18, ["#c0392b", "#ff9a7a", "#ffd23f"], 70, 160, 0.7);
        break;
      case "doorOpen":
        p.burst(px, py, 20, ["#fff1a8", "#ffe066"], 70, -40, 0.8);
        break;
      default:
        break;
    }
  }

  private hud(): HudInfo {
    return {
      score: this.flow.score,
      lives: this.flow.lives,
      levelIndex: this.flow.levelIndex,
      totalLevels: this.flow.mode === "endless" ? 0 : this.levels.length,
    };
  }

  private draw(): void {
    this.canvas.dataset.audio = this.sfx.context?.state ?? "none";
    this.canvas.dataset.state = this.flow.state;
    const r = this.renderer;
    r.goldenHero = this.progress.cleared && this.settings.golden;
    const state = this.flow.state;
    if (state === "win") {
      r.drawVictory(this.endT, this.particles, this.levels.length);
      return;
    }
    if (state === "results") {
      r.drawResults(this.resultsView(), this.endT);
      return;
    }
    if (state === "credits") {
      r.drawCredits(this.endT, this.particles);
      return;
    }
    if (state === "title" || !this.world) {
      if (state === "title" && this.screen === "credits")
        r.drawCredits(this.creditsT, this.particles);
      else r.drawTitle(this.clock, this.titleView());
      return;
    }
    r.drawPlay(this.world, this.hud(), this.particles, this.clock);
    if (state === "paused") {
      if (this.pauseScreen === "credits")
        r.drawCredits(this.creditsT, this.particles);
      else if (this.pauseScreen === "options") {
        r.drawPanel(
          "OPTIONS",
          this.optionItems(),
          this.menu.index,
          "\u2191\u2193 SELECT   \u2190\u2192 ADJUST   ESC BACK",
          this.clock,
        );
      } else {
        r.drawPanel(
          "PAUSED",
          PAUSE_ITEMS,
          this.pauseMenu.index,
          "\u2191\u2193 SELECT   ENTER CONFIRM   ESC RESUME",
          this.clock,
        );
      }
      return;
    }
    if (state === "playing" && this.introT > 0) {
      r.drawIntro(
        this.world.level.name,
        this.flow.levelIndex,
        this.clock,
        this.world.diff.stars,
      );
    } else if (state !== "playing") {
      const extra =
        state === "gameOver" && this.flow.mode === "endless"
          ? `ENDLESS: REACHED LEVEL ${this.flow.levelIndex + 1}`
          : this.settings.sfx
            ? ""
            : "SOUND OFF";
      r.drawBanner(state, this.hud(), extra, this.clock);
    }
  }
}
