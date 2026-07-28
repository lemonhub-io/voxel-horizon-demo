import * as THREE from 'three/webgpu';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CC0_MODEL_ASSETS } from './model-assets';

const loader = new GLTFLoader();
const templates = new Map<string, Promise<THREE.Group>>();

export interface ModelLoadFailure {
  id: string;
  label: string;
  url: string;
  reason: string;
}

export function loadCC0Model(url: string): Promise<THREE.Group> {
  if (import.meta.env.MODE === 'test') return Promise.reject(new Error('CC0 model loading is disabled in tests'));
  let template = templates.get(url);
  if (!template) {
    template = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    templates.set(url, template);
  }
  return template.then(scene => scene.clone(true));
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
  model.updateMatrixWorld();
  const before = new Box3().setFromObject(model);
  const size = before.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 0.001);
  const scale = Math.min(maxSpan / span, maxHeight / Math.max(size.y, 0.001));
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld();
  const after = new Box3().setFromObject(model);
  const center = after.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= after.min.y;
  model.position.z -= center.z;
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}