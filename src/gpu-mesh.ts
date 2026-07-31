import * as THREE from 'three/webgpu';
import { Fn, If, atomicAdd, atomicOr, float, fract, instanceIndex, positionGeometry, storage, texture, transformNormalToView, uint, vec2, vec3 } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type StorageBufferNode from 'three/src/nodes/accessors/StorageBufferNode.js';
import type ComputeNode from 'three/src/nodes/gpgpu/ComputeNode.js';
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
 * is enabled. This is the conservative fallback for devices without it.
 */
export const GPU_MESH_BATCH_SIZE = 1;
/** Keep batches bounded so frustum bounds and storage allocations stay manageable. */
export const GPU_MESH_MAX_BATCH_SIZE = 8;

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
  width: number;
  height: number;
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
  assertRange('width', record.width, 0xff);
  assertRange('height', record.height, 0xff);

  const header =
    record.x |
    (record.y << 4) |
    (record.z << 10) |
    (record.face << 14) |
    (record.tile << 17) |
    (record.blockId << 23);
  return [header >>> 0, (record.ao | (record.flags << 8) | (record.width << 16) | (record.height << 24)) >>> 0] as const;
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
    width: (detail >>> 16) & 0xff,
    height: (detail >>> 24) & 0xff,
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
 * Non-zero indirect firstInstance is optional in WebGPU. Use larger batches
 * only when the active device advertises the feature; the one-slot path remains
 * the portable fallback.
 */
export function detectGpuMeshBatchSize(renderer: unknown): number {
  const backend = (renderer as {
    backend?: {
      isWebGPUBackend?: boolean;
      device?: { features?: { has?: (feature: string) => boolean } };
    };
  } | null)?.backend;
  if (!backend?.isWebGPUBackend || backend.device?.features?.has?.('indirect-first-instance') !== true) {
    return GPU_MESH_BATCH_SIZE;
  }
  return GPU_MESH_MAX_BATCH_SIZE;
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

/** A bounded indirect batch keeps pipeline and draw overhead predictable. */
export class GpuMeshBatch {
  readonly faces: THREE.StorageBufferAttribute;
  readonly faceDetails: THREE.StorageBufferAttribute;
  readonly drawArgs: THREE.IndirectStorageBufferAttribute;
  readonly origins: THREE.StorageBufferAttribute;
  readonly overflow: THREE.StorageBufferAttribute;
  readonly blockTable = new THREE.StorageBufferAttribute(createGpuOpaqueBlockTable(), 1);
  readonly mesh: THREE.Mesh;
  private readonly _freeSlots: number[];
  private readonly _slotCoords: Array<GpuMeshChunkCoord | null>;
  readonly batchSize: number;
  private _usedSlots = 0;

  constructor(atlas: THREE.Texture, batchSize = GPU_MESH_BATCH_SIZE) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > GPU_MESH_MAX_BATCH_SIZE) {
      throw new RangeError(`GPU mesh batch size must be an integer in 1..${GPU_MESH_MAX_BATCH_SIZE}`);
    }
    this.batchSize = batchSize;
    this.faces = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_MAX_FACES * batchSize * 2), 2);
    this.faceDetails = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_MAX_FACES * batchSize), 1);
    this.drawArgs = new THREE.IndirectStorageBufferAttribute(new Uint32Array(batchSize * GPU_MESH_DRAW_ARG_COUNT), 1);
    this.origins = new THREE.StorageBufferAttribute(new Int32Array(batchSize * 2), 2);
    this.overflow = new THREE.StorageBufferAttribute(new Uint32Array(batchSize), 1);
    this._freeSlots = Array.from({ length: batchSize }, (_, index) => index);
    this._slotCoords = Array.from({ length: batchSize }, () => null);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      // Preserve the CPU face winding so FrontSide keeps the exterior visible.
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0,
    ]), 3));
    geometry.setIndirect(this.drawArgs, Array.from({ length: batchSize }, (_, slot) => slot * 16));

    const faceRecords = storage(this.faces, 'uvec2', GPU_MESH_MAX_FACES * batchSize).toReadOnly();
    const faceDetails = storage(this.faceDetails, 'uint', GPU_MESH_MAX_FACES * batchSize).toReadOnly();
    const origins = storage(this.origins, 'ivec2', batchSize).toReadOnly();
    const header = () => faceRecords.element(instanceIndex).x;
    const face = () => header().shiftRight(uint(14)).bitAnd(uint(FACE_MASK));
    // This pass contains opaque blocks only. Do not let the atlas alpha channel
    // turn transparent gutter/cutout samples into blended terrain.
    const material = new THREE.MeshStandardNodeMaterial({
      roughness: 0.72,
      metalness: 0.05,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      alphaTest: 0,
      // The six face branches are reconstructed in the vertex shader. Keep
      // the GPU path consistent with the CPU terrain material so a backend
      // specific front-face convention cannot cull one whole direction.
      side: THREE.DoubleSide,
    });

    material.positionNode = Fn(() => {
      const packed = header();
      const direction = face();
      const origin = origins.element(instanceIndex.div(uint(GPU_MESH_MAX_FACES)));
      const x = float(packed.bitAnd(uint(X_MASK))).add(float(origin.x));
      const y = float(packed.shiftRight(uint(4)).bitAnd(uint(Y_MASK)));
      const z = float(packed.shiftRight(uint(10)).bitAnd(uint(Z_MASK))).add(float(origin.y));
      const q = positionGeometry;
      const detail = faceDetails.element(instanceIndex);
      const width = float(detail.shiftRight(uint(16)).bitAnd(uint(0xff)));
      const height = float(detail.shiftRight(uint(24)).bitAnd(uint(0xff)));
      // Each branch follows the CPU face order. DoubleSide above is deliberate:
      // the mesh is shader-reconstructed and must not lose a direction when a
      // WebGPU backend applies a different front-face convention.
      const top = vec3(x.add(q.x.mul(width)), y.add(1), z.add(height.sub(q.y.mul(height))));
      const bottom = vec3(x.add(q.x.mul(width)), y, z.add(q.y.mul(height)));
      const east = vec3(x.add(1), y.add(q.y.mul(height)), z.add(width.sub(q.x.mul(width))));
      const west = vec3(x, y.add(q.y.mul(height)), z.add(q.x.mul(width)));
      const south = vec3(x.add(q.x.mul(width)), y.add(q.y.mul(height)), z.add(1));
      const north = vec3(x.add(width.sub(q.x.mul(width))), y.add(q.y.mul(height)), z);
      return direction.equal(uint(0)).select(top,
        direction.equal(uint(1)).select(bottom,
          direction.equal(uint(2)).select(east,
            direction.equal(uint(3)).select(west,
              direction.equal(uint(4)).select(south, north)))));
    })();
    material.normalNode = Fn(() => {
      const direction = face();
      const localNormal = direction.equal(uint(0)).select(vec3(0, 1, 0),
        direction.equal(uint(1)).select(vec3(0, -1, 0),
          direction.equal(uint(2)).select(vec3(1, 0, 0),
            direction.equal(uint(3)).select(vec3(-1, 0, 0),
              direction.equal(uint(4)).select(vec3(0, 0, 1), vec3(0, 0, -1))))));
      // NodeMaterial.normalNode is consumed as a view-space normal. The face
      // table stores object/world-axis directions, so passing them through
      // unchanged makes lighting and CSM bias camera-dependent and can make a
      // fixed direction appear to disappear on only part of the terrain.
      return transformNormalToView(localNormal);
    })();
    material.colorNode = texture(atlas, Fn(() => {
      const tile = header().shiftRight(uint(17)).bitAnd(uint(TILE_MASK));
      const tileX = float(tile.mod(uint(8)));
      const tileY = float(tile.div(uint(8)));
      const q = positionGeometry;
      const detail = faceDetails.element(instanceIndex);
      const width = float(detail.shiftRight(uint(16)).bitAnd(uint(0xff)));
      const height = float(detail.shiftRight(uint(24)).bitAnd(uint(0xff)));
      const local = fract(vec2(q.x.mul(width), q.y.mul(height)));
      return vec2(
        tileX.mul(34).add(1.5).add(local.x.mul(31)).div(272),
        float(1).sub(tileY.mul(34).add(32.5).sub(local.y.mul(31)).div(272)),
      );
    })()).rgb;
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
    this.origins.needsUpdate = true;
    this._slotCoords[slot] = { cx, cz };
    this._updateBounds();
    return slot;
  }

  release(slot: number): void {
    if (this._freeSlots.includes(slot)) return;
    this._freeSlots.push(slot);
    this._usedSlots--;
    const draw = this.drawArgs.array as Uint32Array;
    draw[slot * GPU_MESH_DRAW_ARG_COUNT + 1] = 0;
    this.drawArgs.needsUpdate = true;
    this._slotCoords[slot] = null;
    this._updateBounds();
  }

  private _updateBounds(): void {
    const active = this._slotCoords.filter((coord): coord is GpuMeshChunkCoord => coord !== null);
    if (active.length === 0) {
      this.mesh.geometry.boundingSphere = null;
      return;
    }
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const coord of active) {
      minX = Math.min(minX, coord.cx * CFG.CHUNK);
      minZ = Math.min(minZ, coord.cz * CFG.CHUNK);
      maxX = Math.max(maxX, (coord.cx + 1) * CFG.CHUNK);
      maxZ = Math.max(maxZ, (coord.cz + 1) * CFG.CHUNK);
    }
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    this.mesh.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(centerX, CFG.WORLD_H / 2, centerZ),
      Math.hypot((maxX - minX) / 2, CFG.WORLD_H / 2, (maxZ - minZ) / 2),
    );
  }

  dispose(): void {
    this.faces.dispose();
    this.faceDetails.dispose();
    this.drawArgs.dispose();
    this.origins.dispose();
    this.overflow.dispose();
    this.blockTable.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Reuse one shader node so Three.js can reuse its compute pipeline; only the
 * storage bindings change between chunks, which avoids compiling WGSL per job.
 */
export class GpuMeshExtractKernel {
  readonly voxels: StorageBufferNode<'uint'>;
  readonly faceRecords: StorageBufferNode<'uvec2'>;
  readonly faceDetails: StorageBufferNode<'uint'>;
  readonly draw: StorageBufferNode<'uint'>;
  readonly overflow: StorageBufferNode<'uint'>;
  readonly blockTable: StorageBufferNode<'uint'>;
  readonly extractNode: ComputeNode;

  constructor() {
    // The final word stores the batch slot for this resource. Keeping the
    // metadata in the per-chunk voxel binding avoids rebinding a second small
    // storage buffer between consecutive dispatches of the shared kernel.
    const dummyVoxels = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_WORD_COUNT + 1), 1);
    const dummyFaces = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_MAX_FACES * 2), 2);
    const dummyFaceDetails = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_MAX_FACES), 1);
    const dummyDraw = new THREE.IndirectStorageBufferAttribute(new Uint32Array(GPU_MESH_DRAW_ARG_COUNT), 1);
    const dummyOverflow = new THREE.StorageBufferAttribute(new Uint32Array(1), 1);
    const dummyTable = new THREE.StorageBufferAttribute(createGpuOpaqueBlockTable(), 1);
    this.voxels = storage(dummyVoxels, 'uint', GPU_MESH_WORD_COUNT + 1).toReadOnly();
    this.faceRecords = storage(dummyFaces, 'uvec2', GPU_MESH_MAX_FACES);
    this.faceDetails = storage(dummyFaceDetails, 'uint', GPU_MESH_MAX_FACES);
    this.draw = storage(dummyDraw, 'uint', GPU_MESH_DRAW_ARG_COUNT).toAtomic();
    this.overflow = storage(dummyOverflow, 'uint', 1).toAtomic();
    this.blockTable = storage(dummyTable, 'uint', BLOCK_DEF.length).toReadOnly();

    const voxelWords = this.voxels;
    const faceRecords = this.faceRecords;
    const faceDetails = this.faceDetails;
    const draw = this.draw;
    const overflow = this.overflow;
    const blockTable = this.blockTable;
    this.extractNode = Fn(() => {
      const batchSlot = voxelWords.element(uint(GPU_MESH_WORD_COUNT));
      const drawBase = batchSlot.mul(uint(GPU_MESH_DRAW_ARG_COUNT));
      const faceBase = batchSlot.mul(uint(GPU_MESH_MAX_FACES));
      const index = instanceIndex;
      const x = index.mod(uint(CFG.CHUNK));
      const z = index.div(uint(CFG.CHUNK)).mod(uint(CFG.CHUNK));
      const y = index.div(uint(CFG.CHUNK * CFG.CHUNK));
      const voxelAt = (sampleX: UintNode, sampleY: UintNode, sampleZ: UintNode) => {
        const padded = sampleX.add(sampleZ.mul(uint(GPU_MESH_WIDTH))).add(sampleY.mul(uint(GPU_MESH_WIDTH * GPU_MESH_WIDTH)));
        return voxelWords.element(padded.div(uint(4))).shiftRight(padded.mod(uint(4)).mul(uint(8))).bitAnd(uint(0xff));
      };
      const paddedX = x.add(uint(1));
      const paddedY = y.add(uint(1));
      const paddedZ = z.add(uint(1));
      const id = voxelAt(paddedX, paddedY, paddedZ);
      const data = blockTable.element(id);
      If(data.bitAnd(uint(1)).equal(uint(1)), () => {
        const tileForFace = (face: number) => face === 0
          ? data.shiftRight(uint(1)).bitAnd(uint(0x3f))
          : face === 1
            ? data.shiftRight(uint(13)).bitAnd(uint(0x3f))
            : data.shiftRight(uint(7)).bitAnd(uint(0x3f));
        const offset = (value: UintNode, delta: number) => delta < 0
          ? value.sub(uint(-delta))
          : delta > 0
            ? value.add(uint(delta))
            : value;
        const emit = (face: number, dx: number, dy: number, dz: number): void => {
          const neighbor = voxelAt(offset(paddedX, dx), offset(paddedY, dy), offset(paddedZ, dz));
          If(blockTable.element(neighbor).bitAnd(uint(1)).equal(uint(1)).not(), () => {
            const localSlot = atomicAdd<'uint'>(draw.element(drawBase.add(uint(1))), uint(1)).toVar();
            If(localSlot.lessThan(uint(GPU_MESH_MAX_FACES)), () => {
              const header = x.bitOr(y.shiftLeft(uint(4))).bitOr(z.shiftLeft(uint(10))).bitOr(uint(face).shiftLeft(uint(14))).bitOr(tileForFace(face).shiftLeft(uint(17))).bitOr(id.shiftLeft(uint(23)));
              // A face remains attached to its owning voxel; avoiding cross-cell
              // expansion prevents isolated trunks from producing orphan planes.
              const detail = uint(1).shiftLeft(uint(16)).bitOr(uint(1).shiftLeft(uint(24)));
              faceRecords.element(faceBase.add(localSlot)).x.assign(header);
              faceDetails.element(faceBase.add(localSlot)).assign(detail);
            }).Else(() => {
              atomicOr(overflow.element(batchSlot), uint(1));
            });
          });
        };
        emit(0, 0, 1, 0);
        emit(1, 0, -1, 0);
        emit(2, 1, 0, 0);
        emit(3, -1, 0, 0);
        emit(4, 0, 0, 1);
        emit(5, 0, 0, -1);
      });
    })().compute(CFG.CHUNK * CFG.CHUNK * CFG.WORLD_H, [64]);
  }

  bind(resource: GpuMeshChunkCompute): void {
    this.voxels.value = resource.voxels;
    this.faceRecords.value = resource.batch.faces;
    this.faceDetails.value = resource.batch.faceDetails;
    this.draw.value = resource.batch.drawArgs;
    this.overflow.value = resource.batch.overflow;
    this.blockTable.value = resource.batch.blockTable;
  }
}

/**
 * Per-chunk voxel uploads stay isolated because edits are local, while their
 * extracted faces are written into a shared batch for a single render object.
 */
export class GpuMeshChunkCompute {
  readonly voxels = new THREE.StorageBufferAttribute(new Uint32Array(GPU_MESH_WORD_COUNT + 1), 1);
  readonly extractNode: ComputeNode;
  private _disposed = false;

  constructor(readonly batch: GpuMeshBatch, readonly batchSlot: number, readonly kernel = new GpuMeshExtractKernel()) {
    this.extractNode = kernel.extractNode;
  }

  upload(payload: Uint32Array): void {
    if (this._disposed) throw new Error('GPU mesh chunk has been disposed');
    if (payload.length !== GPU_MESH_WORD_COUNT) throw new RangeError(`expected ${GPU_MESH_WORD_COUNT} GPU mesh words, got ${payload.length}`);
    const words = this.voxels.array as Uint32Array;
    words.set(payload);
    words[GPU_MESH_WORD_COUNT] = this.batchSlot;
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
    this.kernel.bind(this);
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
    const detailOffset = this.batchSlot * GPU_MESH_MAX_FACES * 4;
    const [drawBuffer, overflowBuffer, faceBuffer, detailBuffer] = await Promise.all([
      renderer.getArrayBufferAsync(this.batch.drawArgs, null, drawOffset, GPU_MESH_DRAW_ARG_COUNT * 4),
      renderer.getArrayBufferAsync(this.batch.overflow, null, this.batchSlot * 4, 4),
      renderer.getArrayBufferAsync(this.batch.faces, null, faceOffset, 8),
      renderer.getArrayBufferAsync(this.batch.faceDetails, null, detailOffset, 4),
    ]);
    const draw = new Uint32Array(drawBuffer);
    const overflow = new Uint32Array(overflowBuffer)[0];
    const face = new Uint32Array(faceBuffer);
    const detail = new Uint32Array(detailBuffer)[0];
    console.warn('[gpu-mesh] dispatch readback', {
      label,
      slot: this.batchSlot,
      draw: { vertexCount: draw[0], instanceCount: draw[1], firstVertex: draw[2], firstInstance: draw[3] },
      overflow,
      firstFace: { header: face[0], detail: face[1], separateDetail: detail },
    });
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.voxels.dispose();
    this.batch.release(this.batchSlot);
  }
}
