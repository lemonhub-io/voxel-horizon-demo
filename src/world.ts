// ============================================================
// world.ts — Chunk + World class (performance optimized)
// ============================================================

import * as THREE from 'three/webgpu';
import { U, SimplexNoise } from './utils';
import { CFG, B, BLOCK_DEF } from './config';
import type { Game, Palette, RaycastResult, ScanTarget, MeshBuffers } from './types';

export class Chunk {
  cx: number;
  cz: number;
  data: Uint8Array;
  meshes: THREE.Mesh[];
  built: boolean;
  dirty: boolean;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CFG.CHUNK * CFG.CHUNK * CFG.WORLD_H);
    this.meshes = [];
    this.built = false;
    this.dirty = false;
  }

  idx(x: number, y: number, z: number): number { return x + z * 16 + y * 256; }
  get(x: number, y: number, z: number): number { return this.data[x + z * 16 + y * 256]; }
  set(x: number, y: number, z: number, id: number): void { this.data[x + z * 16 + y * 256] = id; }
}

export class World {
  g: Game;
  chunks: Map<string, Chunk>;
  edits: Map<string, Map<number, number>>;
  group: THREE.Group;
  genQueue: Chunk[];
  meshQueue: Chunk[];
  meshQueueSet: Set<Chunk>;
  lampLights: THREE.PointLight[];
  lampPool: THREE.PointLight[];
  heightCache: Map<string, number>;
  matsReady: boolean;
  seed!: number;
  pal!: Palette;
  noise!: SimplexNoise;
  noiseB!: SimplexNoise;
  noiseC!: SimplexNoise;
  offA!: number;
  lamps!: number[][];
  matOpaque!: THREE.MeshStandardMaterial;
  matCutout!: THREE.MeshStandardMaterial;
  matWater!: THREE.MeshStandardMaterial;
  private _waterTSLMat: THREE.Material | null = null;
  waterCamPos: THREE.Vector3 | null = null;
  cullFrame: number;

  constructor(game: Game) {
    this.g = game;
    this.chunks = new Map();
    this.edits = new Map();
    this.group = new THREE.Group();
    this.g.scene.add(this.group);
    this.genQueue = [];
    this.meshQueue = [];
    this.meshQueueSet = new Set();
    this.lampLights = [];
    this.lampPool = [];
    this.heightCache = new Map();
    this.matsReady = false;
    this.cullFrame = 0;
  }

  setPlanet(seed: number, pal: Palette): void {
    this.dispose();
    this.seed = seed;
    this.pal = pal;
    const rng = U.mulberry32(seed);
    this.noise = new SimplexNoise(seed);
    this.noiseB = new SimplexNoise(seed ^ 0xbeef);
    this.noiseC = new SimplexNoise(seed ^ 0x1234);
    this.offA = rng() * 1000;
    this.edits = new Map();
    this.heightCache = new Map();
    this.lamps = [];
    this.buildMaterials();
  }

  buildMaterials(): void {
    const tex = this.g.atlas.texture;
    const normalMap = this.g.atlas.normalTexture;
    if (this.matOpaque) {
      this.matOpaque.map = tex; this.matCutout.map = tex; this.matWater.map = tex;
      this.matOpaque.normalMap = normalMap;
      this.matOpaque.needsUpdate = this.matCutout.needsUpdate = this.matWater.needsUpdate = true;
      return;
    }

    // PBR materials for better lighting
    this.matOpaque = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.72, metalness: 0.05
    });
    this.matOpaque.normalMap = normalMap;
    // Stronger normals read better under cinematic lighting / CSM.
    this.matOpaque.normalScale.set(0.42, 0.42);
    this.matCutout = new THREE.MeshStandardMaterial({
      vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide,
      alphaToCoverage: true, roughness: 0.8, metalness: 0.02
    });
    this.matWater = new THREE.MeshStandardMaterial({
      vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
      roughness: 0.1, metalness: 0.3
    });
    this.matOpaque.map = tex;
    this.matCutout.map = tex;
    this.matWater.map = tex;
  }

  /** Update water Fresnel effect — more reflective at grazing angles */
  updateWaterFresnel(): void {
    if (!this.g.player) return;
    const cam = this.g.camera;
    // Camera look direction dot up vector = cos(angle from horizontal)
    const lookY = Math.abs(Math.sin(cam.rotation.x));
    // Fresnel: more transparent when looking straight down, more reflective at grazing
    const fresnel = Math.pow(1 - lookY, 3);
    this.matWater.opacity = 0.55 + fresnel * 0.35;
    this.matWater.roughness = 0.25 - fresnel * 0.2;
  }

  key(cx: number, cz: number): string { return cx + ',' + cz; }

  genColumn(gx: number, gz: number): number {
    const n1 = this.noise.fbm2(gx * 0.0085, gz * 0.0085, 4, 2, 0.5);
    const n2 = this.noiseB.noise2(gx * 0.003, gz * 0.003);
    const mountain = Math.max(0, n2) * Math.max(0, n2) * 26;
    return Math.min(Math.floor(30 + n1 * 9 + mountain), CFG.WORLD_H - 8);
  }

  findLand(sx: number, sz: number): { x: number; z: number } {
    if (!this.pal.sea) return { x: sx, z: sz };
    for (let r = 0; r < 24; r++) {
      for (let a = 0; a < 8; a++) {
        const x = Math.floor(sx + Math.cos(a * 0.785) * r * 6);
        const z = Math.floor(sz + Math.sin(a * 0.785) * r * 6);
        if (this.genColumn(x, z) >= CFG.SEA + 2) return { x, z };
      }
    }
    return { x: sx, z: sz };
  }

  surfaceY(gx: number, gz: number): number {
    const k = gx + ',' + gz;
    let h = this.heightCache.get(k);
    if (h === undefined) { h = this.genColumn(gx, gz); this.heightCache.set(k, h); }
    return h;
  }

  /**
   * Shallow ferrite veins / surface outcrops embedded in terrain.
   * Uses dual 3D noise so deposits form connected pods rather than single
   * blocks floating on grass (the old pal.rock surface decoration).
   *
   * Band: surface (depth 0) down to ~9 blocks — can replace grass/dirt/stone
   * so iron reads as part of the ground, not a prop on top of it.
   */
  private isFerriteOre(gx: number, y: number, gz: number, surfaceH: number): boolean {
    const depth = surfaceH - y;
    if (depth < 0 || depth > 9 || y <= 2) return false;

    // Primary field + secondary ridge → blob / lens shaped veins
    const field = this.noise.noise3(gx * 0.078, y * 0.1, gz * 0.078);
    const ridge = this.noiseB.noise3(gx * 0.042 + 19.7, y * 0.055 + 3.1, gz * 0.042 - 8.4);
    const vein = field * 0.62 + ridge * 0.38;

    // Easier to expose near the surface (outcrops), rarer deeper in the band
    let thresh: number;
    if (depth === 0) thresh = 0.56;       // flush surface outcrop (replaces grass)
    else if (depth <= 2) thresh = 0.54;  // topsoil pocket
    else if (depth <= 5) thresh = 0.6;
    else thresh = 0.66;

    // Palette rock density slightly increases ore frequency
    const dens = this.pal?.rock ?? 0.014;
    thresh -= Math.min(0.1, dens * 3.5);

    // Require mild ridge support so veins stay clumpy, not salt-and-pepper
    return vein > thresh && ridge > -0.05;
  }

  /** Deep copper veins (unchanged depth policy, shared ore-placement path). */
  private isCopperOre(gx: number, y: number, gz: number, surfaceH: number): boolean {
    if (y <= 3 || y >= surfaceH - 6) return false;
    return this.noiseB.noise3(gx * 0.11, y * 0.13, gz * 0.11) > 0.72;
  }

  generate(chunk: Chunk): void {
    const { cx, cz } = chunk;
    const pal = this.pal;
    const sea = pal.sea ? CFG.SEA : -1;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const gx = cx * 16 + lx, gz = cz * 16 + lz;
      const h = this.surfaceY(gx, gz);
      for (let y = 0; y <= Math.max(h, sea); y++) {
        let id = B.AIR;
        if (y === 0) id = B.BEDROCK;
        else if (y <= h) {
          if (y === h) id = (h <= sea + 1 && pal.sea) ? B.SAND : B.GRASS;
          else if (y >= h - 3) id = (h <= sea + 1 && pal.sea) ? B.SAND : B.DIRT;
          else {
            id = B.STONE;
            const cave = this.noiseC.noise3(gx * 0.06, y * 0.09, gz * 0.06);
            if (cave > 0.62 && y > 3 && y < h - 4) id = B.AIR;
          }

          // Ores replace solid ground (not air/water/bedrock/beach sand).
          // Ferrite: shallow veins + surface outcrops. Copper: deeper stone only.
          if (id !== B.AIR && id !== B.BEDROCK && id !== B.SAND) {
            if (this.isCopperOre(gx, y, gz, h)) id = B.COPPER;
            else if (this.isFerriteOre(gx, y, gz, h)) id = B.FERRITE;
          }
        } else if (y <= sea) id = B.WATER;
        chunk.set(lx, y, lz, id);
      }
      // Surface flora only — ferrite no longer spawns as isolated props on grass.
      if (h > sea + (pal.sea ? 0 : -99) && h < CFG.WORLD_H - 10 && chunk.get(lx, h, lz) === B.GRASS) {
        const r = U.hash2(gx, gz, this.seed);
        const t = pal.trees;
        if (r < t.density && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) {
          this.plantTree(chunk, lx, h + 1, lz, U.pick(t.types, U.mulberry32(this.seed ^ (gx * 31 + gz * 17))), gx, gz);
        } else if (r < t.density + pal.tuft) chunk.set(lx, h + 1, lz, B.TUFT);
        else if (r < t.density + pal.tuft + pal.plant) chunk.set(lx, h + 1, lz, B.PLANT);
        else if (r < t.density + pal.tuft + pal.plant + pal.na) chunk.set(lx, h + 1, lz, B.NA_PLANT);
        else if (r < t.density + pal.tuft + pal.plant + pal.na + pal.o2) chunk.set(lx, h + 1, lz, B.O_PLANT);
        else if (r < t.density + pal.tuft + pal.plant + pal.na + pal.o2 + pal.h2) chunk.set(lx, h + 1, lz, B.H_CRYS);
      } else if (!pal.sea && h < CFG.WORLD_H - 10) {
        const r = U.hash2(gx, gz, this.seed);
        // Only flora on arid surfaces; iron is handled by isFerriteOre.
        if (r < pal.h2) chunk.set(lx, h + 1, lz, B.H_CRYS);
        else if (r < pal.h2 + pal.na) chunk.set(lx, h + 1, lz, B.NA_PLANT);
      }
    }
    const ek = this.edits.get(this.key(cx, cz));
    if (ek) for (const [i, id] of ek) {
      chunk.data[i] = id;
      if (id === B.LAMP) this.lamps.push([cx * 16 + (i & 15) + 0.5, (i >> 8) + 0.5, cz * 16 + ((i >> 4) & 15) + 0.5]);
    }
    chunk.built = true;
  }

  plantTree(chunk: Chunk, lx: number, y: number, lz: number, type: string, gx: number, gz: number): void {
    const rng = U.mulberry32(this.seed ^ (gx * 131 + gz * 37));
    const setSafe = (x: number, yy: number, z: number, id: number): void => {
      if (x < 0 || x > 15 || z < 0 || z > 15 || yy < 0 || yy >= CFG.WORLD_H) return;
      if (chunk.get(x, yy, z) === B.AIR) chunk.set(x, yy, z, id);
    };
    if (type === 'spire') {
      const h = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < h; i++) setSafe(lx, y + i, lz, B.LOG);
      setSafe(lx, y + h, lz, B.H_CRYS);
      return;
    }
    const h = type === 'tall' ? 6 + Math.floor(rng() * 4) : 4 + Math.floor(rng() * 3);
    for (let i = 0; i < h; i++) chunk.set(lx, y + i, lz, B.LOG);
    if (type === 'shroom') {
      const R = 2 + Math.floor(rng() * 2);
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= R + 1) {
          setSafe(lx + dx, y + h, lz + dz, B.LEAVES);
          if (Math.abs(dx) + Math.abs(dz) <= R - 1) setSafe(lx + dx, y + h + 1, lz + dz, B.LEAVES);
        }
      }
    } else {
      const R = type === 'tall' ? 2 : 2;
      const top = y + h;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const d = dx * dx + dy * dy * 1.6 + dz * dz;
        if (d <= R * R + 1 && rng() > 0.12) setSafe(lx + dx, top + dy, lz + dz, B.LEAVES);
      }
    }
  }

  getBlock(gx: number, gy: number, gz: number): number {
    if (gy < 0 || gy >= CFG.WORLD_H) return B.AIR;
    const cx = Math.floor(gx / 16), cz = Math.floor(gz / 16);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch || !ch.built) return B.AIR;
    return ch.get(gx - cx * 16, gy, gz - cz * 16);
  }

  setBlock(gx: number, gy: number, gz: number, id: number, _opts?: object): boolean {
    if (gy < 1 || gy >= CFG.WORLD_H) return false;
    const cx = Math.floor(gx / 16), cz = Math.floor(gz / 16);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch || !ch.built) return false;
    const lx = gx - cx * 16, lz = gz - cz * 16;
    const old = ch.get(lx, gy, lz);
    if (old === id) return false;
    ch.set(lx, gy, lz, id);
    const k = this.key(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k)!.set(ch.idx(lx, gy, lz), id);
    this.remesh(cx, cz);
    if (lx === 0) this.remesh(cx - 1, cz);
    if (lx === 15) this.remesh(cx + 1, cz);
    if (lz === 0) this.remesh(cx, cz - 1);
    if (lz === 15) this.remesh(cx, cz + 1);
    if (id === B.LAMP) this.lamps.push([gx + 0.5, gy + 0.5, gz + 0.5]);
    if (old === B.LAMP) {
      const idx = this.lamps.findIndex(l => Math.floor(l[0]) === gx && Math.floor(l[1]) === gy && Math.floor(l[2]) === gz);
      if (idx >= 0) this.lamps.splice(idx, 1);
    }
    return true;
  }

  remesh(cx: number, cz: number): void {
    const ch = this.chunks.get(this.key(cx, cz));
    if (ch && ch.built && !ch.dirty) {
      ch.dirty = true;
      this.meshQueueSet.add(ch);
      this.meshQueue.push(ch);
    }
  }

  topSolidY(gx: number, gz: number): number {
    // Fast path: use heightCache if available (surfaceY caches terrain height)
    const surfY = this.surfaceY(gx, gz);
    // Start from surface height instead of world top
    for (let y = Math.min(surfY + 1, CFG.WORLD_H - 1); y > 0; y--) {
      const b = this.getBlock(gx, y, gz);
      if (b !== B.AIR && BLOCK_DEF[b].solid) return y;
    }
    return 1;
  }

  buildMesh(chunk: Chunk): void {
    for (const m of chunk.meshes) { this.group.remove(m); m.geometry.dispose(); }
    chunk.meshes = [];
    const opaque: MeshBuffers = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const cutout: MeshBuffers = { pos: [], nor: [], uv: [], col: [], idx: [], sway: [] };
    const water: MeshBuffers = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const ox = chunk.cx * 16, oz = chunk.cz * 16;
    const gb = (x: number, y: number, z: number): number => {
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 0 && y < CFG.WORLD_H) return chunk.get(x, y, z);
      return this.getBlock(ox + x, y, oz + z);
    };
    const solidAt = (x: number, y: number, z: number): boolean => { const b = gb(x, y, z); const d = BLOCK_DEF[b]; return d.solid && !d.cutout && !d.glass; };

    const FACES = [
      { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, tk: 'top' },
      { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, tk: 'bottom' },
      { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, tk: 'side' },
      { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, tk: 'side' },
      { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.88, tk: 'side' },
      { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.7, tk: 'side' }
    ];
    const aoLevel = [1.0, 0.78, 0.62, 0.48];

    for (let y = 0; y < CFG.WORLD_H; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const id = chunk.get(x, y, z);
      if (id === B.AIR) continue;
      const def = BLOCK_DEF[id];

      if (def.cross) {
        const t = def.tiles!.all!;
        const [u0, v0, u1, v1] = this.g.atlas.uv(t);
        const quads = [
          [[x + 0.08, y, z + 0.08], [x + 0.92, y, z + 0.92]],
          [[x + 0.92, y, z + 0.08], [x + 0.08, y, z + 0.92]]
        ];
        for (const [a, b2] of quads) {
          const i0 = cutout.pos.length / 3;
          cutout.pos.push(a[0], y, a[2], b2[0], y, b2[2], b2[0], y + 1, b2[2], a[0], y + 1, a[2]);
          cutout.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          cutout.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let i = 0; i < 4; i++) cutout.col.push(1, 1, 1);
          cutout.sway!.push(0, 0, 1, 1);
          cutout.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        }
        continue;
      }

      if (def.water) {
        if (gb(x, y + 1, z) === B.WATER) continue;
        const t = def.tiles!.all!;
        const [u0, v0, u1, v1] = this.g.atlas.uv(t);
        const i0 = water.pos.length / 3;
        const yy = y + 0.88;
        water.pos.push(x, yy, z + 1, x + 1, yy, z + 1, x + 1, yy, z, x, yy, z);
        water.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        water.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let i = 0; i < 4; i++) water.col.push(1, 1, 1);
        water.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        water.idx.push(i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2, i0);
        continue;
      }

      const target = (def.glass || def.cutout) ? cutout : opaque;
      for (const face of FACES) {
        const [dx, dy, dz] = face.dir;
        const nb = gb(x + dx, y + dy, z + dz);
        const nd = BLOCK_DEF[nb];
        let visible: boolean;
        if (def.glass) visible = nb !== id && (!nd.solid || !!nd.cutout || !!nd.water || !!nd.glass) || nb === B.AIR;
        else visible = !nd.solid || !!nd.cutout || !!nd.glass || (!!nd.water && !def.water);
        if (!visible) continue;
        let t: number;
        const tiles = def.tiles!;
        if (tiles.all !== undefined) t = tiles.all;
        else t = face.tk === 'top' ? tiles.top! : face.tk === 'bottom' ? tiles.bottom! : tiles.side!;
        const [u0, v0, u1, v1] = this.g.atlas.uv(t);
        const i0 = target.pos.length / 3;
        const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        const aos: number[] = [];
        for (let ci = 0; ci < 4; ci++) {
          const c = face.corners[ci];
          target.pos.push(x + c[0], y + c[1], z + c[2]);
          target.nor.push(dx, dy, dz);
          target.uv.push(uvs[ci][0], uvs[ci][1]);
          let ao = 0;
          if (!def.emissive) {
            const px = x + dx, py = y + dy, pz = z + dz;
            let s1: boolean, s2: boolean, cn: boolean;
            if (dy !== 0) {
              const ex = c[0] === 0 ? -1 : 1, ez = c[2] === 0 ? -1 : 1;
              s1 = solidAt(px + ex, py, pz); s2 = solidAt(px, py, pz + ez); cn = solidAt(px + ex, py, pz + ez);
            } else if (dx !== 0) {
              const ey = c[1] === 0 ? -1 : 1, ez = c[2] === 0 ? -1 : 1;
              s1 = solidAt(px, py + ey, pz); s2 = solidAt(px, py, pz + ez); cn = solidAt(px, py + ey, pz + ez);
            } else {
              const ey = c[1] === 0 ? -1 : 1, ex = c[0] === 0 ? -1 : 1;
              s1 = solidAt(px, py + ey, pz); s2 = solidAt(px + ex, py, pz); cn = solidAt(px + ex, py + ey, pz);
            }
            ao = (s1 && s2) ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (cn ? 1 : 0);
          }
          aos.push(ao);
          const br = face.shade * aoLevel[ao] * (def.emissive ? 1.6 : 1);
          target.col.push(br, br, br);
          if (target === cutout) cutout.sway!.push(0);
        }
        if (aos[0] + aos[2] > aos[1] + aos[3]) target.idx.push(i0 + 1, i0 + 2, i0 + 3, i0 + 1, i0 + 3, i0);
        else target.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
    }

    const mk = (dat: MeshBuffers, mat: THREE.Material, extra?: (mesh: THREE.Mesh) => void): void => {
      if (dat.idx.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dat.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(dat.nor), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(dat.uv), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dat.col), 3));
      if (dat.sway) geo.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(dat.sway), 1));
      geo.setIndex(dat.idx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ox, 0, oz);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.receiveShadow = true;
      if (extra) extra(mesh);
      this.group.add(mesh);
      chunk.meshes.push(mesh);
    };
    mk(opaque, this.matOpaque, m => { m.castShadow = true; });
    mk(cutout, this.matCutout, m => { m.castShadow = true; });
    // Use TSL water material if available, otherwise standard
    mk(water, this._waterTSLMat || this.matWater, m => { m.renderOrder = 2; });
    chunk.dirty = false;
  }

  update(px: number, pz: number, budgetMs: number): void {
    // Update water Fresnel camera position
    if (this.waterCamPos) this.waterCamPos.copy(this.g.camera.position);
    const R = this.g.settings.dist;
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const need: Chunk[] = [];
    for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      const k = this.key(cx, cz);
      let ch = this.chunks.get(k);
      if (!ch) { ch = new Chunk(cx, cz); this.chunks.set(k, ch); }
      if (!ch.built) need.push(ch);
      else if (Math.abs(dx) <= R && Math.abs(dz) <= R && ch.meshes.length === 0 && !ch.dirty) {
        ch.dirty = true;
        if (!this.meshQueueSet.has(ch)) { this.meshQueueSet.add(ch); this.meshQueue.push(ch); }
      }
    }
    need.sort((a, b) => (Math.abs(a.cx - pcx) + Math.abs(a.cz - pcz)) - (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)));
    this.meshQueue.sort((a, b) => (Math.abs(a.cx - pcx) + Math.abs(a.cz - pcz)) - (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)));
    const t0 = performance.now();
    while (need.length && performance.now() - t0 < budgetMs) {
      const ch = need.shift()!;
      this.generate(ch);
      // A previously meshed neighbour may have emitted faces toward this chunk
      // while it was still missing. Rebuild both sides to remove those overlaps.
      this.remesh(ch.cx, ch.cz);
      this.remesh(ch.cx - 1, ch.cz);
      this.remesh(ch.cx + 1, ch.cz);
      this.remesh(ch.cx, ch.cz - 1);
      this.remesh(ch.cx, ch.cz + 1);
    }
    while (this.meshQueue.length && performance.now() - t0 < budgetMs + 4) {
      const ch = this.meshQueue.shift()!;
      this.meshQueueSet.delete(ch);
      if (ch.built && ch.dirty) this.buildMesh(ch);
    }
    // Defer chunk culling to every 3rd frame
    this.cullFrame++;
    if (this.cullFrame >= 3) {
      this.cullFrame = 0;
      for (const [k, ch] of this.chunks) {
        if (Math.abs(ch.cx - pcx) > R + 2 || Math.abs(ch.cz - pcz) > R + 2) {
          for (const m of ch.meshes) { this.group.remove(m); m.geometry.dispose(); }
          ch.meshes = [];
          if (Math.abs(ch.cx - pcx) > R + 4 || Math.abs(ch.cz - pcz) > R + 4) this.chunks.delete(k);
        }
      }
    }
    this.updateLampLights(px, pz);
  }

  pregenProgress(px: number, pz: number): number {
    const R = this.g.settings.dist;
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    let total = 0, done = 0;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      total++;
      const ch = this.chunks.get(this.key(pcx + dx, pcz + dz));
      if (ch && ch.built && ch.meshes.length > 0) done++;
    }
    return done / total;
  }

  // Single-pass partial selection: keep top-6 nearest lamps without intermediate arrays
  private _lampBuf: { l: number[]; d: number }[] = [];

  updateLampLights(px: number, pz: number): void {
    if (!this.lamps) return;
    const buf = this._lampBuf;
    buf.length = 0;
    for (let i = 0; i < this.lamps.length; i++) {
      const l = this.lamps[i];
      const d = U.dist2(l[0], l[2], px, pz);
      if (d >= 40) continue;
      // Insert sorted by distance (keep only top 6)
      let j = buf.length;
      if (j >= 6) {
        if (d >= buf[5].d) continue;
        j = 5;
      }
      while (j > 0 && buf[j - 1].d > d) { buf[j] = buf[j - 1]; j--; }
      buf[j] = { l, d };
      if (buf.length > 6) buf.length = 6;
    }
    while (this.lampPool.length < buf.length) {
      const pl = new THREE.PointLight(0xffdf9e, 1.1, 13, 1.6);
      this.g.scene.add(pl);
      this.lampPool.push(pl);
    }
    this.lampPool.forEach((pl, i) => {
      if (i < buf.length) { pl.visible = true; pl.position.set(buf[i].l[0], buf[i].l[1], buf[i].l[2]); }
      else pl.visible = false;
    });
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RaycastResult | null {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (dir.x || 1e-9)), tDY = Math.abs(1 / (dir.y || 1e-9)), tDZ = Math.abs(1 / (dir.z || 1e-9));
    let tX = (dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDX;
    let tY = (dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDY;
    let tZ = (dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDZ;
    let dist = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 128; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && !BLOCK_DEF[id].water) {
        return { x, y, z, id, nx, ny, nz, dist };
      }
      if (tX < tY && tX < tZ) { x += stepX; dist = tX; tX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tY < tZ) { y += stepY; dist = tY; tY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; dist = tZ; tZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
      if (dist > maxDist) return null;
    }
    return null;
  }

  collides(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    for (let y = Math.floor(minY); y <= Math.floor(maxY); y++)
      for (let x = Math.floor(minX); x <= Math.floor(maxX); x++)
        for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
          const b = this.getBlock(x, y, z);
          if (b !== B.AIR && BLOCK_DEF[b].solid) return true;
        }
    return false;
  }

  isWater(x: number, y: number, z: number): boolean { return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER; }

  findScanTargets(px: number, py: number, pz: number, radius: number): ScanTarget[] {
    const out: ScanTarget[] = [];
    const r2 = radius * radius;
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const cr = Math.ceil(radius / 16) + 1;
    for (let dx = -cr; dx <= cr; dx++) for (let dz = -cr; dz <= cr; dz++) {
      const ch = this.chunks.get(this.key(pcx + dx, pcz + dz));
      if (!ch || !ch.built) continue;
      for (let y = 0; y < CFG.WORLD_H; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const id = ch.get(x, y, z);
        if (id === B.AIR) continue;
        const def = BLOCK_DEF[id];
        if (!def.scan) continue;
        const gx = ch.cx * 16 + x + 0.5, gz = ch.cz * 16 + z + 0.5;
        const dx2 = gx - px, dy = y - py, dz2 = gz - pz;
        const d2 = dx2 * dx2 + dy * dy + dz2 * dz2;
        if (d2 < r2) out.push({ x: gx, y: y + 0.5, z: gz, type: def.scan, d: Math.sqrt(d2), id });
      }
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, 14);
  }

  dispose(): void {
    for (const [, ch] of this.chunks) for (const m of ch.meshes) { this.group.remove(m); m.geometry.dispose(); }
    this.chunks = new Map();
    this.meshQueue = [];
    this.meshQueueSet.clear();
    this.heightCache = new Map();
    for (const pl of this.lampPool) pl.visible = false;
    this.lamps = [];
  }
}
