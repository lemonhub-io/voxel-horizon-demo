import * as THREE from 'three/webgpu';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CC0_MODEL_ASSETS } from './model-assets';

const loader = new GLTFLoader();

export interface CC0GltfTemplate {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface LoadedCC0Model {
  /** Fresh skinned-safe instance (SkeletonUtils.clone). */
  scene: THREE.Group;
  /** Clips from the glTF (shared, immutable content). */
  animations: THREE.AnimationClip[];
}

/** Cached full glTF templates (never hand the scene out — always clone). */
const templates = new Map<string, Promise<CC0GltfTemplate>>();

export interface ModelLoadFailure {
  id: string;
  label: string;
  url: string;
  reason: string;
}

function loadTemplate(url: string): Promise<CC0GltfTemplate> {
  if (import.meta.env.MODE === 'test') {
    return Promise.reject(new Error('CC0 model loading is disabled in tests'));
  }
  let template = templates.get(url);
  if (!template) {
    template = new Promise<CC0GltfTemplate>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          prepareCC0Scene(gltf.scene);
          resolve({
            scene: gltf.scene,
            animations: gltf.animations ? gltf.animations.slice() : [],
          });
        },
        undefined,
        reject,
      );
    });
    templates.set(url, template);
  }
  return template;
}

/**
 * Load a CC0 glTF and return a **fresh instance**.
 * Fauna models are skinned; `Object3D.clone()` breaks skeleton binding so the
 * mesh casts no visible body (only our ground blob shadow shows). Always use
 * SkeletonUtils.clone for correct bone → SkinnedMesh rebinding.
 */
export function loadCC0Model(url: string): Promise<THREE.Group> {
  return loadTemplate(url).then((t) => cloneCC0Scene(t.scene));
}

/** Load scene + animation clips (clips are shared references from the template). */
export function loadCC0ModelWithAnimations(url: string): Promise<LoadedCC0Model> {
  return loadTemplate(url).then((t) => ({
    scene: cloneCC0Scene(t.scene),
    animations: t.animations,
  }));
}

/** Find a clip by exact name or suffix (Quaternius uses `Armature|Idle`). */
export function findAnimationClip(
  clips: THREE.AnimationClip[],
  ...candidates: string[]
): THREE.AnimationClip | null {
  for (const name of candidates) {
    const exact = clips.find((c) => c.name === name);
    if (exact) return exact;
    const ends = clips.find((c) => c.name.endsWith(name) || c.name.endsWith(`|${name}`));
    if (ends) return ends;
    const includes = clips.find((c) => c.name.includes(name));
    if (includes) return includes;
  }
  return null;
}

/** Clone a prepared template (skinned-safe). */
export function cloneCC0Scene(source: THREE.Object3D): THREE.Group {
  const root = cloneSkinned(source) as THREE.Group;
  prepareCC0Scene(root);
  return root;
}

/**
 * Make glTF content render reliably under WebGPURenderer:
 * - rebind / pose skeletons
 * - disable bad frustum culling on skinned meshes
 * - ensure base-color maps use sRGB
 */
function prepareCC0Scene(root: THREE.Object3D): void {
  root.traverse((child) => {
    const skinned = child as THREE.Object3D & {
      isSkinnedMesh?: boolean;
      skeleton?: { pose: () => void; update: () => void };
      frustumCulled?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
      material?: THREE.Material | THREE.Material[];
    };

    if (skinned.isSkinnedMesh && skinned.skeleton) {
      skinned.skeleton.pose();
      // Bind-pose AABBs are often wrong after retarget/scale → mesh culled.
      skinned.frustumCulled = false;
    }

    if ('castShadow' in skinned) {
      skinned.castShadow = true;
      skinned.receiveShadow = true;
    }

    const mats = skinned.material
      ? Array.isArray(skinned.material)
        ? skinned.material
        : [skinned.material]
      : [];
    for (const mat of mats) {
      const m = mat as THREE.Material & {
        map?: THREE.Texture | null;
        color?: THREE.Color;
        side?: number;
        transparent?: boolean;
        opacity?: number;
        depthWrite?: boolean;
        needsUpdate?: boolean;
        fog?: boolean;
      };
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.needsUpdate = true;
      }
      // Unlit fauna textures must stay fully opaque and double-sided.
      if (m.side !== undefined) m.side = THREE.DoubleSide;
      if (m.transparent) {
        m.transparent = false;
        m.opacity = 1;
      }
      if (m.depthWrite !== undefined) m.depthWrite = true;
      if (m.fog !== undefined) m.fog = true;
      m.needsUpdate = true;
    }
  });
  root.updateMatrixWorld(true);
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '网络请求或模型解析失败';
}

export async function preloadCC0Models(): Promise<ModelLoadFailure[]> {
  const results = await Promise.all(CC0_MODEL_ASSETS.map(async asset => {
    try {
      await loadCC0Model(asset.url);
      return null;
    } catch (error) {
      return { ...asset, reason: failureReason(error) };
    }
  }));
  return results.filter((failure): failure is ModelLoadFailure => failure !== null);
}

export function fitCC0Model(model: THREE.Object3D, maxSpan: number, maxHeight: number): void {
  // Pose skins before measuring bounds.
  model.traverse((child) => {
    const skinned = child as THREE.Object3D & {
      isSkinnedMesh?: boolean;
      skeleton?: { pose: () => void };
      frustumCulled?: boolean;
    };
    if (skinned.isSkinnedMesh && skinned.skeleton) {
      skinned.skeleton.pose();
      skinned.frustumCulled = false;
    }
  });
  model.updateMatrixWorld(true);

  const before = new Box3().setFromObject(model);
  const size = before.getSize(new Vector3());
  if (!Number.isFinite(size.x) || size.length() < 1e-6) return;

  const span = Math.max(size.x, size.z, 0.001);
  const scale = Math.min(maxSpan / span, maxHeight / Math.max(size.y, 0.001));
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const after = new Box3().setFromObject(model);
  const center = after.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= after.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Scale a model so its axis-aligned height is exactly `height` world units
 * (1 unit = 1 voxel). Feet are placed on y=0 of the model local origin.
 */
export function fitCC0ModelExactHeight(model: THREE.Object3D, height: number): void {
  model.traverse((child) => {
    const skinned = child as THREE.Object3D & {
      isSkinnedMesh?: boolean;
      skeleton?: { pose: () => void };
      frustumCulled?: boolean;
    };
    if (skinned.isSkinnedMesh && skinned.skeleton) {
      skinned.skeleton.pose();
      skinned.frustumCulled = false;
    }
  });
  model.updateMatrixWorld(true);

  const before = new Box3().setFromObject(model);
  const size = before.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y < 1e-6) return;

  const scale = height / size.y;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const after = new Box3().setFromObject(model);
  const center = after.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= after.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);

  // Correct any residual float error so bounds are exactly `height`.
  const finalBox = new Box3().setFromObject(model);
  const finalH = finalBox.max.y - finalBox.min.y;
  if (finalH > 1e-6 && Math.abs(finalH - height) > 1e-4) {
    model.scale.multiplyScalar(height / finalH);
    model.updateMatrixWorld(true);
    const box2 = new Box3().setFromObject(model);
    const c2 = box2.getCenter(new Vector3());
    model.position.x -= c2.x;
    model.position.y -= box2.min.y;
    model.position.z -= c2.z;
    model.updateMatrixWorld(true);
  }

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}