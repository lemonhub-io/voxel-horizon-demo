// ============================================================
// three-setup.ts — Import Three.js WebGPU build as global
// ============================================================

// Import EVERYTHING from the WebGPU build (includes standard classes + node materials)
import * as THREE from 'three/webgpu';

// Attach to window as global THREE — single source of truth
(window as unknown as { THREE: typeof THREE }).THREE = THREE;
