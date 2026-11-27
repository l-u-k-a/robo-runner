export const TILE = 20;
export const COLS = 28;
export const ROWS = 16;
export const HUD_H = 24;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE + HUD_H;
export const SIM_DT = 1 / 60;

/** All tunable gameplay numbers. Speeds are in tiles per second, times in seconds. */
export const CFG = {
  heroRun: 4.5,
  heroClimb: 3.6,
  guardRun: 2.95,
  guardClimb: 2.65,
  fall: 8.5,
  zip: 10,
  zipRemountCooldown: 0.5,

  digTime: 0.3,
  pitOpenTime: 5,
  refillTime: 0.6,
  guardEscape: 2,
  heroEscape: 1,
  laserCooldown: 0.7,
  laserCooldownBoots: 0.35,

  guardRespawn: 4,
  heroDeathDelay: 1.2,

  shockStun: 5,
  decoyTime: 6,
  empRadius: 5,
  empStun: 3,
  bootsTime: 8,
  bootsSpeedMul: 1.5,

  /** Smoke bomb: guards cough, the hero cannot be caught for a while. */
  smokeTime: 5,
  smokeRadius: 2.6,
  smokeCough: 3.5,
  smokeInvuln: 4,
  /** Glue puddle: guards crossing it move at this fraction of their speed. */
  glueSlow: 0.35,

  /** Guards beyond the aggro radius stroll their own platform at this fraction of their speed. */
  patrolSpeed: 0.7,
  patrolPause: 0.8,
  /** A chasing guard gives up once the hero is this much farther than the aggro radius. */
  aggroHysteresis: 6,
  /** Bomb: seconds until it blows, and the blast radius in tiles. */
  bombFuse: 2.5,
  bombRadius: 2.3,

  goldScore: 100,
  diamondScore: 500,
  toolScore: 50,
  levelScore: 500,
  startLives: 3,
  maxLives: 5,
  /** A bonus life is awarded every this many cleared levels. */
  extraLifeEvery: 5,
} as const;
