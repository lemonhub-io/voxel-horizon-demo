// ============================================================
// entities.ts — Fauna (creatures)
// ============================================================

import { U } from './utils';
import { CFG, B } from './config';
import type { Game, Palette, CreatureSpec, Creature, CreatureHit } from './types';

export class Fauna {
  g: Game;
  creatures: Creature[];
  group: THREE.Group;
  speciesList: CreatureSpec[];
  callTimer: number;

  constructor(game: Game) {
    this.g = game;
    this.creatures = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.speciesList = [];
    this.callTimer = 0;
  }

  spawnPlanet(seed: number, pal: Palette): void {
    this.dispose();
    const rng = U.mulberry32(seed ^ 0xfa17);
    const nSpecies = Math.max(1, pal.fauna - 1 + Math.floor(rng() * 3));
    this.speciesList = [];
    for (let s = 0; s < nSpecies; s++) {
      this.speciesList.push({
        seed: Math.floor(rng() * 1e9),
        name: U.creatureName(rng),
        col: U.pick(pal.creatures, rng),
        col2: U.pick(pal.creatures, rng),
        size: 0.5 + rng() * 0.9,
        legs: rng() < 0.6 ? 4 : 2,
        horn: rng() < 0.45,
        tail: rng() < 0.6,
        speed: 1.2 + rng() * 1.6
      });
    }
    const px = this.g.spawnPoint ? this.g.spawnPoint.x : 8;
    const pz = this.g.spawnPoint ? this.g.spawnPoint.z : 8;
    const count = 6 + Math.floor(rng() * 5);
    for (let i = 0; i < count; i++) {
      const sp = this.speciesList[Math.floor(rng() * this.speciesList.length)];
      let x = px + (rng() - 0.5) * 160, z = pz + (rng() - 0.5) * 160;
      for (let t = 0; t < 8; t++) {
        const gy = this.g.world.surfaceY(Math.floor(x), Math.floor(z));
        if (!pal.sea || gy > CFG.SEA) break;
        x = px + (rng() - 0.5) * 160; z = pz + (rng() - 0.5) * 160;
      }
      this.spawnCreature(sp, x, z, rng);
    }
  }

  spawnCreature(sp: CreatureSpec, x: number, z: number, rng: () => number): Creature {
    const grp = new THREE.Group();
    const s = sp.size;
    const matBody = new THREE.MeshLambertMaterial({ color: sp.col });
    const matAcc = new THREE.MeshLambertMaterial({ color: sp.col2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 0.85, s * 0.9), matBody);
    body.position.y = s * 0.95;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.62, s * 0.58, s * 0.6), matAcc);
    head.position.set(s * 0.95, s * 1.3, 0);
    grp.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1a22' });
    for (const dz of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(s * 0.09, s * 0.09, s * 0.09), eyeMat);
      eye.position.set(s * 1.27, s * 1.38, s * dz * 2);
      grp.add(eye);
    }
    if (sp.horn) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.5, 5), matBody);
      horn.position.set(s * 0.95, s * 1.75, 0);
      grp.add(horn);
    }
    const legs: THREE.Mesh[] = [];
    const legGeo = new THREE.BoxGeometry(s * 0.2, s * 0.7, s * 0.2);
    legGeo.translate(0, -s * 0.35, 0);
    const legPos: [number, number][] = sp.legs === 4 ? [[0.5, 0.3], [0.5, -0.3], [-0.5, 0.3], [-0.5, -0.3]] : [[0.25, 0.28], [0.25, -0.28]];
    for (const [lx, lz] of legPos) {
      const leg = new THREE.Mesh(legGeo, matAcc);
      leg.position.set(s * lx, s * 0.72, s * lz);
      grp.add(leg);
      legs.push(leg);
    }
    let tail: THREE.Mesh | null = null;
    if (sp.tail) {
      tail = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, s * 0.16, s * 0.16), matAcc);
      tail.position.set(-s * 1.05, s * 1.1, 0);
      grp.add(tail);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(s * 0.9, 12), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    grp.add(shadow);
    const y = this.g.world.surfaceY(Math.floor(x), Math.floor(z)) + 1;
    grp.position.set(x, y, z);
    this.group.add(grp);
    const c: Creature = {
      grp, sp, legs, tail, shadow,
      state: 'idle', stateT: U.rand(1, 4),
      dir: U.rand(0, Math.PI * 2),
      hp: 20 * sp.size,
      phase: U.rand(0, 9),
      panic: 0,
      seed: Math.floor((rng ? rng() : Math.random()) * 1e9)
    };
    this.creatures.push(c);
    return c;
  }

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    if (!p) return;
    this.callTimer -= dt;
    for (const c of this.creatures) {
      const pos = c.grp.position;
      const d = U.dist2(pos.x, pos.z, p.pos.x, p.pos.z);
      if (d > 140) continue;
      c.stateT -= dt;
      c.phase += dt * (c.state === 'walk' || c.panic > 0 ? 9 : 2);
      if (c.panic > 0) c.panic -= dt;
      if (c.stateT <= 0) {
        c.state = c.state === 'idle' ? 'walk' : (Math.random() < 0.4 ? 'walk' : 'idle');
        c.stateT = U.rand(1.5, 5);
        c.dir = U.rand(0, Math.PI * 2);
      }
      if (c.panic > 0) {
        c.dir = Math.atan2(pos.x - p.pos.x, pos.z - p.pos.z);
        c.state = 'walk';
      }
      if (c.state === 'walk') {
        const sp = c.sp.speed * (c.panic > 0 ? 2.2 : 1);
        const nx = pos.x + Math.sin(c.dir) * sp * dt;
        const nz = pos.z + Math.cos(c.dir) * sp * dt;
        const gy = this.g.world.topSolidY(Math.floor(nx), Math.floor(nz));
        const curY = this.g.world.topSolidY(Math.floor(pos.x), Math.floor(pos.z));
        if (Math.abs(gy - curY) <= 1 && this.g.world.getBlock(Math.floor(nx), gy + 1, Math.floor(nz)) !== B.WATER) {
          pos.x = nx; pos.z = nz;
          pos.y += U.clamp((gy + 1) - pos.y, -6 * dt, 6 * dt);
        } else {
          c.dir += Math.PI * 0.6;
        }
        c.grp.rotation.y = c.dir - Math.PI * 0.5;
      }
      const sw = c.state === 'walk' ? 0.5 : 0.06;
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
    const pos = c.grp.position;
    this.g.audio.creatureHurt(0);
    this.g.fx.spawn(pos.x, pos.y + c.sp.size, pos.z, { n: 6, col: '#c04a4a', speed: 2, life: 0.5 });
    if (c.hp <= 0) {
      this.g.fx.spawn(pos.x, pos.y + c.sp.size, pos.z, { n: 18, col: c.sp.col, speed: 3.2, life: 0.8 });
      this.group.remove(c.grp);
      this.creatures.splice(this.creatures.indexOf(c), 1);
      const inv = this.g.inv;
      inv.add('biomass', U.randi(2, 4));
      inv.add('carbon', U.randi(3, 6));
      this.g.hud.toast('biomass', 3);
      return true;
    }
    return false;
  }

  dispose(): void {
    for (const c of this.creatures) this.group.remove(c.grp);
    this.creatures = [];
  }
}
