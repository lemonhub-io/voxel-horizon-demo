// ============================================================
// types.ts — All shared interfaces and type definitions
// ============================================================

// --- Block / Item / Recipe types ---

export interface BlockTiles {
  all?: number;
  top?: number;
  side?: number;
  bottom?: number;
}

export interface BlockDrop {
  id: string;
  n: [number, number];
  p?: number;
}

export interface BlockDef {
  name: string;
  solid: boolean;
  tiles?: BlockTiles;
  hard?: number;
  snd?: string;
  drops?: BlockDrop[];
  cross?: boolean;
  water?: boolean;
  cutout?: boolean;
  glass?: boolean;
  emissive?: boolean;
  flora?: boolean;
  scan?: string;
}

export interface ItemDef {
  name: string;
  type: string;
  sym?: string;
  col?: string;
  stack?: number;
  desc: string;
  place?: number;
  glyph?: string;
  use?: string;
  useAmt?: number;
}

export interface Recipe {
  id: string;
  out: number;
  cat: string;
  req: [string, number][];
  desc: string;
}

export interface HazardDef {
  type: string;
  label: string;
  day: number;
  night: number;
  nightType: string;
  nightLabel: string;
}

export interface StormDef {
  chance: number;
  label: string;
}

export interface TreesDef {
  density: number;
  types: string[];
}

export interface Palette {
  id: string;
  climate: string;
  grass: string;
  grassAlt: string;
  dirt: string;
  sand: string;
  leaves: string[];
  wood: string;
  skyDayTop: string;
  skyDayHor: string;
  skyNightTop: string;
  skyNightHor: string;
  fogDay: string;
  fogNight: string;
  sun: string;
  water: string | null;
  sea: boolean;
  hazard: HazardDef;
  storm: StormDef;
  trees: TreesDef;
  tuft: number;
  plant: number;
  na: number;
  o2: number;
  h2: number;
  rock: number;
  creatures: string[];
  fauna: number;
  floraLevel: string;
  stormLevel: string;
}

export interface MilestoneDef {
  key: string;
  name: string;
  unit: string;
  tiers: number[];
  subs: string[];
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  sens: number;
  fov: number;
  dist: number;
  invert: boolean;
}

// --- Game subsystem types ---

export interface SlotItem {
  id: string;
  n: number;
}

export interface ScanTarget {
  x: number;
  y: number;
  z: number;
  type: string;
  d: number;
  id: number;
}

export interface RaycastResult {
  x: number;
  y: number;
  z: number;
  id: number;
  nx: number;
  ny: number;
  nz: number;
  dist: number;
}

export interface CreatureSpec {
  seed: number;
  name: string;
  col: string;
  col2: string;
  size: number;
  legs: number;
  horn: boolean;
  tail: boolean;
  speed: number;
}

export interface Creature {
  grp: THREE.Group;
  sp: CreatureSpec;
  legs: THREE.Mesh[];
  tail: THREE.Mesh | null;
  shadow: THREE.Mesh;
  state: string;
  stateT: number;
  dir: number;
  hp: number;
  phase: number;
  panic: number;
  seed: number;
}

export interface CreatureHit {
  creature: Creature;
  dist: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  col: THREE.Color;
  grav: number;
}

export interface SpawnOpts {
  n?: number;
  col?: string;
  speed?: number;
  up?: number;
  life?: number;
  grav?: number;
}

export interface ShipComponent {
  name: string;
  broken: boolean;
  req: [string, number][];
  desc: string;
}

export interface PlanetInfo {
  name: string;
  climate: string;
  flora: string;
  fauna: string;
  storm: string;
  res: string[];
}

export interface Discovery {
  key: string;
  name: string;
  kind: string;
  planet: string;
  units: number;
}

export interface PlanetDiscovery {
  name: string;
  climate: string;
  visited: number;
}

export interface Discoveries {
  planets: PlanetDiscovery[];
  entries: Discovery[];
}

export interface MissionDef {
  id: string;
  title: string;
  desc: string;
  prog: (() => [number | string, number | string] | null) | null;
  check: () => boolean;
  done?: string;
  onComplete?: () => void;
  progText?: () => string;
}

export interface Marker {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  ttl: number;
  type: string;
}

export interface AudioToneOpts {
  type?: OscillatorType;
  f: number;
  f2?: number;
  dur?: number;
  vol?: number;
  at?: number;
  a?: number;
  r?: number;
  sus?: number;
  slide?: number;
  detune?: number;
  filter?: BiquadFilterType;
  ff?: number;
  q?: number;
  pan?: number;
  rev?: number;
  bus?: GainNode;
}

export interface AudioNoiseOpts {
  type?: BiquadFilterType;
  f?: number;
  f2?: number;
  dur?: number;
  vol?: number;
  at?: number;
  a?: number;
  r?: number;
  q?: number;
  pan?: number;
  rev?: number;
  bus?: GainNode;
}

export interface LoopHandle {
  [key: string]: AudioNode | undefined;
}

export interface LoopEntry {
  gain: GainNode;
  handle: LoopHandle | null;
  on: boolean;
}

export interface MeshBuffers {
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
  idx: number[];
  sway?: number[];
}

export interface InteractPrompt {
  key: string;
  text: string;
  hold: number;
  action?: () => void;
  progress?: number;
}

export interface VisorSubject {
  kind: 'creature' | 'block';
  c?: Creature;
  id?: number;
}

export interface SaveData {
  v: number;
  seed: number;
  palIdx: number;
  planetName: string;
  time: number;
  playTime: number;
  player: PlayerSaveData;
  inv: InventorySaveData;
  ship: ShipSaveData;
  missions: MissionsSaveData;
  milestones: MilestonesSaveData;
  discoveries: Discoveries;
  edits: Record<string, number[]>;
}

export interface SaveSlotMeta {
  id: number;
  planetName: string;
  climate: string;
  playTime: number;
  timestamp: number;
  playerHp: number;
}

export interface PlayerSaveData {
  pos: number[];
  yaw: number;
  pitch: number;
  hp: number;
  hazard: number;
  ls: number;
  flash: boolean;
}

export interface InventorySaveData {
  slots: (SlotItem | null)[];
  hotbar: (SlotItem | null)[];
  sel: number;
  units: number;
}

export interface ShipSaveData {
  pos: number[];
  rotY: number;
  fuel: number;
  thruster: boolean;
  pulse: boolean;
}

export interface MissionsSaveData {
  idx: number;
  scanner: boolean;
  shelter: number;
  launched: boolean;
}

export interface MilestonesSaveData {
  stats: Record<string, number>;
  awarded: Record<string, number>;
}

// --- Input state ---

export interface InputState {
  keys: Record<string, boolean>;
  buttons: Record<number, boolean>;
  dx: number;
  dy: number;
  dxSmooth: number;
  init(game: Game): void;
}

// --- Forward reference for Game (defined in main.ts) ---

export interface Game {
  state: string;
  settings: Settings;
  audio: AudioEngine;
  time: number;
  playTime: number;
  timeUniform: { value: number };
  stormActive: boolean;
  stormFactor: number;
  stormTimer: number;
  discoveries: Discoveries;
  autoSaveT: number;
  input: InputState;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  atlas: TextureAtlas;
  clock: THREE.Clock;
  seed: number;
  palIdx: number;
  palette: Palette;
  planetName: string;
  world: World;
  sky: Sky;
  fx: FX;
  fauna: Fauna;
  inv: Inventory;
  ship: Ship;
  hud: HUD;
  missions: Missions;
  milestones: Milestones;
  player: Player;
  spawnPoint: { x: number; z: number };
  missionT?: number;
  stormLeft?: number;
  postProc?: { render(): void; resize(w: number, h: number): void };
  initRenderer(): Promise<void>;
  applySettings(): void;
  uiOpen(): boolean;
  requestPointerLock(): void;
  exitPointerLock(): void;
  newGame(): void;
  continueGame(): void;
  beginLoad(seed: number, palIdx: number, saveData: SaveData | null): void;
  finishLoad(saveData: SaveData | null): void;
  playIntro(): void;
  planetInfo(): PlanetInfo;
  startPlay(): void;
  togglePause(on?: boolean): void;
  onKey(code: string, e: KeyboardEvent): void;
  onMouseDown(e: MouseEvent): void;
  onWheel(e: WheelEvent): void;
  updateStorm(dt: number): void;
  startWarp(): void;
  onPlayerDeath(cause?: string): void;
  respawn(): void;
  syncPlayerStore(): void;
  loop(): void;
}

// Forward references for classes defined in other modules
// These are resolved at runtime via imports in main.ts
export interface TextureAtlas {
  size: number;
  px: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture | null;
  iconCache: Record<string, string>;
  avgCache: Record<string, string>;
  tileRect(t: number): [number, number, number, number];
  uv(t: number): [number, number, number, number];
  build(pal: Palette, seed: number): THREE.CanvasTexture;
  tileAvg(t: number, f: number): string;
  icon(itemId: string): string;
}

export interface AudioEngine {
  ok: boolean;
  vol: { master: number; music: number; sfx: number };
  loops: Record<string, LoopEntry>;
  musicMode: string | null;
  nightMix: number;
  ctx: AudioContext;
  master: GainNode;
  comp: DynamicsCompressorNode;
  sfxBus: GainNode;
  musicBus: GainNode;
  reverb: ConvolverNode;
  revGain: GainNode;
  noiseBuf: AudioBuffer;
  padTimer: ReturnType<typeof setInterval> | null;
  pluckTimer: ReturnType<typeof setInterval> | null;
  chordIdx: number;
  ensure(): void;
  applyVol(): void;
  setVol(k: string, v: number): void;
  tone(o: AudioToneOpts): OscillatorNode | null;
  noise(o: AudioNoiseOpts): void;
  mkLoop(name: string, build: (c: AudioContext, out: GainNode) => LoopHandle | void): LoopEntry;
  setLoop(name: string, on: boolean, vol?: number, ramp?: number): void;
  initLoops(): void;
  shipThrottle(t: number): void;
  laserPitch(p: number): void;
  uiHover(): void;
  uiClick(): void;
  uiOpen(): void;
  uiClose(): void;
  uiDeny(): void;
  pickup(i: number): void;
  notify(kind: string): void;
  milestone(): void;
  missionDone(): void;
  craft(): void;
  alarm(): void;
  heartbeat(): void;
  mineHit(snd: string, pan?: number): void;
  blockBreak(snd: string, pan?: number): void;
  place(snd: string | undefined, pan?: number): void;
  step(snd: string, run: boolean): void;
  jump(): void;
  land(hard: boolean): void;
  hurt(): void;
  death(): void;
  respawn(): void;
  scanPulse(): void;
  scanFound(i: number): void;
  analyze(): void;
  analyzeTick(p: number): void;
  recharge(): void;
  useItem(): void;
  overheat(): void;
  splash(): void;
  takeoff(): void;
  landing(): void;
  warpCharge(): void;
  warpBoom(): void;
  creatureCall(seed: number, dist: number): void;
  creatureHurt(pan: number): void;
  thunder(): void;
  startMusic(mode: string): void;
  stopMusic(): void;
  playPad(): void;
  playPluck(): void;
}

export interface World {
  g: Game;
  chunks: Map<string, Chunk>;
  edits: Map<string, Map<number, number>>;
  group: THREE.Group;
  genQueue: Chunk[];
  meshQueue: Chunk[];
  lampLights: THREE.PointLight[];
  lampPool: THREE.PointLight[];
  heightCache: Map<string, number>;
  matsReady: boolean;
  seed: number;
  pal: Palette;
  noise: SimplexNoise;
  noiseB: SimplexNoise;
  noiseC: SimplexNoise;
  offA: number;
  lamps: number[][];
  matOpaque: THREE.MeshLambertMaterial;
  matCutout: THREE.MeshLambertMaterial;
  matWater: THREE.MeshLambertMaterial;
  setPlanet(seed: number, pal: Palette): void;
  buildMaterials(): void;
  key(cx: number, cz: number): string;
  genColumn(gx: number, gz: number): number;
  findLand(sx: number, sz: number): { x: number; z: number };
  surfaceY(gx: number, gz: number): number;
  generate(chunk: Chunk): void;
  plantTree(chunk: Chunk, lx: number, y: number, lz: number, type: string, gx: number, gz: number): void;
  getBlock(gx: number, gy: number, gz: number): number;
  setBlock(gx: number, gy: number, gz: number, id: number, opts?: object): boolean;
  remesh(cx: number, cz: number): void;
  topSolidY(gx: number, gz: number): number;
  buildMesh(chunk: Chunk): void;
  update(px: number, pz: number, budgetMs: number): void;
  pregenProgress(px: number, pz: number): number;
  updateLampLights(px: number, pz: number): void;
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RaycastResult | null;
  collides(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean;
  isWater(x: number, y: number, z: number): boolean;
  findScanTargets(px: number, py: number, pz: number, radius: number): ScanTarget[];
  dispose(): void;
}

export interface Chunk {
  cx: number;
  cz: number;
  data: Uint8Array;
  meshes: THREE.Mesh[];
  built: boolean;
  dirty: boolean;
  idx(x: number, y: number, z: number): number;
  get(x: number, y: number, z: number): number;
  set(x: number, y: number, z: number, id: number): void;
}

export interface Sky {
  g: Game;
  group: THREE.Group;
  t: number;
  dayMix: number;
  pal: Palette;
  setPalette(pal: Palette): void;
  update(dt: number): void;
}

export interface FX {
  g: Game;
  max: number;
  parts: Particle[];
  shakeAmp: number;
  warpAnim: number | null;
  spawn(x: number, y: number, z: number, opts: SpawnOpts): void;
  update(dt: number): void;
  laserShow(from: THREE.Vector3, to: THREE.Vector3, col?: string): void;
  laserHide(): void;
  shake(a: number): void;
  applyShake(camera: THREE.Camera): void;
  startWarp(): void;
  stopWarp(): void;
}

export interface Fauna {
  g: Game;
  creatures: Creature[];
  group: THREE.Group;
  speciesList: CreatureSpec[];
  callTimer: number;
  spawnPlanet(seed: number, pal: Palette): void;
  spawnCreature(sp: CreatureSpec, x: number, z: number, rng: () => number): Creature;
  update(dt: number): void;
  raycastCreature(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): CreatureHit | null;
  hit(c: Creature, dmg: number): boolean;
  dispose(): void;
}

export interface Inventory {
  g: Game;
  slots: (SlotItem | null)[];
  hotbar: (SlotItem | null)[];
  sel: number;
  units: number;
  open: boolean;
  tab: string;
  drag: SlotItem | null;
  selRecipe: Recipe | null;
  stackMax(id: string): number;
  add(id: string, n: number): number;
  count(id: string): number;
  consume(id: string, n: number): boolean;
  canAfford(req: [string, number][]): boolean;
  pay(req: [string, number][]): boolean;
  selected(): SlotItem | null;
  useItem(id: string): boolean;
  craft(r: Recipe): void;
  toggle(force?: boolean): void;
  syncStore(): void;
  serialize(): InventorySaveData;
  deserialize(d: InventorySaveData | undefined): void;
}

export interface Ship {
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
  shadow: THREE.Mesh;
  buildMesh(): void;
  repaired(): boolean;
  canLaunch(): boolean;
  placeAt(x: number, z: number): void;
  updateCrashPose(): void;
  update(dt: number): void;
  enter(): void;
  tryLand(): void;
  tryWarp(): void;
  openPanel(): void;
  closePanel(): void;
  renderPanel(): void;
  serialize(): ShipSaveData;
  deserialize(d: ShipSaveData | undefined): void;
}

export interface Player {
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
  flashlight: THREE.SpotLight;
  scanCd: number;
  target: RaycastResult | null;
  flashOn: boolean;
  buildViewmodel(): void;
  eyePos(): THREE.Vector3;
  lookDir(): THREE.Vector3;
  update(dt: number): void;
  moveCollide(dt: number): void;
  updateTargeting(dt?: number): void;
  updateMining(dt: number): void;
  heatUp(dt: number): void;
  stopMining(keepLaser?: boolean): void;
  blockColor(id: number): string;
  breakBlock(t: RaycastResult): void;
  vmTipWorld(): THREE.Vector3;
  placeBlock(): void;
  statsTick(dt: number, inShip: boolean): void;
  checkShelter(): boolean;
  damage(amt: number, cause?: string, silent?: boolean): void;
  die(cause?: string): void;
  respawn(): void;
  updateInteract(dt: number): void;
  doScan(): void;
  toggleVisor(force?: boolean): void;
  updateVisor(dt: number): void;
  isDiscovered(key: string): boolean;
  discover(subject: VisorSubject): void;
  exitShip(): void;
  serialize(): PlayerSaveData;
  deserialize(d: PlayerSaveData | undefined): void;
}

export interface HUD {
  g: Game;
  markers: Marker[];
  compass: HTMLCanvasElement | null;
  cctx: CanvasRenderingContext2D | null;
  initCompass(): void;
  update(dt: number): void;
  drawCompass(): void;
  addMarker(type: string, pos: THREE.Vector3, ttl: number): void;
  updateMarkers(dt: number): void;
  clearMarkers(): void;
  scanFlash(): void;
  toast(itemId: string, n: number): void;
  notify(text: string, kind?: string): void;
  alert(text: string, on: boolean): void;
  milestone(kicker: string, title: string, sub: string): void;
  setMission(title: string, desc: string, cur: number, max: number): void;
  showPrompt(key: string, text: string, prog: number): void;
  hidePrompt(): void;
  setMineProgress(p: number): void;
  setHeat(h: number, hot: boolean): void;
  setFlightHud(on: boolean): void;
  closeShipPanel(): void;
  planetCard(info: PlanetInfo): void;
  renderDiscoveries(): void;
}

export interface Missions {
  g: Game;
  idx: number;
  scannerUnlocked: boolean;
  shelterCount: number;
  defs: MissionDef[];
  launched?: boolean;
  sodiumUsed?: number;
  oxygenUsed?: number;
  buildDefs(): MissionDef[];
  current(): MissionDef;
  onEvent(ev: string, data?: string): void;
  tick(): void;
  updateCard(): void;
  serialize(): MissionsSaveData;
  deserialize(d: MissionsSaveData | undefined): void;
}

export interface Milestones {
  g: Game;
  stats: Record<string, number>;
  awarded: Record<string, number>;
  tier(def: MilestoneDef, val: number): number;
  addStat(key: string, amt: number): void;
  checkKey(key: string): void;
  tickTime(dt: number): void;
  serialize(): MilestonesSaveData;
  deserialize(d: MilestonesSaveData | undefined): void;
}

export interface SimplexNoise {
  noise2(xin: number, yin: number): number;
  noise3(xin: number, yin: number, zin: number): number;
  fbm2(x: number, y: number, oct: number, lac: number, gain: number): number;
}

export interface U {
  clamp(v: number, a: number, b: number): number;
  lerp(a: number, b: number, t: number): number;
  smooth(t: number): number;
  rand(a: number, b: number): number;
  randi(a: number, b: number): number;
  pick<T>(arr: T[], rng?: () => number): T;
  dist2(ax: number, az: number, bx: number, bz: number): number;
  fmtDist(m: number): string;
  fmtTime(s: number): string;
  xmur3(str: string): () => number;
  mulberry32(seed: number): () => number;
  seedFromString(str: string | number): number;
  hash2(x: number, y: number, seed: number): number;
  hexRgb(hex: string): [number, number, number];
  rgbHex(r: number, g: number, b: number): string;
  mixHex(a: string, b: string, t: number): string;
  shade(hex: string, f: number): string;
  vary(hex: string, rng: () => number, amt: number): string;
  roman(n: number): string;
  planetName(rng: () => number): string;
  creatureName(rng: () => number): string;
  floraName(rng: () => number): string;
}

export interface Save {
  save(g: Game, slot?: number): Promise<boolean>;
  load(slot?: number): Promise<SaveData | null>;
  hasSave(): Promise<boolean>;
  listSlots(): Promise<SaveSlotMeta[]>;
  deleteSlot(slot: number): Promise<void>;
  clear(): Promise<void>;
  getCurrentSlot(): number;
  setCurrentSlot(slot: number): void;
  loadSettings(): Settings;
  saveSettings(s: Settings): void;
}

// --- THREE.js global declaration (loaded via script tag) ---

declare global {
namespace THREE {
  class Vector2 { constructor(x?: number, y?: number); x: number; y: number; set(x: number, y: number): this; }
  class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
    setScalar(s: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    addScaledVector(v: Vector3, s: number): this;
    normalize(): this;
    lengthSq(): number;
    length(): number;
    distanceTo(v: Vector3): number;
    dot(v: Vector3): number;
    cross(v: Vector3): this;
    applyQuaternion(q: Quaternion): this;
    toArray(): number[];
    fromArray(a: number[]): this;
    lerp(v: Vector3, t: number): this;
    project(camera: Camera): this;
  }
  class Vector4 { constructor(x?: number, y?: number, z?: number, w?: number); }
  class Euler {
    constructor(x?: number, y?: number, z?: number, order?: string);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number, order?: string): this;
    setFromQuaternion(q: Quaternion, order?: string): this;
  }
  class Quaternion {
    constructor(x?: number, y?: number, z?: number, w?: number);
    setFromEuler(e: Euler): this;
    setFromAxisAngle(axis: Vector3, angle: number): this;
    multiply(q: Quaternion): this;
    slerp(q: Quaternion, t: number): this;
  }
  class Matrix4 { constructor(); }
  class Color { constructor(color?: string | number); set(color: string | number): this; r: number; g: number; b: number; }
  class Object3D {
    position: Vector3;
    rotation: Euler;
    quaternion: Quaternion;
    scale: Vector3;
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    children: Object3D[];
    matrixAutoUpdate: boolean;
    add(object: Object3D): this;
    remove(object: Object3D): this;
    lookAt(v: Vector3): void;
    updateMatrix(): void;
    updateMatrixWorld(): void;
    getWorldPosition(target: Vector3): Vector3;
  }
  class Scene extends Object3D { fog: Fog | null; }
  class Camera extends Object3D { }
  class PerspectiveCamera extends Camera {
    constructor(fov: number, aspect: number, near: number, far: number);
    fov: number;
    aspect: number;
    updateProjectionMatrix(): void;
  }
  class WebGLRenderer {
    constructor(params: { canvas: HTMLCanvasElement; antialias?: boolean; powerPreference?: string; forceWebGL?: boolean });
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number): void;
    setClearColor(color: string | number): void;
    render(scene: Scene, camera: Camera): void;
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    shadowMap: { enabled: boolean; type: number };
  }
  class Fog { constructor(color: string, near: number, far: number); color: Color; near: number; far: number; }
  class BufferGeometry {
    setAttribute(name: string, attribute: BufferAttribute): this;
    setIndex(index: number[]): this;
    setDrawRange(start: number, count: number): void;
    attributes: Record<string, BufferAttribute>;
    dispose(): void;
  }
  class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
    needsUpdate: boolean;
    count: number;
    getX(index: number): number;
    getY(index: number): number;
    getZ(index: number): number;
    setXY(index: number, x: number, y: number): void;
  }
  class EdgesGeometry extends BufferGeometry { constructor(geometry: BufferGeometry); }
  class SphereGeometry extends BufferGeometry { constructor(radius: number, widthSegments?: number, heightSegments?: number); }
  class BoxGeometry extends BufferGeometry {
    constructor(width: number, height: number, depth: number);
    translate(x: number, y: number, z: number): this;
  }
  class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop: number, radiusBottom: number, height: number, radialSegments?: number, heightSegments?: number, openEnded?: boolean);
    translate(x: number, y: number, z: number): this;
    rotateX(angle: number): this;
  }
  class ConeGeometry extends BufferGeometry { constructor(radius: number, height: number, radialSegments?: number); }
  class CircleGeometry extends BufferGeometry { constructor(radius: number, segments?: number); }
  class Material { dispose(): void; }
  class MeshBasicMaterial extends Material {
    constructor(params?: Record<string, unknown>);
    color: Color;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    blending: number;
    polygonOffset: boolean;
    polygonOffsetFactor: number;
    map: Texture | null;
  }
  class MeshLambertMaterial extends Material {
    constructor(params?: Record<string, unknown>);
    color: Color;
    emissive: Color;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    vertexColors: boolean;
    alphaTest: number;
    side: number;
    fog: boolean;
    map: Texture | null;
    needsUpdate: boolean;
    onBeforeCompile: ((shader: Shader) => void) | undefined;
  }
  class PointsMaterial extends Material {
    constructor(params?: Record<string, unknown>);
    size: number;
    map: Texture | null;
    vertexColors: boolean;
    transparent: boolean;
    depthWrite: boolean;
    blending: number;
    sizeAttenuation: boolean;
  }
  class ShaderMaterial extends Material {
    constructor(params: {
      uniforms: Record<string, { value: unknown }>;
      vertexShader: string;
      fragmentShader: string;
      side?: number;
      depthWrite?: boolean;
      fog?: boolean;
    });
  }
  class LineBasicMaterial extends Material {
    constructor(params?: Record<string, unknown>);
    color: Color;
    transparent: boolean;
    opacity: number;
  }
  class SpriteMaterial extends Material {
    constructor(params?: Record<string, unknown>);
    color: Color;
    transparent: boolean;
    opacity: number;
    fog: boolean;
    depthWrite: boolean;
    blending: number;
    map: Texture | null;
  }
  interface Shader { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string; }
  class Texture {
    dispose(): void;
    magFilter: number;
    minFilter: number;
    generateMipmaps: boolean;
    wrapS: number;
    wrapT: number;
  }
  class CanvasTexture extends Texture { constructor(canvas: HTMLCanvasElement); }
  class Mesh extends Object3D {
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    material: Material;
    frustumCulled: boolean;
    renderOrder: number;
  }
  class Points extends Object3D {
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    frustumCulled: boolean;
  }
  class LineSegments extends Object3D {
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    visible: boolean;
  }
  class Sprite extends Object3D {
    constructor(material: SpriteMaterial);
    material: SpriteMaterial;
    scale: Vector3;
  }
  class Group extends Object3D { }
  class Light extends Object3D { intensity: number; color: Color; }
  class LightShadow {
    camera: OrthographicCamera;
    bias: number;
    normalBias: number;
    radius: number;
    mapSize: Vector2;
    dispose(): void;
  }
  class DirectionalLightShadow extends LightShadow {
    constructor();
  }
  class OrthographicCamera extends Camera {
    constructor(left: number, right: number, top: number, bottom: number, near?: number, far?: number);
    left: number; right: number; top: number; bottom: number; near: number; far: number;
  }
  class DirectionalLight extends Light {
    constructor(color?: number | string, intensity?: number);
    shadow: DirectionalLightShadow;
    castShadow: boolean;
    target: Object3D;
  }
  class HemisphereLight extends Light {
    constructor(skyColor?: number | string, groundColor?: number | string, intensity?: number);
    groundColor: Color;
  }
  class PointLight extends Light {
    constructor(color?: number | string, intensity?: number, distance?: number, decay?: number);
  }
  class SpotLight extends Light {
    constructor(color?: number | string, intensity?: number, distance?: number, angle?: number, penumbra?: number, decay?: number);
    target: Object3D;
  }
  class Clock { constructor(); getDelta(): number; }

  const AdditiveBlending: number;
  const BackSide: number;
  const DoubleSide: number;
  const NearestFilter: number;
  const ClampToEdgeWrapping: number;
  const SRGBColorSpace: string;
  const ACESFilmicToneMapping: number;
  const AgXToneMapping: number;
  const NeutralToneMapping: number;
  const NoToneMapping: number;
  const PCFSoftShadowMap: number;

  // Post-processing types
  class EffectComposer {
    constructor(renderer: WebGLRenderer);
    addPass(pass: unknown): void;
    setSize(width: number, height: number): void;
    render(): void;
  }
  class RenderPass {
    constructor(scene: Scene, camera: Camera);
  }
  class UnrealBloomPass {
    constructor(resolution: Vector2, strength: number, radius: number, threshold: number);
  }
  class FXAAPass {
    constructor(width: number, height: number);
  }
  class ShaderPass {
    constructor(shader: Record<string, unknown>);
    uniforms: Record<string, { value: unknown }>;
    renderToScreen: boolean;
  }
}
} // declare global
