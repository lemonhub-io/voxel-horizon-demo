// ============================================================
// ship.ts — Ship components, flight, landing, warp
// ============================================================

import { U } from './utils';
import { Sky } from './sky';
import { fitCC0Model, loadCC0Model } from './cc0-models';
import { CC0_MODEL_URLS } from './model-assets';
import type { Game, ShipComponent, ShipSaveData } from './types';

export class Ship {
  g: Game;
  group: THREE.Group;
  comps: Record<string, ShipComponent>;
  fuel: number;
  flying: boolean;
  speed: number;
  throttle: number;
  yaw: number;
  pitch: number;
  landing: boolean;
  smokeT: number;
  open: boolean;
  engineGlows: THREE.Sprite[];
  shadow!: THREE.Mesh;

  constructor(game: Game) {
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
    this.engineGlows = [];
  }

  buildMesh(): void {
    const grp = this.group;
    while (grp.children.length) grp.remove(grp.children[0]);
    // PBR materials with roughness variation
    const white = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.7, metalness: 0.1 });
    const red = new THREE.MeshStandardMaterial({ color: '#c8472e', roughness: 0.6, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.5, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#a8d8e8', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 });
    const accent = new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: 0.4, metalness: 0.4 });

    // Body — smoother cylinder (16 segments)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 5.2, 16), white);
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.6;
    grp.add(body);

    // Nose — smoother cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 16), red);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.6, -3.7);
    grp.add(nose);

    // Cabin — glass sphere
    const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), glassMat);
    cabin.scale.set(1, 0.75, 1.4);
    cabin.position.set(0, 2.5, -1.1);
    grp.add(cabin);

    // Spine with panel detail
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 3.4), red);
    spine.position.set(0, 2.35, 0.9);
    grp.add(spine);
    // Panel line on spine
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 3.42), accent);
    panel.position.set(0, 2.65, 0.9);
    grp.add(panel);

    for (const side of [-1, 1]) {
      // Wing with rounded edge
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.9), white);
      wing.position.set(side * 2.4, 1.5, 0.6);
      wing.rotation.z = side * 0.28;
      grp.add(wing);
      // Wing panel line
      const wingPanel = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.04, 1.92), accent);
      wingPanel.position.set(side * 2.4, 1.58, 0.6);
      wingPanel.rotation.z = side * 0.28;
      grp.add(wingPanel);

      const wtip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.4), red);
      wtip.position.set(side * 4.0, 1.95, 0.6);
      wtip.rotation.z = side * 0.28;
      grp.add(wtip);

      // Engine — smoother cylinder with greeble
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 12), dark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(side * 1.35, 1.45, 2.6);
      grp.add(eng);
      // Engine ring detail
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.04, 6, 12), accent);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * 1.35, 1.45, 2.0);
      grp.add(ring);

      // Landing leg
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

    // Enable shadow casting on ship meshes (not glow/sprite/shadow-plane)
    for (const child of grp.children) {
      if (child instanceof THREE.Mesh && child !== shadow) {
        child.castShadow = true;
      }
    }
    void this.loadCC0Visual();
  }

  private async loadCC0Visual(): Promise<void> {
    try {
      const model = await loadCC0Model(CC0_MODEL_URLS.ship);
      fitCC0Model(model, 8.2, 4.4);
      model.rotation.y = Math.PI;
      const fallbackMeshes = this.group.children.filter(child => child instanceof THREE.Mesh && child !== this.shadow);
      fallbackMeshes.forEach(mesh => { mesh.visible = false; });
      this.group.add(model);
    } catch {
      // Keep the procedural fallback available if an asset cannot be loaded.
    }
  }

  repaired(): boolean { return !this.comps.thruster.broken && !this.comps.pulse.broken; }
  canLaunch(): boolean { return this.repaired() && this.fuel >= 25; }

  placeAt(x: number, z: number): void {
    const y = this.g.world.topSolidY(Math.floor(x), Math.floor(z)) + 1;
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, U.rand(0, 6.28), 0);
    this.updateCrashPose();
  }

  updateCrashPose(): void {
    const broken = !this.repaired();
    this.group.rotation.z = broken ? 0.16 : 0;
    this.group.rotation.x = broken ? -0.06 : 0;
  }

  update(dt: number): void {
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
      this.engineGlows.forEach(s => { (s.material as THREE.SpriteMaterial).opacity = glow; });
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
      (s.material as THREE.SpriteMaterial).opacity = 0.5 + this.throttle * 0.5 + boost * 0.4;
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

    document.getElementById('fd-speed')!.textContent = String(Math.round(this.speed));
    document.getElementById('fd-alt')!.textContent = String(Math.max(0, Math.round(pos.y - groundY + 4)));
    document.getElementById('fd-warp')!.textContent = String(g.inv.count('warp_cell'));
  }

  enter(): void {
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

  tryLand(): void {
    const g = this.g;
    const pos = this.group.position;
    const gy = g.world.topSolidY(Math.floor(pos.x), Math.floor(pos.z)) + 1;
    if (pos.y - gy > 60) { g.hud.notify('高度过高，无法降落', 'warn'); g.audio.uiDeny(); return; }
    this.flying = false;
    this.landing = true;
    g.audio.landing();
    g.audio.setLoop('ship', false, 0, 0.8);
    const land = (): void => {
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

  tryWarp(): void {
    const g = this.g;
    if (g.inv.count('warp_cell') < 1) {
      g.hud.notify('需要 跃迁电池 ×1 —— 用铜、碳纳米管与双氢合成', 'warn');
      g.audio.uiDeny();
      return;
    }
    g.inv.consume('warp_cell', 1);
    g.startWarp();
  }

  openPanel(): void {
    this.open = true;
    this.syncStore();
    this.g.exitPointerLock();
    this.g.audio.uiOpen();
  }
  closePanel(): void {
    this.open = false;
    this.syncStore();
  }

  /** Repair a component by key */
  repair(key: string): boolean {
    const c = this.comps[key];
    if (!c || !c.broken) return false;
    if (!this.g.inv.pay(c.req)) { this.g.audio.uiDeny(); return false; }
    c.broken = false;
    this.g.audio.craft();
    this.g.fx.shake(0.2);
    this.g.hud.notify(`${c.name} 修复完成`, 'success');
    this.updateCrashPose();
    this.syncStore();
    this.g.missions.onEvent('repair_' + key);
    return true;
  }

  /** Refuel the ship */
  refuel(): boolean {
    if (this.g.inv.count('launch_fuel') < 1 || this.fuel >= 100) { this.g.audio.uiDeny(); return false; }
    this.g.inv.consume('launch_fuel', 1);
    this.fuel = 100;
    this.g.audio.recharge();
    this.g.hud.notify('燃料舱已加注 100%', 'success');
    this.syncStore();
    this.g.missions.onEvent('refuel');
    return true;
  }

  /** Sync ship state to Pinia store */
  syncStore(): void {
    const s = (this.g as unknown as { stores: { ship: { comps: Record<string, ShipComponent>; fuel: number; open: boolean; flying: boolean; speed: number; throttle: number } } }).stores;
    if (!s) return;
    s.ship.comps = { ...this.comps };
    s.ship.fuel = this.fuel;
    s.ship.open = this.open;
    s.ship.flying = this.flying;
    s.ship.speed = this.speed;
    s.ship.throttle = this.throttle;
  }

  serialize(): ShipSaveData {
    return {
      pos: this.group.position.toArray(),
      rotY: this.group.rotation.y,
      fuel: this.fuel,
      thruster: this.comps.thruster.broken,
      pulse: this.comps.pulse.broken
    };
  }
  deserialize(d: ShipSaveData | undefined): void {
    if (!d) return;
    this.group.position.fromArray(d.pos);
    this.group.rotation.y = d.rotY;
    this.fuel = d.fuel;
    this.comps.thruster.broken = d.thruster;
    this.comps.pulse.broken = d.pulse;
    this.updateCrashPose();
  }
}
