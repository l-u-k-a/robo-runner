/** Keyboard state. Presses persist until consumed so no tap is lost between sim steps. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  attach(target: Window): void {
    target.addEventListener("keydown", (e) => {
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
      if (!e.repeat) this.press(e.code);
    });
    target.addEventListener("keyup", (e) => this.release(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  press(code: string): void {
    this.down.add(code);
    this.pressed.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True once per physical press; clears the flag. */
  take(...codes: string[]): boolean {
    let hit = false;
    for (const c of codes) {
      if (this.pressed.delete(c)) hit = true;
    }
    return hit;
  }

  clearPressed(): void {
    this.pressed.clear();
  }
}
