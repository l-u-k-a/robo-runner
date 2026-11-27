interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

export class Particles {
  private list: Particle[] = [];

  burst(
    x: number,
    y: number,
    n: number,
    colors: string[],
    speed = 60,
    gravity = 120,
    life = 0.6,
  ): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() > 0.6 ? 2 : 1,
        gravity,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.list = [];
  }
}
