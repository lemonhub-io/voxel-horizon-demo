// ============================================================
// three-setup.ts — Import Three.js and set as global
// ============================================================

import * as THREEModule from 'three';
import { WebGPURenderer } from 'three/webgpu';

// Attach to window for non-module code access
interface GameGlobals {
  THREE: typeof THREEModule & {
    WebGPURenderer: typeof WebGPURenderer;
  };
}

(window as unknown as GameGlobals).THREE = {
  ...THREEModule,
  WebGPURenderer,
};
