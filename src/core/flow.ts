import { CFG } from "../game/config";

export type FlowState =
  | "title"
  | "playing"
  | "paused"
  | "levelClear"
  | "gameOver"
  | "win" // victory cinematic after the last campaign level
  | "results"
  | "credits";

export type GameMode = "campaign" | "endless";

/** Pure scene/lives/score state machine, independent of rendering. */
export class GameFlow {
  state: FlowState = "title";
  mode: GameMode = "campaign";
  lives: number = CFG.startLives;
  levelIndex = 0;
  score = 0;

  constructor(readonly totalLevels: number) {}

  /** Begins a run. Campaign runs may start from any unlocked level. */
  start(mode: GameMode = "campaign", startIndex = 0): void {
    this.state = "playing";
    this.mode = mode;
    this.lives = CFG.startLives;
    this.levelIndex = mode === "endless" ? this.totalLevels : startIndex;
    this.score = 0;
  }

  togglePause(): void {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
  }

  /** Returns 'retry' (restart same level) or 'gameOver'. */
  heroDied(): "retry" | "gameOver" {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = "gameOver";
      return "gameOver";
    }
    return "retry";
  }

  levelCompleted(levelScore: number): void {
    this.score += levelScore + CFG.levelScore;
    if ((this.levelIndex + 1) % CFG.extraLifeEvery === 0) {
      this.lives = Math.min(CFG.maxLives, this.lives + 1);
    }
    const last =
      this.mode === "campaign" && this.levelIndex >= this.totalLevels - 1;
    this.state = last ? "win" : "levelClear";
  }

  nextLevel(): void {
    if (this.state !== "levelClear") return;
    this.levelIndex++;
    this.state = "playing";
  }

  /** Steps through the ending: cinematic, results, credits, title. */
  advanceEnding(): void {
    if (this.state === "win") this.state = "results";
    else if (this.state === "results") this.state = "credits";
    else if (this.state === "credits") this.state = "title";
  }

  toTitle(): void {
    this.state = "title";
  }
}
