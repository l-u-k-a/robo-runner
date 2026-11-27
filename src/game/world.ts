import { CFG, COLS, ROWS } from "./config";
import { NEUTRAL, type Difficulty } from "./difficulty";
import { nextStep, nextStepToNearest, type GridView } from "./pathfinding";
import {
  newChar,
  stepCharacter,
  type Char,
  type Mode,
  type MoveEnv,
  type MoveInput,
  type Speeds,
} from "./movement";
import {
  isHang,
  type ParsedLevel,
  type Pos,
  type Tile,
  type ToolKind,
} from "./types";

export interface HeroInput {
  dx: number;
  dy: number;
  digLeft: boolean;
  digRight: boolean;
  useTool: boolean;
}

export const NO_INPUT: HeroInput = {
  dx: 0,
  dy: 0,
  digLeft: false,
  digRight: false,
  useTool: false,
};

export type EventType =
  | "laser"
  | "dig"
  | "denied"
  | "pitOpen"
  | "pitRefill"
  | "guardTrapped"
  | "guardDied"
  | "guardRespawn"
  | "gold"
  | "diamond"
  | "tool"
  | "toolUse"
  | "shock"
  | "emp"
  | "smoke"
  | "glue"
  | "bombLit"
  | "boom"
  | "cough"
  | "death"
  | "doorOpen"
  | "win";

export interface GameEvent {
  type: EventType;
  x: number;
  y: number;
}

export interface Pit {
  x: number;
  y: number;
  state: "digging" | "open" | "refilling";
  t: number;
}

export interface Beam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
}

/** What a guard remembers: whether it has noticed the hero, and where its patch of floor is. */
interface GuardBrain {
  alert: boolean;
  /** How long this guard has been waiting behind another one. */
  holdT: number;
  home: Pos;
  dir: 1 | -1;
  wait: number;
}

export type WorldStatus = "playing" | "dying" | "dead" | "won";

const cellKey = (x: number, y: number): number => y * COLS + x;
const near = (a: Pos, b: Pos, r: number): boolean =>
  Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;

export class World implements MoveEnv, GridView {
  readonly level: ParsedLevel;
  readonly tiles: Tile[][];
  pits: Pit[] = [];
  gold = new Set<number>();
  diamonds = new Set<number>();
  diamondsTaken = 0;
  items = new Map<number, ToolKind>();
  hero: Char;
  guards: Char[] = [];
  traps: Pos[] = [];
  smokes: (Pos & { t: number })[] = [];
  bombs: (Pos & { t: number })[] = [];
  /** Cells covered in glue; they stay until the level ends. */
  glue = new Set<number>();
  /** Seconds left in which guards cannot catch the hero (smoke bomb). */
  invulnT = 0;
  decoy: (Pos & { t: number }) | null = null;
  held: ToolKind | null = null;
  bootsT = 0;
  laserCd = 0;
  beam: Beam | null = null;
  doorOpen = false;
  score = 0;
  time = 0;
  status: WorldStatus = "playing";
  deathT = 0;
  events: GameEvent[] = [];
  /** Debug switches (see DebugPanel). Defaults are normal gameplay. */
  debug = { guards: true, invincible: false };

  readonly diff: Difficulty;

  constructor(level: ParsedLevel, diff: Difficulty = NEUTRAL) {
    this.level = level;
    this.diff = diff;
    this.tiles = level.tiles.map((r) => r.slice());
    for (const g of level.gold) this.gold.add(cellKey(g.x, g.y));
    for (const d of level.diamonds) this.diamonds.add(cellKey(d.x, d.y));
    for (const i of level.items) this.items.set(cellKey(i.x, i.y), i.kind);
    this.hero = newChar("hero", level.hero.x, level.hero.y);
    this.guards = level.guards.map((g) => newChar("guard", g.x, g.y));
    this.doorOpen = this.gold.size === 0;
  }

  // ---- grid queries -------------------------------------------------------

  pitAt(x: number, y: number): Pit | undefined {
    return this.pits.find((p) => p.x === x && p.y === y);
  }

  pitOpenAt(x: number, y: number): boolean {
    const p = this.pitAt(x, y);
    return !!p && p.state !== "digging";
  }

  baseTile(x: number, y: number): Tile {
    if (x < 0 || x >= COLS || y >= ROWS) return "stone";
    if (y < 0) return "empty";
    return this.tiles[y][x];
  }

  tileAt(x: number, y: number): Tile {
    const t = this.baseTile(x, y);
    if (t === "ground" && this.pitOpenAt(x, y)) return "empty";
    return t;
  }

  solid(x: number, y: number): boolean {
    const t = this.tileAt(x, y);
    return t === "ground" || t === "stone";
  }

  trappedGuardAt(x: number, y: number): boolean {
    return this.guards.some(
      (g) => g.alive && g.mode === "pit" && g.trapX === x && g.trapY === y,
    );
  }

  supported(x: number, y: number): boolean {
    return (
      this.solid(x, y + 1) ||
      this.tileAt(x, y + 1) === "ladder" ||
      this.trappedGuardAt(x, y + 1)
    );
  }

  /** Grid view for guard path planning: the cell above an open pit looks walkable so guards fall in. */
  private readonly guardView: GridView = {
    tileAt: (x, y) => this.tileAt(x, y),
    solid: (x, y) => this.solid(x, y),
    supported: (x, y) => this.supported(x, y) || this.pitOpenAt(x, y + 1),
  };

  get goldLeft(): number {
    return this.gold.size;
  }

  emit(type: EventType, x: number, y: number): void {
    this.events.push({ type, x, y });
  }

  // ---- main update --------------------------------------------------------

  update(dt: number, inp: HeroInput): void {
    this.dt = dt;
    if (this.status === "dying") {
      this.deathT += dt;
      this.updatePits(dt);
      if (this.deathT >= CFG.heroDeathDelay) this.status = "dead";
      return;
    }
    if (this.status !== "playing") return;

    this.time += dt;
    this.laserCd = Math.max(0, this.laserCd - dt);
    this.bootsT = Math.max(0, this.bootsT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    if (this.beam) {
      this.beam.t -= dt;
      if (this.beam.t <= 0) this.beam = null;
    }
    if (this.decoy) {
      this.decoy.t -= dt;
      if (this.decoy.t <= 0) this.decoy = null;
    }

    this.updatePits(dt);
    this.updateHero(dt, inp);
    this.updateHazards(dt);
    if (this.debug.guards) {
      this.updateGuards(dt);
      this.updateTraps();
    }
    this.collect();
    this.checkHeroHit();
    this.checkExit();
  }

  /** Stunned or coughing guards cannot act and cannot hurt the hero. */
  private disabled(g: Char): boolean {
    return g.stun > 0 || g.cough > 0;
  }

  private heroSpeeds(): Speeds {
    const m = this.bootsT > 0 ? CFG.bootsSpeedMul : 1;
    return {
      run: CFG.heroRun * m,
      climb: CFG.heroClimb * m,
      fall: CFG.fall,
      zip: CFG.zip,
    };
  }

  /** Each guard moves at a slightly different pace so a pack naturally strings out. */
  private static readonly PACE = [1, 0.94, 1.05, 0.9];

  private guardSpeeds(idx: number): Speeds {
    const k = World.PACE[idx % World.PACE.length] * this.diff.guardSpeed;
    return {
      run: CFG.guardRun * k,
      climb: CFG.guardClimb * k,
      fall: CFG.fall,
      zip: CFG.zip,
    };
  }

  /** Cells claimed this tick by guards that already picked their next step. */
  private reserved = new Set<number>();
  private brains: GuardBrain[] = [];
  private dt = 1 / 60;

  // ---- hero ---------------------------------------------------------------

  private updateHero(dt: number, inp: HeroInput): void {
    const h = this.hero;
    if (h.mode === "pit") {
      h.trapT += dt;
      h.pose = "pit";
      if (h.trapT >= CFG.heroEscape && (inp.dx !== 0 || inp.dy < 0)) {
        this.climbOut(h, inp.dx !== 0 ? Math.sign(inp.dx) : h.facing);
      }
      return;
    }
    if (inp.digLeft) this.tryDig(-1);
    else if (inp.digRight) this.tryDig(1);
    if (inp.useTool) this.useTool();
    stepCharacter(this, h, inp, dt, this.heroSpeeds(), true);
  }

  /**
   * Fires the laser down-left or down-right at the first floor cell completely clear of the hero's
   * body. The hero is a full tile wide, so when he stands between two cells his body covers both;
   * the shot then goes one cell farther, and it can never open a pit under his own feet.
   */
  private tryDig(dir: -1 | 1): void {
    const h = this.hero;
    if (this.laserCd > 0) return;
    const row = Math.round(h.y);
    const cx = Math.round(h.x);
    const here = this.tileAt(cx, row);
    const ok =
      h.mode === "ground" &&
      Math.abs(h.y - row) < 1e-3 &&
      !isHang(here) &&
      this.supported(cx, row);
    // Columns the hero's body overlaps (a small tolerance keeps exact alignment on one column).
    const left = Math.floor(h.x + 1e-3);
    const right = Math.floor(h.x + 1 - 1e-3);
    const tx = dir > 0 ? right + 1 : left - 1;
    h.facing = dir;
    if (
      !ok ||
      this.baseTile(tx, row + 1) !== "ground" ||
      this.tileAt(tx, row) !== "empty" ||
      this.pitAt(tx, row + 1)
    ) {
      this.laserCd = 0.15;
      this.emit("denied", cx, row);
      return;
    }
    this.pits.push({ x: tx, y: row + 1, state: "digging", t: 0 });
    this.laserCd = this.bootsT > 0 ? CFG.laserCooldownBoots : CFG.laserCooldown;
    this.beam = {
      x0: h.x + 0.5 + dir * 0.4,
      y0: row + 0.5,
      x1: tx + 0.5,
      y1: row + 1.5,
      t: 0.18,
    };
    this.emit("laser", cx, row);
  }

  private useTool(): void {
    const h = this.hero;
    if (!this.held) return;
    const cx = Math.round(h.x);
    const row = Math.round(h.y);
    switch (this.held) {
      case "shock":
        if (h.mode !== "ground") return;
        this.traps.push({ x: cx, y: row });
        break;
      case "decoy":
        if (h.mode !== "ground") return;
        this.decoy = { x: cx, y: row, t: CFG.decoyTime };
        break;
      case "emp":
        for (const g of this.guards) {
          if (g.alive && Math.hypot(g.x - h.x, g.y - h.y) <= CFG.empRadius) {
            g.stun = Math.max(g.stun, CFG.empStun);
          }
        }
        this.emit("emp", cx, row);
        break;
      case "boots":
        this.bootsT = CFG.bootsTime;
        break;
      case "smoke":
        this.smokes.push({ x: cx, y: row, t: CFG.smokeTime });
        this.invulnT = CFG.smokeInvuln;
        for (const g of this.guards) {
          if (
            g.alive &&
            Math.hypot(g.x - h.x, g.y - h.y) <= CFG.smokeRadius * 1.8
          )
            this.startCough(g, CFG.smokeCough);
        }
        this.emit("smoke", cx, row);
        break;
      case "glue":
        if (h.mode !== "ground") return;
        for (const dx of [-1, 0, 1]) {
          if (this.supported(cx + dx, row) && !this.solid(cx + dx, row))
            this.glue.add(cellKey(cx + dx, row));
        }
        this.emit("glue", cx, row);
        break;
      case "bomb":
        if (h.mode !== "ground") return;
        this.bombs.push({ x: cx, y: row, t: CFG.bombFuse });
        this.emit("bombLit", cx, row);
        break;
    }
    this.emit("toolUse", cx, row);
    this.held = null;
  }

  /** Debug invincibility: lift a buried hero out of the closed pit instead of killing him. */
  private unbury(h: Char, p: Pos): void {
    if (h.mode === "pit" || h.mode === "fall") {
      h.trapX = p.x;
      h.trapY = p.y;
      if (this.climbOut(h, h.facing)) return;
    }
    h.x = p.x;
    h.y = p.y - 1;
    h.mode = "ground";
  }

  isGlued(g: Char): boolean {
    return (
      g.mode === "ground" &&
      this.glue.has(cellKey(Math.round(g.x), Math.round(g.y)))
    );
  }

  private startCough(g: Char, seconds: number): void {
    if (g.cough <= 0) this.emit("cough", g.x, g.y);
    g.cough = Math.max(g.cough, seconds);
  }

  /** Smoke clouds keep guards coughing; bombs count down and explode. */
  private updateHazards(dt: number): void {
    for (const s of this.smokes) {
      s.t -= dt;
      for (const g of this.guards) {
        if (g.alive && Math.hypot(g.x - s.x, g.y - s.y) <= CFG.smokeRadius)
          this.startCough(g, 0.6);
      }
    }
    this.smokes = this.smokes.filter((s) => s.t > 0);

    for (const b of this.bombs) b.t -= dt;
    const blown = this.bombs.filter((b) => b.t <= 0);
    if (blown.length) {
      this.bombs = this.bombs.filter((b) => b.t > 0);
      for (const b of blown) this.explode(b);
    }
  }

  /** Kills everything in the radius and blasts the diggable ground into pits that heal back. */
  private explode(b: Pos): void {
    this.emit("boom", b.x, b.y);
    const R = CFG.bombRadius;
    const dist = (c: Char): number => Math.hypot(c.x - b.x, c.y - b.y);
    if (this.hero.alive && dist(this.hero) <= R) this.killHero();
    for (const g of this.guards) {
      if (g.alive && dist(g) <= R) this.killGuard(g);
    }
    for (let y = Math.ceil(b.y - R); y <= Math.floor(b.y + R); y++) {
      for (let x = Math.ceil(b.x - R); x <= Math.floor(b.x + R); x++) {
        if (Math.hypot(x - b.x, y - b.y) > R) continue;
        if (this.baseTile(x, y) !== "ground" || this.pitAt(x, y)) continue;
        this.pits.push({ x, y, state: "open", t: 0 });
      }
    }
  }

  private killHero(buriedIn?: Pos): void {
    if (this.status !== "playing") return;
    if (this.debug.invincible) {
      // Never leave an invincible hero stuck inside a refilled pit.
      if (buriedIn) this.unbury(this.hero, buriedIn);
      return;
    }
    this.status = "dying";
    this.hero.alive = false;
    this.deathT = 0;
    this.emit("death", this.hero.x, this.hero.y);
  }

  // ---- pits ---------------------------------------------------------------

  private updatePits(dt: number): void {
    for (const p of this.pits) {
      p.t += dt;
      if (p.state === "digging" && p.t >= CFG.digTime) {
        p.state = "open";
        p.t = 0;
        this.emit("pitOpen", p.x, p.y);
      } else if (p.state === "open" && p.t >= this.diff.pitOpen) {
        p.state = "refilling";
        p.t = 0;
        this.emit("pitRefill", p.x, p.y);
      }
    }
    const done = this.pits.filter(
      (p) => p.state === "refilling" && p.t >= CFG.refillTime,
    );
    if (done.length === 0) return;
    this.pits = this.pits.filter((p) => !done.includes(p));
    for (const p of done) this.bury(p);
  }

  /** The pit closed: anything still inside it dies. */
  /**
   * The pit closed: anything still in it dies. "In it" means any overlap with the pit's cell, so a
   * character who was only part-way into a refilling pit is buried too (otherwise he would finish
   * his fall inside the solid floor). Standing on the floor above it, or on a trapped guard's head,
   * is a full tile up and is safe.
   */
  private bury(p: Pit): void {
    const inside = (c: Char): boolean =>
      c.alive &&
      ((c.mode === "pit" && c.trapX === p.x && c.trapY === p.y) ||
        (Math.abs(c.x - p.x) < 1 - 1e-3 && Math.abs(c.y - p.y) < 1 - 1e-3));
    if (inside(this.hero)) this.killHero(p);
    for (const g of this.guards) {
      if (inside(g)) this.killGuard(g);
    }
  }

  private killGuard(g: Char): void {
    g.alive = false;
    g.respawnT = this.diff.guardRespawn;
    g.mode = "ground";
    g.stun = 0;
    this.emit("guardDied", g.x, g.y);
  }

  private climbOut(c: Char, pref: number): boolean {
    for (const s of [pref >= 0 ? 1 : -1, pref >= 0 ? -1 : 1]) {
      const nx = c.trapX + s;
      const ny = c.trapY - 1;
      if (!this.solid(nx, ny) && this.tileAt(nx, ny) !== "ladder") {
        c.x = nx;
        c.y = ny;
        c.mode = "ground";
        c.trapT = 0;
        c.facing = s as 1 | -1;
        return true;
      }
    }
    return false;
  }

  // ---- guards -------------------------------------------------------------

  private updateGuards(dt: number): void {
    const h = this.hero;
    this.reserved.clear();
    for (const [idx, g] of this.guards.entries()) {
      if (!g.alive) {
        g.respawnT -= dt;
        if (g.respawnT <= 0) this.respawnGuard(g);
        continue;
      }
      if (g.stun > 0) g.stun = Math.max(0, g.stun - dt);
      if (g.cough > 0) g.cough = Math.max(0, g.cough - dt);

      if (g.mode === "pit") {
        g.pose = "pit";
        if (!this.disabled(g)) {
          const pinned =
            h.alive &&
            h.mode === "ground" &&
            Math.abs(h.x - g.trapX) < 0.6 &&
            Math.abs(h.y - (g.trapY - 1)) < 0.1;
          if (!pinned) g.trapT += dt;
          if (g.trapT >= this.diff.guardEscape)
            this.climbOut(g, Math.sign(h.x - g.x));
        }
        continue;
      }
      const brain = this.brainFor(idx, g);
      this.updateAwareness(g, brain);
      const inp: MoveInput =
        !this.disabled(g) && h.alive
          ? this.guardInput(g, idx)
          : { dx: 0, dy: 0 };
      let sp = this.guardSpeeds(idx);
      if (!brain.alert && !this.decoyVisible(g)) {
        sp = { ...sp, run: sp.run * CFG.patrolSpeed, climb: sp.climb * CFG.patrolSpeed };
      }
      if (this.isGlued(g))
        sp = {
          ...sp,
          run: sp.run * CFG.glueSlow,
          climb: sp.climb * CFG.glueSlow,
        };
      stepCharacter(this, g, inp, dt, sp, false);
      if ((g.mode as Mode) === "pit") this.emit("guardTrapped", g.x, g.y);
      if (this.disabled(g) && g.mode === "ground") g.pose = "idle";
    }
  }

  private brainFor(idx: number, g: Char): GuardBrain {
    let b = this.brains[idx];
    if (!b) {
      b = { alert: false, holdT: 0, home: { x: Math.round(g.x), y: Math.round(g.y) }, dir: 1, wait: 0 };
      this.brains[idx] = b;
    }
    return b;
  }

  /**
   * When does a guard go after the hero? Any one of these is enough:
   *  - He is on a higher floor than the guard is on right now. Then the guard chases wherever he
   *    is (see `climbInput`: first up to his floor, then along it), so nobody stays stranded below.
   *  - A guard that has already climbed above its post keeps hunting on that floor until he drops
   *    below it.
   *  - He is very close (`CFG.closeChase`, about a floor and a half): chase on any floor.
   *  - He is within `diff.aggro` (a column counts 1, a floor counts 3) and not below its post.
   * Once chasing, a guard keeps going a little beyond the limits (hysteresis). Otherwise it
   * patrols its own floor, so the hero cannot drag the guards downstairs.
   */
  private updateAwareness(g: Char, b: GuardBrain): void {
    const h = this.hero;
    if (!h.alive) {
      b.alert = false;
      return;
    }
    const heroRow = Math.round(h.y);
    const curRow = this.floorRow(g);
    const below = heroRow > b.home.y;
    const above = heroRow <= curRow - 2;
    const elevated = curRow < b.home.y - 1;
    const near = Math.hypot(g.x - h.x, g.y - h.y);
    const d = Math.abs(g.x - h.x) + 3 * Math.abs(g.y - h.y);

    b.alert =
      above ||
      (b.alert
        ? near <= CFG.closeChase + CFG.closeChaseHysteresis ||
          (elevated && heroRow <= curRow + 1) ||
          (!below && d <= this.diff.aggro + CFG.aggroHysteresis)
        : near <= CFG.closeChase || (!below && d <= this.diff.aggro));
  }

  /**
   * The floor row a character counts as being on: its own row when standing, the row below its feet
   * while it is part-way up a ladder. (Rounding instead flips half-way up a rung.)
   */
  private floorRow(c: Char): number {
    return Math.ceil(c.y - 1e-4);
  }

  private decoyVisible(g: Char): boolean {
    const d = this.decoy;
    return !!d && this.lineOfSight(Math.round(g.x), Math.round(g.y), d.x, d.y);
  }

  /** The stretch of floor a guard sweeps: standable cells on its home row, up to the next wall or gap. */
  patrolRange(home: Pos): { y: number; x0: number; x1: number } {
    const y = home.y;
    let x0 = home.x;
    let x1 = home.x;
    while (x0 - 1 >= 0 && this.standable(x0 - 1, y)) x0--;
    while (x1 + 1 < COLS && this.standable(x1 + 1, y)) x1++;
    return { y, x0, x1 };
  }

  /** A cell a guard could actually stand in. */
  private standable(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS || this.solid(x, y))
      return false;
    const t = this.tileAt(x, y);
    return t === "ladder" || isHang(t) || this.supported(x, y);
  }

  /**
   * Each guard has a role so they do not all pile onto the same path:
   *  0 chaser   goes straight for the hero
   *  1 ambusher heads for where the hero is running to
   *  2 flanker  comes from the side opposite to the chaser
   *  3 warden   guards the open exit door
   * Once a guard is close it always switches to a direct attack.
   */
  private guardTarget(g: Char, idx: number): Pos {
    const d = this.decoy;
    if (d && this.lineOfSight(Math.round(g.x), Math.round(g.y), d.x, d.y))
      return d;
    const h = this.hero;
    const hc = { x: Math.round(h.x), y: Math.round(h.y) };
    if (Math.hypot(g.x - h.x, g.y - h.y) <= 4) return hc;
    switch (idx % 4) {
      case 1: {
        const ahead = {
          x: Math.max(0, Math.min(COLS - 1, hc.x + h.facing * 5)),
          y: hc.y,
        };
        return this.standable(ahead.x, ahead.y) ? ahead : hc;
      }
      case 2: {
        const lead = this.guards.find(
          (q, i) => i !== idx && q.alive && q.mode !== "pit",
        );
        const side = lead ? Math.sign(h.x - lead.x) || 1 : 1;
        const flank = {
          x: Math.max(0, Math.min(COLS - 1, hc.x + side * 4)),
          y: hc.y,
        };
        return this.standable(flank.x, flank.y) ? flank : hc;
      }
      case 3:
        return this.doorOpen ? this.level.exit : hc;
      default:
        return hc;
    }
  }

  private lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 1; i < n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (this.solid(x, y)) return false;
    }
    return true;
  }

  private guardInput(g: Char, idx: number): MoveInput {
    if (g.mode !== "ground") return { dx: 0, dy: 0 };
    const brain = this.brainFor(idx, g);
    const hc = { x: Math.round(this.hero.x), y: Math.round(this.hero.y) };
    if (brain.alert || this.decoyVisible(g)) {
      const cur = { x: Math.round(g.x), y: Math.round(g.y) };
      if (!this.decoyVisible(g) && hc.y <= this.floorRow(g) - 2) {
        // The hero is on a higher floor: first get up there, then close in horizontally.
        return this.climbInput(g, idx, cur) ?? this.patrolInput(g, idx, brain);
      }
      return this.pathInput(g, idx, this.guardTarget(g, idx), hc, true);
    }
    return this.patrolInput(g, idx, brain);
  }

  /**
   * The hero is on a higher floor: head for the nearest cell on his floor (or above it). BFS takes the
   * shortest way there, so the guard climbs the closest ladder first and then runs along his floor;
   * a level whose only way up goes down and around first works too. The goal is fixed by the hero's
   * floor, not by the guard's position, so the guard cannot loop between two floors. Returns null when
   * the hero's floor cannot be reached from here.
   */
  private climbInput(g: Char, idx: number, cur: Pos): MoveInput | null {
    const heroFloor = this.floorRow(this.hero);
    const target = (x: number, y: number): boolean =>
      y <= heroFloor && this.tileAt(x, y) !== "ladder" && this.standable(x, y);
    if (!nextStepToNearest(this.guardView, cur, target)) return null;
    return this.pathInput(g, idx, cur, cur, true, target);
  }

  /** Walks the guard's own platform from end to end, pausing at each end. */
  private patrolInput(g: Char, idx: number, b: GuardBrain): MoveInput {
    const cur = { x: Math.round(g.x), y: Math.round(g.y) };
    const seg = this.patrolRange(b.home);
    const onPatch = cur.y === b.home.y && cur.x >= seg.x0 && cur.x <= seg.x1;
    let target: Pos = b.home;
    if (onPatch) {
      if (b.wait > 0) {
        b.wait -= this.dt;
        return { dx: 0, dy: 0 };
      }
      const goal = b.dir > 0 ? seg.x1 : seg.x0;
      if (Math.abs(g.x - goal) < 0.12) {
        b.dir = b.dir > 0 ? -1 : 1;
        b.wait = CFG.patrolPause;
        return { dx: 0, dy: 0 };
      }
      target = { x: goal, y: b.home.y };
    }
    return this.pathInput(g, idx, target, target, false);
  }

  /** Turns "go to this cell" into a move, using BFS around the other guards when `avoidOthers`. */
  private pathInput(
    g: Char,
    idx: number,
    target: Pos,
    hc: Pos,
    avoidOthers: boolean,
    goal?: (x: number, y: number) => boolean,
  ): MoveInput {
    const cur = { x: Math.round(g.x), y: Math.round(g.y) };

    // Keep clear of the other guards' cells (and the steps they just claimed) so the pack spreads out.
    // Stunned guards do not block anyone.
    const blocked = new Set<number>(avoidOthers ? this.reserved : []);
    if (avoidOthers) {
      for (const [i, q] of this.guards.entries()) {
        if (i !== idx && q.alive && q.mode !== "pit" && !this.disabled(q)) {
          blocked.add(cellKey(Math.round(q.x), Math.round(q.y)));
        }
      }
    }
    blocked.delete(cellKey(cur.x, cur.y));

    const find = (blk?: ReadonlySet<number>): Pos | null =>
      goal ? nextStepToNearest(this.guardView, cur, goal, {}, blk) : nextStep(this.guardView, cur, target, {}, blk);
    let step = find(blocked);
    let hold = false;
    if (step && avoidOthers && step.y > cur.y) {
      // The way around the other guards goes back down. If the direct route does not, wait in line
      // instead (patience below); otherwise a guard just below the hero's floor yo-yos on its ladder.
      const direct = goal ? find() : nextStep(this.guardView, cur, target);
      if (direct && direct.y <= cur.y) step = null;
    }
    if (!step) {
      // No route around the others: take the shortest one, but queue up instead of overlapping.
      const free = goal
        ? find()
        : (nextStep(this.guardView, cur, target) ??
          (target !== hc ? nextStep(this.guardView, cur, hc) : null));
      if (free && blocked.has(cellKey(free.x, free.y))) {
        // Queue behind the other guard, but not for ever: an idle guard on a ladder must not jam the rest.
        const brain = this.brainFor(idx, g);
        brain.holdT += this.dt;
        if (brain.holdT > CFG.holdPatience) step = free;
        else hold = true;
      } else step = free;
    }
    if (step && !hold && avoidOthers && !blocked.has(cellKey(step.x, step.y))) this.brainFor(idx, g).holdT = 0;
    if (step && avoidOthers) this.reserved.add(cellKey(step.x, step.y));

    let dx = 0;
    let dy = 0;
    if (step) {
      dx = Math.sign(step.x - cur.x);
      dy = Math.sign(step.y - cur.y);
    } else if (!hold && cur.y === hc.y) {
      dx = Math.sign(hc.x - g.x);
    }
    // Finish the current ladder rung before stepping sideways.
    const off = Math.round(g.y) - g.y;
    if (dy === 0 && dx !== 0 && Math.abs(off) > 1e-4) dy = Math.sign(off);
    return { dx, dy };
  }

  private respawnGuard(g: Char): void {
    const h = this.hero;
    const spawns = this.level.guards
      .filter((s) => Math.hypot(s.x - h.x, s.y - h.y) > 4)
      .sort(
        (a, b) =>
          Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y),
      );
    if (spawns.length === 0) {
      g.respawnT = 1;
      return;
    }
    const s = spawns[0];
    Object.assign(g, newChar("guard", s.x, s.y));
    this.brains[this.guards.indexOf(g)] = { alert: false, holdT: 0, home: { x: s.x, y: s.y }, dir: 1, wait: 0 };
    this.emit("guardRespawn", s.x, s.y);
  }

  // ---- traps, pickups, collisions ----------------------------------------

  private updateTraps(): void {
    for (const t of [...this.traps]) {
      const g = this.guards.find(
        (q) => q.alive && q.mode !== "pit" && near(q, t, 0.6),
      );
      if (g) {
        g.stun = CFG.shockStun;
        this.traps = this.traps.filter((x) => x !== t);
        this.emit("shock", t.x, t.y);
      }
    }
  }

  private collect(): void {
    const h = this.hero;
    const cx = Math.round(h.x);
    const cy = Math.round(h.y);
    if (Math.abs(h.x - cx) > 0.6 || Math.abs(h.y - cy) > 0.6) return;
    const k = cellKey(cx, cy);
    if (this.gold.delete(k)) {
      this.score += CFG.goldScore;
      this.emit("gold", cx, cy);
      if (this.gold.size === 0 && !this.doorOpen) {
        this.doorOpen = true;
        this.emit("doorOpen", this.level.exit.x, this.level.exit.y);
      }
    }
    if (this.diamonds.delete(k)) {
      this.diamondsTaken++;
      this.score += CFG.diamondScore;
      this.emit("diamond", cx, cy);
    }
    const item = this.items.get(k);
    if (item && !this.held) {
      this.held = item;
      this.items.delete(k);
      this.score += CFG.toolScore;
      this.emit("tool", cx, cy);
    }
  }

  /** Debug helper: grab every coin and open the exit door. */
  debugCollectAll(): void {
    this.gold.clear();
    if (!this.doorOpen) {
      this.doorOpen = true;
      this.emit("doorOpen", this.level.exit.x, this.level.exit.y);
    }
  }

  private checkHeroHit(): void {
    if (!this.debug.guards || this.invulnT > 0) return;
    const h = this.hero;
    for (const g of this.guards) {
      if (g.alive && g.mode !== "pit" && !this.disabled(g) && near(g, h, 0.6)) {
        this.killHero();
        return;
      }
    }
  }

  private checkExit(): void {
    if (
      this.status === "playing" &&
      this.doorOpen &&
      near(this.hero, this.level.exit, 0.6)
    ) {
      this.status = "won";
      this.emit("win", this.level.exit.x, this.level.exit.y);
    }
  }
}
