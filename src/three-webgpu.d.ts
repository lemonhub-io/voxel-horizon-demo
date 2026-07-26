// ============================================================
// three-webgpu.d.ts — Type declarations for Three.js WebGPU
// ============================================================

/* eslint-disable @typescript-eslint/no-unused-vars */

declare module 'three/webgpu' {
  import type {
    WebGLRenderer, Scene, Camera, Material, Color, Vector2, Vector3,
    Mesh, BufferGeometry, Texture
  } from 'three';

  // --- TSL Node types ---

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

  export interface TSLUniform extends TSLNode {
    value: unknown;
  }

  // --- TSL function signatures (also exported as value) ---

  export const TSL: TSL;
  export interface TSL {
    uniform(type: string): TSLUniform;
    float(value: number): TSLNode;
    vec3(x: number | TSLNode, y: number | TSLNode, z: number | TSLNode): TSLNode;
    vec4(x: number | TSLNode, y: number | TSLNode, z: number | TSLNode, w: number | TSLNode): TSLNode;
    color(r: number, g: number, b: number): TSLNode;

    mix(a: TSLNode, b: TSLNode, t: TSLNode | number): TSLNode;
    pow(a: TSLNode, b: TSLNode | number): TSLNode;
    max(a: TSLNode | number, b: TSLNode | number): TSLNode;
    min(a: TSLNode | number, b: TSLNode | number): TSLNode;
    dot(a: TSLNode, b: TSLNode): TSLNode;
    normalize(v: TSLNode): TSLNode;
    abs(v: TSLNode): TSLNode;
    sin(v: TSLNode): TSLNode;
    cos(v: TSLNode): TSLNode;
    floor(v: TSLNode): TSLNode;
    exp(v: TSLNode): TSLNode;
    fract(v: TSLNode): TSLNode;
    step(edge: TSLNode | number, x: TSLNode): TSLNode;
    smoothstep(edge0: TSLNode | number, edge1: TSLNode | number, x: TSLNode): TSLNode;
    clamp(x: TSLNode, min: TSLNode | number, max: TSLNode | number): TSLNode;

    Fn(body: (args?: TSLNode[]) => TSLNode): (...args: unknown[]) => TSLNode;

    // Built-in nodes
    positionLocal: TSLNode;
    positionWorld: TSLNode;
    cameraPosition: TSLNode;
    modelWorldMatrix: TSLNode;
    uv(): TSLNode;
  }

  // --- Node Materials ---

  export class MeshBasicNodeMaterial extends Material {
    colorNode: TSLNode | null;
    positionNode: TSLNode | null;
    opacityNode: TSLNode | null;
    side: number;
    depthWrite: boolean;
    fog: boolean;
    transparent: boolean;
  }

  export class MeshStandardNodeMaterial extends Material {
    colorNode: TSLNode | null;
    positionNode: TSLNode | null;
    opacityNode: TSLNode | null;
    roughness: number;
    metalness: number;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    side: number;
    map: Texture | null;
    vertexColors: boolean;
    alphaTest: number;
  }

  export class NodeMaterial extends Material {
    colorNode: TSLNode | null;
    positionNode: TSLNode | null;
  }

  // --- WebGPU Renderer ---

  export class WebGPURenderer extends WebGLRenderer {
    constructor(params?: {
      canvas?: HTMLCanvasElement;
      antialias?: boolean;
      forceWebGL?: boolean;
      powerPreference?: string;
    });
    isWebGPURenderer: boolean;
    init(): Promise<void>;
  }

  // --- PostProcessing ---

  export class PostProcessing {
    constructor(renderer: WebGPURenderer);
    render(): void;
  }
}
