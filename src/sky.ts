// ============================================================
// sky.ts — Sky dome, sun, moon, atmosphere (HDR + optimized lighting)
// ============================================================

import { U } from './utils';
import { CFG } from './config';
import type { Game, Palette } from './types';

export class Sky {
  g: Game;
  group: THREE.Group;
  uniforms: {
    topColor: { value: THREE.Color };
    horColor: { value: THREE.Color };
    sunDir: { value: THREE.Vector3 };
    sunColor: { value: THREE.Color };
    nightMix: { value: number };
    uTime: { value: number };
    starBright: { value: number };
  };
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

  constructor(game: Game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);

    this.uniforms = {
      topColor: { value: new THREE.Color('#3a8fd4') },
      horColor: { value: new THREE.Color('#bfe4ee') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#fff2d0') },
      nightMix: { value: 0 },
      uTime: { value: 0 },
      starBright: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = position;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 topColor, horColor, sunDir, sunColor;
        uniform float nightMix, uTime, starBright;
        varying vec3 vDir;

        float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }

        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);

          // Atmospheric scattering gradient
          float scatter = pow(h, 0.45);
          vec3 col = mix(horColor, topColor, scatter);

          // Ground reflection
          if(d.y < 0.0){
            col = mix(horColor, horColor * 0.45, min(-d.y * 2.5, 1.0));
          }

          // Sun disc with multiple lobes (HDR values, tone-mapped by renderer)
          float s = max(dot(d, sunDir), 0.0);
          float horizonBoost = 1.0 - abs(d.y);

          // Core disc — very bright HDR peak
          col += sunColor * pow(s, 900.0) * 5.0;
          // Inner glow — bright halo
          col += sunColor * pow(s, 24.0) * 0.8;
          // Outer haze
          col += sunColor * pow(s, 5.0) * 0.3 * horizonBoost;
          // Wide atmospheric glow near horizon
          col += sunColor * pow(s, 2.0) * 0.1 * horizonBoost;

          // Dusk/dawn horizon band
          float duskBand = exp(-abs(d.y) * 8.0) * nightMix * 0.3;
          col += vec3(1.0, 0.4, 0.15) * duskBand * max(sunDir.y + 0.2, 0.0);

          // Stars (only visible at night)
          if(starBright > 0.01 && d.y > -0.05){
            vec3 cell = floor(d * 190.0);
            float star = step(0.9975, hash3(cell));
            float tw = 0.55 + 0.45 * sin(uTime * 2.4 + hash3(cell + 1.0) * 40.0);
            // Brighter stars with slight color variation
            float starCol = hash3(cell + 2.0);
            vec3 starTint = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.7), starCol);
            col += starTint * star * tw * starBright * 1.2;
          }

          // Night sky ambient glow
          if(nightMix > 0.3){
            float nightGlow = (1.0 - h) * nightMix * 0.08;
            col += vec3(0.05, 0.08, 0.15) * nightGlow;
          }

          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 16), mat);
    (this.dome as THREE.Mesh).frustumCulled = false;
    (this.dome as THREE.Mesh).renderOrder = -10;
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
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
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
    this.uniforms.sunDir.value.copy(sunDir);

    // Smooth day/night curve with wider twilight zone
    const day = U.clamp(sunY * 2.8 + 0.35, 0, 1);
    this.dayMix = day;
    // Dusk factor: peaks when sun is near horizon
    const dusk = U.clamp(1 - Math.abs(sunY) * 3.5, 0, 1) * (day > 0.03 ? 1 : 0.3);

    const pal = this.pal;

    // Sky colors with smooth interpolation
    const top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#ff8a4a', dusk * 0.6);
    this.uniforms.topColor.value.set(top);
    this.uniforms.horColor.value.set(hor);
    this.uniforms.sunColor.value.set(U.mixHex(pal.sun, '#ff6a3a', dusk * 0.65));
    this.uniforms.nightMix.value = 1 - day;
    this.uniforms.starBright.value = Math.max(0, 1 - day * 3) * 0.85;

    // Sun light — HDR values (tone-mapped by renderer)
    this.sunLight.position.copy(sunDir).multiplyScalar(300);

    // Shadow camera follows player, snapped to texel grid to prevent jitter
    if (g.player) {
      const p = g.player.pos;
      const texelSize = 160 / 2048; // shadow frustum / map resolution
      const snapX = Math.round(p.x / texelSize) * texelSize;
      const snapZ = Math.round(p.z / texelSize) * texelSize;
      this.sunLight.target.position.set(snapX, p.y, snapZ);
      this.sunLight.target.updateMatrixWorld();
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

    // Ambient fill — prevents pitch black at night
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
