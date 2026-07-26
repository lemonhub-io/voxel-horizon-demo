// ============================================================
// three-setup.ts — Import Three.js and set as global
// ============================================================

import * as THREEModule from 'three';
import { WebGPURenderer } from 'three/webgpu';

// Attach to window for non-module code access
(window as unknown as Record<string, unknown>).THREE = {
  ...THREEModule,
  WebGPURenderer,
};
