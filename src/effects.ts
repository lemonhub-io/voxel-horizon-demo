// ============================================================
// effects.ts — Particle FX, laser, shake, warp (optimized)
// ============================================================

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
  posArr: Float32Array;
  colArr: Float32Array;
  mat: THREE.PointsMaterial;
  points: THREE.Points;
  laser: THREE.Mesh;
  laserGlow: THREE.Sprite;
  laserLight: THREE.PointLight;
  shakeAmp: number;
  warpAnim: number | null;

  constructor(game: Game) {
    this.g = game;
    this.max = 600;
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(this.max * 3);
    this.colArr = new Float32Array(this.max * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3));
    const tex = Sky.makeGlow();
    this.mat = new THREE.PointsMaterial({ size: 0.22, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    game.scene.add(this.points);

    const laserGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 6, 1, true);
    laserGeo.translate(0, 0.5, 0);
    laserGeo.rotateX(Math.PI / 2);
    this.laser = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: '#ff7a3c', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.laser.visible = false;
    this.laser.frustumCulled = false;
    game.scene.add(this.laser);
    this.laserGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffb066', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.laserGlow.scale.set(0.9, 0.9, 1);
    this.laserGlow.visible = false;
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
        col: col as unknown as THREE.Color,
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
    // Only write active particles to buffer
    const len = this.parts.length;
    for (let i = 0; i < len; i++) {
      const p = this.parts[i];
      this.posArr[i * 3] = p.x; this.posArr[i * 3 + 1] = p.y; this.posArr[i * 3 + 2] = p.z;
      const f = Math.min(1, p.life * 2.5);
      const c = p.col as unknown as { r: number; g: number; b: number };
      this.colArr[i * 3] = c.r * f; this.colArr[i * 3 + 1] = c.g * f; this.colArr[i * 3 + 2] = c.b * f;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.points.geometry.setDrawRange(0, Math.max(len, 1));
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
  }

  laserShow(from: THREE.Vector3, to: THREE.Vector3, col?: string): void {
    this.laser.visible = true;
    this.laserGlow.visible = true;
    const len = from.distanceTo(to);
    this.laser.position.copy(from);
    this.laser.scale.set(1, 1, len);
    this.laser.lookAt(to);
    if (col) (this.laser.material as THREE.MeshBasicMaterial).color.set(col);
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
    if (this.shakeAmp > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
      camera.position.z += (Math.random() - 0.5) * this.shakeAmp;
    }
  }

  startWarp(): void {
    const cvs = document.getElementById('warp-canvas') as HTMLCanvasElement;
    const ovl = document.getElementById('warp-overlay')!;
    ovl.classList.remove('hidden');
    cvs.width = innerWidth; cvs.height = innerHeight;
    const ctx = cvs.getContext('2d')!;
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
