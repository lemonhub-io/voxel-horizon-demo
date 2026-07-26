// ============================================================
// three-setup.ts — Import Three.js and set as global
// ============================================================

import * as THREEModule from 'three';

// WebGPU modules loaded via dynamic import (not in @types/three)
const webgpu = await import('three/webgpu' as string) as any;

// Attach to window for non-module code access
(window as any).THREE = {
  ...THREEModule,
  WebGPURenderer: webgpu.WebGPURenderer,
  MeshBasicNodeMaterial: webgpu.MeshBasicNodeMaterial,
  MeshStandardNodeMaterial: webgpu.MeshStandardNodeMaterial,
  TSL: webgpu.TSL,
  PostProcessing: webgpu.PostProcessing,
};
