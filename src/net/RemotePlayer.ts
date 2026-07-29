import * as THREE from 'three/webgpu';
import { findAnimationClip, fitCC0Model, loadCC0ModelWithAnimations } from '../cc0-models';
import { CC0_MODEL_URLS } from '../model-assets';
import { animToKey, type AnimCode, type PlayerSnap } from './protocol';

/**
 * Remote multiplayer avatar (same CC0 astronaut as local body).
 * Rendered on default layer 0 so all clients can see each other.
 */
export class RemotePlayer {
  id: string;
  name: string;
  root: THREE.Group;
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private action: THREE.AnimationAction | null = null;
  private animKey = '';
  private target = new THREE.Vector3();
  private targetYaw = 0;
  private ready = false;

  constructor(snap: PlayerSnap) {
    this.id = snap.id;
    this.name = snap.name;
    this.root = new THREE.Group();
    this.root.name = `remote-${snap.id}`;
    this.target.set(snap.x, snap.y, snap.z);
    this.targetYaw = snap.yaw;
    this.root.position.copy(this.target);
    this.root.rotation.y = snap.yaw + Math.PI;
    void this.load(snap.anim);
  }

  private async load(initialAnim: AnimCode): Promise<void> {
    try {
      const { scene, animations } = await loadCC0ModelWithAnimations(CC0_MODEL_URLS.player);
      fitCC0Model(scene, 0.85, 1.78);
      scene.name = 'remote-astronaut';
      scene.traverse((child) => {
        const n = child.name.toLowerCase();
        if (n.includes('pistol') || n.includes('rifle') || n.includes('gun') || n.includes('weapon')) {
          child.visible = false;
        }
      });
      this.root.add(scene);
      this.model = scene;
      this.mixer = new THREE.AnimationMixer(scene);
      const keys: Record<string, string[]> = {
        idle: ['Idle_Gun', 'Idle'],
        walk: ['Walk_Gun', 'Walk'],
        run: ['Run_Gun', 'Run'],
        jump: ['Jump'],
        jumpIdle: ['Jump_Idle', 'Jump'],
        jumpLand: ['Jump_Land', 'Idle'],
        death: ['Death'],
      };
      for (const [key, names] of Object.entries(keys)) {
        const clip = findAnimationClip(animations, ...names);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip);
        if (key === 'death' || key === 'jump' || key === 'jumpLand') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        this.actions.set(key, action);
      }
      this.ready = true;
      this.play(animToKey(initialAnim));
    } catch {
      this.ready = false;
    }
  }

  applySnap(snap: PlayerSnap): void {
    this.name = snap.name;
    this.target.set(snap.x, snap.y, snap.z);
    this.targetYaw = snap.yaw;
    if (snap.flags & 1) {
      this.root.visible = false;
    } else {
      this.root.visible = true;
      this.play(animToKey(snap.anim));
    }
  }

  private play(key: string): void {
    if (!this.mixer) return;
    if (key === this.animKey && this.action) return;
    const next = this.actions.get(key) || this.actions.get('idle');
    if (!next) return;
    if (this.action && this.action !== next) this.action.fadeOut(0.15);
    next.reset().setEffectiveWeight(1).fadeIn(0.15).play();
    this.action = next;
    this.animKey = key;
  }

  update(dt: number): void {
    // Smooth follow network targets
    this.root.position.lerp(this.target, 1 - Math.exp(-12 * dt));
    const cur = this.root.rotation.y;
    const want = this.targetYaw + Math.PI;
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y = cur + d * (1 - Math.exp(-10 * dt));
    if (this.mixer) this.mixer.update(dt);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mixer?.stopAllAction();
    this.model = null;
    this.ready = false;
  }
}
