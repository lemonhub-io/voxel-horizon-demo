// ============================================================
// sky.ts — Sky dome with TSL node material (WebGPU-compatible)
// ============================================================

import { U } from './utils';
import { CFG } from './config';
import { Starfield } from './starfield';
import type { Game, Palette } from './types';

export class Sky {
  g: Game;
  group: THREE.Group;
  dome!: THREE.Mesh;
  sunLight!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  ambientFill!: THREE.AmbientLight;
  celestial!: THREE.Group;
  planetBig!: THREE.Mesh;
  moon!: THREE.Mesh;
  planetGlow!: THREE.Sprite;
  sunSprite!: THREE.Sprite;
  starfield!: Starfield;
  t: number;
  dayMix: number;
  pal!: Palette;
  private _sunDir = new THREE.Vector3();
  private _shadowTargetX = 0;
  private _shadowTargetZ = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uTop: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uHor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uSun: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uSunCol: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uNight: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _uStar: any;

  constructor(game: Game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.t = 0.28;
    this.dayMix = 1;

    this._buildSkyDome();
    this._buildLights();
    this._buildCelestial();
    this.starfield = new Starfield();
  }

  private _buildSkyDome(): void {
    // TSL functions are under THREE.TSL namespace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TSL = (THREE as any).TSL;
    const { uniform, float, vec3, mix, pow, max, min, dot, normalize, sin, abs, floor, exp, fract, step, positionLocal, Fn, time } = TSL;

    // Uniforms
    const uTop = uniform('vec3'); uTop.value = new THREE.Color('#3a8fd4');
    const uHor = uniform('vec3'); uHor.value = new THREE.Color('#bfe4ee');
    const uSun = uniform('vec3'); uSun.value = new THREE.Vector3(0, 1, 0);
    const uSunCol = uniform('vec3'); uSunCol.value = new THREE.Color('#fff2d0');
    const uNight = uniform('float'); uNight.value = 0;
    const uStar = uniform('float'); uStar.value = 0;

    this._uTop = uTop;
    this._uHor = uHor;
    this._uSun = uSun;
    this._uSunCol = uSunCol;
    this._uNight = uNight;
    this._uStar = uStar;

    // Sky color node tree
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

    let skyColor = withGround;
    skyColor = skyColor.add(uSunCol.mul(pow(s, 900)).mul(5));
    skyColor = skyColor.add(uSunCol.mul(pow(s, 24)).mul(0.8));
    skyColor = skyColor.add(uSunCol.mul(pow(s, 5)).mul(0.3).mul(horizonBoost));
    skyColor = skyColor.add(uSunCol.mul(mie));

    // Dusk band
    const duskBand = exp(abs(d.y).negate().mul(6)).mul(uNight).mul(0.4);
    const duskCol = mix(vec3(1, 0.5, 0.2), vec3(1, 0.3, 0.1), float(1).sub(rayleigh.z));
    skyColor = skyColor.add(duskCol.mul(duskBand).mul(max(uSun.y.add(0.2), 0)));

    // Stars
    const hash3 = Fn((p: unknown) => {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    });
    const cell = floor(d.mul(280));
    const star = step(0.998, hash3(cell));
    const tw = float(0.55).add(sin(time.mul(2.4).add(hash3(cell.add(1)).mul(40))).mul(0.45));
    const starColHash = hash3(cell.add(2));
    const starTint = mix(vec3(0.8, 0.9, 1), vec3(1, 0.9, 0.7), starColHash);
    const starSize = float(0.8).add(hash3(cell.add(3)).mul(0.6));
    skyColor = skyColor.add(starTint.mul(star).mul(tw).mul(uStar).mul(starSize));

    // Night glow — brighter for better visibility
    const nightGlow = float(1).sub(h).mul(uNight).mul(0.2);
    skyColor = skyColor.add(vec3(0.08, 0.12, 0.25).mul(nightGlow));

    // Create node material (MeshBasicNodeMaterial is from the WebGPU build)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MeshBasicNodeMaterial = (THREE as any).MeshBasicNodeMaterial;
    const mat = new MeshBasicNodeMaterial();
    mat.colorNode = skyColor;
    mat.side = THREE.BackSide;
    mat.depthWrite = false;
    mat.fog = false;

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 16), mat as unknown as THREE.Material);
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

    // Planet — with procedural band pattern via vertex colors
    const planetGeo = new THREE.SphereGeometry(120, 24, 18);
    const planetColors = new Float32Array(planetGeo.attributes.position.count * 3);
    for (let i = 0; i < planetGeo.attributes.position.count; i++) {
      const y = (planetGeo.attributes.position as THREE.BufferAttribute).getY(i);
      const band = Math.sin(y * 0.08) * 0.5 + 0.5; // horizontal bands
      const r = 0.54 + band * 0.15;
      const g = 0.6 + band * 0.1;
      const b = 0.72 + band * 0.08;
      planetColors[i * 3] = r;
      planetColors[i * 3 + 1] = g;
      planetColors[i * 3 + 2] = b;
    }
    planetGeo.setAttribute('color', new THREE.BufferAttribute(planetColors, 3));
    this.planetBig = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#1a2438', roughness: 0.8, metalness: 0.1, fog: false }));
    this.planetBig.position.set(480, 130, -380);
    this.celestial.add(this.planetBig);

    // Moon — with dark maria patches via vertex colors
    const moonGeo = new THREE.SphereGeometry(34, 20, 14);
    const moonColors = new Float32Array(moonGeo.attributes.position.count * 3);
    for (let i = 0; i < moonGeo.attributes.position.count; i++) {
      const x = (moonGeo.attributes.position as THREE.BufferAttribute).getX(i);
      const y = (moonGeo.attributes.position as THREE.BufferAttribute).getY(i);
      const z = (moonGeo.attributes.position as THREE.BufferAttribute).getZ(i);
      // Pseudo-random maria patches
      const patch = Math.sin(x * 0.3) * Math.cos(z * 0.4) * Math.sin(y * 0.5);
      const dark = patch > 0.3 ? 0.6 : 1.0;
      moonColors[i * 3] = 0.78 * dark;
      moonColors[i * 3 + 1] = 0.76 * dark;
      moonColors[i * 3 + 2] = 0.7 * dark;
    }
    moonGeo.setAttribute('color', new THREE.BufferAttribute(moonColors, 3));
    this.moon = new THREE.Mesh(moonGeo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#2a2820', roughness: 0.9, metalness: 0.05, fog: false }));
    this.moon.position.set(-420, 200, 240);
    this.celestial.add(this.moon);
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

    // Update TSL uniforms
    const top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#ff8a4a', dusk * 0.6);
    this._uTop.value = new THREE.Color(top);
    this._uHor.value = new THREE.Color(hor);
    this._uSunCol.value = new THREE.Color(U.mixHex(pal.sun, '#ff6a3a', dusk * 0.65));
    this._uSun.value = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z);
    this._uNight.value = 1 - day;
    this._uStar.value = Math.max(0, 1 - day * 2.5) * 1.0;

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
    this.sunLight.intensity = 0.6 + day * 1.8 + dusk * 0.2;
    this.sunLight.color.set(dusk > 0.1
      ? U.mixHex(pal.sun, '#ff7a4a', dusk * 0.7)
      : U.mixHex('#8fa8cc', pal.sun, Math.max(day, 0.2)));

    this.hemi.intensity = 0.5 + day * 0.7 + dusk * 0.1;
    this.hemi.color.set(top);
    this.hemi.groundColor.set(U.shade(pal.grass, 0.5 + day * 0.2));
    this.ambientFill.intensity = 0.25 + (1 - day) * 0.25;

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

    // Star field
    this.starfield.update(g.time, g.camera.rotation.y, g.camera.rotation.x, 1 - day);
  }
}
