export type SfxName =
  | "laser"
  | "dig"
  | "denied"
  | "pitRefill"
  | "guardTrapped"
  | "guardDied"
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
  | "levelClear"
  | "gameOver"
  | "menu"
  | "start";

/** Tiny synthesizer: all sound effects are generated, no audio files. */
export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** True once the browser lets us make sound (after autoplay was allowed or a user gesture). */
  get running(): boolean {
    return this.ctx?.state === "running";
  }

  /** Browsers only allow audio after a user gesture; call from a key handler. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended")
      this.ctx.resume().catch(() => undefined);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined)
      o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case "laser":
        this.tone(1100, 0.16, "sawtooth", 0.08, 180);
        break;
      case "dig":
        this.noise(0.25, 0.25, 900);
        this.tone(90, 0.2, "square", 0.1, 50);
        break;
      case "denied":
        this.tone(140, 0.1, "square", 0.07, 100);
        break;
      case "pitRefill":
        this.noise(0.3, 0.12, 500);
        break;
      case "guardTrapped":
        this.tone(500, 0.25, "square", 0.08, 120);
        break;
      case "guardDied":
        this.noise(0.25, 0.2, 1200);
        this.tone(220, 0.3, "sawtooth", 0.08, 50);
        break;
      case "gold":
        this.tone(880, 0.07, "square", 0.07);
        this.tone(1320, 0.1, "square", 0.07, undefined, 0.07);
        break;
      case "diamond":
        [1046, 1318, 1568, 2093].forEach((f, i) =>
          this.tone(f, 0.12, "triangle", 0.09, undefined, i * 0.06),
        );
        break;
      case "tool":
        [523, 659, 784].forEach((f, i) =>
          this.tone(f, 0.08, "triangle", 0.1, undefined, i * 0.06),
        );
        break;
      case "toolUse":
        this.tone(400, 0.12, "triangle", 0.1, 800);
        break;
      case "shock":
        this.noise(0.5, 0.25, 6000);
        this.tone(120, 0.5, "square", 0.1, 60);
        break;
      case "emp":
        this.tone(200, 0.5, "sine", 0.2, 1400);
        this.noise(0.4, 0.15, 3000);
        break;
      case "smoke":
        this.noise(0.7, 0.22, 1600);
        this.tone(220, 0.45, "sine", 0.06, 110);
        break;
      case "glue":
        this.tone(520, 0.2, "sine", 0.1, 130);
        this.tone(320, 0.16, "triangle", 0.08, 90, 0.12);
        this.noise(0.14, 0.05, 800, 0.05);
        break;
      case "bombLit":
        // match scratch, then a crackling fuse for the whole countdown
        this.noise(0.14, 0.14, 7000);
        this.tone(900, 0.12, "sawtooth", 0.05, 1500);
        for (let i = 0; i < 18; i++)
          this.noise(0.04, 0.05 + (i % 3) * 0.015, 6000, 0.18 + i * 0.13);
        break;
      case "boom":
        this.tone(130, 0.7, "sine", 0.4, 28);
        this.noise(1, 0.55, 900);
        this.tone(70, 0.9, "sawtooth", 0.13, 24, 0.04);
        this.noise(0.25, 0.3, 5000);
        break;
      case "cough":
        this.tone(190, 0.06, "square", 0.07, 120);
        this.tone(170, 0.06, "square", 0.07, 110, 0.1);
        this.noise(0.08, 0.05, 900, 0.02);
        break;
      case "death":
        [440, 330, 247, 165].forEach((f, i) =>
          this.tone(f, 0.18, "sawtooth", 0.1, f * 0.8, i * 0.14),
        );
        break;
      case "doorOpen":
        [392, 523, 659, 784].forEach((f, i) =>
          this.tone(f, 0.12, "square", 0.07, undefined, i * 0.08),
        );
        break;
      case "levelClear":
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
          this.tone(f, 0.16, "square", 0.08, undefined, i * 0.11),
        );
        break;
      case "gameOver":
        [330, 294, 262, 196].forEach((f, i) =>
          this.tone(f, 0.3, "triangle", 0.14, undefined, i * 0.25),
        );
        break;
      case "menu":
        this.tone(660, 0.05, "square", 0.05);
        break;
      case "start":
        [262, 330, 392, 523].forEach((f, i) =>
          this.tone(f, 0.1, "square", 0.07, undefined, i * 0.07),
        );
        break;
    }
  }
}
