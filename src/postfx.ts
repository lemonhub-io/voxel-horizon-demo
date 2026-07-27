// ============================================================
// postfx.ts — CSS-based post-processing effects
// ============================================================

export class PostFX {
  private canvas: HTMLElement;
  private vignetteEl: HTMLElement;
  private healthVignette = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas')!;

    // Dynamic vignette overlay (health-based)
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.id = 'health-vignette';
    this.vignetteEl.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 15;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(180, 20, 20, 0) 100%);
      transition: background 0.3s;
    `;
    document.body.appendChild(this.vignetteEl);
  }

  /** Update post-processing effects. Call each frame. */
  update(hp: number, inWater: boolean): void {
    // Health vignette — stronger at low HP
    const hpFrac = Math.max(0, Math.min(1, hp / 100));
    const vignetteStrength = Math.pow(1 - hpFrac, 2) * 0.6;
    if (Math.abs(vignetteStrength - this.healthVignette) > 0.01) {
      this.healthVignette = vignetteStrength;
      this.vignetteEl.style.background =
        `radial-gradient(ellipse at center, transparent 40%, rgba(180, 20, 20, ${vignetteStrength}) 100%)`;
    }

    // Water tint — blue overlay when submerged
    if (inWater) {
      this.canvas.style.filter = 'contrast(1.12) saturate(1.2) brightness(0.85) hue-rotate(10deg)';
    } else {
      this.canvas.style.filter = 'contrast(1.12) saturate(1.2) brightness(1.02)';
    }
  }

  /** Flash effect on damage */
  flashDamage(): void {
    this.vignetteEl.style.transition = 'none';
    this.vignetteEl.style.background = 'radial-gradient(ellipse at center, rgba(255,40,30,0.4) 0%, rgba(180,20,20,0.6) 100%)';
    setTimeout(() => {
      this.vignetteEl.style.transition = 'background 0.4s';
      this.update(100, false); // reset to health-based
    }, 100);
  }

  dispose(): void {
    this.vignetteEl.remove();
  }
}
