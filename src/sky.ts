// ============================================================
// sky.ts — Sky dome with TSL (WebGPU-compatible) shader
// ============================================================

import { U } from './utils';
import { CFG } from './config';
import type { Game, Palette } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
// TSL is a dynamic node-graph API; strict typing is not feasible.

function T(): any {
  return (window as any).THREE.TSL;
}

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
  dome!: THREE.Mesh;
  sunLight!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  ambientFill!: THREE.AmbientLight;
  celestial!: THREE.Group;
  planetBig!: THREE.Mesh;
  moon!: THREE.Mesh;
  planetGlow!: THREE.Sprite;
  sunSprite!: THREE.Sprite;
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
    this.t = 0.28;
    this.dayMix = 1;

    this._buildSkyDome();
    this._buildLights();
    this._buildCelestial();
  }

  private _buildSkyDome(): void {
    const t = T();
    const { uniform, float, vec3, mix, pow, max, min, dot, normalize, sin, abs, floor, exp, fract, step, positionLocal, Fn } = t;

    // TSL uniforms
    const uTop = uniform('vec3'); uTop.value = this.uTopColor;
    const uHor = uniform('vec3'); uHor.value = this.uHorColor;
    const uSun = uniform('vec3'); uSun.value = this.uSunDir;
    const uSunCol = uniform('vec3'); uSunCol.value = this.uSunColor;
    const uNight = uniform('float'); uNight.value = this.uNightMix;
    const uTimeU = uniform('float'); uTimeU.value = this.uTime;
    const uStar = uniform('float'); uStar.value = this.uStarBright;

    // Hash function for stars
    const hash3 = Fn(([p]: any[]) => {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    });

    // Sky color node
    const skyColor = Fn(() => {
      const d = normalize(positionLocal);
      const h = max(d.y, float(0));

      // Rayleigh scattering
      const rayleigh = exp(h.negate().mul(vec3(5.5, 13.0, 22.4)));
      const skyBase = mix(uHor, uTop, float(1).sub(rayleigh));
      const col = mix(skyBase, mix(uHor, uTop, pow(h, 0.45)), 0.4);

      // Ground blend
      const groundFactor = min(d.y.negate().mul(2.5), 1.0);
      const groundCol = mix(uHor, uHor.mul(0.4), groundFactor);
      const groundMask = step(float(0), d.y);
      const withGround = mix(col, groundCol, groundMask);

      // Sun disc
      const s = max(dot(d, uSun), float(0));
      const horizonBoost = float(1).sub(abs(d.y));
      const mie = pow(s, 8).mul(0.15).mul(horizonBoost);

      let r = withGround;
      r = r.add(uSunCol.mul(pow(s, 900)).mul(5));
      r = r.add(uSunCol.mul(pow(s, 24)).mul(0.8));
      r = r.add(uSunCol.mul(pow(s, 5)).mul(0.3).mul(horizonBoost));
      r = r.add(uSunCol.mul(mie));

      // Dusk band
      const duskBand = exp(abs(d.y).negate().mul(6)).mul(uNight).mul(0.4);
      const duskCol = mix(vec3(1, 0.5, 0.2), vec3(1, 0.3, 0.1), float(1).sub(rayleigh.z));
      r = r.add(duskCol.mul(duskBand).mul(max(uSun.y.add(0.2), 0)));

      // Stars
      const cell = floor(d.mul(280));
      const star = step(0.998, hash3(cell));
      const tw = float(0.55).add(sin(uTimeU.mul(2.4).add(hash3(cell.add(1)).mul(40))).mul(0.45));
      const starColHash = hash3(cell.add(2));
      const starTint = mix(vec3(0.8, 0.9, 1), vec3(1, 0.9, 0.7), starColHash);
      const starSize = float(0.8).add(hash3(cell.add(3)).mul(0.6));
      r = r.add(starTint.mul(star).mul(tw).mul(uStar).mul(starSize));

      // Night glow
      const nightGlow = float(1).sub(h).mul(uNight).mul(0.1);
      r = r.add(vec3(0.04, 0.06, 0.14).mul(nightGlow));

      return r;
    });

    // Create TSL node material
    const MeshBasicNodeMaterial = (window as any).THREE.MeshBasicNodeMaterial;
    const mat = new MeshBasicNodeMaterial();
    mat.colorNode = skyColor();
    mat.side = THREE.BackSide;
    mat.depthWrite = false;
    mat.fog = false;

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);
  }

  private _buildLights(): void {
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
    this.g.scene.add(this.sunLight);

    this.hemi = new THREE.HemisphereLight(0xbfd8e8, 0x3a4a3a, 0.75);
    this.g.scene.add(this.hemi);

    this.ambientFill = new THREE.AmbientLight(0x1a2030, 0.15);
    this.g.scene.add(this.ambientFill as unknown as THREE.Object3D);
  }

  private _buildCelestial(): void {
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

    // Update TSL uniform values
    const top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#ff8a4a', dusk * 0.6);
    this.uTopColor.set(top);
    this.uHorColor.set(hor);
    this.uSunColor.set(U.mixHex(pal.sun, '#ff6a3a', dusk * 0.65));
    this.uSunDir.copy(sunDir);
    this.uNightMix = 1 - day;
    this.uStarBright = Math.max(0, 1 - day * 3) * 0.85;
    this.uTime = g.timeUniform.value;

    // Sun light
    this.sunLight.position.copy(sunDir).multiplyScalar(300);
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
    this.sunLight.intensity = 0.3 + day * 2.0 + dusk * 0.2;
    this.sunLight.color.set(dusk > 0.1
      ? U.mixHex(pal.sun, '#ff7a4a', dusk * 0.7)
      : U.mixHex('#8fa8cc', pal.sun, Math.max(day, 0.2)));

    this.hemi.intensity = 0.3 + day * 0.8 + dusk * 0.1;
    this.hemi.color.set(top);
    this.hemi.groundColor.set(U.shade(pal.grass, 0.4 + day * 0.2));
    this.ambientFill.intensity = 0.1 + (1 - day) * 0.2;

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
