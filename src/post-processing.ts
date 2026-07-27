// ============================================================
// post-processing.ts — WebGPU render pipeline with WebGL fallback
// ============================================================

import * as THREE from 'three/webgpu';
import type { Game } from './types';

export class PostProcessing {
  enabled = false;
  private _renderer: THREE.WebGPURenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;

  constructor(game: Game) {
    this._renderer = game.renderer;
    this._scene = game.scene;
    this._camera = game.camera;

    // Avoid TSL render-pipeline construction here. The current Three.js WebGPU
    // build can throw while compiling a node graph, leaving the game black.
    // The renderer's direct scene path is stable on both WebGPU and WebGL.
  }

  resize(_width: number, _height: number): void {
    // Direct rendering tracks the drawing-buffer size automatically.
  }

  render(): void {
    this._renderer.render(this._scene, this._camera);
  }
}
