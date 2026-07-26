/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module 'three/webgpu' {
  export class WebGPURenderer {
    constructor(params?: Record<string, unknown>);
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number): void;
    setClearColor(color: string | number): void;
    render(scene: unknown, camera: unknown): void;
    outputColorSpace: string;
  }
}

declare module 'three/examples/jsm/postprocessing/EffectComposer.js' {
  export class EffectComposer {
    constructor(renderer: unknown);
    addPass(pass: unknown): void;
    setSize(w: number, h: number): void;
    render(): void;
  }
}

declare module 'three/examples/jsm/postprocessing/RenderPass.js' {
  export class RenderPass {
    constructor(scene: unknown, camera: unknown);
  }
}

declare module 'three/examples/jsm/postprocessing/UnrealBloomPass.js' {
  export class UnrealBloomPass {
    constructor(resolution: unknown, strength: number, radius: number, threshold: number);
  }
}

declare module 'three/examples/jsm/postprocessing/FXAAPass.js' {
  export class FXAAPass {
    constructor(width: number, height: number);
  }
}
