import * as THREE from 'three/webgpu';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CC0_MODEL_ASSETS } from './model-assets';

const loader = new GLTFLoader();
/** Cached source scenes (never hand these out — always clone). */
const templates = new Map<string, Promise<THREE.Group>>();

export interface ModelLoadFailure {
  id: string;
  label: string;
  url: string;
  reason: string;
}

/**
 * Load a CC0 glTF and return a **fresh instance**.
 * Fauna models are skinned; `Object3D.clone()` breaks skeleton binding so the
 * mesh casts no visible body (only our ground blob shadow shows). Always use
 * SkeletonUtils.clone for correct bone → SkinnedMesh rebinding.
 */
export function loadCC0Model(url: string): Promise<THREE.Group> {
  if (import.meta.env.MODE === 'test') return Promise.reject(new Error('CC0 model loading is disabled in tests'));
  let template = templates.get(url);
  if (!template) {
    template = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          // Normalize once on the template source.
          prepareCC0Scene(gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        reject,
      );
    });
    templates.set(url, template);
  }
  return template.then((scene) => cloneCC0Scene(scene));
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