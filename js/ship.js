class Ship {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.buildMesh();
    this.comps = {
      thruster: { name: '起飞推进器', broken: true, req: [['metal_plate', 1], ['ferrite', 20]], desc: '突破重力井的主推进器。' },
      pulse: { name: '脉冲引擎', broken: true, req: [['nanotube', 1], ['sodium', 15]], desc: '大气层内巡航引擎。' }
    };
    this.fuel = 0;
    this.flying = false;
    this.speed = 0;
    this.throttle = 0.4;
    this.yaw = 0;
    this.pitch = 0;
    this.landing = false;
    this.smokeT = 0;
    this.open = false;
  }

  buildMesh() {
    const grp = this.group;
    while (grp.children.length) grp.remove(grp.children[0]);
    const white = new THREE.MeshLambertMaterial({ color: '#e8e4dc' });
    const red = new THREE.MeshLambertMaterial({ color: '#c8472e' });
    const dark = new THREE.MeshLambertMaterial({ color: '#3a3f48' });
    const glassMat = new THREE.MeshLambertMaterial({ color: '#a8d8e8', transparent: true, opacity: 0.55 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 5.2, 8), white);
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.6;
    grp.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 8), red);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.6, -3.7);
    grp.add(nose);
    const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), glassMat);
    cabin.scale.set(1, 0.75, 1.4);
    cabin.position.set(0, 2.5, -1.1);
    grp.add(cabin);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 3.4), red);
    spine.position.set(0, 2.35, 0.9);
    grp.add(spine);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.9), white);
      wing.position.set(side * 2.4, 1.5, 0.6);
      wing.rotation.z = side * 0.28;
      grp.add(wing);
      const wtip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.4), red);
      wtip.position.set(side * 4.0, 1.95, 0.6);
      wtip.rotation.z = side * 0.28;
      grp.add(wtip);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 8), dark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(side * 1.35, 1.45, 2.6);
      grp.add(eng);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.18), dark);
      leg.position.set(side * 1.3, 0.55, -0.4);
      grp.add(leg);
    }
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.18), dark);
    legB.position.set(0, 0.55, 2.2);
    grp.add(legB);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.6), red);
    fin.position.set(0, 3.1, 2.4);
    grp.add(fin);

    const glowTex = Sky.makeGlow();
    this.engineGlows = [];
    for (const side of [-1, 1]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#7ac8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(side * 1.35, 1.45, 3.6);
      s.scale.set(1.4, 1.4, 1);
      grp.add(s);
      this.engineGlows.push(s);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(4.4, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    grp.add(shadow);
    this.shadow = shadow;
  }

  repaired() { return !this.comps.thruster.broken && !this.comps.pulse.broken; }
  canLaunch() { return this.repaired() && this.fuel >= 25; }

  placeAt(x, z) {
    const y = this.g.world.topSolidY(Math.floor(x), Math.floor(z)) + 1;
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, U.rand(0, 6.28), 0);
    this.updateCrashPose();
  }

  updateCrashPose() {
    const broken = !this.repaired();
    this.group.rotation.z = broken ? 0.16 : 0;
    this.group.rotation.x = broken ? -0.06 : 0;
  }

  update(dt) {
    const g = this.g;
    if (!this.flying) {
      if (!this.repaired()) {
        this.smokeT -= dt;
        if (this.smokeT <= 0) {
          this.smokeT = 0.18;
          const p = this.group.position;
          g.fx.spawn(p.x + U.rand(-1, 1), p.y + 2.4, p.z + U.rand(-1, 1), { n: 2, col: '#555a60', speed: 0.4, up: 1.2, life: 1.4, grav: -1.2 });
          if (Math.random() < 0.25) g.fx.spawn(p.x, p.y + 1.8, p.z, { n: 2, col: '#ffb066', speed: 1.4, life: 0.35, grav: 4 });
        }
      }
      const glow = this.repaired() ? 0.5 + Math.sin(g.time * 3) * 0.15 : 0;
      this.engineGlows.forEach(s => { s.material.opacity = glow; });
      return;
    }

    const input = g.input;
    const sens = g.settings.sens / 100 * 0.0022;
    this.yaw -= input.dx * sens;
    this.pitch += (g.settings.invert ? -1 : 1) * input.dy * sens * 0.8;
    this.pitch = U.clamp(this.pitch, -1.1, 1.1);
    input.dx = input.dy = 0;

    if (input.keys['KeyW']) this.throttle = Math.min(1, this.throttle + dt * 0.7);
    if (input.keys['KeyS']) this.throttle = Math.max(0, this.throttle - dt * 0.9);
    const boost = input.keys['Space'] ? 1 : 0;
    const targetSpeed = 6 + this.throttle * 58 + boost * 70;
    this.speed = U.lerp(this.speed, targetSpeed, dt * 1.6);

    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const pos = this.group.position;
    pos.addScaledVector(dir, this.speed * dt);
    const groundY = this.g.world.surfaceY(Math.floor(pos.x), Math.floor(pos.z)) + 4;
    if (pos.y < groundY) pos.y = U.lerp(pos.y, groundY, dt * 5);
    if (pos.y > 220) pos.y = 220;

    const targetRot = new THREE.Euler(this.pitch * 0.9, this.yaw + Math.PI, 0, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(targetRot);
    const bank = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), U.clamp(-input.dxSmooth * 0.04, -0.6, 0.6));
    q.multiply(bank);
    this.group.quaternion.slerp(q, dt * 5);

    this.engineGlows.forEach(s => {
      s.material.opacity = 0.5 + this.throttle * 0.5 + boost * 0.4;
      s.scale.setScalar(1.2 + this.throttle * 1.2 + boost * 1 + Math.random() * 0.2);
    });
    if (boost || this.throttle > 0.5) {
      const back = new THREE.Vector3().copy(dir).multiplyScalar(-3.4).add(pos);
      g.fx.spawn(back.x, back.y + 1.5, back.z, { n: 1, col: boost ? '#bfe8ff' : '#7ac8ff', speed: 0.8, life: 0.3, grav: 0, up: 0 });
    }

    g.audio.shipThrottle(this.throttle + boost * 0.5);
    this.shadow.visible = false;

    const cam = g.camera;
    const camOff = new THREE.Vector3().copy(dir).multiplyScalar(-11);
    camOff.y += 3.6;
    const camTarget = new THREE.Vector3().copy(pos).add(camOff);
    cam.position.lerp(camTarget, 1 - Math.pow(0.0001, dt));
    const look = new THREE.Vector3().copy(pos).addScaledVector(dir, 14);
    look.y += 1.5;
    cam.lookAt(look);

    document.getElementById('fd-speed').textContent = Math.round(this.speed);
    document.getElementById('fd-alt').textContent = Math.max(0, Math.round(pos.y - groundY + 4));
    document.getElementById('fd-warp').textContent = g.inv.count('warp_cell');
  }

  enter() {
    const g = this.g;
    if (!this.canLaunch()) { this.openPanel(); return; }
    g.hud.closeShipPanel();
    this.flying = true;
    this.landing = false;
    this.fuel = Math.max(0, this.fuel - 25);
    this.speed = 0;
    this.throttle = 0.5;
    const e = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
    this.yaw = e.y - Math.PI;
    this.pitch = -0.35;
    g.player.inShip = true;
    g.audio.takeoff();
    g.audio.setLoop('ship', true, 0.9, 0.5);
    g.fx.shake(0.5);
    g.hud.setFlightHud(true);
    g.hud.notify('起飞成功 —— 脉冲引擎在线', 'success');
    const p = this.group.position;
    for (let i = 0; i < 24; i++) g.fx.spawn(p.x + U.rand(-2, 2), p.y + 0.5, p.z + U.rand(-2, 2), { n: 2, col: '#d8cfc0', speed: 3, life: 0.9 });
    this.group.position.y += 0.5;
    g.missions.onEvent('launch');
  }

  tryLand() {
    const g = this.g;
    const pos = this.group.position;
    const gy = g.world.topSolidY(Math.floor(pos.x), Math.floor(pos.z)) + 1;
    if (pos.y - gy > 60) { g.hud.notify('高度过高，无法降落', 'warn'); g.audio.uiDeny(); return; }
    this.flying = false;
    this.landing = true;
    g.audio.landing();
    g.audio.setLoop('ship', false, 0, 0.8);
    const land = () => {
      const cur = this.group.position;
      const targetY = g.world.topSolidY(Math.floor(cur.x), Math.floor(cur.z)) + 1;
      if (cur.y > targetY + 0.15) {
        cur.y -= Math.max(6 * (1 / 60), (cur.y - targetY) * 0.04);
        this.group.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw + Math.PI, 0)), 0.06);
        requestAnimationFrame(land);
      } else {
        cur.y = targetY;
        this.landing = false;
        this.shadow.visible = true;
        g.player.exitShip();
        g.fx.shake(0.35);
        g.audio.land(true);
        for (let i = 0; i < 16; i++) g.fx.spawn(cur.x + U.rand(-2.5, 2.5), cur.y + 0.4, cur.z + U.rand(-2.5, 2.5), { n: 1, col: '#cfc4b0', speed: 2.4, life: 0.7 });
      }
    };
    land();
  }

  tryWarp() {
    const g = this.g;
    if (g.inv.count('warp_cell') < 1) {
      g.hud.notify('需要 跃迁电池 ×1 —— 用铜、碳纳米管与双氢合成', 'warn');
      g.audio.uiDeny();
      return;
    }
    g.inv.consume('warp_cell', 1);
    g.startWarp();
  }

  openPanel() {
    this.open = true;
    this.g.exitPointerLock();
    document.getElementById('ship-screen').classList.remove('hidden');
    this.g.audio.uiOpen();
    this.renderPanel();
  }
  closePanel() {
    this.open = false;
    document.getElementById('ship-screen').classList.add('hidden');
  }

  renderPanel() {
    const g = this.g;
    const wrap = document.getElementById('ship-comps');
    wrap.innerHTML = '';
    for (const key of ['thruster', 'pulse']) {
      const c = this.comps[key];
      const d = document.createElement('div');
      d.className = 'comp-card ' + (c.broken ? 'broken' : 'ok');
      let req = '';
      if (c.broken) {
        req = c.req.map(([id, n]) => {
          const have = g.inv.count(id);
          return `<span style="color:${have >= n ? '#9be564' : '#ff5c5c'}"><img src="${g.atlas.icon(id)}" style="width:18px;height:18px;vertical-align:-4px"> ${ITEMS[id].name} ${have}/${n}</span>`;
        }).join(' · ');
      }
      d.innerHTML = `
        <div class="cc-name">${c.name}</div>
        <div class="cc-status">${c.broken ? '● 受损 // DAMAGED' : '● 在线 // ONLINE'}</div>
        <div class="cc-req">${c.broken ? req : c.desc}</div>
        ${c.broken ? `<button class="btn sm ${g.inv.canAfford(c.req) ? 'primary' : 'disabled'}" data-fix="${key}">修复</button>` : ''}`;
      wrap.appendChild(d);
    }
    wrap.querySelectorAll('[data-fix]').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.fix;
        const c = this.comps[key];
        if (!g.inv.pay(c.req)) { g.audio.uiDeny(); return; }
        c.broken = false;
        g.audio.craft();
        g.fx.shake(0.2);
        g.hud.notify(`${c.name} 修复完成`, 'success');
        this.updateCrashPose();
        this.renderPanel();
        g.missions.onEvent('repair_' + key);
      });
    });
    document.getElementById('ship-fuel-fill').style.width = this.fuel + '%';
    document.getElementById('ship-fuel-txt').textContent = Math.round(this.fuel) + '%';
    const refuel = document.getElementById('btn-refuel');
    refuel.classList.toggle('disabled', g.inv.count('launch_fuel') < 1 || this.fuel >= 100);
    refuel.onclick = () => {
      if (g.inv.count('launch_fuel') < 1) { g.audio.uiDeny(); return; }
      g.inv.consume('launch_fuel', 1);
      this.fuel = 100;
      g.audio.recharge();
      g.hud.notify('燃料舱已加注 100%', 'success');
      this.renderPanel();
      g.missions.onEvent('refuel');
    };
    const launch = document.getElementById('btn-launch');
    launch.classList.toggle('disabled', !this.canLaunch());
    launch.onclick = () => {
      if (!this.canLaunch()) { g.audio.uiDeny(); return; }
      this.closePanel();
      g.requestPointerLock();
      setTimeout(() => this.enter(), 60);
    };
  }

  serialize() {
    return {
      pos: this.group.position.toArray(),
      rotY: this.group.rotation.y,
      fuel: this.fuel,
      thruster: this.comps.thruster.broken,
      pulse: this.comps.pulse.broken
    };
  }
  deserialize(d) {
    if (!d) return;
    this.group.position.fromArray(d.pos);
    this.group.rotation.y = d.rotY;
    this.fuel = d.fuel;
    this.comps.thruster.broken = d.thruster;
    this.comps.pulse.broken = d.pulse;
    this.updateCrashPose();
  }
}
