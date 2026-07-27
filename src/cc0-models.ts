import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const templates = new Map<string, Promise<THREE.Group>>();

interface CloneableGroup extends THREE.Group {
  clone(recursive?: boolean): THREE.Group;
}

interface ModelBounds {
  min: THREE.Vector3;
  setFromObject(object: THREE.Object3D): ModelBounds;
  getCenter(target: THREE.Vector3): THREE.Vector3;
  getSize(target: THREE.Vector3): THREE.Vector3;
}

interface ModelBoundsConstructor {
  new(): ModelBounds;
}

interface TraversableObject extends THREE.Object3D {
  traverse(callback: (child: THREE.Object3D) => void): void;
}

function getBox3(): ModelBoundsConstructor {
  return (THREE as unknown as { Box3: ModelBoundsConstructor }).Box3;
}

/** Loads one bundled CC0 glTF once, then returns an isolated scene instance. */
export function loadCC0Model(url: string): Promise<THREE.Group> {
  if (import.meta.env.MODE === 'test') return Promise.reject(new Error('CC0 model loading is disabled in tests'));
  let template = templates.get(url);
  if (!template) {
    template = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    templates.set(url, template);
  }
  return template.then(scene => (scene as unknown as CloneableGroup).clone(true));
}

/** Normalizes an authored model to the game's world scale and rests it on y = 0. */
export function fitCC0Model(model: THREE.Object3D, maxSpan: number, maxHeight: number): void {
  model.updateMatrixWorld();
  const before = new (getBox3())().setFromObject(model);
  const size = before.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 0.001);
  const scale = Math.min(maxSpan / span, maxHeight / Math.max(size.y, 0.001));
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld();

  const after = new (getBox3())().setFromObject(model);
  const center = after.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= after.min.y;
  model.position.z -= center.z;
  (model as unknown as TraversableObject).traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
