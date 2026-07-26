// ============================================================
// hud.ts — HUD engine logic (compass canvas, markers)
// All DOM UI is handled by Vue components via Pinia stores
// ============================================================

import { U } from './utils';
import { B, ITEMS } from './config';
import type { Game, Marker, PlanetInfo } from './types';
import { useHudStore } from './stores/hudStore';

export class HUD {
  g: Game;
  markers: Marker[];
  compass: HTMLCanvasElement | null = null;
  cctx: CanvasRenderingContext2D | null = null;

  constructor(game: Game) {
    this.g = game;
    this.markers = [];
  }

  /** Call after Vue has mounted and #compass canvas exists in DOM */
  initCompass(): void {
    this.compass = document.getElementById('compass') as HTMLCanvasElement | null;
    if (this.compass) this.cctx = this.compass.getContext('2d');
  }

  update(dt: number): void {
    const g = this.g, p = g.player;
    if (!p) return;
    this.drawCompass();
    this.updateMarkers(dt);
  }

  drawCompass(): void {
    const g = this.g;
    // Re-acquire canvas if not yet available (Vue may have mounted it)
    if (!this.compass) this.initCompass();
    const ctx = this.cctx;
    const cvs = this.compass;
    if (!ctx || !cvs) return;

    const W = cvs.width, H = cvs.height;
    ctx.clearRect(0, 0, W, H);
    const yaw = g.player.inShip ? g.ship.yaw : g.player.yaw;
    let deg = (-yaw * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    const pxPerDeg = 4.4;
    ctx.font = '600 15px Rajdhani';
    ctx.textAlign = 'center';
    for (let d = -100; d <= 100; d += 5) {
      let a = Math.round((deg + d) / 5) * 5;
      const x = W / 2 + (a - deg) * pxPerDeg;
      if (x < 10 || x > W - 10) continue;
      const norm = ((a % 360) + 360) % 360;
      const alpha = 1 - Math.pow(Math.abs(x - W / 2) / (W / 2), 1.6);
      if (norm % 90 === 0) {
        const L = ['N', 'E', 'S', 'W'][Math.round(norm / 90) % 4];
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillText(L, x, 20);
        ctx.fillRect(x - 1, 26, 2, 10);
      } else if (norm % 45 === 0) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.75})`;
        ctx.fillRect(x - 0.5, 28, 1.5, 8);
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.35})`;
        ctx.fillRect(x - 0.5, 31, 1, 5);
      }
    }
    if (!g.player.inShip) {
      const sp = g.ship.group.position;
      const dx = sp.x - g.player.pos.x, dz = sp.z - g.player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 8) {
        let bearing = Math.atan2(dx, -dz) * 180 / Math.PI;
        let rel = bearing - deg;
        while (rel > 180) rel -= 360;
        while (rel < -180) rel += 360;
        const x = W / 2 + rel * pxPerDeg;
        if (x > 8 && x < W - 8) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(x, 38); ctx.lineTo(x - 5, 46); ctx.lineTo(x + 5, 46);
          ctx.closePath(); ctx.fill();
          ctx.font = '600 10px Rajdhani';
          ctx.fillText(U.fmtDist(dist), x, 12);
          ctx.font = '600 15px Rajdhani';
        }
      }
    }
  }

  addMarker(type: string, pos: THREE.Vector3, ttl: number): void {
    const icons: Record<string, string> = { na: 'Na', h2: 'H', o2: 'O₂', fe: 'Fe', cu: 'Cu' };
    const layer = document.getElementById('marker-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'marker ' + type;
    el.innerHTML = `<div class="m-ico">${icons[type] || '?'}</div><div class="m-dist"></div>`;
    layer.appendChild(el);
    this.markers.push({ el, pos, ttl, type });
  }

  updateMarkers(dt: number): void {
    const g = this.g;
    const cam = g.camera;
    const v = new THREE.Vector3();
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.ttl -= dt;
      const blockGone = g.world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y), Math.floor(m.pos.z)) === B.AIR;
      if (m.ttl <= 0 || blockGone) {
        m.el.remove();
        this.markers.splice(i, 1);
        continue;
      }
      v.copy(m.pos).project(cam);
      const behind = v.z > 1;
      if (behind || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) {
        m.el.style.opacity = '0';
        continue;
      }
      const d = m.pos.distanceTo(g.player.pos);
      m.el.style.opacity = m.ttl < 3 ? String(m.ttl / 3) : '1';
      m.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
      m.el.style.top = ((-v.y + 1) / 2 * innerHeight) + 'px';
      (m.el.querySelector('.m-dist')!).textContent = U.fmtDist(d);
    }
  }

  clearMarkers(): void {
    for (const m of this.markers) m.el.remove();
    this.markers = [];
  }

  // --- Methods delegated to Pinia stores / Vue components ---

  scanFlash(): void {
    const layer = document.getElementById('hud');
    if (!layer) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:50%;top:50%;width:10px;height:10px;border:2px solid rgba(120,230,245,.8);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30';
    layer.appendChild(el);
    el.animate([
      { width: '10px', height: '10px', opacity: 1 },
      { width: '160vmax', height: '160vmax', opacity: 0 }
    ], { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove();
  }

  toast(itemId: string, n: number): void {
    useHudStore().addToast(itemId, n);
  }

  notify(text: string, kind?: string): void {
    useHudStore().addNotification(text, kind || 'info');
    this.g.audio.notify(kind || 'info');
  }

  alert(text: string, on: boolean): void {
    const s = useHudStore();
    s.alertText = text;
    s.alertOn = on;
  }

  milestone(kicker: string, title: string, sub: string): void {
    useHudStore().pushMilestone(kicker, title, sub);
  }

  setMission(title: string, desc: string, cur: number, max: number): void {
    const s = useHudStore();
    s.missionTitle = title;
    s.missionDesc = desc;
    s.missionCur = cur;
    s.missionMax = max;
  }

  showPrompt(key: string, text: string, prog: number): void {
    const s = useHudStore();
    s.interactKey = key;
    s.interactText = text;
    s.interactProgress = prog;
  }

  hidePrompt(): void {
    useHudStore().interactKey = '';
  }

  setMineProgress(p: number): void {
    // Rendered reactively by HudOverlay via player store
  }

  setHeat(h: number, hot: boolean): void {
    // Rendered reactively by HudOverlay via player store
  }

  setFlightHud(on: boolean): void {
    useHudStore().flightHudOn = on;
  }

  closeShipPanel(): void {
    this.g.ship.closePanel();
  }

  planetCard(info: PlanetInfo): void {
    useHudStore().showPlanetCard(info);
  }

  renderDiscoveries(): void {
    // Rendered reactively by InventoryScreen Vue component
  }
}
