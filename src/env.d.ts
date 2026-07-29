/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module 'three/addons/loaders/GLTFLoader.js' {
  export interface GLTF {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
    scenes: THREE.Group[];
    cameras: THREE.Camera[];
    asset: Record<string, unknown>;
  }

  export class GLTFLoader {
    load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: undefined, onError?: (error: unknown) => void): void;
  }
}

declare module 'three/addons/utils/SkeletonUtils.js' {
  import type { Object3D } from 'three';
  /** Deep-clone that rebinds SkinnedMesh skeletons (Object3D.clone does not). */
  export function clone(source: Object3D): Object3D;
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
      layers: { enable(channel: number): void };
      shadow: {
        camera: {
          near: number;
          far: number;
          layers: { enable(channel: number): void };
          updateProjectionMatrix(): void;
        };
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

declare module 'three/addons/tsl/display/GTAONode.js' {
  import type { Camera } from 'three/webgpu';

  /** Screen-space AO node (WebGPU GTAO — SSAOPass equivalent for WebGPURenderer). */
  export function ao(depthNode: unknown, normalNode: unknown, camera: Camera): {
    resolutionScale: number;
    useTemporalFiltering: boolean;
    samples: { value: number };
    radius: { value: number };
    scale: { value: number };
    thickness: { value: number };
    distanceExponent: { value: number };
    distanceFallOff: { value: number };
    getTextureNode(): { r: unknown; rgb: unknown };
    dispose(): void;
  };
}

declare module 'three/addons/objects/SkyMesh.js' {
  import type { Mesh, Vector3 } from 'three/webgpu';

  /**
   * Official WebGPU Preetham skydome (TSL NodeMaterial).
   * @see three.js examples/webgpu_sky.html
   */
  export class SkyMesh extends Mesh {
    turbidity: { value: number };
    rayleigh: { value: number };
    mieCoefficient: { value: number };
    mieDirectionalG: { value: number };
    sunPosition: { value: Vector3 };
    upUniform: { value: Vector3 };
    cloudScale: { value: number };
    cloudSpeed: { value: number };
    cloudCoverage: { value: number };
    cloudDensity: { value: number };
    cloudElevation: { value: number };
    showSunDisc: { value: number };
    readonly isSkyMesh: true;
    constructor();
  }
}
