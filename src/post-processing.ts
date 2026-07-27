// ============================================================
// post-processing.ts — WebGPU render pipeline with WebGL fallback
// ============================================================

import type { Game } from './types';

interface RenderPipeline {
  outputNode: unknown;
  needsUpdate: boolean;
  render(): void;
}

interface RenderPipelineApi {
  RenderPipeline?: new (renderer: unknown) => RenderPipeline;
  TSL?: { pass(scene: unknown, camera: unknown): unknown };
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

    const renderer = this._renderer as unknown as { isWebGPURenderer?: boolean };
    const api = THREE as unknown as RenderPipelineApi;
    if (renderer.isWebGPURenderer && api.RenderPipeline && api.TSL?.pass) {
      const pipeline = new api.RenderPipeline(this._renderer);
      pipeline.outputNode = api.TSL.pass(this._scene, this._camera);
      pipeline.needsUpdate = true;
      this._pipeline = pipeline;
      this.enabled = true;
    }
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
