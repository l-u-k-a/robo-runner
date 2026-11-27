import { isHang, isZip, type Tile } from "./types";

export type Mode = "ground" | "fall" | "zip" | "pit";
export type Pose = "idle" | "run" | "climb" | "hang" | "fall" | "zip" | "pit";

export interface Char {
  kind: "hero" | "guard";
  x: number;
  y: number;
  mode: Mode;
  pose: Pose;
  facing: 1 | -1;
  animT: number;
  stun: number;
  /** Coughing from smoke: like a stun, but shown differently. */
  cough: number;
  trapT: number;
  trapX: number;
  trapY: number;
  zipDir: 1 | -1;
  zipCd: number;
  alive: boolean;
  respawnT: number;
}

export interface MoveInput {
  dx: number;
  dy: number;
}

export interface Speeds {
  run: number;
  climb: number;
  fall: number;
  zip: number;
}

export interface MoveEnv {
  tileAt(x: number, y: number): Tile;
  solid(x: number, y: number): boolean;
  supported(x: number, y: number): boolean;
  pitOpenAt(x: number, y: number): boolean;
}

const EPS = 1e-4;

export function newChar(kind: "hero" | "guard", x: number, y: number): Char {
  return {
    kind,
    x,
    y,
    mode: "ground",
    pose: "idle",
    facing: 1,
    animT: 0,
    stun: 0,
    cough: 0,
    trapT: 0,
    trapX: 0,
    trapY: 0,
    zipDir: 1,
    zipCd: 0,
    alive: true,
    respawnT: 0,
  };
}

/** Advances one character by dt using Lode Runner style tile rules. */
export function stepCharacter(
  env: MoveEnv,
  c: Char,
  inp: MoveInput,
  dt: number,
  sp: Speeds,
  canZip: boolean,
): void {
  if (c.zipCd > 0) c.zipCd -= dt;
  if (c.mode === "pit") {
    c.pose = "pit";
    return;
  }
  if (c.mode === "fall") return doFall(env, c, dt, sp);
  if (c.mode === "zip") return doZip(env, c, inp, dt, sp);
  groundStep(env, c, inp, dt, sp, canZip);
}

function groundStep(
  env: MoveEnv,
  c: Char,
  inp: MoveInput,
  dt: number,
  sp: Speeds,
  canZip: boolean,
): void {
  const row0 = Math.round(c.y);
  let aligned = Math.abs(c.y - row0) < EPS;
  const cx = Math.round(c.x);

  if (aligned) {
    c.y = row0;
    const here = env.tileAt(cx, row0);
    if (canZip && c.zipCd <= 0 && isZip(here)) {
      c.mode = "zip";
      c.zipDir = here === "zipR" ? 1 : -1;
      return doZip(env, c, inp, dt, sp);
    }
    // Guards are always held by an open pit (even in a one-tile floor); the hero only if there is
    // solid ground under it, so he can drop through his own pits to the level below.
    if (
      env.pitOpenAt(cx, row0) &&
      (c.kind === "guard" || env.supported(cx, row0))
    ) {
      c.mode = "pit";
      c.x = cx;
      c.trapX = cx;
      c.trapY = row0;
      c.trapT = 0;
      c.pose = "pit";
      return;
    }
    if (!isHang(here) && here !== "ladder" && !env.supported(cx, row0)) {
      c.mode = "fall";
      return doFall(env, c, dt, sp);
    }
  }

  let moved = false;
  let climbed = false;

  if (inp.dy < 0) {
    const r = Math.ceil(c.y - EPS);
    if (env.tileAt(cx, r) === "ladder") {
      if (alignX(c, cx, sp.run * dt)) {
        const limit = env.solid(cx, r - 1) ? r : r - 1;
        c.y = Math.max(limit, c.y - sp.climb * dt);
        moved = climbed = true;
      }
    }
  } else if (inp.dy > 0) {
    const r = Math.floor(c.y + EPS);
    if (env.tileAt(cx, r) === "ladder" || env.tileAt(cx, r + 1) === "ladder") {
      if (alignX(c, cx, sp.run * dt)) {
        const limit = env.solid(cx, r + 1) ? r : r + 1;
        c.y = Math.min(limit, c.y + sp.climb * dt);
        moved = climbed = true;
      }
    } else if (aligned && isHang(env.tileAt(cx, row0))) {
      c.mode = "fall";
      return doFall(env, c, dt, sp);
    }
  }

  if (inp.dx !== 0 && !climbed) {
    let ok = aligned;
    if (!ok && Math.abs(c.y - Math.round(c.y)) < 0.3) {
      c.y = Math.round(c.y);
      aligned = ok = true;
    }
    if (ok) {
      const row = Math.round(c.y);
      c.facing = inp.dx > 0 ? 1 : -1;
      let nx = c.x + c.facing * sp.run * dt;
      if (c.facing > 0) {
        const col = Math.floor(nx + 1 - 1e-6);
        if (env.solid(col, row)) nx = col - 1;
      } else {
        const col = Math.floor(nx);
        if (env.solid(col, row)) nx = col + 1;
      }
      if (Math.abs(nx - c.x) > 1e-9) moved = true;
      c.x = nx;
    }
  }

  // Pose
  const frac = Math.abs(c.y - Math.round(c.y)) >= EPS;
  const here = env.tileAt(Math.round(c.x), Math.round(c.y));
  if (frac || here === "ladder") c.pose = "climb";
  else if (isHang(here)) c.pose = "hang";
  else c.pose = moved ? "run" : "idle";
  if (moved) c.animT += dt;
}

/** Slides x toward the column centre; returns true when close enough to climb. */
function alignX(c: Char, cx: number, maxMove: number): boolean {
  const d = cx - c.x;
  if (Math.abs(d) <= 0.25) {
    c.x = cx;
    return true;
  }
  c.x += Math.sign(d) * Math.min(Math.abs(d), maxMove);
  return false;
}

function stopsFall(env: MoveEnv, c: Char, x: number, k: number): boolean {
  if (c.kind === "guard" && env.pitOpenAt(x, k)) return true;
  const t = env.tileAt(x, k);
  if (t === "ladder" || isHang(t)) return true;
  return env.supported(x, k);
}

function doFall(env: MoveEnv, c: Char, dt: number, sp: Speeds): void {
  c.pose = "fall";
  const cx = Math.round(c.x);
  const d = cx - c.x;
  c.x += Math.sign(d) * Math.min(Math.abs(d), 30 * dt);
  const prev = c.y;
  const ny = prev + sp.fall * dt;
  for (let k = Math.floor(prev + EPS) + 1; k <= ny; k++) {
    if (stopsFall(env, c, cx, k)) {
      c.y = k;
      c.mode = "ground";
      return;
    }
  }
  c.y = ny;
}

function doZip(
  env: MoveEnv,
  c: Char,
  inp: MoveInput,
  dt: number,
  sp: Speeds,
): void {
  c.pose = "zip";
  const row = Math.round(c.y);
  c.y = row;
  if (inp.dy > 0) {
    c.mode = "fall";
    c.zipCd = 0.5;
    return doFall(env, c, dt, sp);
  }
  let nx = c.x + c.zipDir * sp.zip * dt;
  let blocked = false;
  if (c.zipDir > 0) {
    const col = Math.floor(nx + 1 - 1e-6);
    if (env.solid(col, row)) {
      nx = col - 1;
      blocked = true;
    }
  } else {
    const col = Math.floor(nx);
    if (env.solid(col, row)) {
      nx = col + 1;
      blocked = true;
    }
  }
  c.x = nx;
  c.facing = c.zipDir;
  c.animT += dt;
  if (blocked || !isZip(env.tileAt(Math.round(c.x), row))) {
    c.mode = "ground";
    c.zipCd = 0.5;
  }
}
