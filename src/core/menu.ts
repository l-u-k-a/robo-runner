/** Cursor for a vertical menu. Wraps around at both ends. */
export class Menu {
  index = 0;

  constructor(public count: number) {}

  up(): void {
    this.index = (this.index - 1 + this.count) % this.count;
  }

  down(): void {
    this.index = (this.index + 1) % this.count;
  }

  reset(count = this.count): void {
    this.count = count;
    this.index = 0;
  }
}
