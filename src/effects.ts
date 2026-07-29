// ============================================================
// effects.ts — Particle FX, laser, shake, warp (optimized)
// ============================================================

import * as THREE from 'three/webgpu';
import { U } from './utils';
import { Sky } from './sky';
import type { Game, SpawnOpts, Particle } from './types';

// Color cache: hex string → {r,g,b} to avoid new THREE.Color per particle
const _colorCache = new Map<string, { r: number; g: number; b: number }>();
function parseColor(hex: string): { r: number; g: number; b: number } {
  let c = _colorCache.get(hex);
  if (c) return c;
  const n = parseInt(hex.slice(1), 16);
  c = { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  _colorCache.set(hex, c);
  return c;
}

export class FX {
  g: Game;
  max: number;
  parts: Particle[];
  /** Instanced debris chips — WebGPU Points are forced to 1px and invisible. */
  mesh: THREE.InstancedMesh;
  laser: THREE.Mesh;
  laserGlow: THREE.Sprite;
  laserLight: THREE.PointLight;
  shakeAmp: number;
  warpAnim: number | null;
  /** Reused for beam direction (unit cylinder is along +Y). */
  private _laserDir = new THREE.Vector3();
  private _tmpObj = new THREE.Object3D();
  private _tmpColor = new THREE.Color();
  private static readonly _Y_UP = new THREE.Vector3(0, 1, 0);

  constructor(game: Game) {
    this.g = game;
    this.max = 600;
    this.parts = [];

    // Tiny chips (WebGPU Points are 1px; instanced boxes stay visible but subtle).
    const chipGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    const chipMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(chipGeo, chipMat, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // Seed instance colors so instanceColor buffer exists before first setColorAt.
    for (let i = 0; i < this.max; i++) {
      this.mesh.setColorAt(i, this._tmpColor.setRGB(1, 1, 1));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    game.scene.add(this.mesh);

    const tex = Sky.makeGlow();

    // Laser visuals match origin/main: #ff7a3c @ 0.85 opacity, glow #ffb066, tip light #ff8a4c.
    // Geometry stays +Y so setFromUnitVectors orients correctly (remote used lookAt + Z which reversed the beam).
    const laserGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 6, 1, true);
    laserGeo.translate(0, 0.5, 0);
    this.laser = new THREE.Mesh(
      laserGeo,
      new THREE.MeshBasicMaterial({
        color: '#ff7a3c',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.laser.visible = false;
    this.laser.frustumCulled = false;
    this.laser.renderOrder = 20;
    game.scene.add(this.laser);
    this.laserGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: '#ffb066',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    this.laserGlow.scale.set(0.9, 0.9, 1);
    this.laserGlow.visible = false;
    this.laserGlow.renderOrder = 21;
    game.scene.add(this.laserGlow);
    this.laserLight = new THREE.PointLight('#ff8a4c', 0, 7, 2);
    game.scene.add(this.laserLight);

    this.shakeAmp = 0;
    this.warpAnim = null;
  }

  spawn(x: number, y: number, z: number, opts: SpawnOpts): void {
    const n = opts.n || 6;
    const col = parseColor(opts.col || '#ffffff');
    const sp = opts.speed || 2.4;
    const up = opts.up || 0.5;
    const life = opts.life || 0.7;
    const grav = opts.grav !== undefined ? opts.grav : 9;
    for (let i = 0; i < n; i++) {
      // Swap-with-last eviction instead of O(n) shift
      if (this.parts.length >= this.max) {
        const last = this.parts.length - 1;
        this.parts[0] = this.parts[last];
        this.parts.length = last;
      }
      this.parts.push({
        x, y, z,
        vx: U.rand(-sp, sp), vy: U.rand(up, sp * 1.4), vz: U.rand(-sp, sp),
        life: U.rand(0.25, life),
        col,
        grav
      });
    }
  }

  /** Directional burst — particles fly outward from a point */
  burst(x: number, y: number, z: number, opts: SpawnOpts & { nx?: number; ny?: number; nz?: number }): void {
    const n = opts.n || 12;
    const col = parseColor(opts.col || '#ffffff');
    const sp = opts.speed || 3;
    const life = opts.life || 0.5;
    const grav = opts.grav !== undefined ? opts.grav : 8;
    const nx = opts.nx || 0, ny = opts.ny || 0, nz = opts.nz || 0;
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.max) {
        const last = this.parts.length - 1;
        this.parts[0] = this.parts[last];
        this.parts.length = last;
      }
      // Bias velocity outward from the break face
      const out = 0.3 + Math.random() * 0.7;
      this.parts.push({
        x: x + U.rand(-0.3, 0.3), y: y + U.rand(-0.3, 0.3), z: z + U.rand(-0.3, 0.3),
        vx: U.rand(-sp, sp) + nx * sp * out,
        vy: U.rand(0.2, sp * 1.2) + ny * sp * out,
        vz: U.rand(-sp, sp) + nz * sp * out,
        life: U.rand(0.15, life),
        col,
        grav
      });
    }
  }

  update(dt: number): void {
    // Swap-with-last removal for dead particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = this.parts.length - 1;
        if (i !== last) this.parts[i] = this.parts[last];
        this.parts.length = last;
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }

    const len = this.parts.length;
    const obj = this._tmpObj;
    const color = this._tmpColor;
    for (let i = 0; i < len; i++) {
      const p = this.parts[i];
      const fade = Math.min(1, p.life * 2.5);
      // Keep chips tiny: base 4cm cube × ~0.6–1.0.
      const size = 0.55 + 0.45 * fade;
      obj.position.set(p.x, p.y, p.z);
      obj.scale.setScalar(size);
      obj.rotation.set(p.x * 4.1 + p.life * 6.0, p.y * 3.3 + p.life * 4.5, p.z * 5.2);
      obj.updateMatrix();
      this.mesh.setMatrixAt(i, obj.matrix);
      color.setRGB(p.col.r * fade, p.col.g * fade, p.col.b * fade);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.count = len;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
  }

  laserShow(from: THREE.Vector3, to: THREE.Vector3, col?: string): void {
    this._laserDir.subVectors(to, from);
    const len = this._laserDir.length();
    if (len < 1e-4) {
      this.laserHide();
      return;
    }
    this._laserDir.multiplyScalar(1 / len);

    this.laser.visible = true;
    this.laserGlow.visible = true;
    this.laser.position.copy(from);
    // Geometry is unit length on +Y; scale Y to match beam length.
    this.laser.scale.set(1, len, 1);
    this.laser.quaternion.setFromUnitVectors(FX._Y_UP, this._laserDir);
    this.laser.updateMatrixWorld(true);

    if (col && this.laser.material instanceof THREE.MeshBasicMaterial) {
      this.laser.material.color.set(col);
    }
    // Remote defaults: tip glow size pulse + strong point light.
    this.laserGlow.position.copy(to);
    this.laserGlow.scale.setScalar(0.7 + Math.random() * 0.5);
    this.laserLight.position.copy(to);
    this.laserLight.intensity = 1.6 + Math.random() * 0.8;
  }

  laserHide(): void {
    this.laser.visible = false;
    this.laserGlow.visible = false;
    this.laserLight.intensity = 0;
  }

  shake(a: number): void { this.shakeAmp = Math.max(this.shakeAmp, a); }

  applyShake(camera: THREE.Camera): void {
    if (this.shakeAmp > 0.01) {
      camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
      camera.position.z += (Math.random() - 0.5) * this.shakeAmp;
    }
  }

  startWarp(): void {
    const cvs = document.getElementById('warp-canvas');
    const ovl = document.getElementById('warp-overlay');
    if (!(cvs instanceof HTMLCanvasElement) || !ovl) return;
    ovl.classList.remove('hidden');
    cvs.width = innerWidth; cvs.height = innerHeight;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const stars: { a: number; r: number; sp: number; hue: number }[] = [];
    for (let i = 0; i < 340; i++) stars.push({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.9 + 0.05, sp: 0.4 + Math.random() * 2.4, hue: Math.random() });
    const cx = cvs.width / 2, cy = cvs.height / 2;
    // Pre-create gradient once
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130);
    grd.addColorStop(0, 'rgba(210,235,255,0.9)');
    grd.addColorStop(1, 'rgba(120,160,255,0)');
    let last = performance.now();
    const anim = (): void => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.fillStyle = 'rgba(2,4,12,0.32)';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      for (const s of stars) {
        const r0 = s.r, r1 = Math.min(1.6, s.r + s.sp * dt * (0.4 + s.r * 2.2));
        const R = Math.max(cvs.width, cvs.height) * 0.75;
        const x0 = cx + Math.cos(s.a) * r0 * R, y0 = cy + Math.sin(s.a) * r0 * R;
        const x1 = cx + Math.cos(s.a) * r1 * R, y1 = cy + Math.sin(s.a) * r1 * R;
        const c = s.hue < 0.6 ? '190,225,255' : s.hue < 0.85 ? '255,255,255' : '186,140,255';
        ctx.strokeStyle = `rgba(${c},${0.25 + s.r * 0.75})`;
        ctx.lineWidth = 0.6 + s.r * 2.4;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        s.r = r1;
        if (s.r > 1.55) { s.r = Math.random() * 0.12; s.a = Math.random() * Math.PI * 2; }
      }
      ctx.fillStyle = grd;
      ctx.fillRect(cx - 140, cy - 140, 280, 280);
      this.warpAnim = requestAnimationFrame(anim);
    };
    ctx.fillStyle = '#02040c';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    anim();
  }
  stopWarp(): void {
    cancelAnimationFrame(this.warpAnim!);
    document.getElementById('warp-overlay')!.classList.add('hidden');
  }
}
