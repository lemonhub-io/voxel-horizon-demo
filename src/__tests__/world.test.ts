import { describe, it, expect } from 'vitest';

// Minimal THREE mock for world tests
(globalThis as Record<string, unknown>).THREE = {
  Group: class { add() {} remove() {} children = []; position = { set() {} }; },
  MeshLambertMaterial: class { map = null; needsUpdate = false; onBeforeCompile = null; },
  BufferGeometry: class { setAttribute() { return this; } setIndex() { return this; } setDrawRange() {} attributes = {}; dispose() {} },
  Float32BufferAttribute: class { constructor() {} },
  Mesh: class { position = { set() {} }; matrixAutoUpdate = false; updateMatrix() {} geometry = { dispose() {} }; },
  Points: class { frustumCulled = false; geometry = { attributes: { position: { needsUpdate: false }, color: { needsUpdate: false } }, setDrawRange() {} }; },
  PointsMaterial: class {},
  Scene: class { add() {} fog = null; },
  Fog: class {},
  PointLight: class { visible = false; position = { set() {} }; },
  NearestFilter: 0,
  ClampToEdgeWrapping: 0,
  DoubleSide: 2,
  AdditiveBlending: 2,
  CanvasTexture: class { magFilter = 0; minFilter = 0; generateMipmaps = false; wrapS = 0; wrapT = 0; dispose() {} },
  Vector3: class { x = 0; y = 0; z = 0; set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; } copy() { return this; } clone() { return this; } sub() { return this; } multiplyScalar() { return this; } addScaledVector() { return this; } normalize() { return this; } distanceTo() { return 0; } dot() { return 0; } applyQuaternion() { return this; } toArray() { return [0,0,0]; } fromArray() { return this; } project() { return this; } lengthSq() { return 0; } length() { return 0; } },
};

import { CFG, B } from '../config';
import { SimplexNoise } from '../utils';

// We can't fully instantiate World without THREE renderer, but we can test helper logic
describe('World generation helpers', () => {
  it('CFG values are consistent', () => {
    expect(CFG.CHUNK).toBe(16);
    expect(CFG.WORLD_H).toBe(64);
    expect(CFG.SEA).toBeLessThan(CFG.WORLD_H);
  });

  it('terrain height from noise is within bounds', () => {
    const noise = new SimplexNoise(42);
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const n1 = noise.fbm2(x * 0.0085, z * 0.0085, 4, 2, 0.5);
        const h = Math.min(Math.floor(30 + n1 * 9), CFG.WORLD_H - 8);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(CFG.WORLD_H);
      }
    }
  });

  it('block types are valid numbers', () => {
    for (const key of Object.keys(B)) {
      const val = B[key as keyof typeof B];
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});
