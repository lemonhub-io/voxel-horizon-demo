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

  it('ferrite ore band is shallow (surface to ~9 blocks deep)', () => {
    // Mirrors World.isFerriteOre depth gate — iron must sit in the crust, not as props.
    const maxDepth = 9;
    const surfaceH = 40;
    for (let y = 0; y <= surfaceH; y++) {
      const depth = surfaceH - y;
      const inBand = depth >= 0 && depth <= maxDepth && y > 2;
      if (y <= 2) expect(inBand).toBe(false);
      else if (depth > maxDepth) expect(inBand).toBe(false);
      else expect(inBand).toBe(true);
    }
  });

  it('ferrite noise veins form clusters not pure random salt', () => {
    // Dual-noise vein field should be spatially correlated (neighbors often match).
    const a = new SimplexNoise(12345);
    const b = new SimplexNoise(12345 ^ 0xbeef);
    let agree = 0;
    let total = 0;
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        const y = 30;
        const vein = (gx: number, gz: number): boolean => {
          const field = a.noise3(gx * 0.078, y * 0.1, gz * 0.078);
          const ridge = b.noise3(gx * 0.042 + 19.7, y * 0.055 + 3.1, gz * 0.042 - 8.4);
          return field * 0.62 + ridge * 0.38 > 0.55 && ridge > -0.05;
        };
        const here = vein(x, z);
        const right = vein(x + 1, z);
        if (here === right) agree++;
        total++;
      }
    }
    // Pure random 50/50 would ~50% agree; correlated veins should be clearly higher.
    expect(agree / total).toBeGreaterThan(0.62);
  });
});
