// ============================================================
// three-setup.ts — Import Three.js WebGPU build as global
// ============================================================

// Import the WebGPU build which includes ALL classes + node material system
import * as THREE_WEBGPU from 'three/webgpu';

// The WebGPU build contains: THREE core + MeshBasicNodeMaterial + WebGPURenderer + TSL
// Attach to window so all other files can use THREE.* as a global
(window as unknown as { THREE: typeof THREE_WEBGPU }).THREE = THREE_WEBGPU;
