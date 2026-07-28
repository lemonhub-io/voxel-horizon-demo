/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module 'three/addons/loaders/GLTFLoader.js' {
  export interface GLTF {
    scene: THREE.Group;
  }

  export class GLTFLoader {
    load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: undefined, onError?: (error: unknown) => void): void;
  }
}

declare module 'three/addons/csm/CSMShadowNode.js' {
  import type { Camera, DirectionalLight } from 'three/webgpu';

  export interface CSMShadowNodeData {
    cascades?: number;
    maxFar?: number;
    mode?: 'practical' | 'uniform' | 'logarithmic' | 'custom';
    customSplitsCallback?: (cascades: number, near: number, far: number, breaks: number[]) => void;
    lightMargin?: number;
  }

  /** TSL cascaded shadow node for WebGPURenderer (three/addons). */
  export class CSMShadowNode {
    camera: Camera | null;
    cascades: number;
    maxFar: number;
    mode: 'practical' | 'uniform' | 'logarithmic' | 'custom';
    lightMargin: number;
    fade: boolean;
    breaks: number[];
    lights: Array<{
      shadow: {
        camera: { near: number; far: number; updateProjectionMatrix(): void };
        radius: number;
        bias: number;
        normalBias: number;
      };
    }>;
    constructor(light: DirectionalLight, data?: CSMShadowNodeData);
    updateFrustums(): void;
    dispose(): void;
  }
}
