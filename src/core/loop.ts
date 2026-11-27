/** Fixed-timestep accumulator: feed it real frame time, get back how many sim steps to run. */
export class Accumulator {
  private acc = 0;

  constructor(
    readonly step: number,
    private readonly maxSteps = 5,
  ) {}

  add(frameSeconds: number): number {
    // Clamp huge frames (tab switch, breakpoint) so we never spiral.
    this.acc += Math.min(frameSeconds, this.step * this.maxSteps);
    let n = 0;
    while (this.acc >= this.step - 1e-9 && n < this.maxSteps) {
      this.acc -= this.step;
      n++;
    }
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
