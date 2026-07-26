// ============================================================
// player.ts — First-person player controller
// ============================================================

import { U } from './utils';
import { CFG, B, BLOCK_DEF, T, ITEMS } from './config';
import type { Game, RaycastResult, InteractPrompt, VisorSubject, Discovery, PlayerSaveData } from './types';

export class Player {
  g: Game;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  hp: number;
  hazard: number;
  ls: number;
  jetFuel: number;
  inShip: boolean;
  dead: boolean;
  heat: number;
  overheated: number;
  mining: string | null;
  mineProgress: number;
  stepT: number;
  headInWater: boolean;
  inWater: boolean;
  sheltered: boolean;
  visor: boolean;
  analyzeT: number;
  holdE: number;
  lowBeepT: number;
  fallVy: number;
  flashlight!: THREE.SpotLight;
  scanCd: number;
  vm!: THREE.Group;
  vmTip!: THREE.Mesh;
  blockInHand!: THREE.Mesh;
  highlight!: THREE.LineSegments;
  crackMat!: THREE.MeshBasicMaterial;
  crack!: THREE.Mesh;
  target!: RaycastResult | null;
  lastHandItem!: string | null;
  flashOn!: boolean;
  sfxT?: number;
  dmgT?: number;
  zT?: number;
  xT?: number;
  zWarned?: boolean;
  xWarned?: boolean;
  dfT?: ReturnType<typeof setTimeout>;

  // Pre-allocated scratch vectors to avoid per-frame allocations
  private _eyePos = new THREE.Vector3();
  private _lookDir = new THREE.Vector3();
  private _fwd = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _wish = new THREE.Vector3();
  private _vmTipWorld = new THREE.Vector3();
  private _hitP = new THREE.Vector3();
  private _shelterCache = 0;
  private _shelterVal = false;

  constructor(game: Game) {
    this.g = game;
    this.pos = new THREE.Vector3(8, 40, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.hp = 100;
    this.hazard = 25;
    this.ls = 80;
    this.jetFuel = 100;
    this.inShip = false;
    this.dead = false;
    this.heat = 0;
    this.overheated = 0;
    this.mining = null;
    this.mineProgress = 0;
    this.stepT = 0;
    this.headInWater = false;
    this.inWater = false;
    this.sheltered = false;
    this.visor = false;
    this.analyzeT = 0;
    this.holdE = 0;
    this.lowBeepT = 0;
    this.fallVy = 0;
    this.scanCd = 0;
    this.buildViewmodel();
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })
    );
    this.highlight.visible = false;
    game.scene.add(this.highlight);
    const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.crackMat = new THREE.MeshBasicMaterial({ map: game.atlas.texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.crack = new THREE.Mesh(crackGeo, this.crackMat);
    this.crack.visible = false;
    game.scene.add(this.crack);
  }

  buildViewmodel(): void {
    const g = this.g;
    this.vm = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: '#2e333c' });
    const grey = new THREE.MeshLambertMaterial({ color: '#5a616e' });
    const acc = new THREE.MeshBasicMaterial({ color: '#ff8a5c' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), dark);
    this.vm.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6), grey);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.32);
    this.vm.add(barrel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), acc);
    tip.position.set(0, 0.03, -0.47);
    this.vm.add(tip);
    this.vmTip = tip;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.1), grey);
    grip.position.set(0, -0.15, 0.1);
    grip.rotation.x = 0.3;
    this.vm.add(grip);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: '#66d9e8' }));
    screen.position.set(0, 0.1, 0.05);
    this.vm.add(screen);
    this.blockInHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    this.blockInHand.position.set(-0.22, 0.05, 0);
    this.blockInHand.visible = false;
    this.vm.add(this.blockInHand);
    this.vm.position.set(0.32, -0.3, -0.55);
    g.camera.add(this.vm);
    this.flashlight = new THREE.SpotLight('#cfe8f0', 0, 26, 0.6, 0.5, 1.2);
    this.flashlight.position.set(0, 0, 0.1);
    g.camera.add(this.flashlight);
    g.camera.add(this.flashlight.target);
    this.flashlight.target.position.set(0, 0, -10);
    this.flashOn = false;
  }

  eyePos(): THREE.Vector3 {
    return this._eyePos.set(this.pos.x, this.pos.y + 1.62, this.pos.z);
  }
  lookDir(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return this._lookDir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt: number): void {
    const g = this.g;
    if (this.dead) return;
    if (this.inShip) {
      this.pos.copy(g.ship.group.position);
      this.statsTick(dt, true);
      return;
    }
    const input = g.input;
    const sens = g.settings.sens / 100 * 0.0023;
    this.yaw -= input.dx * sens;
    this.pitch -= input.dy * sens;
    this.pitch = U.clamp(this.pitch, -1.55, 1.55);
    input.dx = input.dy = 0;

    const fwd = this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = this._right.set(-fwd.z, 0, fwd.x);
    const wish = this._wish.set(0, 0, 0);
    if (input.keys['KeyW']) wish.add(fwd);
    if (input.keys['KeyS']) wish.sub(fwd);
    if (input.keys['KeyD']) wish.add(right);
    if (input.keys['KeyA']) wish.sub(right);
    const sprint = input.keys['ShiftLeft'] && input.keys['KeyW'] && this.ls > 5;
    if (wish.lengthSq() > 0) wish.normalize();

    const feet = this.g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    const wasInWater = this.inWater;
    this.inWater = feet === B.WATER;
    this.headInWater = this.g.world.isWater(this.pos.x, this.pos.y + 1.62, this.pos.z);
    if (this.inWater && !wasInWater && this.vel.y < -3) g.audio.splash();
    (document.getElementById('water-tint') as HTMLElement).style.opacity = this.headInWater ? '1' : '0';

    let speed = sprint ? 6.6 : 4.35;
    if (this.inWater) speed *= 0.55;
    const accel = this.onGround ? 60 : 18;
    this.vel.x = U.lerp(this.vel.x, wish.x * speed, U.clamp(accel * dt, 0, 1));
    this.vel.z = U.lerp(this.vel.z, wish.z * speed, U.clamp(accel * dt, 0, 1));

    if (this.inWater) {
      this.vel.y -= 5 * dt;
      this.vel.y = Math.max(this.vel.y, -3.2);
      if (input.keys['Space']) this.vel.y = Math.min(this.vel.y + 16 * dt, 3.4);
    } else {
      // Only apply gravity if not on ground (prevents Y oscillation)
      if (!this.onGround || this.vel.y > 0) {
        this.vel.y -= CFG.GRAVITY * dt;
      } else {
        this.vel.y = 0;
      }
      if (input.keys['Space']) {
        if (this.onGround) {
          this.vel.y = 8.0;
          this.onGround = false;
          g.audio.jump();
        } else if (this.jetFuel > 1) {
          this.vel.y = Math.min(this.vel.y + 30 * dt, 6.2);
          this.jetFuel -= 42 * dt;
          this.ls -= 0.6 * dt;
          g.audio.setLoop('jet', true, 0.7);
          if (Math.random() < 0.6) {
            const bx = this.pos.x - fwd.x * 0.2, bz = this.pos.z - fwd.z * 0.2;
            g.fx.spawn(bx, this.pos.y + 0.35, bz, { n: 1, col: '#8fd8f4', speed: 1, life: 0.4, grav: 2, up: -2 });
          }
        } else g.audio.setLoop('jet', false);
      } else g.audio.setLoop('jet', false);
    }
    if (this.onGround) this.jetFuel = Math.min(100, this.jetFuel + 30 * dt);

    this.fallVy = this.vel.y;
    this.moveCollide(dt);

    if (this.onGround && wish.lengthSq() > 0) {
      this.stepT -= dt * (sprint ? 1.6 : 1);
      if (this.stepT <= 0) {
        this.stepT = 0.42;
        const under = this.g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.4), Math.floor(this.pos.z));
        const def = BLOCK_DEF[under];
        if (def && def.snd) g.audio.step(def.snd, sprint);
        this.ls -= sprint ? 0.05 : 0.015;
      }
    }

    const cam = g.camera;
    cam.position.copy(this.eyePos());
    const bob = this.onGround && wish.lengthSq() > 0 ? Math.sin(g.time * (sprint ? 13 : 9.5)) * 0.045 : 0;
    cam.position.y += bob;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    this.vm.position.y = -0.3 + bob * 0.6 + (this.mining ? Math.sin(g.time * 40) * 0.006 : 0);
    this.vm.rotation.x = this.mining ? 0.02 : 0;
    const selItem = g.inv.selected();
    const isBlock = selItem && ITEMS[selItem.id].place !== undefined;
    this.blockInHand.visible = !!isBlock;
    if (isBlock && this.lastHandItem !== selItem!.id) {
      this.lastHandItem = selItem!.id;
      (this.blockInHand.material as THREE.MeshLambertMaterial).color.set(this.blockColor(ITEMS[selItem!.id].place!));
    }

    this.updateTargeting(dt);
    this.updateMining(dt);
    this.updateInteract(dt);
    this.statsTick(dt, false);
    this.updateVisor(dt);
    if (this.scanCd > 0) this.scanCd -= dt;
  }

  moveCollide(dt: number): void {
    const w = 0.3, h = 1.8;
    const world = this.g.world;
    const p = this.pos;
    this.vel.y = Math.max(this.vel.y, -46);
    const collide = (): boolean => world.collides(p.x - w, p.y, p.z - w, p.x + w, p.y + h - 0.001, p.z + w);
    const move = (axis: 'x' | 'y' | 'z', amt: number): void => {
      if (Math.abs(amt) < 1e-8) return;
      const dirS = Math.sign(amt);
      let rem = Math.abs(amt);
      while (rem > 0) {
        const st = Math.min(rem, 0.4);
        rem -= st;
        p[axis] += st * dirS;
        if (!collide()) continue;
        if (axis !== 'y' && (this.onGround || this.inWater)) {
          const oy = p.y;
          p.y += 0.62;
          if (!collide()) {
            while (p.y > oy) {
              p.y -= 0.05;
              if (collide()) { p.y += 0.05; break; }
            }
            continue;
          }
          p.y = oy;
        }
        let guard = 0;
        while (collide() && guard++ < 40) p[axis] -= 0.02 * dirS;
        if (axis === 'y') this.vel.y = 0;
        else this.vel[axis] = 0;
        rem = 0;
      }
    };
    move('x', this.vel.x * dt);
    move('z', this.vel.z * dt);
    const wasGround = this.onGround;
    move('y', this.vel.y * dt);
    this.onGround = this.vel.y <= 0.01 && world.collides(p.x - w, p.y - 0.12, p.z - w, p.x + w, p.y - 0.01, p.z + w);
    if (this.onGround && !wasGround) {
      const impact = this.fallVy;
      if (impact < -16) {
        const dmg = Math.floor((-impact - 15) * 4);
        this.damage(dmg, '坠落');
        this.g.audio.land(true);
        this.g.fx.shake(0.3);
      } else if (impact < -6) this.g.audio.land(false);
    }
  }

  updateTargeting(_dt?: number): void {
    const g = this.g;
    const hit = g.world.raycast(this.eyePos(), this.lookDir(), CFG.REACH);
    this.target = hit;
    if (hit && !this.visor) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else this.highlight.visible = false;
  }

  updateMining(dt: number): void {
    const g = this.g;
    const input = g.input;
    if (this.overheated > 0) {
      this.overheated -= dt;
      this.heat = Math.max(0, this.heat - dt * 0.8);
      g.hud.setHeat(this.heat, true);
      this.stopMining();
      return;
    }
    const wantMine = input.buttons[0] && !this.visor && !g.uiOpen();
    const cHit = wantMine ? g.fauna.raycastCreature(this.eyePos(), this.lookDir(), CFG.REACH + 2) : null;
    if (wantMine && cHit && (!this.target || cHit.dist < this.target.dist)) {
      const tip = this.vmTipWorld();
      const cpos = cHit.creature.grp.position.clone();
      cpos.y += cHit.creature.sp.size;
      g.fx.laserShow(tip, cpos, '#ff5c4c');
      g.audio.setLoop('laser', true, 0.85);
      this.heatUp(dt);
      this.dmgT = (this.dmgT || 0) - dt;
      if (this.dmgT <= 0) {
        this.dmgT = 0.25;
        g.fauna.hit(cHit.creature, 6);
      }
      this.mining = null;
      this.mineProgress = 0;
      this.crack.visible = false;
      g.hud.setMineProgress(0);
      return;
    }
    if (wantMine && this.target) {
      const t = this.target;
      const def = BLOCK_DEF[t.id];
      if (def.hard === Infinity) {
        g.hud.setMineProgress(0);
        this.stopMining(true);
        const tip = this.vmTipWorld();
        g.fx.laserShow(tip, new THREE.Vector3(t.x + 0.5 + t.nx * 0.5, t.y + 0.5 + t.ny * 0.5, t.z + 0.5 + t.nz * 0.5), '#ff7a3c');
        g.audio.setLoop('laser', true, 0.6);
        this.heatUp(dt);
        return;
      }
      const key = t.x + ',' + t.y + ',' + t.z;
      if (this.mining !== key) { this.mining = key; this.mineProgress = 0; }
      this.mineProgress += dt / (def.hard || 1);
      const tip = this.vmTipWorld();
      const hitP = new THREE.Vector3(t.x + 0.5 + t.nx * 0.52, t.y + 0.5 + t.ny * 0.52, t.z + 0.5 + t.nz * 0.52);
      g.fx.laserShow(tip, hitP, '#ff7a3c');
      g.audio.setLoop('laser', true, 0.85);
      g.audio.laserPitch(this.mineProgress);
      this.heatUp(dt);
      this.sfxT = (this.sfxT || 0) - dt;
      if (this.sfxT <= 0) {
        this.sfxT = 0.14;
        g.audio.mineHit(def.snd || 'stone');
        g.fx.spawn(hitP.x, hitP.y, hitP.z, { n: 3, col: this.blockColor(t.id), speed: 1.8, life: 0.45 });
      }
      const stage = Math.min(2, Math.floor(this.mineProgress * 3));
      this.crack.visible = true;
      this.crack.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      const uv = g.atlas.uv(T.CRACK0 + stage);
      this.applyCrackUV(uv);
      g.hud.setMineProgress(this.mineProgress);
      if (this.mineProgress >= 1) this.breakBlock(t);
    } else {
      this.stopMining();
      this.heat = Math.max(0, this.heat - dt * 0.65);
      g.hud.setHeat(this.heat, false);
    }
  }

  heatUp(dt: number): void {
    this.heat += dt / 3.2;
    this.g.hud.setHeat(this.heat, false);
    if (this.heat >= 1) {
      this.overheated = 2.2;
      this.g.audio.overheat();
      this.g.hud.notify('采集光束过热 —— 冷却中', 'warn');
    }
  }

  applyCrackUV(uv: [number, number, number, number]): void {
    const [u0, v0, u1, v1] = uv;
    const attr = this.crack.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i += 4) {
      attr.setXY(i, u0, v1);
      attr.setXY(i + 1, u1, v1);
      attr.setXY(i + 2, u0, v0);
      attr.setXY(i + 3, u1, v0);
    }
    attr.needsUpdate = true;
  }

  stopMining(keepLaser?: boolean): void {
    if (!keepLaser) {
      this.g.fx.laserHide();
      this.g.audio.setLoop('laser', false);
    }
    this.mining = null;
    this.mineProgress = 0;
    this.crack.visible = false;
    this.g.hud.setMineProgress(0);
  }

  blockColor(id: number): string {
    const def = BLOCK_DEF[id];
    const t = def.tiles ? (def.tiles.all !== undefined ? def.tiles.all : def.tiles.side) : T.STONE;
    return this.g.atlas.tileAvg(t!, 1);
  }

  breakBlock(t: RaycastResult): void {
    const g = this.g;
    const def = BLOCK_DEF[t.id];
    g.world.setBlock(t.x, t.y, t.z, B.AIR);
    g.audio.blockBreak(def.snd || 'stone');
    g.fx.spawn(t.x + 0.5, t.y + 0.5, t.z + 0.5, { n: 14, col: this.blockColor(t.id), speed: 2.6, life: 0.6 });
    g.fx.shake(0.06);
    if (def.drops) {
      let pi = 0;
      for (const d of def.drops) {
        if (d.p !== undefined && Math.random() > d.p) continue;
        const n = U.randi(d.n[0], d.n[1]);
        const added = g.inv.add(d.id, n);
        if (added > 0) {
          g.hud.toast(d.id, added);
          g.audio.pickup(pi++);
        } else g.hud.notify('库存已满！', 'warn');
      }
    }
    g.milestones.addStat('mined', 1);
    g.missions.onEvent('mine', String(t.id));
    this.stopMining(true);
  }

  vmTipWorld(): THREE.Vector3 {
    this.vmTip.getWorldPosition(this._vmTipWorld);
    return this._vmTipWorld;
  }

  placeBlock(): void {
    const g = this.g;
    const sel = g.inv.selected();
    if (!sel) return;
    const def = ITEMS[sel.id];
    if (def.use) { g.inv.useItem(sel.id); return; }
    if (def.place === undefined) return;
    const t = this.target;
    if (!t) return;
    let px: number, py: number, pz: number;
    const tDef = BLOCK_DEF[t.id];
    if (tDef.cross) { px = t.x; py = t.y; pz = t.z; }
    else { px = t.x + t.nx; py = t.y + t.ny; pz = t.z + t.nz; }
    const w = 0.3;
    const p = this.pos;
    if (BLOCK_DEF[def.place].solid &&
      px + 1 > p.x - w && px < p.x + w &&
      pz + 1 > p.z - w && pz < p.z + w &&
      py + 1 > p.y && py < p.y + 1.8) return;
    const existing = g.world.getBlock(px, py, pz);
    if (existing !== B.AIR && !BLOCK_DEF[existing].cross && !BLOCK_DEF[existing].water) return;
    if (g.world.setBlock(px, py, pz, def.place)) {
      g.inv.consume(sel.id, 1);
      g.audio.place(BLOCK_DEF[def.place].snd);
      g.milestones.addStat('placed', 1);
      g.missions.onEvent('place');
    }
  }

  statsTick(dt: number, inShip: boolean): void {
    const g = this.g;
    const pal = g.palette;
    const night = g.sky.dayMix < 0.35;
    this.sheltered = this.checkShelter();
    let haz = night ? pal.hazard.night : pal.hazard.day;
    if (g.stormActive) haz *= 3.2;
    if (this.sheltered || inShip) haz = 0;
    this.hazard -= haz * dt;
    if (!inShip) this.ls -= 0.10 * dt;
    if (this.headInWater) this.ls -= 0.9 * dt;

    if (this.hazard <= 0) { this.hazard = 0; this.damage(2.2 * dt, '环境防护失效', true); }
    if (this.ls <= 0) { this.ls = 0; this.damage(3 * dt, '生命维持耗尽', true); }
    if (this.hazard > 55 && this.ls > 45 && this.hp < 100) this.hp = Math.min(100, this.hp + 0.6 * dt);

    this.lowBeepT -= dt;
    if (this.lowBeepT <= 0) {
      this.lowBeepT = 3;
      if (this.hazard < 25 && this.hazard > 0) { g.hud.alert(`危险防护不足 —— ${night ? pal.hazard.nightLabel : pal.hazard.label}环境`, true); g.audio.alarm(); }
      else if (this.ls < 25 && this.ls > 0) { g.hud.alert('生命维持不足 —— 请补充氧', true); g.audio.alarm(); }
      else if (this.hazard <= 0 || this.ls <= 0) { g.hud.alert('远行者生命体征恶化！', true); g.audio.alarm(); g.audio.heartbeat(); }
      else if (this.hp < 30) { g.audio.heartbeat(); g.hud.alert('生命体征微弱', true); }
      else g.hud.alert('', false);
    }
  }

  checkShelter(): boolean {
    // Cache result for 10 frames to reduce getBlock calls
    this._shelterCache--;
    if (this._shelterCache > 0) return this._shelterVal;
    this._shelterCache = 10;
    const w = this.g.world;
    const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z);
    for (let y = Math.floor(this.pos.y + 2); y < Math.min(CFG.WORLD_H, this.pos.y + 10); y++) {
      const b = w.getBlock(x, y, z);
      if (b !== B.AIR && BLOCK_DEF[b].solid) { this._shelterVal = true; return true; }
    }
    this._shelterVal = false;
    return false;
  }

  damage(amt: number, cause?: string, silent?: boolean): void {
    if (this.dead) return;
    this.hp -= amt;
    if (!silent) {
      this.g.audio.hurt();
      this.g.fx.shake(0.25);
    }
    const df = document.getElementById('damage-flash')!;
    df.classList.add('hit');
    clearTimeout(this.dfT);
    this.dfT = setTimeout(() => df.classList.remove('hit'), 130);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(cause);
    }
  }

  die(cause?: string): void {
    if (this.dead) return;
    this.dead = true;
    this.g.audio.death();
    this.g.audio.setLoop('laser', false);
    this.g.audio.setLoop('jet', false);
    this.g.onPlayerDeath(cause);
  }

  respawn(): void {
    const g = this.g;
    const sp = g.ship.group.position;
    this.pos.set(sp.x + 4, g.world.topSolidY(Math.floor(sp.x + 4), Math.floor(sp.z)) + 1.2, sp.z);
    this.vel.set(0, 0, 0);
    this.hp = 100;
    this.hazard = 60;
    this.ls = 60;
    this.dead = false;
    g.audio.respawn();
  }

  updateInteract(dt: number): void {
    const g = this.g;
    const input = g.input;
    let prompt: InteractPrompt | null = null;
    if (!this.inShip) {
      const shipD = this.pos.distanceTo(g.ship.group.position);
      if (shipD < 5) {
        prompt = { key: 'E', text: g.ship.canLaunch() ? '进入飞船 · 起飞' : '检查飞船（修复 / 加注）', hold: 0.5, action: () => g.ship.openPanel() };
      }
    }
    if (input.keys['KeyZ'] && this.ls < 99) {
      if (g.inv.count('oxygen') >= 1) {
        this.zT = (this.zT || 0) + dt;
        prompt = { key: 'Z', text: '正在补充生命维持…', hold: 0, progress: 1 };
        if (this.zT > 0.12) {
          this.zT = 0;
          g.inv.consume('oxygen', 1);
          g.missions.oxygenUsed = (g.missions.oxygenUsed || 0) + 1;
          this.ls = Math.min(100, this.ls + 3.5);
          g.audio.recharge();
        }
      } else if (!this.zWarned) { g.hud.notify('没有 氧 —— 采集红色呼吸花', 'warn'); this.zWarned = true; setTimeout(() => this.zWarned = false, 3000); }
    }
    if (input.keys['KeyX'] && this.hazard < 99) {
      if (g.inv.count('sodium') >= 1) {
        this.xT = (this.xT || 0) + dt;
        prompt = { key: 'X', text: '正在为危险防护充能…', hold: 0, progress: 1 };
        if (this.xT > 0.12) {
          this.xT = 0;
          g.inv.consume('sodium', 1);
          g.missions.sodiumUsed = (g.missions.sodiumUsed || 0) + 1;
          this.hazard = Math.min(100, this.hazard + 3.5);
          g.audio.recharge();
        }
      } else if (!this.xWarned) { g.hud.notify('没有 钠 —— 采集黄色钠光花', 'warn'); this.xWarned = true; setTimeout(() => this.xWarned = false, 3000); }
    }

    if (prompt && prompt.key === 'E') {
      if (input.keys['KeyE']) {
        this.holdE += dt;
        if (this.holdE >= prompt.hold) {
          this.holdE = 0;
          input.keys['KeyE'] = false;
          prompt.action!();
        }
      } else this.holdE = 0;
      g.hud.showPrompt(prompt.key, prompt.text, prompt.hold > 0 ? this.holdE / prompt.hold : (prompt.progress || 0));
    } else if (prompt) {
      g.hud.showPrompt(prompt.key, prompt.text, prompt.progress || 0);
    } else {
      this.holdE = 0;
      g.hud.hidePrompt();
    }
  }

  doScan(): void {
    const g = this.g;
    if (this.scanCd > 0) return;
    if (!g.missions.scannerUnlocked) {
      g.hud.notify('扫描仪未校准 —— 先收集铁尘修复它', 'warn');
      g.audio.uiDeny();
      return;
    }
    this.scanCd = 8;
    g.audio.scanPulse();
    g.hud.scanFlash();
    const targets = g.world.findScanTargets(this.pos.x, this.pos.y, this.pos.z, 44);
    targets.forEach((t, i) => {
      g.hud.addMarker(t.type, new THREE.Vector3(t.x, t.y, t.z), 30);
      g.audio.scanFound(i);
    });
    if (targets.length === 0) g.hud.notify('附近未发现特殊资源', 'info');
    g.missions.onEvent('scan_pulse');
  }

  toggleVisor(force?: boolean): void {
    const g = this.g;
    const want = force !== undefined ? force : !this.visor;
    if (want && !g.missions.scannerUnlocked) {
      g.hud.notify('分析目镜未校准 —— 先收集铁尘修复扫描仪', 'warn');
      return;
    }
    this.visor = want;
    document.getElementById('visor-overlay')!.classList.toggle('hidden', !want);
    g.audio[want ? 'uiOpen' : 'uiClose']();
  }

  updateVisor(dt: number): void {
    const g = this.g;
    if (!this.visor) {
      g.camera.fov = U.lerp(g.camera.fov, g.settings.fov, dt * 8);
      g.camera.updateProjectionMatrix();
      return;
    }
    g.camera.fov = U.lerp(g.camera.fov, g.settings.fov - 22, dt * 8);
    g.camera.updateProjectionMatrix();
    document.getElementById('visor-clock')!.textContent = 'T+' + Math.floor(g.playTime) + 's // ' + Math.round(this.pos.x) + ',' + Math.round(this.pos.z);

    const cHit = g.fauna.raycastCreature(this.eyePos(), this.lookDir(), 40);
    const info = document.getElementById('visor-info')!;
    let subject: VisorSubject | null = null;
    if (cHit) {
      subject = { kind: 'creature', c: cHit.creature };
      info.classList.remove('hidden');
      document.getElementById('vi-name')!.textContent = cHit.creature.sp.name;
      document.getElementById('vi-type')!.textContent = '生物 // FAUNA' + (this.isDiscovered('c' + cHit.creature.sp.seed) ? ' · 已记录' : '');
      document.getElementById('vi-extra')!.textContent = `体型 ${cHit.creature.sp.size.toFixed(1)}m · 性情温和 · 群居`;
    } else if (this.target && (BLOCK_DEF[this.target.id].flora || BLOCK_DEF[this.target.id].scan)) {
      subject = { kind: 'block', id: this.target.id };
      const def = BLOCK_DEF[this.target.id];
      info.classList.remove('hidden');
      document.getElementById('vi-name')!.textContent = def.name;
      document.getElementById('vi-type')!.textContent = (def.flora ? '植物 // FLORA' : '矿物 // MINERAL') + (this.isDiscovered('b' + this.target.id) ? ' · 已记录' : '');
      const drops = (def.drops || []).map(d => ITEMS[d.id].name).join('、');
      document.getElementById('vi-extra')!.textContent = '可采集：' + (drops || '未知');
    } else {
      info.classList.add('hidden');
    }

    if (subject && g.input.buttons[0]) {
      const key = subject.kind === 'creature' ? 'c' + subject.c!.sp.seed : 'b' + subject.id;
      if (!this.isDiscovered(key!)) {
        this.analyzeT += dt;
        if (Math.floor(this.analyzeT * 8) !== Math.floor((this.analyzeT - dt) * 8)) g.audio.analyzeTick(this.analyzeT / 1.1);
        document.getElementById('vi-hint')!.innerHTML = `分析中… ${Math.round(Math.min(1, this.analyzeT / 1.1) * 100)}%`;
        if (this.analyzeT >= 1.1) {
          this.analyzeT = 0;
          this.discover(subject);
        }
      } else document.getElementById('vi-hint')!.innerHTML = '档案已存在';
    } else {
      this.analyzeT = 0;
      if (subject) document.getElementById('vi-hint')!.innerHTML = '按住 <span class="kbd sm">左键</span> 分析';
    }
  }

  isDiscovered(key: string): boolean { return this.g.discoveries.entries.some(e => e.key === key); }

  discover(subject: VisorSubject): void {
    const g = this.g;
    let entry: Discovery;
    if (subject.kind === 'creature') {
      const sp = subject.c!.sp;
      entry = { key: 'c' + sp.seed, name: sp.name, kind: '生物', planet: g.planetName, units: 275 };
    } else {
      const def = BLOCK_DEF[subject.id!];
      entry = { key: 'b' + subject.id, name: def.name, kind: def.flora ? '植物' : '矿物', planet: g.planetName, units: def.flora ? 55 : 85 };
    }
    g.discoveries.entries.push(entry);
    g.inv.units += entry.units;
    g.inv.syncStore();
    g.audio.analyze();
    g.hud.notify(`已记录 ${entry.name} —— +${entry.units} ◈`, 'success');
    g.milestones.addStat('scans', 1);
    g.missions.onEvent('analyze');
  }

  exitShip(): void {
    const g = this.g;
    this.inShip = false;
    const sp = g.ship.group.position;
    const side = new THREE.Vector3(3.2, 0, 0).applyQuaternion(g.ship.group.quaternion);
    this.pos.set(sp.x + side.x, sp.y + 0.5, sp.z + side.z);
    let tries = 0;
    while (g.world.collides(this.pos.x - 0.3, this.pos.y, this.pos.z - 0.3, this.pos.x + 0.3, this.pos.y + 1.8, this.pos.z + 0.3) && tries++ < 30) this.pos.y += 0.5;
    this.vel.set(0, 0, 0);
    g.hud.setFlightHud(false);
    g.missions.onEvent('land');
  }

  serialize(): PlayerSaveData {
    return { pos: this.pos.toArray(), yaw: this.yaw, pitch: this.pitch, hp: this.hp, hazard: this.hazard, ls: this.ls, flash: this.flashOn };
  }
  deserialize(d: PlayerSaveData | undefined): void {
    if (!d) return;
    this.pos.fromArray(d.pos);
    this.yaw = d.yaw; this.pitch = d.pitch;
    this.hp = d.hp; this.hazard = d.hazard; this.ls = d.ls;
  }
}
