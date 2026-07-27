// ============================================================
// post-processing.ts — Post-processing pipeline
// NOTE: EffectComposer uses GLSL shaders which are incompatible
// with WebGPU. Using direct renderer.render() for now.
// TODO: Convert to Three.js WebGPU PostProcessing with TSL nodes.
// ============================================================

import type { Game } from './types';

export class PostProcessing {
  enabled = false; // Disabled until TSL-based post-processing is implemented
  private _renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;

  constructor(game: Game) {
    this._renderer = game.renderer;
    this._scene = game.scene;
    this._camera = game.camera;
  }

  resize(_width: number, _height: number): void {
    // No-op until post-processing is implemented
  }

  render(): void {
    // Direct render — no post-processing pass
    this._renderer.render(this._scene, this._camera);
  }
}
