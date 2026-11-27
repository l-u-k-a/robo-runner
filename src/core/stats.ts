import type { EventType } from "../game/world";

export type Rank = "S" | "A" | "B" | "C";

/** Numbers collected over one full run, shown on the results screen. Never stored. */
export class RunStats {
  deaths = 0;
  gold = 0;
  diamonds = 0;
  guardsTrapped = 0;
  toolsUsed = 0;
  seconds = 0;
  levelsCleared = 0;

  reset(): void {
    this.deaths = 0;
    this.gold = 0;
    this.diamonds = 0;
    this.guardsTrapped = 0;
    this.toolsUsed = 0;
    this.seconds = 0;
    this.levelsCleared = 0;
  }

  tick(dt: number): void {
    this.seconds += dt;
  }

  record(type: EventType): void {
    switch (type) {
      case "gold":
        this.gold++;
        break;
      case "diamond":
        this.diamonds++;
        break;
      case "guardTrapped":
        this.guardsTrapped++;
        break;
      case "toolUse":
        this.toolsUsed++;
        break;
      case "death":
        this.deaths++;
        break;
      default:
        break;
    }
  }
}

/** S = near-flawless and thorough, down to C = survived. */
export function rankFor(
  s: Pick<RunStats, "deaths" | "diamonds">,
  totalDiamonds: number,
): Rank {
  const found = totalDiamonds > 0 ? s.diamonds / totalDiamonds : 1;
  if (s.deaths <= 1 && found >= 0.8) return "S";
  if (s.deaths <= 4 && found >= 0.5) return "A";
  if (s.deaths <= 10) return "B";
  return "C";
}

export const RANK_NOTE: Record<Rank, string> = {
  S: "FLAWLESS. THE VAULT IS YOURS.",
  A: "EXCELLENT RUN.",
  B: "WELL DONE, RUNNER.",
  C: "YOU MADE IT OUT ALIVE.",
};

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
