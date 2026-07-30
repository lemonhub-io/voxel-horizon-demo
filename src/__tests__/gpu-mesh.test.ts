import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CFG } from '../config';
import {
  GPU_MESH_HEIGHT,
  GPU_MESH_VOXEL_COUNT,
  GPU_MESH_WIDTH,
  GpuMeshChunkCompute,
  buildGpuMeshChunkPayload,
  createGpuOpaqueBlockTable,
  detectGpuMeshCapability,
  gpuMeshVoxelIndex,
  packGpuMeshFace,
  unpackGpuMeshFace,
} from '../gpu-mesh';

function unpackVoxel(words: Uint32Array, index: number): number {
  return (words[index >>> 2] >>> ((index & 3) << 3)) & 0xff;
}

describe('GPU mesh data contract', () => {
  it('keeps a one-voxel halo around a chunk', () => {
    expect(GPU_MESH_WIDTH).toBe(CFG.CHUNK + 2);
    expect(GPU_MESH_HEIGHT).toBe(CFG.WORLD_H + 2);

    const words = buildGpuMeshChunkPayload(
      { cx: 2, cz: -1 },
      (x, y, z) => (x + y * 17 + z * 31) & 0xff,
    );
    expect(words.length).toBe(Math.ceil(GPU_MESH_VOXEL_COUNT / 4));
    expect(unpackVoxel(words, gpuMeshVoxelIndex(0, 1, 0))).toBe((31 - 17 * 31) & 0xff);
    expect(unpackVoxel(words, gpuMeshVoxelIndex(1, 1, 1))).toBe((32 - 16 * 31) & 0xff);
    expect(unpackVoxel(words, gpuMeshVoxelIndex(1, 0, 1))).toBe(0);
  });

  it('round-trips compact face records', () => {
    const input = { x: 15, y: 63, z: 14, face: 5 as const, tile: 63, blockId: 19, ao: 0xe4, flags: 3 };
    const [header, detail] = packGpuMeshFace(input);
    expect(unpackGpuMeshFace(header, detail)).toEqual(input);
  });

  it('requires an actual WebGPU backend', () => {
    expect(detectGpuMeshCapability({ backend: { isWebGPUBackend: true } })).toEqual({ supported: true, reason: null });
    expect(detectGpuMeshCapability({ backend: { isWebGPUBackend: false } }).supported).toBe(false);
    expect(detectGpuMeshCapability(null).supported).toBe(false);
  });

  it('keeps alpha-tested, glass, and water blocks out of the opaque GPU pass', () => {
    const table = createGpuOpaqueBlockTable();
    expect(table[0]).toBe(0);
    expect(table[12]).toBe(0);
    expect(table[8]).toBe(0);
    expect(table[11]).toBe(0);
    expect(table[1] & 1).toBe(1);
  });

  it('binds face records to a compact indirect render mesh', () => {
    const resource = new GpuMeshChunkCompute();
    const mesh = resource.createRenderMesh(new THREE.Texture());
    expect(mesh.geometry.getIndirect()).toBe(resource.drawArgs);
    expect(mesh.geometry.getAttribute('position').count).toBe(6);
    expect((resource.drawArgs.array as Uint32Array)[1]).toBe(0);
    resource.dispose();
  });
});
