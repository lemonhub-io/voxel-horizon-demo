class Sky {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);

    this.uniforms = {
      topColor: { value: new THREE.Color('#3a8fd4') },
      horColor: { value: new THREE.Color('#bfe4ee') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#fff2d0') },
      nightMix: { value: 0 },
      uTime: { value: 0 }
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
        uniform float nightMix, uTime;
        varying vec3 vDir;
        float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horColor, topColor, pow(h, 0.5));
          if(d.y < 0.0) col = mix(horColor, horColor*0.55, min(-d.y*2.2,1.0));
          float s = max(dot(d, sunDir), 0.0);
          float horizonBoost = 1.0 - abs(d.y);
          col += sunColor * (pow(s, 900.0)*1.4 + pow(s, 24.0)*0.28 + pow(s, 5.0)*0.12*horizonBoost);
          if(nightMix > 0.01 && d.y > -0.1){
            vec3 cell = floor(d * 190.0);
            float star = step(0.9975, hash3(cell));
            float tw = 0.55 + 0.45*sin(uTime*2.4 + hash3(cell+1.0)*40.0);
            col += vec3(star * tw * nightMix * 0.85);
          }
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    game.scene.add(this.sunLight);
    this.hemi = new THREE.HemisphereLight(0xbfd8e8, 0x3a4a3a, 0.75);
    game.scene.add(this.hemi);

    this.celestial = new THREE.Group();
    this.group.add(this.celestial);
    const mk = (r, col, emis, x, y, z) => {
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

  static makeGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  setPalette(pal) {
    this.pal = pal;
    const rng = U.mulberry32(this.g.seed ^ 0x77);
    this.planetBig.material.color.set(U.mixHex(pal.skyDayTop, '#8a9ab8', 0.5));
    this.planetBig.position.set(300 + rng() * 400, 90 + rng() * 160, -500 + rng() * 300);
    this.planetGlow.position.copy(this.planetBig.position);
    this.planetGlow.material.color.set(pal.skyDayHor);
    this.moon.position.set(-300 - rng() * 300, 150 + rng() * 120, 100 + rng() * 300);
  }

  update(dt) {
    const g = this.g;
    this.t = (this.t + dt / CFG.DAY_LEN) % 1;
    const ang = (this.t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(ang), sunX = Math.cos(ang);
    const sunDir = new THREE.Vector3(sunX * 0.7, sunY, sunX * 0.3).normalize();
    this.uniforms.sunDir.value.copy(sunDir);
    this.uniforms.uTime.value = g.timeUniform.value;

    const day = U.clamp(sunY * 3 + 0.35, 0, 1);
    this.dayMix = day;
    const dusk = U.clamp(1 - Math.abs(sunY) * 4, 0, 1) * (day > 0.05 ? 1 : 0.4);
    const pal = this.pal;

    let top = U.mixHex(pal.skyNightTop, pal.skyDayTop, day);
    let hor = U.mixHex(pal.skyNightHor, pal.skyDayHor, day);
    if (dusk > 0) hor = U.mixHex(hor, '#ff9a5a', dusk * 0.55);
    this.uniforms.topColor.value.set(top);
    this.uniforms.horColor.value.set(hor);
    this.uniforms.sunColor.value.set(U.mixHex(pal.sun, '#ff7a3a', dusk * 0.6));
    this.uniforms.nightMix.value = 1 - day;

    this.sunLight.position.copy(sunDir).multiplyScalar(300);
    this.sunLight.intensity = 0.35 + day * 0.85;
    this.sunLight.color.set(U.mixHex('#8fa8cc', U.mixHex(pal.sun, '#ff9a5a', dusk * 0.5), Math.max(day, 0.25)));
    this.hemi.intensity = 0.28 + day * 0.55;
    this.hemi.color.set(top);
    this.hemi.groundColor.set(U.shade(pal.grass, 0.5));

    this.sunSprite.position.copy(sunDir).multiplyScalar(650);
    this.sunSprite.material.opacity = 0.55 + day * 0.4;

    const storm = g.stormFactor || 0;
    let fogCol = U.mixHex(pal.fogNight, pal.fogDay, day);
    if (storm > 0) fogCol = U.mixHex(fogCol, U.shade(pal.fogDay, 0.75), storm * 0.7);
    const dist = g.settings.dist * 16;
    let fogNear = dist * 0.45, fogFar = dist * 1.05;
    if (storm > 0) { fogNear = U.lerp(fogNear, 8, storm); fogFar = U.lerp(fogFar, dist * 0.55, storm); }
    if (g.player && g.player.headInWater) { fogCol = U.shade(pal.water || '#2e6f9e', 0.7); fogNear = 2; fogFar = 22; }
    g.scene.fog.color.set(fogCol);
    g.scene.fog.near = fogNear;
    g.scene.fog.far = fogFar;
    g.renderer.setClearColor(fogCol);

    this.group.position.copy(g.camera.position);
    this.celestial.rotation.y += dt * 0.002;

    if (g.audio.ok) g.audio.nightMix = 1 - day;
  }
}
