// ============================================================
// sky.ts — Soft TSL skydome + lights / CSM (WebGPU)
// ============================================================
//
// Uses a controlled LDR TSL gradient sky (not Preetham SkyMesh).
// Preetham HDR sun energy was repeatedly clipping the horizon bright;
// this shader stays in a soft 0–1-ish range under ACES exposure.
//

import * as THREE from 'three/webgpu';
import {
  uniform,
  float,
  vec3,
  mix,
  pow,
  max,
  min,
  abs,
  dot,
  normalize,
  exp,
  positionLocal,
  clamp as tslClamp,
} from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { U } from './utils';
import { CFG } from './config';
import { Starfield } from './starfield';
import type { Game, Palette } from './types';

type UniformVec3 = { value: THREE.Vector3 | THREE.Color };
type UniformFloat = { value: number };

export class Sky {
  g: Game;
  group: THREE.Group;
  /** Soft TSL skydome mesh. */
  dome!: THREE.Mesh;
  sunLight!: THREE.DirectionalLight;
  csm!: CSMShadowNode;
  hemi!: THREE.HemisphereLight;
  ambientFill!: THREE.AmbientLight;
  sunSprite!: THREE.Sprite;
  clouds!: THREE.Group;
  starfield!: Starfield;
  t: number;
  dayMix: number;
  pal!: Palette;

  private _sunDir = new THREE.Vector3();
  private _moonLift = new THREE.Vector3();
  private _shadowTargetX = 0;
  private _shadowTargetZ = 0;
  private _csmSoftnessApplied = false;
  private _csmMaxFar = 0;
  private _cloudMaterials: THREE.SpriteMaterial[] = [];
  private _cloudOpacities: number[] = [];

  // TSL uniforms (updated each frame)
  private _uTop!: UniformVec3;
  private _uHor!: UniformVec3;
  private _uGround!: UniformVec3;
  private _uSunDir!: UniformVec3;
  private _uSunCol!: UniformVec3;
  private _uDay!: UniformFloat;
  private _uDusk!: UniformFloat;
  private _uStorm!: UniformFloat;

  constructor(game: Game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.t = 0.28;
    this.dayMix = 1;

    this._buildSkyDome();
    this._buildLights();
    this._buildSun();
    this._buildClouds();
    this.starfield = new Starfield();
  }

  /**
   * Soft palette-driven TSL sky (MeshBasicNodeMaterial).
   * Gradient + mild Rayleigh-like falloff + gentle sun glow (no HDR Preetham).
   */
  private _buildSkyDome(): void {
    const uTop = uniform(new THREE.Color('#3a8fd4'));
    const uHor = uniform(new THREE.Color('#bfe4ee'));
    const uGround = uniform(new THREE.Color('#1a2838'));
    const uSunDir = uniform(new THREE.Vector3(0.5, 0.8, 0.2));
    const uSunCol = uniform(new THREE.Color('#fff2d0'));
    const uDay = uniform(1.0);
    const uDusk = uniform(0.0);
    const uStorm = uniform(0.0);

    this._uTop = uTop as unknown as UniformVec3;
    this._uHor = uHor as unknown as UniformVec3;
    this._uGround = uGround as unknown as UniformVec3;
    this._uSunDir = uSunDir as unknown as UniformVec3;
    this._uSunCol = uSunCol as unknown as UniformVec3;
    this._uDay = uDay as unknown as UniformFloat;
    this._uDusk = uDusk as unknown as UniformFloat;
    this._uStorm = uStorm as unknown as UniformFloat;

    const dir = normalize(positionLocal);
    const h = max(dir.y, float(0));
    const under = max(dir.y.negate(), float(0));

    // Soft vertical gradient (zenith → horizon → ground)
    const zenithMix = pow(h, float(0.55));
    let col = mix(uHor, uTop, zenithMix);

    // Slight cooler zenith / warmer low sky without harsh bands
    const lowBoost = pow(float(1).sub(h), float(2.2));
    col = mix(col, uHor.mul(1.05), lowBoost.mul(0.25));

    // Soft ground hemisphere
    const groundMask = tslClamp(under.mul(2.2), float(0), float(1));
    col = mix(col, mix(uHor, uGround, float(0.65)), groundMask);

    // Soft sky body first (no HDR sun energy), then add a visible sun disc on top.
    col = min(col, vec3(0.88));

    // Visible sun disc + soft corona (still much gentler than Preetham SkyMesh).
    // sunAbove fades the disc under the horizon instead of hard-cutting.
    const sunDirN = normalize(uSunDir);
    const sunDot = max(dot(dir, sunDirN), float(0));
    const sunAbove = tslClamp(sunDirN.y.mul(3.5).add(0.15), float(0), float(1));
    const dayVis = max(uDay, uDusk.mul(0.65));
    // Tight bright core (disc)
    const disc = pow(sunDot, float(220)).mul(float(1.15));
    // Soft limb
    const limb = pow(sunDot, float(80)).mul(float(0.45));
    // Wide gentle halo
    const corona = pow(sunDot, float(12)).mul(float(0.16));
    // Dusk-only warm scatter near sun (kept mild)
    const duskGlow = pow(sunDot, float(4))
      .mul(float(1).sub(abs(dir.y)))
      .mul(uDusk)
      .mul(float(0.1));
    const sunLight = disc.add(limb).add(corona).add(duskGlow).mul(sunAbove).mul(dayVis);
    col = col.add(uSunCol.mul(sunLight));

    // Gentle dusk warm band near horizon
    const duskBand = exp(abs(dir.y).negate().mul(5.5)).mul(uDusk).mul(float(0.14));
    col = col.add(vec3(1.0, 0.48, 0.25).mul(duskBand));

    // Storm desaturation / darken
    const stormGrey = vec3(0.35, 0.38, 0.42);
    col = mix(col, stormGrey, uStorm.mul(0.45));
    col = col.mul(float(1).sub(uStorm.mul(0.2)));

    // Night pull toward deep blue (when day low). Floor kept readable (~CFG.NIGHT.skyFloor).
    const nightCol = mix(uHor, uTop, float(0.4)).mul(0.58);
    col = mix(nightCol, col, max(uDay, uDusk.mul(0.5)));

    // Soft ceiling: allow sun to read brighter than sky, ACES will roll it off.
    col = min(col, vec3(1.25));

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = col;
    mat.side = THREE.BackSide;
    mat.depthWrite = false;
    mat.fog = false;
    mat.toneMapped = true;

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 32, 20), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);
  }

  private _buildLights(): void {
    const csmCfg = CFG.CSM;
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.castShadow = true;

    const sh = this.sunLight.shadow;
    sh.mapSize.set(csmCfg.mapSize, csmCfg.mapSize);
    sh.camera.near = csmCfg.shadowNear;
    sh.camera.far = csmCfg.shadowFar;
    sh.camera.left = -50;
    sh.camera.right = 50;
    sh.camera.top = 50;
    sh.camera.bottom = -50;
    sh.camera.updateProjectionMatrix();
    sh.bias = csmCfg.bias;
    sh.normalBias = csmCfg.normalBias;
    sh.radius = csmCfg.radiusNear;
    sh.intensity = 1;

    this._csmMaxFar = this._computeCsmMaxFar();
    this.csm = new CSMShadowNode(this.sunLight, {
      cascades: csmCfg.cascades,
      maxFar: this._csmMaxFar,
      mode: csmCfg.mode,
      lightMargin: csmCfg.lightMargin,
      customSplitsCallback: (cascades, _near, _far, breaks) => {
        const preset = csmCfg.breaks;
        for (let i = 0; i < cascades; i++) {
          breaks.push(preset[Math.min(i, preset.length - 1)]);
        }
      },
    });
    this.csm.fade = false;
    this.sunLight.shadow.shadowNode = this.csm as unknown as typeof this.sunLight.shadow.shadowNode;

    this.g.scene.add(this.sunLight);
    this.g.scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8e8, 0x3a4a3a, 0.65);
    this.g.scene.add(this.hemi);

    // Cool moonlight baseline — intensity ramps up at night in update().
    this.ambientFill = new THREE.AmbientLight(CFG.NIGHT.ambientColor, CFG.NIGHT.ambientDay);
    this.g.scene.add(this.ambientFill);
  }

  private _computeCsmMaxFar(): number {
    const csmCfg = CFG.CSM;
    const dist = this.g.settings?.dist ?? 4;
    return U.clamp(dist * CFG.CHUNK * csmCfg.farScale, csmCfg.minFar, csmCfg.hardCap);
  }

  updateCsmFrustums(): void {
    if (!this.csm) return;
    const nextFar = this._computeCsmMaxFar();
    if (nextFar !== this._csmMaxFar) {
      this._csmMaxFar = nextFar;
      this.csm.maxFar = nextFar;
    }
    if (this.csm.camera) this.csm.updateFrustums();
  }

  private _applyCascadeQuality(): void {
    if (this._csmSoftnessApplied || !this.csm?.lights?.length) return;
    const csmCfg = CFG.CSM;
    const radii = [csmCfg.radiusNear, csmCfg.radiusMid, csmCfg.radiusFar];
    for (let i = 0; i < this.csm.lights.length; i++) {
      const cascadeShadow = this.csm.lights[i].shadow;
      cascadeShadow.radius = radii[Math.min(i, radii.length - 1)];
      cascadeShadow.camera.near = csmCfg.shadowNear;
      cascadeShadow.camera.far = csmCfg.shadowFar;
      cascadeShadow.camera.updateProjectionMatrix();
    }
    this._csmSoftnessApplied = true;
  }

  private _buildSun(): void {
    const glowTex = Sky.makeGlow();
    // Outer soft glow sprite (complements the TSL disc in the sky shader).
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ffe8b0',
      transparent: true,
      opacity: 0.75,
      fog: false,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    }));
    this.sunSprite.scale.set(200, 200, 1);
    this.sunSprite.renderOrder = -5;
    this.group.add(this.sunSprite);
  }

  private _buildClouds(): void {
    const texture = Sky.makeCloudTexture();
    const rng = U.mulberry32(this.g.seed ^ 0x5c10d);
    this.clouds = new THREE.Group();
    this.group.add(this.clouds);

    for (let i = 0; i < 12; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 360 + rng() * 220;
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: '#e8f4ff',
        transparent: true,
        opacity: 0.18,
        fog: false,
        depthWrite: false,
      });
      const cloud = new THREE.Sprite(material);
      cloud.position.set(Math.cos(angle) * radius, 60 + rng() * 140, Math.sin(angle) * radius);
      const width = 160 + rng() * 200;
      cloud.scale.set(width, width * (0.28 + rng() * 0.12), 1);
      this.clouds.add(cloud);
      this._cloudMaterials.push(material);
      this._cloudOpacities.push(0.4 + rng() * 0.35);
    }
  }

  static makeGlow(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(128, 128, 4, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  static makeCloudTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const context = canvas.getContext('2d')!;
    const puffs = [[70, 112, 70], [130, 82, 88], [210, 105, 78], [286, 70, 96], [372, 105, 74], [438, 120, 55]];
    for (const [x, y, radius] of puffs) {
      const gradient = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.52, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }

  setPalette(pal: Palette): void {
    this.pal = pal;
  }

  private _setColor(u: UniformVec3, hex: string): void {
    if (u.value instanceof THREE.Color) u.value.set(hex);
    else (u.value as THREE.Vector3).set(0, 0, 0);
  }

  update(dt: number): void {
    const g = this.g;
    this.t = (this.t + dt / CFG.DAY_LEN) % 1;
    const ang = (this.t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(ang);
    const sunX = Math.cos(ang);
    const sunDir = this._sunDir.set(sunX * 0.7, sunY, sunX * 0.3).normalize();

    const day = U.clamp(sunY * 2.8 + 0.35, 0, 1);
    this.dayMix = day;
    const dusk = U.clamp(1 - Math.abs(sunY) * 3.5, 0, 1) * (day > 0.03 ? 1 : 0.3);
    const pal = this.pal;
    const storm = g.stormFactor || 0;

    // --- Soft TSL sky uniforms (palette-driven, LDR) ---
    const top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#e8a070', dusk * 0.35);
    const ground = U.shade(hor, 0.35 + day * 0.15);

    this._setColor(this._uTop, top);
    this._setColor(this._uHor, hor);
    this._setColor(this._uGround, ground);
    (this._uSunDir.value as THREE.Vector3).copy(sunDir);
    this._setColor(this._uSunCol, dusk > 0.15 ? U.mixHex(pal.sun, '#ffc090', dusk * 0.4) : pal.sun);
    this._uDay.value = day;
    this._uDusk.value = dusk;
    this._uStorm.value = storm;

    // Focus shadows near the player
    if (g.player) {
      const p = g.player.pos;
      const cellSize = 4;
      const snapX = Math.round(p.x / cellSize) * cellSize;
      const snapZ = Math.round(p.z / cellSize) * cellSize;
      if (snapX !== this._shadowTargetX || snapZ !== this._shadowTargetZ) {
        this._shadowTargetX = snapX;
        this._shadowTargetZ = snapZ;
      }
      this.sunLight.target.position.set(this._shadowTargetX, p.y, this._shadowTargetZ);
    }
    this.sunLight.position
      .copy(this.sunLight.target.position)
      .addScaledVector(sunDir, CFG.CSM.lightDistance);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.updateMatrixWorld();

    // Key light only while sun is up. Below-horizon directional light was
    // still ~0.35 and lit the underside while leaving the top faces black.
    const sunUp = U.clamp(sunY * 3.8 + 0.2, 0, 1);
    this.sunLight.intensity = (0.42 + day * 0.95 + dusk * 0.08) * sunUp;
    this.sunLight.color.set(dusk > 0.1
      ? U.mixHex(pal.sun, '#ffc8a0', dusk * 0.3)
      : U.mixHex('#a8bdd4', pal.sun, Math.max(day, 0.25)));
    // Soft residual moon key when fully night (upper hemisphere so tops stay lit).
    if (sunUp < 0.08) {
      this.sunLight.intensity = 0.14;
      this.sunLight.color.set('#8aa8d0');
      this._moonLift.set(-sunDir.x * 0.35, 0.85, -sunDir.z * 0.35).normalize();
      this.sunLight.position
        .copy(this.sunLight.target.position)
        .addScaledVector(this._moonLift, CFG.CSM.lightDistance);
      this.sunLight.updateMatrixWorld();
    }

    this._applyCascadeQuality();
    const nextFar = this._computeCsmMaxFar();
    if (nextFar !== this._csmMaxFar && this.csm?.camera) {
      this._csmMaxFar = nextFar;
      this.csm.maxFar = nextFar;
      this.csm.updateFrustums();
    }

    const night = 1 - day;
    const nCfg = CFG.NIGHT;
    // Moon / sky bounce: stronger hemi + ambient so voxels stay readable at night.
    this.hemi.intensity = nCfg.hemiBase + day * 0.35 + dusk * 0.06 + night * nCfg.hemiNightBoost;
    this.hemi.color.set(day > 0.15 ? top : U.mixHex(top, '#6a90c8', 0.45));
    this.hemi.groundColor.set(U.shade(pal.grass, 0.5 + day * 0.25 + night * 0.12));
    this.ambientFill.color.set(day > 0.35 ? '#1a2030' : nCfg.ambientColor);
    this.ambientFill.intensity = U.lerp(nCfg.ambientDay, nCfg.ambientNight, night);

    // Sun sprite sits inside the sky sphere (r=720) so it draws in front of the dome.
    this.sunSprite.position.copy(sunDir).multiplyScalar(580);
    const sunHeightFade = U.clamp((sunDir.y + 0.05) / 0.35, 0, 1);
    const sunOpacity = (0.25 + day * 0.45 + dusk * 0.2) * sunHeightFade * (1 - storm * 0.4);
    this.sunSprite.material.opacity = Math.max(0, sunOpacity);
    this.sunSprite.scale.setScalar(160 + day * 80 + dusk * 40);
    this.sunSprite.material.color.set(
      dusk > 0.15 ? U.mixHex(pal.sun, '#ffb070', dusk * 0.5) : pal.sun,
    );
    this.sunSprite.visible = sunDir.y > -0.08 && this.sunSprite.material.opacity > 0.02;

    // Soft sprite clouds
    const cloudColor = U.mixHex('#6a7f96', '#f0f7ff', day);
    for (let i = 0; i < this._cloudMaterials.length; i++) {
      this._cloudMaterials[i].color.set(cloudColor);
      this._cloudMaterials[i].opacity =
        this._cloudOpacities[i] * (0.06 + day * 0.16) * (1 - storm * 0.5);
    }
    this.clouds.rotation.y += dt * 0.001;

    // Distance fog — night fog leans toward horizon so mid-range terrain is not crushed.
    const skyHorizon = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    const fogMix = U.lerp(CFG.NIGHT.fogHorizonMix, 0.55, day);
    let fogCol = U.mixHex(U.mixHex(pal.fogNight, pal.fogDay, day), skyHorizon, fogMix);
    if (storm > 0) fogCol = U.mixHex(fogCol, U.shade(pal.fogDay, 0.75), storm * 0.7);
    const dist = g.settings.dist * 16;
    let fogNear = dist * (day > 0.2 ? 0.85 : 0.95);
    let fogFar = dist * (day > 0.2 ? 2.15 : 2.45);
    if (storm > 0) {
      fogNear = U.lerp(fogNear, 12, storm);
      fogFar = U.lerp(fogFar, dist * 0.7, storm);
    }
    if (g.player && g.player.headInWater) {
      fogCol = U.shade(pal.water || '#2e6f9e', 0.7);
      fogNear = 2;
      fogFar = 22;
    }
    if (g.scene.fog instanceof THREE.Fog) {
      g.scene.fog.color.set(fogCol);
      g.scene.fog.near = fogNear;
      g.scene.fog.far = fogFar;
    }
    g.renderer.setClearColor(U.mixHex(skyHorizon, top, 0.4));

    this.group.position.copy(g.camera.position);
    if (g.audio.ok) g.audio.nightMix = 1 - day;

    this.starfield.update(g.time, g.camera.rotation.y, g.camera.rotation.x, 1 - day);
  }
}
