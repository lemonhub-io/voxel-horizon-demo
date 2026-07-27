// ============================================================
// post-processing.ts — WebGPU render pipeline with WebGL fallback
// ============================================================

import type { Game } from './types';

interface RenderPipeline {
  outputNode: unknown;
  needsUpdate: boolean;
  render(): void;
}

export class PostProcessing {
  enabled = false;
  private _renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _pipeline: RenderPipeline | null = null;

  constructor(game: Game) {
    this._renderer = game.renderer;
    this._scene = game.scene;
    this._camera = game.camera;

    // Avoid TSL render-pipeline construction here. The current Three.js WebGPU
    // build can throw while compiling a node graph, leaving the game black.
    // The renderer's direct scene path is stable on both WebGPU and WebGL.
  }

  resize(_width: number, _height: number): void {
    // RenderPipeline tracks the renderer's drawing-buffer size automatically.
  }

  render(): void {
    if (this._pipeline) {
      this._pipeline.render();
      return;
    }
    this._renderer.render(this._scene, this._camera);
  }
}
