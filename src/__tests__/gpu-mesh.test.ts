import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CFG } from '../config';
import {
  GPU_MESH_HEIGHT,
  GPU_MESH_BATCH_SIZE,
  GPU_MESH_MAX_BATCH_SIZE,
  GPU_MESH_WORD_COUNT,
  GPU_MESH_VOXEL_COUNT,
  GPU_MESH_WIDTH,
  GpuMeshBatch,
  GpuMeshChunkCompute,
  GpuMeshExtractKernel,
  buildGpuMeshChunkPayload,
  createGpuOpaqueBlockTable,
  detectGpuMeshCapability,
  detectGpuMeshBatchSize,
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
    const input = { x: 15, y: 63, z: 14, face: 5 as const, tile: 63, blockId: 19, ao: 0xe4, flags: 3, width: 7, height: 12 };
    const [header, detail] = packGpuMeshFace(input);
    expect(unpackGpuMeshFace(header, detail)).toEqual(input);
  });

  it('requires an actual WebGPU backend', () => {
    expect(detectGpuMeshCapability({ backend: { isWebGPUBackend: true } })).toEqual({ supported: true, reason: null });
    expect(detectGpuMeshCapability({ backend: { isWebGPUBackend: false } }).supported).toBe(false);
    expect(detectGpuMeshCapability(null).supported).toBe(false);
  });

  it('uses optional indirect first-instance support only for larger batches', () => {
    expect(detectGpuMeshBatchSize({ backend: { isWebGPUBackend: false } })).toBe(GPU_MESH_BATCH_SIZE);
    expect(detectGpuMeshBatchSize({ backend: { isWebGPUBackend: true, device: { features: { has: () => false } } } })).toBe(GPU_MESH_BATCH_SIZE);
    expect(detectGpuMeshBatchSize({ backend: { isWebGPUBackend: true, device: { features: { has: (feature: string) => feature === 'indirect-first-instance' } } } })).toBe(GPU_MESH_MAX_BATCH_SIZE);
  });

  it('keeps alpha-tested, glass, and water blocks out of the opaque GPU pass', () => {
    const table = createGpuOpaqueBlockTable();
    expect(table[0]).toBe(0);
    expect(table[5] & 1).toBe(1);
    expect(table[12]).toBe(0);
    expect(table[8]).toBe(0);
    expect(table[11]).toBe(0);
    expect(table[1] & 1).toBe(1);
  });

  it('batches chunk face records into one front-facing indirect mesh', () => {
    const batch = new GpuMeshBatch(new THREE.Texture());
    const slot = batch.allocate(2, -1);
    const resource = new GpuMeshChunkCompute(batch, slot);
    expect(batch.mesh.geometry.getIndirect()).toBe(batch.drawArgs);
    const positions = batch.mesh.geometry.getAttribute('position');
    expect(positions.count).toBe(6);
    expect(Array.from(positions.array as Float32Array)).toEqual([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0,
    ]);
    expect((batch.mesh.material as THREE.Material).side).toBe(THREE.DoubleSide);
    expect((batch.mesh.material as THREE.MeshStandardNodeMaterial).transparent).toBe(false);
    expect((batch.mesh.material as THREE.MeshStandardNodeMaterial).opacity).toBe(1);
    expect((batch.mesh.material as THREE.MeshStandardNodeMaterial).depthWrite).toBe(true);
    expect(batch.mesh.frustumCulled).toBe(true);
    expect(batch.mesh.geometry.boundingSphere?.center.toArray()).toEqual([40, 32, -8]);
    expect(batch.mesh.geometry.boundingSphere?.radius).toBeCloseTo(Math.hypot(8, 32, 8));
    expect((batch.drawArgs.array as Uint32Array)[slot * 4 + 1]).toBe(0);
    expect((batch.origins.array as Int32Array)[slot * 2]).toBe(2 * CFG.CHUNK);
    expect((batch.origins.array as Int32Array)[slot * 2 + 1]).toBe(-CFG.CHUNK);
    expect(GPU_MESH_BATCH_SIZE).toBe(1);
    resource.dispose();
    expect(batch.empty).toBe(true);
    batch.dispose();
  });

  it('reuses one extraction node across chunk resources', () => {
    const kernel = new GpuMeshExtractKernel();
    expect(kernel.extractNode.count).toBe(CFG.CHUNK * CFG.CHUNK * CFG.WORLD_H);
    const firstBatch = new GpuMeshBatch(new THREE.Texture());
    const secondBatch = new GpuMeshBatch(new THREE.Texture());
    const first = new GpuMeshChunkCompute(firstBatch, firstBatch.allocate(0, 0), kernel);
    const second = new GpuMeshChunkCompute(secondBatch, secondBatch.allocate(1, 0), kernel);
    expect(first.extractNode).toBe(second.extractNode);
    first.dispose();
    second.dispose();
    firstBatch.dispose();
    secondBatch.dispose();
  });

  it('keeps batched chunk origins and draw slots independent', () => {
    const batch = new GpuMeshBatch(new THREE.Texture(), 2);
    const firstSlot = batch.allocate(0, 0);
    const secondSlot = batch.allocate(1, 0);
    const first = new GpuMeshChunkCompute(batch, firstSlot);
    const second = new GpuMeshChunkCompute(batch, secondSlot);
    const emptyPayload = new Uint32Array(GPU_MESH_WORD_COUNT);
    first.upload(emptyPayload);
    second.upload(emptyPayload);
    expect(batch.batchSize).toBe(2);
    const origins = batch.origins.array as Int32Array;
    expect(origins[firstSlot * 2]).toBe(0);
    expect(origins[secondSlot * 2]).toBe(16);
    expect((first.voxels.array as Uint32Array)[GPU_MESH_WORD_COUNT]).toBe(firstSlot);
    expect((second.voxels.array as Uint32Array)[GPU_MESH_WORD_COUNT]).toBe(secondSlot);
    expect(batch.mesh.geometry.getIndirect()).toBe(batch.drawArgs);
    expect(batch.mesh.geometry.boundingSphere?.center.toArray()).toEqual([16, 32, 8]);
    first.dispose();
    second.dispose();
    batch.dispose();
  });
});
