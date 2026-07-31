// ============================================================
// entities.ts — Fauna (creatures)
// ============================================================

import * as THREE from 'three/webgpu';
import { U } from './utils';
import { CFG, B } from './config';
import {
  cloneCC0Scene,
  findAnimationClip,
  fitCC0Model,
  loadCC0ModelWithAnimations,
  styleCC0Fauna,
  type LoadedCC0Model,
} from './cc0-models';
import { CC0_MODEL_URLS } from './model-assets';
import type { Game, Palette, CreatureSpec, Creature, CreatureHit, CreatureKind } from './types';

const FAUNA_KINDS: CreatureKind[] = ['wolf', 'raccoon', 'sheep'];
const AI_ACTIVE_RADIUS = 180;
const AI_THINK_INTERVAL = 0.18;

const BEHAVIOR: Record<CreatureKind, {
  fleeRadius: number;
  fleeSpeed: number;
  grazeChance: number;
  socialRadius: number;
}> = {
  wolf: { fleeRadius: 9, fleeSpeed: 1.35, grazeChance: 0.05, socialRadius: 11 },
  raccoon: { fleeRadius: 12, fleeSpeed: 1.2, grazeChance: 0.2, socialRadius: 9 },
  sheep: { fleeRadius: 14, fleeSpeed: 1.1, grazeChance: 0.34, socialRadius: 13 },
};

export class Fauna {
  /** Master switch for the seeded fauna population. */
  static SPAWN_DISABLED = false;

  g: Game;
  creatures: Creature[];
  group: THREE.Group;
  speciesList: CreatureSpec[];
  callTimer: number;
  /** Prepared source templates (skinned); always clone via SkeletonUtils. */
  private faunaModels: Array<LoadedCC0Model | null>;

  constructor(game: Game) {
    this.g = game;
    this.creatures = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.speciesList = [];
    this.callTimer = 0;
    this.faunaModels = [];
    this.alarmX = 0;
    this.alarmZ = 0;
    this.alarmT = 0;
    void this.loadCC0Fauna();
  }

  /** Shared alarm lets nearby animals react to a hit instead of remaining idle. */
  private alarmX: number;
  private alarmZ: number;
  private alarmT: number;

  private async loadCC0Fauna(): Promise<void> {
    try {
      // Keep one skinned template per species and re-clone it for each creature.
      const results = await Promise.allSettled(CC0_MODEL_URLS.fauna.map(loadCC0ModelWithAnimations));
      this.faunaModels = results.map(result => result.status === 'fulfilled' ? result.value : null);
      // Attach to anything spawned before models finished loading.
      this.creatures.forEach(creature => this.attachCC0Model(creature));
    } catch {
      // Asset preflight reports unavailable fauna models before world generation.
    }
  }

  private attachCC0Model(creature: Creature): void {
    if (!this.faunaModels.length) return;
    // Avoid stacking multiple models if attach is called twice.
    const existing = creature.grp.children.find(c => c.name === 'cc0-fauna-model');
    if (existing) return;

    const preferredIndex = FAUNA_KINDS.indexOf(creature.sp.kind);
    const template = this.faunaModels[preferredIndex] ?? this.faunaModels.find(
      (candidate): candidate is LoadedCC0Model => candidate !== null,
    );
    if (!template) return;

    // SkeletonUtils clone — Object3D.clone breaks SkinnedMesh bone binding
    // (mesh invisible; only the ground blob shadow remains).
    const model = cloneCC0Scene(template.scene);
    model.name = 'cc0-fauna-model';
    fitCC0Model(model, creature.sp.size * 1.9, creature.sp.size * 2.15);
    // Cube World Kit animals face local +Z; movement also uses +Z.
    model.rotation.y = 0;
    styleCC0Fauna(model);
    creature.mixer = new THREE.AnimationMixer(model);
    creature.actions.clear();
    const animationNames: Record<string, string[]> = {
      idle: ['Idle'],
      walk: ['Walk'],
      run: ['Run'],
      attack: ['Headbutt', 'Attack'],
      eat: ['Idle_Eating', 'Idle'],
      jump: ['Jump_Loop', 'Jump_Start'],
      death: ['Death'],
    };
    for (const [key, names] of Object.entries(animationNames)) {
      const clip = findAnimationClip(template.animations, ...names);
      if (!clip) continue;
      const action = creature.mixer.clipAction(clip);
      if (key === 'attack' || key === 'jump' || key === 'death') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      creature.actions.set(key, action);
    }
    creature.grp.add(model);
    this.playAnimation(creature, 'idle', 0);
  }

  private playAnimation(creature: Creature, key: string, fade = 0.18): void {
    if (!creature.mixer) return;
    if (key === creature.animKey && creature.action) return;
    const next = creature.actions.get(key) || creature.actions.get('idle');
    if (!next) return;
    if (creature.action && creature.action !== next) creature.action.fadeOut(fade);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    creature.action = next;
    creature.animKey = key;
  }

  private disposeAnimations(creature: Creature): void {
    const model = creature.grp.getObjectByName('cc0-fauna-model');
    creature.mixer?.stopAllAction();
    if (model) creature.mixer?.uncacheRoot(model);
    creature.mixer = null;
    creature.actions.clear();
    creature.action = null;
    creature.animKey = '';
  }

  spawnPlanet(seed: number, pal: Palette): void {
    this.dispose();
    if (Fauna.SPAWN_DISABLED) return;
    const rng = U.mulberry32(seed ^ 0xfa17);
    const nSpecies = Math.max(1, pal.fauna - 1 + Math.floor(rng() * 3));
    this.speciesList = [];
    for (let s = 0; s < nSpecies; s++) {
      this.speciesList.push({
        kind: FAUNA_KINDS[Math.floor(rng() * FAUNA_KINDS.length)],
        seed: Math.floor(rng() * 1e9),
        name: U.creatureName(rng),
        col: U.pick(pal.creatures, rng),
        col2: U.pick(pal.creatures, rng),
        size: 0.5 + rng() * 0.9,
        legs: rng() < 0.6 ? 4 : 2,
        horn: rng() < 0.45,
        tail: rng() < 0.6,
        speed: 1.2 + rng() * 1.6,
      });
    }
    const px = this.g.spawnPoint ? this.g.spawnPoint.x : 8;
    const pz = this.g.spawnPoint ? this.g.spawnPoint.z : 8;
    const count = 8 + Math.floor(rng() * 5);
    const nearbyCount = Math.min(3, count);
    for (let i = 0; i < count; i++) {
      const sp = this.speciesList[Math.floor(rng() * this.speciesList.length)];
      const nearby = i < nearbyCount;
      const minRadius = nearby ? 18 : 38;
      const maxRadius = nearby ? 42 : 100;
      let angle = rng() * Math.PI * 2;
      let radius = minRadius + rng() * (maxRadius - minRadius);
      let x = px + Math.cos(angle) * radius;
      let z = pz + Math.sin(angle) * radius;
      for (let t = 0; t < 8; t++) {
        const gy = this.g.world.surfaceY(Math.floor(x), Math.floor(z));
        if (!pal.sea || gy > CFG.SEA) break;
        angle = rng() * Math.PI * 2;
        radius = minRadius + rng() * (maxRadius - minRadius);
        x = px + Math.cos(angle) * radius;
        z = pz + Math.sin(angle) * radius;
      }
      this.spawnCreature(sp, x, z, rng);
    }
  }

  spawnCreature(sp: CreatureSpec, x: number, z: number, rng: () => number): Creature {
    const grp = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(sp.size * 0.9, 12),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    grp.add(shadow);
    const y = this.g.world.surfaceY(Math.floor(x), Math.floor(z)) + 1;
    grp.position.set(x, y, z);
    this.group.add(grp);
    const c: Creature = {
      grp, sp, legs: [], tail: null, shadow,
      mixer: null, actions: new Map(), action: null, animKey: '',
      state: 'idle', stateT: U.rand(1, 3),
      dir: U.rand(0, Math.PI * 2), hp: 20 * sp.size,
      targetX: x, targetZ: z, homeX: x, homeZ: z,
      velocityX: 0, velocityZ: 0, thinkT: U.rand(0, AI_THINK_INTERVAL),
      stuckT: 0, aiSeed: Math.floor((rng ? rng() : Math.random()) * 0xffffffff),
      phase: U.rand(0, 9), panic: 0,
      seed: Math.floor((rng ? rng() : Math.random()) * 1e9)
    };
    this.creatures.push(c);
    grp.rotation.y = c.dir;
    this.attachCC0Model(c);
    return c;
  }

  private nextAI(c: Creature): number {
    c.aiSeed = (Math.imul(c.aiSeed, 1664525) + 1013904223) >>> 0;
    return c.aiSeed / 0x100000000;
  }

  private isWalkable(x: number, z: number, fromY: number): boolean {
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    const gy = this.g.world.topSolidY(gx, gz);
    if (Math.abs(gy - fromY) > 1) return false;
    if (this.g.world.getBlock(gx, gy + 1, gz) === B.WATER) return false;
    return this.g.world.getBlock(gx, gy + 2, gz) !== B.WATER;
  }

  private chooseWanderTarget(c: Creature): void {
    const pos = c.grp.position;
    const range = 7 + this.nextAI(c) * 13;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = this.nextAI(c) * Math.PI * 2;
      const radius = 4 + this.nextAI(c) * range;
      const x = pos.x + Math.sin(angle) * radius;
      const z = pos.z + Math.cos(angle) * radius;
      if (this.isWalkable(x, z, this.g.world.topSolidY(Math.floor(pos.x), Math.floor(pos.z)))) {
        c.targetX = x;
        c.targetZ = z;
        return;
      }
    }
    c.targetX = pos.x;
    c.targetZ = pos.z;
  }

  private setFleeTarget(c: Creature, threatX: number, threatZ: number): void {
    const pos = c.grp.position;
    let dx = pos.x - threatX;
    let dz = pos.z - threatZ;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) {
      dx = Math.sin(c.dir);
      dz = Math.cos(c.dir);
    } else {
      dx /= length;
      dz /= length;
    }
    const distance = 14 + this.nextAI(c) * 12;
    c.targetX = pos.x + dx * distance;
    c.targetZ = pos.z + dz * distance;
  }

  private think(c: Creature, playerX: number, playerZ: number): void {
    const behavior = BEHAVIOR[c.sp.kind];
    const pos = c.grp.position;
    const dx = pos.x - playerX;
    const dz = pos.z - playerZ;
    const playerD2 = dx * dx + dz * dz;
    const alarmDx = pos.x - this.alarmX;
    const alarmDz = pos.z - this.alarmZ;
    const alarmD2 = alarmDx * alarmDx + alarmDz * alarmDz;
    const alarmThreat = this.alarmT > 0 && alarmD2 < 30 * 30;

    if (c.panic > 0 || alarmThreat || playerD2 < behavior.fleeRadius ** 2) {
      const threatX = c.panic > 0 || alarmThreat ? this.alarmX : playerX;
      const threatZ = c.panic > 0 || alarmThreat ? this.alarmZ : playerZ;
      this.setFleeTarget(c, threatX, threatZ);
      c.state = 'flee';
      c.stateT = Math.max(c.stateT, c.panic > 0 ? c.panic : 2.5);
      return;
    }

    const homeDx = pos.x - c.homeX;
    const homeDz = pos.z - c.homeZ;
    if (homeDx * homeDx + homeDz * homeDz > 22 * 22) {
      c.state = 'return';
      c.targetX = c.homeX;
      c.targetZ = c.homeZ;
      c.stateT = Math.max(c.stateT, 5);
      return;
    }

    if (c.state === 'flee' && c.stateT > 0) return;
    if (c.stuckT > 0.75) {
      c.state = 'investigate';
      c.stateT = 1.5;
      this.chooseWanderTarget(c);
      c.stuckT = 0;
      return;
    }
    if (c.stateT > 0) return;

    const roll = this.nextAI(c);
    if (roll < behavior.grazeChance) {
      c.state = 'graze';
      c.stateT = 2 + this.nextAI(c) * 4;
      return;
    }
    if (roll < behavior.grazeChance + 0.2) {
      c.state = 'idle';
      c.stateT = 1.2 + this.nextAI(c) * 2.5;
      return;
    }
    c.state = 'wander';
    c.stateT = 2.5 + this.nextAI(c) * 4.5;
    this.chooseWanderTarget(c);
  }

  private socialSteering(c: Creature): { x: number; z: number } {
    const radius = BEHAVIOR[c.sp.kind].socialRadius;
    const radius2 = radius * radius;
    let separationX = 0;
    let separationZ = 0;
    let cohesionX = 0;
    let cohesionZ = 0;
    let alignmentX = 0;
    let alignmentZ = 0;
    let count = 0;
    for (const other of this.creatures) {
      if (other === c) continue;
      const dx = other.grp.position.x - c.grp.position.x;
      const dz = other.grp.position.z - c.grp.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.01 || d2 > radius2) continue;
      const d = Math.sqrt(d2);
      count++;
      cohesionX += dx / radius;
      cohesionZ += dz / radius;
      alignmentX += other.velocityX;
      alignmentZ += other.velocityZ;
      if (d < 3.5) {
        const push = (3.5 - d) / 3.5;
        separationX -= (dx / d) * push;
        separationZ -= (dz / d) * push;
      }
    }
    if (!count) return { x: 0, z: 0 };
    return {
      x: separationX * 1.8 + cohesionX * 0.22 / count + alignmentX * 0.08 / count,
      z: separationZ * 1.8 + cohesionZ * 0.22 / count + alignmentZ * 0.08 / count,
    };
  }

  private updateMotion(c: Creature, dt: number, playerX: number, playerZ: number): void {
    const pos = c.grp.position;
    const moving = c.state === 'wander' || c.state === 'flee' || c.state === 'return' || c.state === 'investigate';
    const damping = 1 - Math.exp(-8 * dt);
    if (!moving) {
      c.velocityX = U.lerp(c.velocityX, 0, damping);
      c.velocityZ = U.lerp(c.velocityZ, 0, damping);
      c.grp.rotation.y = c.dir;
      return;
    }

    let desiredX: number;
    let desiredZ: number;
    if (c.state === 'flee') {
      desiredX = pos.x - playerX;
      desiredZ = pos.z - playerZ;
    } else {
      desiredX = c.targetX - pos.x;
      desiredZ = c.targetZ - pos.z;
    }
    const desiredLength = Math.hypot(desiredX, desiredZ);
    if (desiredLength < 1.1 && c.state !== 'flee') {
      c.stateT = 0;
      c.velocityX = U.lerp(c.velocityX, 0, damping);
      c.velocityZ = U.lerp(c.velocityZ, 0, damping);
      return;
    }
    if (desiredLength > 1e-4) {
      desiredX /= desiredLength;
      desiredZ /= desiredLength;
    }

    if (c.state !== 'flee') {
      const social = this.socialSteering(c);
      desiredX += social.x;
      desiredZ += social.z;
    }
    const desiredSteerLength = Math.hypot(desiredX, desiredZ);
    if (desiredSteerLength > 1e-4) {
      desiredX /= desiredSteerLength;
      desiredZ /= desiredSteerLength;
    }

    const groundY = this.g.world.topSolidY(Math.floor(pos.x), Math.floor(pos.z));
    const speed = c.sp.speed * (c.state === 'flee' ? BEHAVIOR[c.sp.kind].fleeSpeed : c.state === 'return' ? 0.85 : 0.7);
    const probe = 1.1 + speed * 0.35;
    const forwardX = Math.sin(c.dir);
    const forwardZ = Math.cos(c.dir);
    if (!this.isWalkable(pos.x + forwardX * probe, pos.z + forwardZ * probe, groundY)) {
      const leftX = -forwardZ;
      const leftZ = forwardX;
      const leftOpen = this.isWalkable(pos.x + leftX * probe, pos.z + leftZ * probe, groundY);
      const rightOpen = this.isWalkable(pos.x - leftX * probe, pos.z - leftZ * probe, groundY);
      if (leftOpen || rightOpen) {
        const turnLeft = leftOpen && (!rightOpen || this.nextAI(c) < 0.5);
        desiredX = turnLeft ? leftX : -leftX;
        desiredZ = turnLeft ? leftZ : -leftZ;
      } else {
        c.velocityX *= 0.2;
        c.velocityZ *= 0.2;
        c.stuckT += dt;
        return;
      }
    }

    const desiredDir = Math.atan2(desiredX, desiredZ);
    let turn = desiredDir - c.dir;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    c.dir += U.clamp(turn, -5.5 * dt, 5.5 * dt);
    c.grp.rotation.y = c.dir;

    const velocityX = Math.sin(c.dir) * speed;
    const velocityZ = Math.cos(c.dir) * speed;
    const acceleration = 1 - Math.exp(-(c.state === 'flee' ? 9 : 5) * dt);
    c.velocityX = U.lerp(c.velocityX, velocityX, acceleration);
    c.velocityZ = U.lerp(c.velocityZ, velocityZ, acceleration);
    const nx = pos.x + c.velocityX * dt;
    const nz = pos.z + c.velocityZ * dt;
    if (this.isWalkable(nx, nz, groundY)) {
      pos.x = nx;
      pos.z = nz;
      const nextY = this.g.world.topSolidY(Math.floor(nx), Math.floor(nz)) + 1;
      pos.y += U.clamp(nextY - pos.y, -7 * dt, 7 * dt);
      c.stuckT = Math.max(0, c.stuckT - dt * 2);
    } else {
      c.velocityX *= 0.25;
      c.velocityZ *= 0.25;
      c.stuckT += dt;
    }
  }

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    if (!p) return;
    const frameDt = Math.min(dt, 0.1);
    this.callTimer -= frameDt;
    this.alarmT = Math.max(0, this.alarmT - frameDt);
    for (const c of this.creatures) {
      const pos = c.grp.position;
      const d = U.dist2(pos.x, pos.z, p.pos.x, p.pos.z);
      if (d > AI_ACTIVE_RADIUS) {
        c.mixer?.update(frameDt * 0.25);
        continue;
      }
      c.stateT -= frameDt;
      c.thinkT -= frameDt;
      if (c.panic > 0) c.panic = Math.max(0, c.panic - frameDt);
      if (c.thinkT <= 0) {
        this.think(c, p.pos.x, p.pos.z);
        c.thinkT = AI_THINK_INTERVAL;
      }
      this.updateMotion(c, frameDt, p.pos.x, p.pos.z);
      c.phase += frameDt * (c.state === 'wander' || c.state === 'flee' || c.state === 'return' ? 9 : 2);
      const attackPlaying = c.animKey === 'attack' && c.action?.isRunning();
      if (!attackPlaying) {
        const animation = c.state === 'graze' ? 'eat' : c.state === 'flee' ? 'run' :
          c.state === 'wander' || c.state === 'return' || c.state === 'investigate' ? 'walk' : 'idle';
        this.playAnimation(c, animation);
      }
      c.mixer?.update(frameDt);
      if (c.animKey === 'attack' && c.action && !c.action.isRunning()) c.animKey = '';
      const sw = c.state === 'wander' || c.state === 'flee' || c.state === 'return' ? 0.5 : 0.06;
      c.legs.forEach((leg, i) => { leg.rotation.z = Math.sin(c.phase + i * Math.PI) * sw; });
      if (c.tail) c.tail.rotation.y = Math.sin(c.phase * 0.7) * 0.4;
      c.shadow.position.y = 0.02;
      if (this.callTimer <= 0 && Math.random() < 0.02 && d < 40) {
        g.audio.creatureCall(c.seed, d);
        this.callTimer = 2.5;
      }
    }
  }

  raycastCreature(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): CreatureHit | null {
    let best: Creature | null = null, bestD = maxDist;
    const v = new THREE.Vector3();
    for (const c of this.creatures) {
      v.copy(c.grp.position).sub(origin);
      const t = v.dot(dir);
      if (t < 0 || t > bestD) continue;
      const closest = new THREE.Vector3().copy(origin).addScaledVector(dir, t);
      const r = c.sp.size * 1.3;
      if (closest.distanceTo(new THREE.Vector3(c.grp.position.x, c.grp.position.y + c.sp.size, c.grp.position.z)) < r) {
        best = c; bestD = t;
      }
    }
    return best ? { creature: best, dist: bestD } : null;
  }

  hit(c: Creature, dmg: number): boolean {
    c.hp -= dmg;
    c.panic = 4;
    this.alarmX = c.grp.position.x;
    this.alarmZ = c.grp.position.z;
    this.alarmT = 4;
    this.playAnimation(c, 'attack');
    const pos = c.grp.position;
    this.g.audio.creatureHurt(0);
    this.g.fx.burst(pos.x, pos.y + c.sp.size, pos.z, { n: 8, col: '#c04a4a', speed: 2.5, life: 0.5, ny: 1 });
    if (c.hp <= 0) {
      // Death burst — dramatic particle explosion
      this.g.fx.burst(pos.x, pos.y + c.sp.size, pos.z, { n: 25, col: c.sp.col, speed: 4, life: 1.0, ny: 1 });
      this.g.fx.burst(pos.x, pos.y + c.sp.size * 0.5, pos.z, { n: 10, col: c.sp.col2, speed: 2, life: 0.6 });
      this.g.fx.shake(0.15);
      this.group.remove(c.grp);
      this.creatures.splice(this.creatures.indexOf(c), 1);
      this.disposeAnimations(c);
      const inv = this.g.inv;
      inv.add('biomass', U.randi(2, 4));
      inv.add('carbon', U.randi(3, 6));
      this.g.hud.toast('biomass', 3);
      return true;
    }
    return false;
  }

  dispose(): void {
    for (const c of this.creatures) {
      this.group.remove(c.grp);
      this.disposeAnimations(c);
    }
    this.creatures = [];
  }
}
