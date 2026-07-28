// ============================================================
// postfx.ts — CSS HUD overlays (health + letterbox); GPU grade is in post-processing.ts
// ============================================================

export class PostFX {
  private canvas: HTMLElement;
  private vignetteEl: HTMLElement;
  private cinematicEl: HTMLElement;
  private letterboxEl: HTMLElement;
  private healthVignette = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas')!;

    // Dynamic vignette overlay (health-based) — sits above GPU vignette
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.id = 'health-vignette';
    this.vignetteEl.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 15;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(180, 20, 20, 0) 100%);
      transition: background 0.3s;
    `;
    document.body.appendChild(this.vignetteEl);

    // Subtle film scan / edge falloff (complements TSL cinematic grade)
    this.cinematicEl = document.createElement('div');
    this.cinematicEl.id = 'cinematic-overlay';
    this.cinematicEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.cinematicEl);

    // Soft cinematic letterbox bars
    this.letterboxEl = document.createElement('div');
    this.letterboxEl.id = 'cinematic-letterbox';
    this.letterboxEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.letterboxEl);
  }

  /** Update post-processing effects. Call each frame. */
  update(hp: number, inWater: boolean): void {
    // Health vignette — stronger at low HP
    const hpFrac = Math.max(0, Math.min(1, hp / 100));
    const vignetteStrength = Math.pow(1 - hpFrac, 2) * 0.45;
    if (Math.abs(vignetteStrength - this.healthVignette) > 0.01) {
      this.healthVignette = vignetteStrength;
      this.vignetteEl.style.background =
        `radial-gradient(ellipse at center, transparent 42%, rgba(180, 20, 20, ${vignetteStrength}) 100%)`;
    }

    // GPU pipeline owns contrast/sat; CSS only handles water immersion tint.
    if (inWater) {
      this.canvas.style.filter = 'brightness(0.88) hue-rotate(12deg) saturate(1.05)';
    } else {
      this.canvas.style.filter = 'none';
    }
  }

  /** Flash effect on damage */
  flashDamage(): void {
    this.vignetteEl.style.transition = 'none';
    this.vignetteEl.style.background = 'radial-gradient(ellipse at center, rgba(255,40,30,0.4) 0%, rgba(180,20,20,0.6) 100%)';
    setTimeout(() => {
      this.vignetteEl.style.transition = 'background 0.4s';
      this.update(100, false);
    }, 100);
  }

  dispose(): void {
    this.vignetteEl.remove();
    this.cinematicEl.remove();
    this.letterboxEl.remove();
  }
}
