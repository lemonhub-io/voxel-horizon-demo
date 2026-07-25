// ============================================================
// main.ts — Vite entry point: Game class, Input, bootstrap
// ============================================================

import type { InputState, Settings, SaveData, Palette, PlanetInfo, Discoveries } from './types';
import { U } from './utils';
import { PALETTES, HAZ_ICONS } from './config';
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

// --- Input singleton ---

export const Input: InputState = {
  keys: {} as Record<string, boolean>,
  buttons: {} as Record<number, boolean>,
  dx: 0, dy: 0, dxSmooth: 0,
  init(game: Game): void {
    addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
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
    addEventListener('blur', () => { this.keys = {} as Record<string, boolean>; this.buttons = {} as Record<number, boolean>; });
  }
};

// --- Game class ---

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
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  atlas!: TextureAtlas;
  clock!: THREE.Clock;
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
  missionT?: number;
  stormLeft?: number;
  _lastHover?: HTMLElement | null;

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
    this.initRenderer();
    this.initTitle();
    this.bindUI();
    Input.init(this);
    this.loop();
  }

  initRenderer(): void {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#cfe8f0', 30, 120);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.08, 1600);
    this.scene.add(this.camera);
    this.atlas = new TextureAtlas();
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
    this.clock = new THREE.Clock();
  }

  initTitle(): void {
    const cvs = document.getElementById('title-stars') as HTMLCanvasElement;
    cvs.width = innerWidth; cvs.height = innerHeight;
    const ctx = cvs.getContext('2d')!;
    const stars: { x: number; y: number; r: number; p: number; s: number }[] = [];
    for (let i = 0; i < 240; i++) stars.push({ x: Math.random() * cvs.width, y: Math.random() * cvs.height, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.5 + Math.random() * 2 });
    const draw = (): void => {
      if (this.state !== 'title') return;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const t = performance.now() / 1000;
      for (const s of stars) {
        const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
        ctx.fillStyle = `rgba(220,238,248,${a})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      requestAnimationFrame(draw);
    };
    draw();
    if (Save.load()) document.getElementById('btn-continue')!.classList.remove('hidden');
  }

  bindUI(): void {
    const $ = (id: string): HTMLElement => document.getElementById(id)!;
    document.addEventListener('mouseover', (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('.btn, .inv-tab, .t-btn') as HTMLElement | null;
      if (b && b !== this._lastHover) { this._lastHover = b; this.audio.ensure(); this.audio.uiHover(); }
      if (!b) this._lastHover = null;
    });
    const clickable = (): void => { this.audio.ensure(); this.audio.uiClick(); };
    $('btn-new').addEventListener('click', () => { clickable(); this.newGame(); });
    $('btn-continue').addEventListener('click', () => { clickable(); this.continueGame(); });
    $('btn-help').addEventListener('click', () => { clickable(); this.showScreen('help-screen'); });
    $('btn-settings').addEventListener('click', () => { clickable(); this.openSettings(); });
    $('btn-help-back').addEventListener('click', () => { clickable(); this.hideScreen('help-screen'); });
    $('btn-set-back').addEventListener('click', () => { clickable(); this.closeSettings(); });
    $('btn-resume').addEventListener('click', () => { clickable(); this.togglePause(false); });
    $('btn-save').addEventListener('click', () => {
      clickable();
      if (Save.save(this)) this.hud.notify('进度已保存', 'success');
      this.togglePause(false);
    });
    $('btn-help2').addEventListener('click', () => { clickable(); this.showScreen('help-screen'); });
    $('btn-settings2').addEventListener('click', () => { clickable(); this.openSettings(); });
    $('btn-quit').addEventListener('click', () => { clickable(); Save.save(this); location.reload(); });
    $('btn-respawn').addEventListener('click', () => { clickable(); this.respawn(); });
    $('btn-wipe').addEventListener('click', () => {
      clickable();
      if (confirm('确定清除全部存档？')) { Save.clear(); location.reload(); }
    });
    const setBind = (id: string, key: keyof Settings, isCheck?: boolean): void => {
      const el = $(id) as HTMLInputElement;
      const span = el.parentElement!.querySelector('span:last-child');
      const upd = (): void => {
        if (isCheck) { (this.settings as unknown as Record<string, unknown>)[key] = el.checked; }
        else { (this.settings as unknown as Record<string, unknown>)[key] = parseFloat(el.value); if (span) span.textContent = el.value; }
        this.applySettings();
        Save.saveSettings(this.settings);
      };
      if (isCheck) el.checked = this.settings[key] as boolean;
      else { el.value = String(this.settings[key]); if (span) span.textContent = el.value; }
      el.addEventListener('input', upd);
      el.addEventListener('change', upd);
    };
    setBind('set-master', 'master');
    setBind('set-music', 'music');
    setBind('set-sfx', 'sfx');
    setBind('set-sens', 'sens');
    setBind('set-fov', 'fov');
    setBind('set-dist', 'dist');
    setBind('set-invert', 'invert', true);
    document.querySelector('#inv-screen')!.addEventListener('mousedown', ((e: MouseEvent) => {
      if ((e.target as HTMLElement).id === 'inv-screen') this.inv.toggle(false);
    }) as EventListener);
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
  }

  showScreen(id: string): void { document.getElementById(id)!.classList.remove('hidden'); }
  hideScreen(id: string): void { document.getElementById(id)!.classList.add('hidden'); }
  openSettings(): void { this.showScreen('settings-screen'); }
  closeSettings(): void { this.hideScreen('settings-screen'); }

  uiOpen(): boolean {
    return (this.inv && this.inv.open) || (this.ship && this.ship.open) || this.state === 'pause' || this.state === 'dead';
  }

  requestPointerLock(): void {
    if (this.state === 'play' && !this.uiOpen()) (document.getElementById('game-canvas') as HTMLCanvasElement).requestPointerLock();
  }
  exitPointerLock(): void { if (document.pointerLockElement) document.exitPointerLock(); }

  newGame(): void {
    this.audio.ensure();
    this.audio.initLoops();
    const seedStr = (document.getElementById('seed-input') as HTMLInputElement).value.trim();
    const seed = seedStr ? U.seedFromString(seedStr) : Math.floor(Math.random() * 1e9);
    this.beginLoad(seed, 0, null);
  }

  continueGame(): void {
    this.audio.ensure();
    this.audio.initLoops();
    const d = Save.load();
    if (!d) return this.newGame();
    this.beginLoad(d.seed, d.palIdx, d);
  }

  beginLoad(seed: number, palIdx: number, saveData: SaveData | null): void {
    this.state = 'loading';
    this.hideScreen('title-screen');
    this.showScreen('loading-screen');
    this.seed = seed;
    this.palIdx = palIdx;
    this.palette = PALETTES[palIdx];
    const rng = U.mulberry32(seed);
    this.planetName = saveData ? saveData.planetName : U.planetName(rng);
    document.getElementById('load-name')!.textContent = this.planetName;
    document.getElementById('load-sub')!.textContent = this.palette.climate + ' · 构建体素地貌…';

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
      this.inv.bindUI();
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
      this.sky.t = saveData.time || 0.3;
      this.playTime = saveData.playTime || 0;
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
      (document.getElementById('load-fill') as HTMLElement).style.width = (prog * 100) + '%';
      frame++;
      if (prog >= 1 || frame > 600) this.finishLoad(saveData);
      else requestAnimationFrame(step);
    };
    step();
  }

  finishLoad(saveData: SaveData | null): void {
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
      this.player.hazard = 25;
      this.player.ls = 75;
      this.inv.add('carbon', 10);
      this.discoveries.planets.push({ name: this.planetName, climate: this.palette.climate, visited: 1 });
    }
    this.fauna.spawnPlanet(this.seed, this.palette);
    this.hideScreen('loading-screen');
    this.hud.init();
    document.getElementById('hud-planet')!.textContent = this.planetName;
    this.inv.refresh();

    if (!saveData) this.playIntro();
    else this.startPlay();
  }

  playIntro(): void {
    this.state = 'intro';
    this.showScreen('intro-screen');
    const lines: [string, number, string?][] = [
      ['//: 远征协议 0x2F —— 信号重构中', 0],
      ['生命维持系统 ………… 在线', 900],
      ['危险防护模块 ………… 受损', 1800, 'warn'],
      ['星舰「拂晓之羽」 …… 坠毁信标已激活', 2700, 'warn'],
      ['坐标锁定：' + this.planetName + ' · ' + this.palette.climate, 3600],
      ['远行者，醒来。', 4700]
    ];
    const box = document.getElementById('intro-lines')!;
    box.innerHTML = '';
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [text, at, cls] of lines) {
      timers.push(setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'il' + (cls ? ' ' + cls : '');
        d.textContent = text;
        box.appendChild(d);
        this.audio.notify(cls === 'warn' ? 'danger' : 'info');
      }, at));
    }
    const finish = (): void => {
      timers.forEach(clearTimeout);
      document.getElementById('intro-screen')!.removeEventListener('click', finish);
      this.hideScreen('intro-screen');
      this.startPlay();
      setTimeout(() => {
        this.hud.planetCard(this.planetInfo());
        this.hud.notify('已抵达 ' + this.planetName, 'info');
        this.audio.alarm();
      }, 600);
    };
    document.getElementById('intro-screen')!.addEventListener('click', finish);
    timers.push(setTimeout(finish, 6400));
  }

  planetInfo(): PlanetInfo {
    const pal = this.palette;
    const res = ['ferrite', 'carbon', 'sodium', 'dihydrogen', 'oxygen', 'copper'];
    return {
      name: this.planetName,
      climate: pal.climate,
      flora: pal.floraLevel,
      fauna: this.fauna.speciesList.length + ' 种',
      storm: pal.stormLevel,
      res
    };
  }

  startPlay(): void {
    this.state = 'play';
    this.showScreen('hud');
    document.getElementById('hud')!.classList.remove('hidden');
    this.audio.ensure();
    this.audio.initLoops();
    this.audio.setLoop('wind', true, 0.35, 2);
    this.audio.startMusic('game');
    this.missions.updateCard();
    this.requestPointerLock();
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'play' && !this.uiOpen()) {
        this.togglePause(true);
      }
    });
  }

  togglePause(on?: boolean): void {
    if (this.state !== 'play' && this.state !== 'pause') return;
    const want = on !== undefined ? on : this.state === 'play';
    if (want) {
      this.state = 'pause';
      this.exitPointerLock();
      this.showScreen('pause-screen');
      const st = this.milestones.stats;
      document.getElementById('pause-stats')!.innerHTML =
        `星球：${this.planetName} · ${this.palette.climate}<br>` +
        `游玩时长：${U.fmtTime(this.playTime)} · 行走 ${Math.round(st.walk)}m<br>` +
        `采集 ${st.mined} · 建造 ${st.placed} · 分析 ${st.scans} · 跃迁 ${st.warps}<br>` +
        `记录点数：◈ ${this.inv.units}`;
      this.audio.uiOpen();
    } else {
      this.state = 'play';
      this.hideScreen('pause-screen');
      this.hideScreen('settings-screen');
      this.hideScreen('help-screen');
      this.audio.uiClose();
      this.requestPointerLock();
    }
  }

  onKey(code: string, e: KeyboardEvent): void {
    if (this.state === 'title') return;
    if (code === 'Escape') {
      if (this.inv && this.inv.open) return this.inv.toggle(false);
      if (this.ship && this.ship.open) { this.ship.closePanel(); this.requestPointerLock(); return; }
      if (!document.getElementById('settings-screen')!.classList.contains('hidden')) return this.closeSettings();
      if (!document.getElementById('help-screen')!.classList.contains('hidden')) return this.hideScreen('help-screen');
      if (this.state === 'play' || this.state === 'pause') this.togglePause();
      return;
    }
    if (this.state !== 'play') return;
    if (code === 'Tab') {
      e.preventDefault();
      if (!this.player.inShip) this.inv.toggle();
      return;
    }
    if (this.uiOpen()) return;
    if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5));
      if (n >= 1 && n <= 9) {
        this.inv.sel = n - 1;
        this.inv.refresh();
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
    const dir = e.deltaY > 0 ? 1 : -1;
    this.inv.sel = (this.inv.sel + dir + 9) % 9;
    this.inv.refresh();
    this.audio.uiHover();
  }

  updateStorm(dt: number): void {
    const pal = this.palette;
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
        this.audio.setLoop('storm', false, 0, 2);
        this.hud.notify('风暴正在消散', 'info');
        this.stormTimer = U.rand(200, 420);
      }
    } else {
      this.stormFactor = Math.max(0, this.stormFactor - dt / 4);
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        if (Math.random() < pal.storm.chance) {
          this.stormActive = true;
          this.stormLeft = U.rand(45, 80);
          this.hud.notify('警告：' + pal.storm.label + ' 来袭 —— 寻找掩体！', 'danger');
          this.audio.alarm();
          this.audio.setLoop('storm', true, 0.8, 3);
        } else this.stormTimer = U.rand(120, 260);
      }
    }
    (document.getElementById('storm-tint') as HTMLElement).style.opacity = String(this.stormFactor * 0.9);
  }

  startWarp(): void {
    const g = this;
    this.state = 'warp';
    this.audio.warpCharge();
    this.hud.notify('跃迁引擎充能中…', 'info');
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
        const rng = U.mulberry32(newSeed);
        g.planetName = U.planetName(rng);
        g.atlas.build(g.palette, newSeed);
        g.world.setPlanet(newSeed, g.palette);
        g.sky.setPalette(g.palette);
        g.player.crackMat.map = g.atlas.texture;
        g.player.lastHandItem = null;
        g.hud.clearMarkers();
        g.atlas.iconCache = {};
        g.inv.refresh();
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
            g.audio.setLoop('ship', true, 0.9, 0.5);
            g.audio.warpBoom();
            g.discoveries.planets.push({ name: g.planetName, climate: g.palette.climate, visited: 1 });
            g.milestones.addStat('warps', 1);
            document.getElementById('hud-planet')!.textContent = g.planetName;
            document.getElementById('haz-ico')!.textContent = HAZ_ICONS[g.palette.hazard.type] || '☢';
            setTimeout(() => {
              g.hud.planetCard(g.planetInfo());
              g.hud.notify('抵达新星球：' + g.planetName, 'success');
            }, 500);
          } else requestAnimationFrame(pregen);
        };
        pregen();
      }, 2600);
    }, 2200);
  }

  onPlayerDeath(cause?: string): void {
    this.state = 'dead';
    this.exitPointerLock();
    (document.querySelector('.d-sub') as HTMLElement).textContent = `远行者生命体征中断（${cause || '未知原因'}）—— 正在重构…`;
    this.showScreen('death-screen');
    this.audio.setLoop('wind', false);
  }

  respawn(): void {
    this.hideScreen('death-screen');
    this.player.respawn();
    this.state = 'play';
    this.audio.setLoop('wind', true, 0.35, 2);
    this.requestPointerLock();
    this.hud.notify('重构完成 —— 物品完好无损', 'info');
  }

  loop(): void {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.08);
    this.time += dt;
    this.timeUniform.value = this.time;

    if (this.state === 'play' || this.state === 'warp' || this.state === 'dead' || this.state === 'pause') {
      if (this.state === 'play') {
        this.playTime += dt;
        const prevPos = this.player.pos.clone();
        this.player.update(dt);
        if (!this.player.inShip) {
          const moved = U.dist2(prevPos.x, prevPos.z, this.player.pos.x, this.player.pos.z);
          if (moved < 2) this.milestones.addStat('walk', moved);
        }
        if (this.player.inShip && this.ship.flying) this.ship.update(dt);
        else this.ship.update(dt);
        this.fauna.update(dt);
        this.updateStorm(dt);
        this.milestones.tickTime(dt);
        this.missionT = (this.missionT || 0) - dt;
        if (this.missionT <= 0) { this.missionT = 0.5; this.missions.tick(); }
        this.autoSaveT += dt;
        if (this.autoSaveT > 60) { this.autoSaveT = 0; Save.save(this); this.hud.notify('自动存档完成', 'info'); }
        this.hud.update(dt);
      }
      this.world.update(this.player.pos.x, this.player.pos.z, 6);
      this.sky.update(this.state === 'pause' ? 0 : dt);
      this.fx.update(dt);
      this.fx.applyShake(this.camera);
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// --- Bootstrap ---

addEventListener('DOMContentLoaded', () => {
  if (!(window as unknown as Record<string, unknown>).THREE) {
    document.body.innerHTML = '<div style="color:#fff;font-family:sans-serif;padding:60px;text-align:center">无法加载 3D 引擎（three.js）。<br>请确认 libs/three.min.js 存在，或联网后刷新。</div>';
    return;
  }
  (window as unknown as Record<string, unknown>).game = new Game();
  addEventListener('beforeunload', () => {
    const w = window as unknown as Record<string, Game>;
    if (w.game && w.game.state === 'play') Save.save(w.game);
  });
});
