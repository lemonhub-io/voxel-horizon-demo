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

    // --- Mouse (always active; gated by pointerLockElement, NOT by isTouchDevice) ---
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
  private _prevX = 0;
  private _prevZ = 0;
  private _syncFrame = 0;
  private _worldUpdateT = 0;
  private pendingLoad: { seed: number; palIdx: number; saveData: SaveData | null } | null = null;

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
    this.ready = this.initRenderer().then(() => { this.loop(); });
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
    this.audio.ensure();
    this.audio.initLoops();
    const seedStr = (seedInput || '').trim();
    const seed = seedStr ? U.seedFromString(seedStr) : Math.floor(Math.random() * 1e9);
    this.beginLoad(seed, 0, null);
  }

  async continueGame(): Promise<void> {
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
    this.palette = PALETTES[palIdx];
    s.game.seed = seed;
    s.game.palIdx = palIdx;
    s.game.palette = this.palette;
    const rng = U.mulberry32(seed);
    this.planetName = saveData ? saveData.planetName : U.planetName(rng);
    s.game.planetName = this.planetName;
    this.pendingLoad = { seed, palIdx, saveData };
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
      this.discoveries = saveData.discoveries || this.discoveries;
      s.game.discoveries = this.discoveries;
      this.sky.t = saveData.time || 0.3;
      this.playTime = saveData.playTime || 0;
      s.game.playTime = this.playTime;
    }
    const land = this.world.findLand(8, 8);
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
      const gy = this.world.topSolidY(sx, sz);
      this.player.pos.set(sx + 0.5, gy + 1.2, sz + 0.5);
      this.player.yaw = Math.PI * 0.25;
      this.ship.placeAt(sx + 14, sz + 9);
      this.player.hazard = 50;
      this.player.ls = 85;
      this.inv.add('carbon', 10);
      this.discoveries.planets.push({ name: this.planetName, climate: this.palette.climate, visited: 1 });
      s.game.discoveries = this.discoveries;
    }
    this.fauna.spawnPlanet(this.seed, this.palette);
    this.syncPlayerStore();
    s.game.planetName = this.planetName;

    if (!saveData) this.playIntro();
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
        if (this.autoSaveT > 60) {
          this.autoSaveT = 0;
          Save.save(this).then(ok => {
            if (ok) this.stores.hud.addNotification('自动存档完成', 'info');
          }).catch(() => {});
        }
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
