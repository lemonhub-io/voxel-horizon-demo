import { vi } from 'vitest';

// Minimal THREE.js mock for testing engine classes without WebGL
export function createThreeMock() {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    setScalar(s: number) { this.x = this.y = this.z = s; return this; }
    copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v: Vector3) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v: Vector3) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this; }
    addScaledVector(v: Vector3, s: number) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    normalize() { const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    length() { return Math.sqrt(this.lengthSq()); }
    distanceTo(v: Vector3) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2); }
    dot(v: Vector3) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v: Vector3) { return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
    applyQuaternion() { return this; }
    toArray() { return [this.x, this.y, this.z]; }
    fromArray(a: number[]) { this.x = a[0]; this.y = a[1]; this.z = a[2]; return this; }
    project() { return this; }
    lerp(v: Vector3, t: number) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  }

  class Euler {
    x: number; y: number; z: number; order: string;
    constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
    set(x: number, y: number, z: number, order?: string) { this.x = x; this.y = y; this.z = z; if (order) this.order = order; return this; }
    setFromQuaternion() { return this; }
  }

  class Quaternion {
    x: number; y: number; z: number; w: number;
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    setFromEuler() { return this; }
    setFromAxisAngle() { return this; }
    multiply() { return this; }
    slerp() { return this; }
  }

  class Color {
    r: number; g: number; b: number;
    constructor(_color?: string | number) { this.r = 1; this.g = 1; this.b = 1; }
    set() { return this; }
  }

  class Object3D {
    position: Vector3 = new Vector3();
    rotation: Euler = new Euler();
    quaternion: Quaternion = new Quaternion();
    scale: Vector3 = new Vector3(1, 1, 1);
    visible = true;
    children: Object3D[] = [];
    matrixAutoUpdate = true;
    add(obj: Object3D) { this.children.push(obj); return this; }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); return this; }
    lookAt() {}
    updateMatrix() {}
    getWorldPosition(target: Vector3) { return target.copy(this.position); }
  }

  class Scene extends Object3D { fog = null; }
  class Camera extends Object3D {}
  class PerspectiveCamera extends Camera {
    fov: number; aspect: number;
    constructor(fov = 50, aspect = 1, _near = 0.1, _far = 2000) { super(); this.fov = fov; this.aspect = aspect; }
    updateProjectionMatrix() {}
  }

  class BufferGeometry {
    attrs: Record<string, unknown> = {};
    setAttribute(name: string, attr: unknown) { this.attrs[name] = attr; return this; }
    setIndex() { return this; }
    setDrawRange() {}
    get attributes() { return this.attrs; }
    dispose() {}
  }

  class BufferAttribute {
    needsUpdate = false;
    count: number;
    constructor(public array: ArrayLike<number>, public itemSize: number) { this.count = array.length / itemSize; }
    setXY() {}
  }

  class Float32BufferAttribute extends BufferAttribute {
    constructor(array: number[], itemSize: number) { super(new Float32Array(array), itemSize); }
  }

  class Material { dispose() {} }
  class MeshBasicMaterial extends Material {
    color = new Color(); transparent = false; opacity = 1; depthWrite = true; blending = 0;
    polygonOffset = false; polygonOffsetFactor = 0; map = null;
    constructor(_params?: Record<string, unknown>) { super(); }
  }
  class MeshLambertMaterial extends Material {
    color = new Color(); emissive = new Color(); transparent = false; opacity = 1; depthWrite = true;
    vertexColors = false; alphaTest = 0; side = 0; fog = true; map = null; needsUpdate = false;
    onBeforeCompile = undefined;
    constructor(_params?: Record<string, unknown>) { super(); }
  }
  class PointsMaterial extends Material {
    size = 1; map = null; vertexColors = false; transparent = false; depthWrite = true;
    blending = 0; sizeAttenuation = true;
    constructor(_params?: Record<string, unknown>) { super(); }
  }
  class LineBasicMaterial extends Material {
    color = new Color(); transparent = false; opacity = 1;
    constructor(_params?: Record<string, unknown>) { super(); }
  }
  class SpriteMaterial extends Material {
    color = new Color(); transparent = false; opacity = 1; fog = true; depthWrite = true;
    blending = 0; map = null;
    constructor(_params?: Record<string, unknown>) { super(); }
  }

  class Texture { dispose() {} magFilter = 0; minFilter = 0; generateMipmaps = true; wrapS = 0; wrapT = 0; }
  class CanvasTexture extends Texture { constructor(_canvas: HTMLCanvasElement) { super(); } }

  class Mesh extends Object3D {
    geometry: BufferGeometry; material: Material; frustumCulled = true; renderOrder = 0;
    constructor(geometry?: BufferGeometry, material?: Material) { super(); this.geometry = geometry || new BufferGeometry(); this.material = material || new Material(); }
  }

  class Points extends Object3D {
    geometry: BufferGeometry; material: Material; frustumCulled = true;
    constructor(geometry?: BufferGeometry, material?: Material) { super(); this.geometry = geometry || new BufferGeometry(); this.material = material || new Material(); }
  }

  class LineSegments extends Object3D {
    geometry: BufferGeometry; material: Material;
    constructor(geometry?: BufferGeometry, material?: Material) { super(); this.geometry = geometry || new BufferGeometry(); this.material = material || new Material(); }
  }

  class Sprite extends Object3D {
    material: SpriteMaterial;
    constructor(material?: SpriteMaterial) { super(); this.material = material || new SpriteMaterial(); }
  }

  class Group extends Object3D {}
  class Light extends Object3D { intensity = 1; color = new Color(); }
  class DirectionalLight extends Light { constructor() { super(); } }
  class HemisphereLight extends Light { groundColor = new Color(); constructor() { super(); } }
  class PointLight extends Light { constructor() { super(); } }
  class SpotLight extends Light { target = new Object3D(); constructor() { super(); } }

  class WebGLRenderer {
    outputColorSpace = 'srgb';
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    render() {}
  }

  class Clock { getDelta() { return 0.016; } }
  class Fog { color = new Color(); near = 0; far = 100; constructor(_color?: string, near = 0, far = 100) { this.near = near; this.far = far; } }

  const THREE = {
    Vector2: Vector3, Vector3, Vector4: Vector3, Euler, Quaternion, Color, Object3D, Scene, Camera, PerspectiveCamera,
    WebGLRenderer, Fog, Clock, BufferGeometry, BufferAttribute, Float32BufferAttribute,
    EdgesGeometry: BufferGeometry, SphereGeometry: BufferGeometry, BoxGeometry: BufferGeometry,
    CylinderGeometry: BufferGeometry, ConeGeometry: BufferGeometry, CircleGeometry: BufferGeometry,
    Material, MeshBasicMaterial, MeshLambertMaterial, PointsMaterial, LineBasicMaterial, SpriteMaterial,
    Texture, CanvasTexture, Mesh, Points, LineSegments, Sprite, Group,
    Light, DirectionalLight, HemisphereLight, PointLight, SpotLight,
    AdditiveBlending: 2, BackSide: 1, DoubleSide: 2, NearestFilter: 0, ClampToEdgeWrapping: 0, SRGBColorSpace: 'srgb',
    ShaderMaterial: Material,
  };

  (globalThis as Record<string, unknown>).THREE = THREE;

  // Mock canvas getContext for happy-dom
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function (type: string) {
    if (type === '2d') {
      return {
        clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
        fill() {}, stroke() {}, clip() {}, save() {}, restore() {}, translate() {},
        scale() {}, rotate() {}, transform() {}, setTransform() {},
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(0) }; },
        putImageData() {}, measureText() { return { width: 0 }; },
        font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '',
        globalAlpha: 1, imageSmoothingEnabled: true,
      } as unknown as CanvasRenderingContext2D;
    }
    return origGetContext.call(this, type);
  };

  return THREE;
}
