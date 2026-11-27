import { TRACKS, type Track } from "./tracks";

const LOOKAHEAD = 0.25; // seconds scheduled ahead
const TICK_MS = 50;
/** Overall music level relative to the sound effects (1 = original, 0.7 = 30% quieter). */
const MUSIC_VOLUME = 0.4;

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Semitone offset for a scale degree; degrees past the scale wrap into higher octaves. */
export function degreeToSemitone(scale: number[], degree: number): number {
  const n = scale.length;
  return scale[degree % n] + 12 * Math.floor(degree / n);
}

/** Looping chiptune player. Needs an AudioContext, supplied lazily (browsers require a user gesture). */
export class Music {
  muted = false;
  private wanted: string | null = null;
  private playing: string | null = null;
  private ducked = false;
  private userVolume = 1;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private nextTime = 0;
  private step = 0;
  private timer: number | null = null;

  constructor(private getContext: () => AudioContext | null) {}

  /** Choose what should be playing (null = silence). Safe to call every frame. */
  set(track: string | null, ducked = false): void {
    this.wanted = track && TRACKS[track] ? track : null;
    this.ducked = ducked;
    if (this.timer === null)
      this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.applyVolume();
  }

  /** Player volume setting 0..10 (5 = default loudness). */
  setVolume(level: number): void {
    this.userVolume = Math.max(0, level) / 5;
    this.applyVolume();
  }

  setMuted(v: boolean): void {
    this.muted = v;
    this.applyVolume();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const v = this.muted
      ? 0
      : (this.ducked ? 0.25 : 1) * MUSIC_VOLUME * this.userVolume;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private tick(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== "running") return;
    if (ctx !== this.ctx) {
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MUSIC_VOLUME * this.userVolume;
      this.master.connect(ctx.destination);
      this.noiseBuf = null;
      this.playing = null;
    }
    if (this.wanted !== this.playing) {
      this.playing = this.wanted;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.08;
      this.master!.gain.cancelScheduledValues(ctx.currentTime);
      this.applyVolume();
    }
    if (!this.playing || this.muted) {
      // Keep the clock moving so unmuting does not trigger a burst of old notes.
      this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.05);
      return;
    }
    const track = TRACKS[this.playing];
    const stepDur = 60 / track.bpm / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(track, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (track.lead.length * 16);
    }
  }

  private scheduleStep(
    t: Track,
    step: number,
    when: number,
    stepDur: number,
  ): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;

    // lead
    const ch = t.lead[bar][s];
    if (ch !== ".") {
      const semi = degreeToSemitone(t.scale, parseInt(ch, 16));
      const hz = midiToHz(t.root + 12 + semi);
      this.note(t.leadWave, hz, when, stepDur * t.leadLen * 0.9, 0.07);
      if (t.echo)
        this.note(
          t.leadWave,
          hz,
          when + stepDur * 3,
          stepDur * t.leadLen * 0.8,
          0.025,
        );
    }
    // bass
    if (s % t.bassEvery === 0) {
      const semi = degreeToSemitone(t.scale, t.bass[bar]);
      const octave = t.bassEvery <= 2 && s % 4 === 2 ? 12 : 0;
      this.note(
        "triangle",
        midiToHz(t.root + semi + octave),
        when,
        stepDur * t.bassEvery * 0.85,
        0.16,
      );
    }
    // drums
    this.drums(t.drums, s, when);
  }

  private drums(style: Track["drums"], s: number, when: number): void {
    switch (style) {
      case "none":
        return;
      case "sparse":
        if (s === 0) this.kick(when, 0.2);
        if (s === 12) this.hat(when, 0.03);
        return;
      case "march":
        if (s % 8 === 0) this.kick(when, 0.22);
        if (s === 4 || s === 12) this.snare(when, 0.1);
        if (s % 4 === 2) this.hat(when, 0.03);
        return;
      case "drive":
        if (s % 4 === 0) this.kick(when, 0.22);
        if (s === 4 || s === 12) this.snare(when, 0.1);
        if (s % 2 === 0) this.hat(when, 0.035);
        return;
    }
  }

  private note(
    type: OscillatorType,
    freq: number,
    when: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, dur));
    o.connect(g).connect(this.master!);
    o.start(when);
    o.stop(when + Math.max(0.04, dur) + 0.02);
  }

  private kick(when: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    o.connect(g).connect(this.master!);
    o.start(when);
    o.stop(when + 0.17);
  }

  private noise(
    when: number,
    dur: number,
    vol: number,
    type: BiquadFilterType,
    freq: number,
  ): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 0.3);
      this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  private snare(when: number, vol: number): void {
    this.noise(when, 0.12, vol, "bandpass", 1800);
  }

  private hat(when: number, vol: number): void {
    this.noise(when, 0.04, vol, "highpass", 7000);
  }
}
