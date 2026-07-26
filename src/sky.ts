// ============================================================
// sky.ts — Sky dome (WebGPU-compatible, no raw GLSL)
// ============================================================

import { U } from './utils';
import { CFG } from './config';
import type { Game, Palette } from './types';

export class Sky {
  g: Game;
  group: THREE.Group;
  uTopColor: THREE.Color;
  uHorColor: THREE.Color;
  uSunDir: THREE.Vector3;
  uSunColor: THREE.Color;
  uNightMix: number;
  uTime: number;
  uStarBright: number;
  dome: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambientFill: THREE.AmbientLight;
  celestial: THREE.Group;
  planetBig: THREE.Mesh;
  moon: THREE.Mesh;
  planetGlow: THREE.Sprite;
  sunSprite: THREE.Sprite;
  t: number;
  dayMix: number;
  pal!: Palette;
  private _sunDir = new THREE.Vector3();
  private _shadowTargetX = 0;
  private _shadowTargetZ = 0;

  constructor(game: Game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);

    this.uTopColor = new THREE.Color('#3a8fd4');
    this.uHorColor = new THREE.Color('#bfe4ee');
    this.uSunDir = new THREE.Vector3(0, 1, 0);
    this.uSunColor = new THREE.Color('#fff2d0');
    this.uNightMix = 0;
    this.uTime = 0;
    this.uStarBright = 0;

    // Create sky dome with MeshBasicMaterial (WebGPU-compatible)
    // The sky colors are updated per-frame via setClearColor and material color
    const mat = new THREE.MeshBasicMaterial({
      color: '#3a8fd4',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    // Main directional light (sun) with shadows
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 600;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2;
    game.scene.add(this.sunLight);

    // Hemisphere light (sky + ground ambient)
    this.hemi = new THREE.HemisphereLight(0xbfd8e8, 0x3a4a3a, 0.75);
    game.scene.add(this.hemi);

    // Ambient fill light (prevents pure black shadows)
    this.ambientFill = new THREE.AmbientLight(0x1a2030, 0.15);
    game.scene.add(this.ambientFill as unknown as THREE.Object3D);

    // Celestial bodies
    this.celestial = new THREE.Group();
    this.group.add(this.celestial);
    const mk = (r: number, col: string, emis: string, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshLambertMaterial({ color: col, emissive: emis, fog: false }));
      m.position.set(x, y, z);
      this.celestial.add(m);
      return m;
    };
    this.planetBig = mk(120, '#8a9ab8', '#1a2438', 480, 130, -380);
    this.moon = mk(34, '#c8c2b4', '#2a2820', -420, 200, 240);
    const glowTex = Sky.makeGlow();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#9fc4ff', transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    glow.scale.set(400, 400, 1);
    glow.position.copy(this.planetBig.position);
    this.celestial.add(glow);
    this.planetGlow = glow;

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe8b0', transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    this.sunSprite.scale.set(260, 260, 1);
    this.group.add(this.sunSprite);

    this.t = 0.28;
    this.dayMix = 1;
  }

  static makeGlow(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(128, 128, 4, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  setPalette(pal: Palette): void {
    this.pal = pal;
    const rng = U.mulberry32(this.g.seed ^ 0x77);
    (this.planetBig.material as THREE.MeshLambertMaterial).color.set(U.mixHex(pal.skyDayTop, '#8a9ab8', 0.5));
    this.planetBig.position.set(300 + rng() * 400, 90 + rng() * 160, -500 + rng() * 300);
    this.planetGlow.position.copy(this.planetBig.position);
    (this.planetGlow.material as THREE.SpriteMaterial).color.set(pal.skyDayHor);
    this.moon.position.set(-300 - rng() * 300, 150 + rng() * 120, 100 + rng() * 300);
  }

  update(dt: number): void {
    const g = this.g;
    this.t = (this.t + dt / CFG.DAY_LEN) % 1;
    const ang = (this.t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(ang), sunX = Math.cos(ang);
    const sunDir = this._sunDir.set(sunX * 0.7, sunY, sunX * 0.3).normalize();

    const day = U.clamp(sunY * 2.8 + 0.35, 0, 1);
    this.dayMix = day;
    const dusk = U.clamp(1 - Math.abs(sunY) * 3.5, 0, 1) * (day > 0.03 ? 1 : 0.3);

    const pal = this.pal;

    // Sky dome color — blend between night and day
    const top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#ff8a4a', dusk * 0.6);
    (this.dome.material as THREE.MeshBasicMaterial).color.set(top);

    // Sun light — HDR values (tone-mapped by renderer)
    this.sunLight.position.copy(sunDir).multiplyScalar(300);

    // Shadow camera follows player, snapped to grid
    if (g.player) {
      const p = g.player.pos;
      const cellSize = 4;
      const snapX = Math.round(p.x / cellSize) * cellSize;
      const snapZ = Math.round(p.z / cellSize) * cellSize;
      if (snapX !== this._shadowTargetX || snapZ !== this._shadowTargetZ) {
        this._shadowTargetX = snapX;
        this._shadowTargetZ = snapZ;
        this.sunLight.target.position.set(snapX, p.y, snapZ);
        this.sunLight.target.updateMatrixWorld();
      }
    }
    const sunInt = 0.3 + day * 2.0 + dusk * 0.2;
    this.sunLight.intensity = sunInt;
    const sunCol = dusk > 0.1
      ? U.mixHex(pal.sun, '#ff7a4a', dusk * 0.7)
      : U.mixHex('#8fa8cc', pal.sun, Math.max(day, 0.2));
    this.sunLight.color.set(sunCol);

    // Hemisphere light
    this.hemi.intensity = 0.3 + day * 0.8 + dusk * 0.1;
    this.hemi.color.set(top);
    this.hemi.groundColor.set(U.shade(pal.grass, 0.4 + day * 0.2));

    // Ambient fill
    this.ambientFill.intensity = 0.1 + (1 - day) * 0.2;

    // Sun sprite
    this.sunSprite.position.copy(sunDir).multiplyScalar(650);
    (this.sunSprite.material as THREE.SpriteMaterial).opacity = 0.4 + day * 0.5 + dusk * 0.15;

    // Fog
    const storm = g.stormFactor || 0;
    let fogCol = U.mixHex(pal.fogNight, pal.fogDay, day);
    if (storm > 0) fogCol = U.mixHex(fogCol, U.shade(pal.fogDay, 0.75), storm * 0.7);
    const dist = g.settings.dist * 16;
    let fogNear = dist * 0.45, fogFar = dist * 1.05;
    if (storm > 0) { fogNear = U.lerp(fogNear, 8, storm); fogFar = U.lerp(fogFar, dist * 0.55, storm); }
    if (g.player && g.player.headInWater) { fogCol = U.shade(pal.water || '#2e6f9e', 0.7); fogNear = 2; fogFar = 22; }
    (g.scene.fog as THREE.Fog).color.set(fogCol);
    (g.scene.fog as THREE.Fog).near = fogNear;
    (g.scene.fog as THREE.Fog).far = fogFar;
    g.renderer.setClearColor(fogCol);

    this.group.position.copy(g.camera.position);
    this.celestial.rotation.y += dt * 0.002;

    if (g.audio.ok) g.audio.nightMix = 1 - day;
  }
}
