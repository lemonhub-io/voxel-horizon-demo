import * as THREE from 'three/webgpu';
import { Fn, If, atomicAdd, atomicOr, float, instanceIndex, positionGeometry, storage, texture, uint, uvec2, vec2, vec3 } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import { BLOCK_DEF, CFG } from './config';

/**
 * GPU mesh extraction reads a one-voxel border so chunk-edge faces can be
 * decided without binding neighbouring chunks in the same compute pass.
 */
export const GPU_MESH_HALO = 1;
export const GPU_MESH_WIDTH = CFG.CHUNK + GPU_MESH_HALO * 2;
export const GPU_MESH_HEIGHT = CFG.WORLD_H + GPU_MESH_HALO * 2;
export const GPU_MESH_VOXEL_COUNT = GPU_MESH_WIDTH * GPU_MESH_HEIGHT * GPU_MESH_WIDTH;
export const GPU_MESH_WORD_COUNT = Math.ceil(GPU_MESH_VOXEL_COUNT / 4);

/**
 * A face record is intentionally smaller than a generated vertex: instanced
 * rendering reconstructs the six quad vertices, avoiding CPU readback and a
 * worst-case vertex buffer for every chunk.
 */
export const GPU_MESH_MAX_FACES = CFG.CHUNK * CFG.CHUNK * CFG.WORLD_H * 6;
export const GPU_MESH_DRAW_ARG_COUNT = 4;
/**
 * WebGPU only permits non-zero indirect firstInstance when an optional feature
 * is enabled, so one draw-owned slot keeps every supported browser valid.
 */
export const GPU_MESH_BATCH_SIZE = 1;

export type GpuMeshFace = 0 | 1 | 2 | 3 | 4 | 5;

export interface GpuMeshFaceRecord {
  x: number;
  y: number;
  z: number;
  face: GpuMeshFace;
  tile: number;
  blockId: number;
  /** Preserve per-corner shading without widening every face record. */
  ao: number;
  /** Keep the binary layout stable as GPU-only material effects are added. */
  flags: number;
}

export interface GpuMeshChunkCoord {
  cx: number;
  cz: number;
}

export interface GpuMeshCapability {
  supported: boolean;
  reason: string | null;
}

type WorldBlockSampler = (x: number, y: number, z: number) => number;
type UintNode = Node<'uint'>;

const X_MASK = 0x0f;
const Y_MASK = 0x3f;
const Z_MASK = 0x0f;
const FACE_MASK = 0x07;
const TILE_MASK = 0x3f;
const BLOCK_MASK = 0x1f;
const AO_MASK = 0xff;
const FLAGS_MASK = 0xff;

function assertRange(name: string, value: number, mask: number): void {
  if (!Number.isInteger(value) || value < 0 || value > mask) {
    throw new RangeError(`${name} must be an integer in 0..${mask}`);
  }
}

/** Keep the indexing identical in CPU packing and the compute shader. */
export function gpuMeshVoxelIndex(x: number, y: number, z: number): number {
  return x + z * GPU_MESH_WIDTH + y * GPU_MESH_WIDTH * GPU_MESH_WIDTH;
}

/**
 * Pack four byte-sized voxel ids into each u32 because storage buffers require
 * 32-bit scalar access while the authoritative chunk data is Uint8Array.
 */
export function packGpuMeshVoxelBytes(voxels: Uint8Array): Uint32Array {
  if (voxels.length !== GPU_MESH_VOXEL_COUNT) {
    throw new RangeError(`expected ${GPU_MESH_VOXEL_COUNT} halo voxels, got ${voxels.length}`);
  }
  const words = new Uint32Array(GPU_MESH_WORD_COUNT);
  for (let i = 0; i < voxels.length; i++) {
    words[i >>> 2] |= voxels[i] << ((i & 3) << 3);
  }
  return words;
}

/**
 * Build the padded upload payload from the CPU world so collision, saving, and
 * networking remain authoritative while the GPU only owns presentation data.
 */
export function buildGpuMeshChunkPayload(
  chunk: GpuMeshChunkCoord,
  sampleBlock: WorldBlockSampler,
): Uint32Array {
  const voxels = new Uint8Array(GPU_MESH_VOXEL_COUNT);
  const originX = chunk.cx * CFG.CHUNK - GPU_MESH_HALO;
  const originZ = chunk.cz * CFG.CHUNK - GPU_MESH_HALO;
  for (let y = 0; y < GPU_MESH_HEIGHT; y++) {
    const worldY = y - GPU_MESH_HALO;
    for (let z = 0; z < GPU_MESH_WIDTH; z++) {
      const worldZ = originZ + z;
      for (let x = 0; x < GPU_MESH_WIDTH; x++) {
        const worldX = originX + x;
        voxels[gpuMeshVoxelIndex(x, y, z)] =
          worldY < 0 || worldY >= CFG.WORLD_H ? 0 : sampleBlock(worldX, worldY, worldZ);
      }
    }
  }
  return packGpuMeshVoxelBytes(voxels);
}

/** Use the same compact ABI for CPU reference tests and GPU face records. */
export function packGpuMeshFace(record: GpuMeshFaceRecord): readonly [number, number] {
  assertRange('x', record.x, X_MASK);
  assertRange('y', record.y, Y_MASK);
  assertRange('z', record.z, Z_MASK);
  assertRange('face', record.face, FACE_MASK);
  assertRange('tile', record.tile, TILE_MASK);
  assertRange('blockId', record.blockId, BLOCK_MASK);
  assertRange('ao', record.ao, AO_MASK);
  assertRange('flags', record.flags, FLAGS_MASK);

  const header =
    record.x |
    (record.y << 4) |
    (record.z << 10) |
    (record.face << 14) |
    (record.tile << 17) |
    (record.blockId << 23);
  return [header >>> 0, (record.ao | (record.flags << 8)) >>> 0] as const;
}

export function unpackGpuMeshFace(header: number, detail: number): GpuMeshFaceRecord {
  return {
    x: header & X_MASK,
    y: (header >>> 4) & Y_MASK,
    z: (header >>> 10) & Z_MASK,
    face: ((header >>> 14) & FACE_MASK) as GpuMeshFace,
    tile: (header >>> 17) & TILE_MASK,
    blockId: (header >>> 23) & BLOCK_MASK,
    ao: detail & AO_MASK,
    flags: (detail >>> 8) & FLAGS_MASK,
  };
}

/**
 * Three's WebGPURenderer can fall back to WebGL2; storage-buffer compute and
 * indirect drawing must stay disabled unless the active backend is truly WebGPU.
 */
export function detectGpuMeshCapability(renderer: unknown): GpuMeshCapability {
  const backend = (renderer as { backend?: { isWebGPUBackend?: boolean } } | null)?.backend;
  if (!backend?.isWebGPUBackend) {
    return { supported: false, reason: '当前渲染器未使用 WebGPU 后端' };
  }
  return { supported: true, reason: null };
}

/**
 * The first GPU pass only extracts fully opaque faces; keeping cutout and water
 * on the CPU path prevents alpha ordering differences while the core ABI lands.
 */
export function createGpuOpaqueBlockTable(): Uint32Array {
  const table = new Uint32Array(BLOCK_DEF.length);
  for (let id = 0; id < BLOCK_DEF.length; id++) {
    const def = BLOCK_DEF[id];
    if (!def || !def.solid || def.cutout || def.glass || def.water || def.cross) continue;
    const tiles = def.tiles;
    if (!tiles) continue;
    const top = tiles.all ?? tiles.top ?? 0;
    const side = tiles.all ?? tiles.side ?? top;
    const bottom = tiles.all ?? tiles.bottom ?? top;
    table[id] = 1 | (top << 1) | (side << 7) | (bottom << 13);
  }
  return table;
}

/**
 * Sharing records, material, geometry, and indirect arguments prevents every
 * visible chunk from multiplying pipeline compilation and bind work.
 */
export class GpuMeshBatch {
  readonly faces = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_MAX_FACES * GPU_MESH_BATCH_SIZE * 2), 2);
  readonly drawArgs = new THREE.IndirectStorageBufferAttribute(new Uint32Array(GPU_MESH_BATCH_SIZE * GPU_MESH_DRAW_ARG_COUNT), 1);
  readonly origins = new THREE.StorageBufferAttribute(new Int32Array(GPU_MESH_BATCH_SIZE * 2), 2);
  readonly overflow = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_BATCH_SIZE), 1);
  readonly blockTable = new THREE.StorageBufferAttribute(createGpuOpaqueBlockTable(), 1);
  readonly mesh: THREE.Mesh;
  private readonly _freeSlots = Array.from({ length: GPU_MESH_BATCH_SIZE }, (_, index) => index);
  private _usedSlots = 0;

  constructor(atlas: THREE.Texture) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      // Preserve the CPU face winding so FrontSide keeps the exterior visible.
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0,
    ]), 3));
    geometry.setIndirect(this.drawArgs, Array.from({ length: GPU_MESH_BATCH_SIZE }, (_, slot) => slot * 16));

    const faceRecords = storage(this.faces, 'uvec2', GPU_MESH_MAX_FACES * GPU_MESH_BATCH_SIZE).toReadOnly();
    const origins = storage(this.origins, 'ivec2', GPU_MESH_BATCH_SIZE).toReadOnly();
    const header = () => faceRecords.element(instanceIndex).x;
    const face = () => header().shiftRight(uint(14)).bitAnd(uint(FACE_MASK));
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.72, metalness: 0.05 });

    material.positionNode = Fn(() => {
      const packed = header();
      const direction = face();
      const origin = origins.element(instanceIndex.div(uint(GPU_MESH_MAX_FACES)));
      const x = float(packed.bitAnd(uint(X_MASK))).add(float(origin.x));
      const y = float(packed.shiftRight(uint(4)).bitAnd(uint(Y_MASK)));
      const z = float(packed.shiftRight(uint(10)).bitAnd(uint(Z_MASK))).add(float(origin.y));
      const q = positionGeometry;
      // Each branch follows the CPU face order, keeping front-face culling on
      // without relying on the costly double-sided fallback.
      const top = vec3(x.add(q.x), y.add(1), z.add(float(1).sub(q.y)));
      const bottom = vec3(x.add(q.x), y, z.add(q.y));
      const east = vec3(x.add(1), y.add(q.y), z.add(float(1).sub(q.x)));
      const west = vec3(x, y.add(q.y), z.add(q.x));
      const south = vec3(x.add(q.x), y.add(q.y), z.add(1));
      const north = vec3(x.add(float(1).sub(q.x)), y.add(q.y), z);
      return direction.equal(uint(0)).select(top,
        direction.equal(uint(1)).select(bottom,
          direction.equal(uint(2)).select(east,
            direction.equal(uint(3)).select(west,
              direction.equal(uint(4)).select(south, north)))));
    })();
    material.normalNode = Fn(() => {
      const direction = face();
      return direction.equal(uint(0)).select(vec3(0, 1, 0),
        direction.equal(uint(1)).select(vec3(0, -1, 0),
          direction.equal(uint(2)).select(vec3(1, 0, 0),
            direction.equal(uint(3)).select(vec3(-1, 0, 0),
              direction.equal(uint(4)).select(vec3(0, 0, 1), vec3(0, 0, -1))))));
    })();
    material.colorNode = texture(atlas, Fn(() => {
      const tile = header().shiftRight(uint(17)).bitAnd(uint(TILE_MASK));
      const tileX = float(tile.mod(uint(8)));
      const tileY = float(tile.div(uint(8)));
      const q = positionGeometry;
      return vec2(
        tileX.mul(34).add(1.5).add(q.x.mul(31)).div(272),
        float(1).sub(tileY.mul(34).add(32.5).div(272)).add(q.y.mul(31).div(272)),
      );
    })());
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.matrixAutoUpdate = false;
    // A per-chunk world-space bound preserves culling without losing shader-offset faces.
    this.mesh.frustumCulled = true;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  get hasCapacity(): boolean { return this._freeSlots.length > 0; }
  get empty(): boolean { return this._usedSlots === 0; }

  allocate(cx: number, cz: number): number {
    const slot = this._freeSlots.pop();
    if (slot === undefined) throw new Error('GPU mesh batch is full');
    this._usedSlots++;
    const origins = this.origins.array as Int32Array;
    origins[slot * 2] = cx * CFG.CHUNK;
    origins[slot * 2 + 1] = cz * CFG.CHUNK;
    this.mesh.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(cx * CFG.CHUNK + CFG.CHUNK / 2, CFG.WORLD_H / 2, cz * CFG.CHUNK + CFG.CHUNK / 2),
      Math.hypot(CFG.CHUNK / 2, CFG.WORLD_H / 2, CFG.CHUNK / 2),
    );
    this.origins.needsUpdate = true;
    return slot;
  }

  release(slot: number): void {
    if (this._freeSlots.includes(slot)) return;
    this._freeSlots.push(slot);
    this._usedSlots--;
    const draw = this.drawArgs.array as Uint32Array;
    draw[slot * GPU_MESH_DRAW_ARG_COUNT + 1] = 0;
    this.drawArgs.needsUpdate = true;
  }

  dispose(): void {
    this.faces.dispose();
    this.drawArgs.dispose();
    this.origins.dispose();
    this.overflow.dispose();
    this.blockTable.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Per-chunk voxel uploads stay isolated because edits are local, while their
 * extracted faces are written into a shared batch for a single render object.
 */
export class GpuMeshChunkCompute {
  readonly voxels = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_WORD_COUNT), 1);
  readonly extractNode;
  private _disposed = false;

  constructor(readonly batch: GpuMeshBatch, readonly batchSlot: number) {
    const voxelWords = storage(this.voxels, 'uint', GPU_MESH_WORD_COUNT).toReadOnly();
    const faceRecords = storage(batch.faces, 'uvec2', GPU_MESH_MAX_FACES * GPU_MESH_BATCH_SIZE);
    const draw = storage(batch.drawArgs, 'uint', GPU_MESH_BATCH_SIZE * GPU_MESH_DRAW_ARG_COUNT).toAtomic();
    const overflow = storage(batch.overflow, 'uint', GPU_MESH_BATCH_SIZE).toAtomic();
    const blockTable = storage(batch.blockTable, 'uint', BLOCK_DEF.length).toReadOnly();
    const drawBase = uint(batchSlot * GPU_MESH_DRAW_ARG_COUNT);
    const faceBase = uint(batchSlot * GPU_MESH_MAX_FACES);
    const overflowSlot = uint(batchSlot);

    this.extractNode = Fn(() => {
      const index = instanceIndex;
      const x = index.mod(uint(CFG.CHUNK)).toVar();
      const z = index.div(uint(CFG.CHUNK)).mod(uint(CFG.CHUNK)).toVar();
      const y = index.div(uint(CFG.CHUNK * CFG.CHUNK)).toVar();
      const voxelAt = (sampleX: UintNode, sampleY: UintNode, sampleZ: UintNode) => {
        const padded = sampleX.add(sampleZ.mul(uint(GPU_MESH_WIDTH))).add(sampleY.mul(uint(GPU_MESH_WIDTH * GPU_MESH_WIDTH)));
        return voxelWords.element(padded.div(uint(4))).shiftRight(padded.mod(uint(4)).mul(uint(8))).bitAnd(uint(0xff));
      };
      const paddedX = x.add(uint(1)), paddedY = y.add(uint(1)), paddedZ = z.add(uint(1));
      const id = voxelAt(paddedX, paddedY, paddedZ).toVar();
      const data = blockTable.element(id).toVar();
      If(data.bitAnd(uint(1)).equal(uint(1)), () => {
        const tileForFace = (face: number) => face === 0
          ? data.shiftRight(uint(1)).bitAnd(uint(0x3f))
          : face === 1 ? data.shiftRight(uint(13)).bitAnd(uint(0x3f)) : data.shiftRight(uint(7)).bitAnd(uint(0x3f));
        const emit = (face: number, dx: number, dy: number, dz: number): void => {
          const offset = (value: UintNode, delta: number) => delta < 0 ? value.sub(uint(-delta)) : delta > 0 ? value.add(uint(delta)) : value;
          const neighbor = voxelAt(offset(paddedX, dx), offset(paddedY, dy), offset(paddedZ, dz));
          If(blockTable.element(neighbor).bitAnd(uint(1)).equal(uint(1)).not(), () => {
            const localSlot = atomicAdd(draw.element(drawBase.add(uint(1))), uint(1)).toVar();
            If(localSlot.lessThan(uint(GPU_MESH_MAX_FACES)), () => {
              const header = x.bitOr(y.shiftLeft(uint(4))).bitOr(z.shiftLeft(uint(10))).bitOr(uint(face).shiftLeft(uint(14))).bitOr(tileForFace(face).shiftLeft(uint(17))).bitOr(id.shiftLeft(uint(23)));
              faceRecords.element(faceBase.add(localSlot)).assign(uvec2(header, uint(0)));
            }).Else(() => {
              atomicOr(overflow.element(overflowSlot), uint(1));
            });
          });
        };
        emit(0, 0, 1, 0); emit(1, 0, -1, 0); emit(2, 1, 0, 0);
        emit(3, -1, 0, 0); emit(4, 0, 0, 1); emit(5, 0, 0, -1);
      });
    })().compute(CFG.CHUNK * CFG.CHUNK * CFG.WORLD_H, [64]);
  }

  upload(payload: Uint32Array): void {
    if (this._disposed) throw new Error('GPU mesh chunk has been disposed');
    if (payload.length !== GPU_MESH_WORD_COUNT) throw new RangeError(`expected ${GPU_MESH_WORD_COUNT} GPU mesh words, got ${payload.length}`);
    (this.voxels.array as Uint32Array).set(payload);
    this.voxels.needsUpdate = true;
  }

  /**
   * CPU uploads establish an exact baseline without relying on atomicStore's
   * void return value being inferred correctly by every TSL code path.
   */
  resetCounters(): void {
    if (this._disposed) return;
    const draw = this.batch.drawArgs.array as Uint32Array;
    const drawOffset = this.batchSlot * GPU_MESH_DRAW_ARG_COUNT;
    draw[drawOffset] = 6;
    draw[drawOffset + 1] = 0;
    draw[drawOffset + 2] = 0;
    draw[drawOffset + 3] = this.batchSlot * GPU_MESH_MAX_FACES;
    this.batch.drawArgs.needsUpdate = true;
    (this.batch.overflow.array as Uint32Array)[this.batchSlot] = 0;
    this.batch.overflow.needsUpdate = true;
  }

  dispatch(renderer: THREE.WebGPURenderer): void {
    if (this._disposed) return;
    this.resetCounters();
    renderer.compute(this.extractNode);
  }

  /**
   * Read back only the counters and first record needed to explain a blank
   * draw; a bounded sample keeps diagnostics from becoming a new frame cost.
   */
  async readbackDiagnostics(renderer: THREE.WebGPURenderer, label: string): Promise<void> {
    if (this._disposed) return;
    const drawOffset = this.batchSlot * GPU_MESH_DRAW_ARG_COUNT * 4;
    const faceOffset = this.batchSlot * GPU_MESH_MAX_FACES * 8;
    const [drawBuffer, overflowBuffer, faceBuffer] = await Promise.all([
      renderer.getArrayBufferAsync(this.batch.drawArgs, null, drawOffset, GPU_MESH_DRAW_ARG_COUNT * 4),
      renderer.getArrayBufferAsync(this.batch.overflow, null, this.batchSlot * 4, 4),
      renderer.getArrayBufferAsync(this.batch.faces, null, faceOffset, 8),
    ]);
    const draw = new Uint32Array(drawBuffer);
    const overflow = new Uint32Array(overflowBuffer)[0];
    const face = new Uint32Array(faceBuffer);
    console.warn('[gpu-mesh] dispatch readback', {
      label,
      slot: this.batchSlot,
      draw: { vertexCount: draw[0], instanceCount: draw[1], firstVertex: draw[2], firstInstance: draw[3] },
      overflow,
      firstFace: { header: face[0], detail: face[1] },
    });
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.voxels.dispose();
    this.batch.release(this.batchSlot);
  }
}
