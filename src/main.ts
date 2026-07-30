// ============================================================
// main.ts — Game engine (Three.js + game logic only)
// All UI is handled by Vue components via Pinia stores
// ============================================================

import * as THREE from 'three/webgpu';
import type { InputState, Settings, SaveData, Palette, PlanetInfo, Discoveries } from './types';
import { U } from './utils';
import { PALETTES } from './config';
import { TextureAtlas } from './atlas';
import { AudioEngine } from './audio';
import { World } from './world';
import { Sky } from './sky';
import { FX } from './effects';
import { Fauna } from './entities';
import { Inventory } from './inventory';
import { Ship } from './ship';
import { Player } from './player';
import { HUD } from './hud';
import { Missions, Milestones } from './missions';
import { Save } from './save';
import { PostProcessing } from './post-processing';
import { PostFX } from './postfx';
import { preloadCC0Models } from './cc0-models';
import { multiplayer, type MultiplayerSession } from './net/MultiplayerSession';
import type { EditEntry, PlayerSnap } from './net/protocol';

// Pinia stores (accessed lazily after pinia is initialized)
import { useGameStore } from './stores/gameStore';
import { usePlayerStore } from './stores/playerStore';
import { useInventoryStore } from './stores/inventoryStore';
import { useShipStore } from './stores/shipStore';
import { useHudStore } from './stores/hudStore';
import { useMissionsStore } from './stores/missionsStore';
import { useMilestonesStore } from './stores/milestonesStore';

// --- Input singleton ---

export const Input: InputState = {
  keys: {},
  buttons: {},
  dx: 0, dy: 0, dxSmooth: 0,
  isTouchDevice: false,
  moveX: 0, moveY: 0, moveActive: false,
  touchSprint: false,
  jumpPressed: false,
  init(game: Game): void {
    this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    document.body.classList.toggle('touch-device', this.isTouchDevice);
    addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      game.onKey(e.code, e);
    });
    addEventListener('keyup', (e: KeyboardEvent) => { this.keys[e.code] = false; });

    addEventListener('mousedown', (e: MouseEvent) => {
      if (document.pointerLockElement) this.buttons[e.button] = true;
      game.onMouseDown(e);
    });
    addEventListener('mouseup', (e: MouseEvent) => { this.buttons[e.button] = false; });
    addEventListener('mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement) {
        this.dx += e.movementX;
        this.dy += e.movementY;
        this.dxSmooth = U.lerp(this.dxSmooth, e.movementX, 0.2);
      }
    });
    addEventListener('wheel', (e: WheelEvent) => game.onWheel(e));
    addEventListener('contextmenu', (e: Event) => e.preventDefault());
    addEventListener('blur', () => {
      this.keys = {};
      this.buttons = {};
      this.moveX = this.moveY = 0;
      this.moveActive = false;
      this.touchSprint = false;
      this.jumpPressed = false;
    });
  }
};

// --- Game class (engine only, no DOM UI) ---

export class Game {
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
  renderer!: THREE.WebGPURenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  atlas!: TextureAtlas;
  clock!: THREE.Timer;
  seed!: number;
  palIdx!: number;
  palette!: Palette;
  planetName!: string;
  world!: World;
  sky!: Sky;
  fx!: FX;
  fauna!: Fauna;
  inv!: Inventory;
  ship!: Ship;
  hud!: HUD;
  missions!: Missions;
  milestones!: Milestones;
  player!: Player;
  spawnPoint!: { x: number; z: number };
  postProc!: PostProcessing;
  postFx!: PostFX;
  ready: Promise<void>;
  missionT?: number;
  stormLeft?: number;
  /** Active public multiplayer session (no server save hosting). */
  mp: MultiplayerSession | null = null;
  multiplayer = false;
  private _prevX = 0;
  private _prevZ = 0;
  private _syncFrame = 0;
  private _worldUpdateT = 0;
  private pendingLoad: {
    seed: number;
    palIdx: number;
    saveData: SaveData | null;
    mpEdits?: EditEntry[];
    mpTime?: number;
    mpSpawn?: { x: number; y: number; z: number; yaw: number };
    mpPlayers?: PlayerSnap[];
  } | null = null;
  private pendingMpEdits: EditEntry[] | null = null;
  private pendingMpTime: number | null = null;
  private pendingMpSpawn: { x: number; y: number; z: number; yaw: number } | null = null;
  private pendingMpPlayers: PlayerSnap[] | null = null;

  // Pinia store refs (lazy init)
  private _stores: ReturnType<typeof this._getStores> | null = null;

  private _getStores() {
    return {
      game: useGameStore(),
      player: usePlayerStore(),
      inventory: useInventoryStore(),
      ship: useShipStore(),
      hud: useHudStore(),
      missions: useMissionsStore(),
      milestones: useMilestonesStore(),
    };
  }

  get stores() {
    if (!this._stores) this._stores = this._getStores();
    return this._stores;
  }

  constructor() {
    this.state = 'title';
    this.settings = Save.loadSettings();
    this.audio = new AudioEngine();
    this.time = 0;
    this.playTime = 0;
    this.timeUniform = { value: 0 };
    this.stormActive = false;
    this.stormFactor = 0;
    this.stormTimer = U.rand(150, 320);
    this.discoveries = { planets: [], entries: [] };
    this.autoSaveT = 0;
    this.input = Input;
    Input.init(this);
    // Prefer visibilitychange over beforeunload alone — OPFS writes often abort on unload.
    // Multiplayer sessions do not write OPFS (server does not host saves either).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.state === 'play' && !this.multiplayer) {
        void Save.save(this);
      }
    });
    this.ready = this.initRenderer().then(() => { this.loop(); });
  }

  /**
   * Open the current local world as a public host room.
   * Map + player data stay on this machine; CF only lists/relays.
   */
  async hostPublicMultiplayer(): Promise<void> {
    if (this.state !== 'play' && this.state !== 'pause') {
      throw new Error('请先进入游戏再开放联机');
    }
    this.multiplayer = true;
    this.mp = multiplayer;
    multiplayer.bind(this);
    try {
      const welcomeP = multiplayer.waitWelcome(12000);
      await multiplayer.hostPublic(this);
      await welcomeP;
      if (this.state === 'pause') this.togglePause(false);
      this.stores.hud.addNotification(`已开放联机 · ${multiplayer.roomId}`, 'success');
    } catch (e) {
      this.multiplayer = false;
      this.mp = null;
      multiplayer.leave();
      throw e;
    }
  }

  /**
   * Join a host's public room and restore map data from the host.
   */
  async joinPublicMultiplayer(roomId: string): Promise<void> {
    this.audio.ensure();
    this.audio.initLoops();
    this.multiplayer = true;
    this.mp = multiplayer;
    multiplayer.bind(this);
    try {
      const snap = await multiplayer.joinAsGuest(this, roomId);
      this.applyMpSnapshot(snap, `已加入 · ${multiplayer.roomId} · ${snap.planetName}`);
    } catch (e) {
      this.multiplayer = false;
      this.mp = null;
      multiplayer.leave();
      this.clearPendingMp();
      throw e;
    }
  }

  /**
   * Join the official DO server (R2-backed world). Map edits persist in the cloud.
   */
  async joinOfficialMultiplayer(): Promise<void> {
    this.audio.ensure();
    this.audio.initLoops();
    this.multiplayer = true;
    this.mp = multiplayer;
    multiplayer.bind(this);
    try {
      const snap = await multiplayer.joinOfficial(this);
      this.applyMpSnapshot(snap, `已进入官方星域 · ${snap.planetName}`);
    } catch (e) {
      this.multiplayer = false;
      this.mp = null;
      multiplayer.leave();
      this.clearPendingMp();
      throw e;
    }
  }

  private applyMpSnapshot(
    snap: {
      edits: import('./net/protocol').EditEntry[];
      time: number;
      players: import('./net/protocol').PlayerSnap[];
      hostId: string;
      planetName: string;
      seed: number;
      palIdx: number;
    },
    notify: string,
  ): void {
    this.pendingMpEdits = snap.edits;
    this.pendingMpTime = typeof snap.time === 'number' ? snap.time : null;
    this.pendingMpPlayers = snap.players || [];
    const hostSnap =
      snap.players.find((p) => p.id === snap.hostId && p.id !== 'server') ||
      snap.players.find((p) => p.id !== multiplayer.myId) ||
      null;
    this.pendingMpSpawn = hostSnap
      ? { x: hostSnap.x, y: hostSnap.y, z: hostSnap.z, yaw: hostSnap.yaw }
      : null;
    this.planetName = snap.planetName;
    this.beginLoad(snap.seed, snap.palIdx, null);
    this.stores.hud.addNotification(notify, 'success');
  }

  private clearPendingMp(): void {
    this.pendingMpEdits = null;
    this.pendingMpTime = null;
    this.pendingMpSpawn = null;
    this.pendingMpPlayers = null;
  }

  leaveMultiplayer(): void {
    multiplayer.leave();
    this.mp = null;
    this.multiplayer = false;
    this.clearPendingMp();
  }

  /** Clear run progress so a second new-game / load does not inherit prior inventory, quests, etc. */
  private resetRunState(): void {
    const s = this.stores;
    this.playTime = 0;
    this.autoSaveT = 0;
    this.stormActive = false;
    this.stormFactor = 0;
    this.stormTimer = U.rand(150, 320);
    this.stormLeft = undefined;
    this.discoveries = { planets: [], entries: [] };
    s.game.discoveries = this.discoveries;
    s.game.playTime = 0;
    s.game.stormActive = false;
    s.game.stormFactor = 0;

    if (this.inv) {
      this.inv.slots = new Array(24).fill(null);
      this.inv.hotbar = new Array(9).fill(null);
      this.inv.sel = 0;
      this.inv.units = 0;
      this.inv.open = false;
      this.inv.tab = 'items';
      this.inv.drag = null;
      this.inv.selRecipe = null;
      this.inv.syncStore();
    }
    if (this.missions) {
      this.missions.idx = 0;
      this.missions.scannerUnlocked = false;
      this.missions.shelterCount = 0;
      this.missions.launched = false;
      this.missions.sodiumUsed = 0;
      this.missions.oxygenUsed = 0;
    }
    if (this.milestones) {
      this.milestones.stats = { walk: 0, mined: 0, scans: 0, placed: 0, warps: 0, crafted: 0, survive: 0 };
      this.milestones.awarded = {};
    }
    if (this.player) {
      this.player.dead = false;
      this.player.inShip = false;
      this.player.hp = 100;
      this.player.hazard = 50;
      this.player.ls = 85;
      this.player.jetFuel = 100;
      this.player.vel.set(0, 0, 0);
      this.player.heat = 0;
      this.player.overheated = 0;
      this.player.mining = null;
      this.player.mineProgress = 0;
      this.player.visor = false;
      this.player.flashOn = false;
      if (this.player.flashlight) this.player.flashlight.intensity = 0;
    }
    if (this.ship) {
      this.ship.flying = false;
      this.ship.landing = false;
      this.ship.flyTime = 0;
      this.ship.speed = 0;
      this.ship.throttle = 0.4;
      this.ship.fuel = 0;
      this.ship.comps.thruster.broken = true;
      this.ship.comps.pulse.broken = true;
      this.ship.open = false;
      this.ship.updateCrashPose();
      this.ship.syncStore();
    }
    s.player.dead = false;
    s.inventory.open = false;
    s.ship.open = false;
  }

  async initRenderer(): Promise<void> {
    const canvas = document.getElementById('game-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game canvas is missing');

    // WebGPURenderer automatically selects the WebGL2 backend when WebGPU is
    // unavailable, so a legacy WebGLRenderer branch is no longer required.
    // Omit powerPreference: Chromium on Windows ignores it and logs a noisy
    // console warning (crbug.com/369219127) when it is passed to requestAdapter().
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    await this.renderer.init();

    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ACES exposure balanced with soft TSL sky + CFG.CINEMATIC gain≈1.0.
    // ~0.9: terrain readable, sky not clipped; pair with CINEMATIC.clip 1.1.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;

    // Shadow maps
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#cfe8f0', 30, 120);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.08, 1600);
    this.scene.add(this.camera);
    this.atlas = new TextureAtlas();
    this.postProc = new PostProcessing(this);
    this.postFx = new PostFX();
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.postProc.resize(innerWidth, innerHeight);
      // CSM cascade ortho bounds depend on the active camera projection.
      if (this.sky) this.sky.updateCsmFrustums();
    });
    this.clock = new THREE.Timer();
  }

  applySettings(): void {
    this.audio.setVol('master', this.settings.master / 100);
    this.audio.setVol('music', this.settings.music / 100);
    this.audio.setVol('sfx', this.settings.sfx / 100);
    this.audio.applyVol();
    if (this.camera && (!this.player || !this.player.visor)) {
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }
    // FOV / render-distance changes affect cascade splits and maxFar.
    if (this.sky) this.sky.updateCsmFrustums();
    if (this.postProc?.applySettings) this.postProc.applySettings();
  }

  uiOpen(): boolean {
    const s = this.stores;
    return (s.inventory.open) || (s.ship.open) || this.state === 'pause' || this.state === 'dead';
  }

  requestPointerLock(): void {
    if (Input.isTouchDevice) return;
    if (this.state === 'play' && !this.uiOpen()) {
      const canvas = document.getElementById('game-canvas');
      if (canvas instanceof HTMLCanvasElement) {
        try { canvas.requestPointerLock(); } catch { /* requires user gesture */ }
      }
    }
  }
  exitPointerLock(): void { if (document.pointerLockElement) document.exitPointerLock(); }

  newGame(seedInput?: string): void {
    this.leaveMultiplayer();
    this.audio.ensure();
    this.audio.initLoops();
    const seedStr = (seedInput || '').trim();
    const seed = seedStr ? U.seedFromString(seedStr) : Math.floor(Math.random() * 1e9);
    this.beginLoad(seed, 0, null);
  }

  async continueGame(): Promise<void> {
    this.leaveMultiplayer();
    this.audio.ensure();
    this.audio.initLoops();
    const d = await Save.load();
    if (!d) return this.newGame();
    this.beginLoad(d.seed, d.palIdx, d);
  }

  beginLoad(seed: number, palIdx: number, saveData: SaveData | null): void {
    this.state = 'loading';
    const s = this.stores;
    s.game.state = 'loading';
    s.game.loadProgress = 0;
    s.game.modelLoadFailures = [];
    this.seed = seed;
    this.palIdx = palIdx;
    this.palette = PALETTES[palIdx % PALETTES.length];
    s.game.seed = seed;
    s.game.palIdx = this.palIdx;
    s.game.palette = this.palette;
    const rng = U.mulberry32(seed);
    if (!this.multiplayer || !this.planetName) {
      this.planetName = saveData ? saveData.planetName : U.planetName(rng);
    }
    s.game.planetName = this.planetName;
    this.pendingLoad = {
      seed,
      palIdx: this.palIdx,
      saveData,
      mpEdits: this.pendingMpEdits || undefined,
      mpTime: this.pendingMpTime ?? undefined,
      mpSpawn: this.pendingMpSpawn || undefined,
      mpPlayers: this.pendingMpPlayers || undefined,
    };
    void this.verifyRemoteModels();
  }

  private async verifyRemoteModels(): Promise<void> {
    const failures = await preloadCC0Models();
    const pending = this.pendingLoad;
    if (!pending) return;
    if (failures.length > 0) {
      this.stores.game.modelLoadFailures = failures.map(failure => `${failure.label}: ${failure.reason}`);
      this.state = 'model-error';
      this.stores.game.state = 'model-error';
      return;
    }
    this.startWorldLoad(pending.seed, pending.saveData);
  }

  continueWithFailedModels(): void {
    const pending = this.pendingLoad;
    if (!pending) return;
    this.state = 'loading';
    this.stores.game.state = 'loading';
    this.stores.game.loadProgress = 0;
    this.startWorldLoad(pending.seed, pending.saveData);
  }

  private startWorldLoad(seed: number, saveData: SaveData | null): void {
    const s = this.stores;
    this.atlas.build(this.palette, seed);
    if (!this.world) {
      this.world = new World(this);
      this.sky = new Sky(this);
      this.fx = new FX(this);
      this.fauna = new Fauna(this);
      this.inv = new Inventory(this);
      this.ship = new Ship(this);
      this.hud = new HUD(this);
      this.missions = new Missions(this);
      this.milestones = new Milestones(this);
    }
    this.world.setPlanet(seed, this.palette);
    this.sky.setPalette(this.palette);
    // Always clear prior run before applying a save or starting fresh.
    this.resetRunState();
    if (saveData) {
      for (const k in saveData.edits) {
        const arr = saveData.edits[k];
        const m = new Map<number, number>();
        for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
        this.world.edits.set(k, m);
      }
      this.inv.deserialize(saveData.inv);
      this.missions.deserialize(saveData.missions);
      this.milestones.deserialize(saveData.milestones);
      this.discoveries = saveData.discoveries
        ? {
            planets: saveData.discoveries.planets.map(p => ({ ...p })),
            entries: saveData.discoveries.entries.map(e => ({ ...e })),
          }
        : { planets: [], entries: [] };
      s.game.discoveries = this.discoveries;
      this.sky.t = saveData.time || 0.3;
      this.playTime = saveData.playTime || 0;
      s.game.playTime = this.playTime;
    } else {
      const mpTime = this.pendingLoad?.mpTime;
      this.sky.t = typeof mpTime === 'number' ? mpTime : 0.28;
      this.playTime = 0;
      s.game.playTime = 0;
      // Session-only multiplayer edits restored from host (not server-hosted).
      const mpEdits = this.pendingLoad?.mpEdits;
      if (mpEdits && mpEdits.length) {
        for (const e of mpEdits) {
          const k = `${e.cx},${e.cz}`;
          let m = this.world.edits.get(k);
          if (!m) {
            m = new Map();
            this.world.edits.set(k, m);
          }
          m.set(e.idx, e.id);
        }
      }
    }
    const mpSpawn = this.pendingLoad?.mpSpawn;
    const land = mpSpawn
      ? { x: Math.floor(mpSpawn.x), z: Math.floor(mpSpawn.z) }
      : this.world.findLand(8, 8);
    const spawnX = land.x, spawnZ = land.z;
    this.spawnPoint = { x: spawnX, z: spawnZ };
    if (!this.player) this.player = new Player(this);
    this.player.crackMat.map = this.atlas.texture;
    let frame = 0;
    const step = (): void => {
      const px = saveData ? saveData.player.pos[0] : spawnX;
      const pz = saveData ? saveData.player.pos[2] : spawnZ;
      this.world.update(px, pz, 24);
      const prog = this.world.pregenProgress(px, pz);
      s.game.loadProgress = prog * 100;
      frame++;
      if (prog >= 1 || frame > 600) this.finishLoad(saveData);
      else requestAnimationFrame(step);
    };
    step();
  }
  finishLoad(saveData: SaveData | null): void {
    const s = this.stores;
    const sx = this.spawnPoint.x, sz = this.spawnPoint.z;
    if (saveData) {
      this.player.deserialize(saveData.player);
      this.ship.deserialize(saveData.ship);
      this.spawnPoint = { x: this.player.pos.x, z: this.player.pos.z };
    } else {
      const mpSpawn = this.pendingLoad?.mpSpawn;
      const gy = this.world.topSolidY(sx, sz);
      // Guests spawn near the host; offset slightly so models don't overlap.
      const ox = this.multiplayer && mpSpawn ? 2.5 : 0.5;
      const oz = this.multiplayer && mpSpawn ? 2.5 : 0.5;
      const py = mpSpawn ? Math.max(mpSpawn.y, gy + 1.2) : gy + 1.2;
      this.player.pos.set(sx + ox, py, sz + oz);
      this.player.yaw = mpSpawn ? mpSpawn.yaw : Math.PI * 0.25;
      this.player.pitch = 0;
      this.player.hp = 100;
      this.player.hazard = 50;
      this.player.ls = 85;
      this.player.dead = false;
      this.player.inShip = false;
      this.ship.placeAt(sx + 14, sz + 9);
      this.inv.add('carbon', 10);
      this.discoveries = {
        planets: [{ name: this.planetName, climate: this.palette.climate, visited: 1 }],
        entries: [],
      };
      s.game.discoveries = this.discoveries;
    }
    this.fauna.spawnPlanet(this.seed, this.palette);
    this.syncPlayerStore();
    this.inv.syncStore();
    this.ship.syncStore();
    this.missions.updateCard();
    s.game.planetName = this.planetName;
    this.autoSaveT = 0;

    // Restore remote peers from host snapshot (late-join).
    const mpPlayers = this.pendingLoad?.mpPlayers;
    if (this.multiplayer && this.mp && mpPlayers?.length) {
      multiplayer.seedRemotesFromSnapshot(mpPlayers);
    }
    this.pendingMpEdits = null;
    this.pendingMpTime = null;
    this.pendingMpSpawn = null;
    this.pendingMpPlayers = null;

    if (this.multiplayer) {
      // Public co-op: skip typewriter intro and drop into play.
      if (this.mp) this.mp.bind(this);
      this.startPlay();
      {
        const mpMode = multiplayer.mode;
        const tip =
          mpMode === 'official'
            ? '官方星域 · DO 权威 · 地图存档于云端'
            : this.mp?.isHost
              ? '已开放联机 · 本机托管地图'
              : '已从房主同步地图 · 云端不存档';
        s.hud.addNotification(tip, 'info');
      }
    } else if (!saveData) this.playIntro();
    else this.startPlay();
  }

  playIntro(): void {
    const s = this.stores;
    this.state = 'intro';
    s.game.state = 'intro';
    const lines = [
      { text: '//: 远征协议 0x2F —— 信号重构中' },
      { text: '生命维持系统 ………… 在线' },
      { text: '危险防护模块 ………… 受损', cls: 'warn' },
      { text: '星舰「拂晓之羽」 …… 坠毁信标已激活', cls: 'warn' },
      { text: '坐标锁定：' + this.planetName + ' · ' + this.palette.climate },
      { text: '远行者，醒来。' }
    ];
    s.game.introLines = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      timers.push(setTimeout(() => {
        s.game.introLines.push(line);
        this.audio.notify(line.cls === 'warn' ? 'danger' : 'info');
      }, i * 900));
    }
    const finish = (): void => {
      timers.forEach(clearTimeout);
      s.game.introLines = [];
      this.startPlay();
      setTimeout(() => {
        s.hud.showPlanetCard(this.planetInfo());
        s.hud.addNotification('已抵达 ' + this.planetName, 'info');
        this.audio.alarm();
      }, 600);
    };
    // Click to skip or auto-advance
    addEventListener('click', finish, { once: true });
    timers.push(setTimeout(finish, 6400));
  }

  planetInfo(): PlanetInfo {
    const pal = this.palette;
    return {
      name: this.planetName,
      climate: pal.climate,
      flora: pal.floraLevel,
      fauna: this.fauna.speciesList.length + ' 种',
      storm: pal.stormLevel,
      res: ['ferrite', 'carbon', 'sodium', 'dihydrogen', 'oxygen', 'copper']
    };
  }

  startPlay(): void {
    const s = this.stores;
    this.state = 'play';
    s.game.state = 'play';
    this.audio.ensure();
    this.audio.initLoops();
    this.audio.setLoop('wind', true, 0.35, 2);
    this.audio.startMusic('game');
    this.missions.updateCard();
    this.requestPointerLock();
    document.addEventListener('pointerlockchange', () => {
      if (!Input.isTouchDevice && !document.pointerLockElement && this.state === 'play' && !this.uiOpen()) {
        this.togglePause(true);
      }
    });
  }

  togglePause(on?: boolean): void {
    if (this.state !== 'play' && this.state !== 'pause') return;
    const s = this.stores;
    const want = on !== undefined ? on : this.state === 'play';
    if (want) {
      this.state = 'pause';
      s.game.state = 'pause';
      this.exitPointerLock();
      this.audio.uiOpen();
    } else {
      this.state = 'play';
      s.game.state = 'play';
      this.audio.uiClose();
      this.requestPointerLock();
    }
  }

  onKey(code: string, e: KeyboardEvent): void {
    if (this.state === 'title') return;
    const s = this.stores;
    if (code === 'Escape') {
      if (s.inventory.open) { s.inventory.open = false; return; }
      if (s.ship.open) { s.ship.open = false; this.requestPointerLock(); return; }
      if (this.state === 'play' || this.state === 'pause') this.togglePause();
      return;
    }
    if (this.state !== 'play') return;
    if (code === 'Tab') {
      e.preventDefault();
      if (!this.player.inShip) s.inventory.open = !s.inventory.open;
      if (s.inventory.open) this.exitPointerLock();
      else this.requestPointerLock();
      return;
    }
    if (this.uiOpen()) return;
    if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5));
      if (n >= 1 && n <= 9) {
        s.inventory.sel = n - 1;
        this.audio.uiHover();
      }
    }
    if (this.player.inShip) {
      if (code === 'KeyE' && !this.ship.landing) this.ship.tryLand();
      if (code === 'KeyJ') this.ship.tryWarp();
      return;
    }
    if (code === 'KeyC') this.player.doScan();
    if (code === 'KeyF') this.player.toggleVisor();
    if (code === 'KeyT') {
      this.player.flashOn = !this.player.flashOn;
      this.player.flashlight.intensity = this.player.flashOn ? 1.4 : 0;
      s.player.flashOn = this.player.flashOn;
      this.audio.uiClick();
    }
  }

  onMouseDown(e: MouseEvent): void {
    if (this.state !== 'play' || this.uiOpen()) return;
    if (!document.pointerLockElement) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 2 && !this.player.inShip && !this.player.visor) this.player.placeBlock();
  }

  onWheel(e: WheelEvent): void {
    if (this.state !== 'play' || this.uiOpen() || this.player.inShip) return;
    const s = this.stores;
    const dir = e.deltaY > 0 ? 1 : -1;
    s.inventory.sel = (s.inventory.sel + dir + 9) % 9;
    this.audio.uiHover();
  }

  updateStorm(dt: number): void {
    const pal = this.palette;
    const s = this.stores;
    if (this.stormActive) {
      this.stormFactor = Math.min(1, this.stormFactor + dt / 3);
      this.stormLeft! -= dt;
      if (Math.random() < dt * 0.5) {
        const p = this.player.pos;
        this.fx.spawn(p.x + U.rand(-14, 14), p.y + U.rand(1, 7), p.z + U.rand(-14, 14), { n: 2, col: U.shade(pal.fogDay, 0.9), speed: 4, life: 0.9, grav: 0.5 });
      }
      if (Math.random() < dt * 0.05) this.audio.thunder();
      if (this.stormLeft! <= 0) {
        this.stormActive = false;
        s.game.stormActive = false;
        this.audio.setLoop('storm', false, 0, 2);
        s.hud.addNotification('风暴正在消散', 'info');
        this.stormTimer = U.rand(200, 420);
      }
    } else {
      this.stormFactor = Math.max(0, this.stormFactor - dt / 4);
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        if (Math.random() < pal.storm.chance) {
          this.stormActive = true;
          s.game.stormActive = true;
          this.stormLeft = U.rand(45, 80);
          s.hud.addNotification('警告：' + pal.storm.label + ' 来袭 —— 寻找掩体！', 'danger');
          this.audio.alarm();
          this.audio.setLoop('storm', true, 0.8, 3);
        } else this.stormTimer = U.rand(120, 260);
      }
    }
    s.game.stormFactor = this.stormFactor;
  }

  startWarp(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const g = this;
    const s = this.stores;
    this.state = 'warp';
    s.game.state = 'warp';
    this.audio.warpCharge();
    s.hud.addNotification('跃迁引擎充能中…', 'info');
    setTimeout(() => {
      g.audio.warpBoom();
      g.fx.startWarp();
      g.audio.setLoop('ship', false);
      setTimeout(() => {
        const newSeed = Math.floor(Math.random() * 1e9);
        const newPal = U.randi(0, PALETTES.length - 1);
        g.seed = newSeed;
        g.palIdx = newPal;
        g.palette = PALETTES[newPal];
        s.game.palette = g.palette;
        const rng = U.mulberry32(newSeed);
        g.planetName = U.planetName(rng);
        s.game.planetName = g.planetName;
        g.atlas.build(g.palette, newSeed);
        g.world.setPlanet(newSeed, g.palette);
        g.sky.setPalette(g.palette);
        g.player.crackMat.map = g.atlas.texture;
        g.player.lastHandItem = null;
        g.atlas.iconCache = {};
        const landW = g.world.findLand(8, 8);
        const sx = landW.x, sz = landW.z;
        g.spawnPoint = { x: sx, z: sz };
        let frames = 0;
        const pregen = (): void => {
          g.world.update(sx, sz, 20);
          frames++;
          if (g.world.pregenProgress(sx, sz) >= 0.9 || frames > 400) {
            g.fauna.spawnPlanet(newSeed, g.palette);
            g.ship.group.position.set(sx, g.world.surfaceY(sx, sz) + 30, sz);
            g.ship.yaw = U.rand(0, 6.28);
            g.ship.pitch = 0;
            g.ship.speed = 30;
            g.ship.throttle = 0.5;
            g.ship.flying = true;
            g.fx.stopWarp();
            g.state = 'play';
            s.game.state = 'play';
            g.audio.setLoop('ship', true, 0.9, 0.5);
            g.audio.warpBoom();
            g.discoveries.planets.push({ name: g.planetName, climate: g.palette.climate, visited: 1 });
            s.game.discoveries = g.discoveries;
            g.milestones.addStat('warps', 1);
            setTimeout(() => {
              s.hud.showPlanetCard(g.planetInfo());
              s.hud.addNotification('抵达新星球：' + g.planetName, 'success');
            }, 500);
          } else requestAnimationFrame(pregen);
        };
        pregen();
      }, 2600);
    }, 2200);
  }

  onPlayerDeath(_cause?: string): void {
    const s = this.stores;
    this.state = 'dead';
    s.game.state = 'dead';
    this.exitPointerLock();
    this.audio.setLoop('wind', false);
  }

  respawn(): void {
    const s = this.stores;
    this.player.respawn();
    this.state = 'play';
    s.game.state = 'play';
    s.player.dead = false;
    this.audio.setLoop('wind', true, 0.35, 2);
    this.requestPointerLock();
    s.hud.addNotification('重构完成 —— 物品完好无损', 'info');
  }

  syncPlayerStore(): void {
    const s = this.stores;
    s.player.hp = this.player.hp;
    s.player.hazard = this.player.hazard;
    s.player.ls = this.player.ls;
    s.player.jetFuel = this.player.jetFuel;
    s.player.inShip = this.player.inShip;
    s.player.dead = this.player.dead;
    s.player.heat = this.player.heat;
    s.player.overheated = this.player.overheated;
    s.player.mineProgress = this.player.mineProgress;
    s.player.visor = this.player.visor;
    s.player.flashOn = this.player.flashOn;
    s.player.onGround = this.player.onGround;
    s.player.inWater = this.player.inWater;
    s.player.headInWater = this.player.headInWater;
    s.player.sheltered = this.player.sheltered;
    s.game.playTime = this.playTime;
    s.game.stormFactor = this.stormFactor;
    s.game.stormActive = this.stormActive;
  }

  loop(): void {
    requestAnimationFrame(() => this.loop());
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.08);
    this.time += dt;
    this.timeUniform.value = this.time;

    if (this.state === 'play' || this.state === 'warp' || this.state === 'dead' || this.state === 'pause') {
      if (this.state === 'play') {
        this.playTime += dt;
        this._prevX = this.player.pos.x;
        this._prevZ = this.player.pos.z;
        this.player.update(dt);
        if (!this.player.inShip) {
          const moved = U.dist2(this._prevX, this._prevZ, this.player.pos.x, this.player.pos.z);
          if (moved < 2) this.milestones.addStat('walk', moved);
        }
        this.ship.update(dt);
        this.fauna.update(dt);
        this.updateStorm(dt);
        this.milestones.tickTime(dt);
        this.missionT = (this.missionT || 0) - dt;
        if (this.missionT <= 0) { this.missionT = 0.5; this.missions.tick(); }
        this.autoSaveT += dt;
        if (!this.multiplayer && this.autoSaveT > 60) {
          this.autoSaveT = 0;
          Save.save(this).then(ok => {
            if (ok) this.stores.hud.addNotification('自动存档完成', 'info');
          }).catch(() => {});
        }
        if (this.mp?.active) this.mp.update(dt);
        // Sync to Pinia every 3 frames to reduce reactive setter overhead
        this._syncFrame++;
        if (this._syncFrame >= 3) { this._syncFrame = 0; this.syncPlayerStore(); }
        if (this.postFx) this.postFx.update(this.player.hp, this.player.headInWater);
      }
      this._worldUpdateT += dt;
      if (this._worldUpdateT >= 1 / 30) {
        this._worldUpdateT = 0;
        this.world.update(this.player.pos.x, this.player.pos.z, 6);
      }
      this.sky.update(this.state === 'pause' ? 0 : dt);
      this.world.updateWaterFresnel();
      this.fx.update(dt);
      this.fx.applyShake(this.camera);
      this.postProc.render();
    }
  }
}
