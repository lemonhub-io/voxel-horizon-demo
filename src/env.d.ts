/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

// three/webgpu re-exports all of three + adds WebGPU-specific classes
declare module 'three/webgpu' {
  export * from 'three';
  export class WebGPURenderer {
    constructor(params?: Record<string, unknown>);
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number): void;
    setClearColor(color: string | number): void;
    render(scene: unknown, camera: unknown): void;
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    shadowMap: { enabled: boolean; type: number };
    init(): Promise<void>;
  }
  export class MeshBasicNodeMaterial {
    colorNode: unknown;
    positionNode: unknown;
    opacityNode: unknown;
    side: number;
    depthWrite: boolean;
    fog: boolean;
    transparent: boolean;
  }
  export class MeshStandardNodeMaterial {
    colorNode: unknown;
    positionNode: unknown;
    opacityNode: unknown;
    roughness: number;
    metalness: number;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    side: number;
    map: unknown;
    vertexColors: boolean;
    alphaTest: number;
  }
}

// three/tsl — TSL node functions
declare module 'three/tsl' {
  export function uniform(type: string): TSLNode & { value: unknown };
  export function float(value: number): TSLNode;
  export function vec3(x: number | TSLNode, y?: number | TSLNode, z?: number | TSLNode): TSLNode;
  export function vec4(x: number | TSLNode, y?: number | TSLNode, z?: number | TSLNode, w?: number | TSLNode): TSLNode;
  export function mix(a: TSLNode, b: TSLNode, t: TSLNode | number): TSLNode;
  export function pow(a: TSLNode, b: TSLNode | number): TSLNode;
  export function max(a: TSLNode | number, b: TSLNode | number): TSLNode;
  export function min(a: TSLNode | number, b: TSLNode | number): TSLNode;
  export function dot(a: TSLNode, b: TSLNode): TSLNode;
  export function normalize(v: TSLNode): TSLNode;
  export function abs(v: TSLNode): TSLNode;
  export function sin(v: TSLNode): TSLNode;
  export function cos(v: TSLNode): TSLNode;
  export function floor(v: TSLNode): TSLNode;
  export function exp(v: TSLNode): TSLNode;
  export function fract(v: TSLNode): TSLNode;
  export function step(edge: TSLNode | number, x: TSLNode): TSLNode;
  export function smoothstep(edge0: TSLNode | number, edge1: TSLNode | number, x: TSLNode): TSLNode;
  export function clamp(x: TSLNode, min: TSLNode | number, max: TSLNode | number): TSLNode;
  export function Fn(body: (args?: TSLNode[]) => TSLNode): (...args: unknown[]) => TSLNode;
  export function color(r: number, g: number, b: number): TSLNode;
  export function texture(tex: unknown, uv?: TSLNode): TSLNode;
  export function uv(channel?: number): TSLNode;
  export function attribute(name: string): TSLNode;
  export const positionLocal: TSLNode;
  export const positionWorld: TSLNode;
  export const cameraPosition: TSLNode;
  export const normalLocal: TSLNode;
  export const time: TSLNode;

  export interface TSLNode {
    add(other: TSLNode | number): TSLNode;
    sub(other: TSLNode | number): TSLNode;
    mul(other: TSLNode | number): TSLNode;
    div(other: TSLNode | number): TSLNode;
    negate(): TSLNode;
    x: TSLNode;
    y: TSLNode;
    z: TSLNode;
  }
}
