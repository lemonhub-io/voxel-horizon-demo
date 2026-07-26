// ============================================================
// three-setup.ts — Import Three.js and set as global
// ============================================================

import * as THREEModule from 'three';
import {
  WebGPURenderer,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  TSL,
} from 'three/webgpu';
import type { TSL as TSLType } from 'three/webgpu';

// Attach to window for non-module code access
interface GameGlobals {
  THREE: typeof THREEModule & {
    WebGPURenderer: typeof WebGPURenderer;
    MeshBasicNodeMaterial: typeof MeshBasicNodeMaterial;
    MeshStandardNodeMaterial: typeof MeshStandardNodeMaterial;
    TSL: TSLType;
  };
}

(window as unknown as GameGlobals).THREE = {
  ...THREEModule,
  WebGPURenderer,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  TSL,
};
