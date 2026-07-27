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
