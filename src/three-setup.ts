// ============================================================
// three-setup.ts — Import Three.js and set as global
// ============================================================

import * as THREEModule from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';

// Attach to window for non-module code access
(window as unknown as Record<string, unknown>).THREE = {
  ...THREEModule,
  WebGPURenderer,
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
  FXAAPass,
};
