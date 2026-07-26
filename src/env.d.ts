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
