// ============================================================
// starfield.ts — 2D canvas star overlay (WebGPU-compatible)
// ============================================================

import { U } from './utils';

interface Star {
  ra: number;   // right ascension (0-2π)
  dec: number;  // declination (-π/2 to π/2)
  size: number; // 0.3–1.8
  bright: number; // 0.4–1.0
  twinkleSpeed: number; // 0.5–3.0
  twinklePhase: number; // 0–2π
  color: [number, number, number]; // RGB
}

export class Starfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private readonly STAR_COUNT = 300;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'starfield-canvas';
    this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.generateStars();
  }

  private resize(): void {
    this.canvas.width = innerWidth;
    this.canvas.height = innerHeight;
  }

  private generateStars(): void {
    const rng = U.mulberry32(12345);
    for (let i = 0; i < this.STAR_COUNT; i++) {
      this.stars.push({
        ra: rng() * Math.PI * 2,
        dec: Math.asin(rng() * 2 - 1), // uniform on sphere
        size: 0.3 + rng() * 1.5,
        bright: 0.4 + rng() * 0.6,
        twinkleSpeed: 0.5 + rng() * 2.5,
        twinklePhase: rng() * Math.PI * 2,
        color: rng() > 0.7
          ? [255, 240, 200]  // warm
          : rng() > 0.4
            ? [200, 220, 255] // cool blue
            : [255, 255, 255] // white
      });
    }
  }

  /** Update and render stars. Call each frame during night. */
  update(time: number, yaw: number, pitch: number, nightMix: number): void {
    if (nightMix < 0.05) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const fov = 1.2; // ~70° FOV factor

    this.ctx.clearRect(0, 0, W, H);

    for (const star of this.stars) {
      // Star position relative to camera orientation
      const cosDec = Math.cos(star.dec);
      const dx = cosDec * Math.cos(star.ra - yaw);
      const dy = Math.sin(star.dec);
      const dz = cosDec * Math.sin(star.ra - yaw);

      // Rotate by pitch
      const ry = dy * Math.cos(pitch) - dz * Math.sin(pitch);
      const rz = dy * Math.sin(pitch) + dz * Math.cos(pitch);

      // Behind camera check
      if (rz <= 0.01) continue;

      // Project to screen
      const sx = cx + (dx / rz) * cx * fov;
      const sy = cy - (ry / rz) * cy * fov;

      // Off-screen check
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      // Twinkle
      const tw = 0.55 + 0.45 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
      const alpha = star.bright * tw * nightMix;

      // Draw star
      const [r, g, b] = star.color;
      this.ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      const s = star.size * (0.8 + 0.2 * tw);
      this.ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }

  dispose(): void {
    this.canvas.remove();
  }
}
