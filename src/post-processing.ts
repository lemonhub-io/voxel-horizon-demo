// ============================================================
// post-processing.ts — FXAA + Bloom post-processing pipeline
// ============================================================

import type { Game } from './types';

type PPComposer = {
  addPass(pass: unknown): void;
  setSize(w: number, h: number): void;
  render(): void;
};

export class PostProcessing {
  composer: PPComposer;
  bloomPass: unknown;
  fxaaPass: unknown;
  enabled = true;
  private _renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;

  constructor(game: Game) {
    this._renderer = game.renderer;
    this._scene = game.scene;
    this._camera = game.camera;

    // Use the global THREE namespace for addon classes
    const g = window as unknown as Record<string, unknown>;
    const THREE_ADDONS = g.THREE as Record<string, unknown>;

    // Try to load post-processing from global THREE (bundled)
    const EffectComposer = THREE_ADDONS.EffectComposer as (new (r: unknown) => PPComposer) | undefined;
    const RenderPass = THREE_ADDONS.RenderPass as (new (s: unknown, c: unknown) => unknown) | undefined;
    const UnrealBloomPass = THREE_ADDONS.UnrealBloomPass as (new (res: unknown, str: number, rad: number, thr: number) => unknown) | undefined;

    if (!EffectComposer || !RenderPass) {
      // Post-processing not available, create a no-op composer
      this.composer = { addPass() {}, setSize() {}, render() { game.renderer.render(game.scene, game.camera); } };
      this.bloomPass = null;
      this.fxaaPass = null;
      return;
    }

    this.composer = new EffectComposer(this._renderer as unknown as Record<string, unknown>);

    const renderPass = new RenderPass(this._scene, this._camera);
    this.composer.addPass(renderPass);

    // Bloom — emissive glow for lamps, crystals, lasers
    if (UnrealBloomPass) {
      const res = new THREE.Vector2(innerWidth, innerHeight);
      this.bloomPass = new UnrealBloomPass(res, 0.35, 0.3, 0.88);
      this.composer.addPass(this.bloomPass);
    }

    // FXAA — fast anti-aliasing
    const FXAAPass = THREE_ADDONS.FXAAPass as (new (w: number, h: number) => unknown) | undefined;
    if (FXAAPass) {
      this.fxaaPass = new FXAAPass(innerWidth, innerHeight);
      this.composer.addPass(this.fxaaPass);
    }
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(): void {
    if (this.enabled) {
      this.composer.render();
    } else {
      this._renderer.render(this._scene, this._camera);
    }
  }
}
