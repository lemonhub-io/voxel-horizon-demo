class HUD {
  constructor(game) {
    this.g = game;
    this.markers = [];
    this.compass = document.getElementById('compass');
    this.cctx = this.compass.getContext('2d');
    this.toastMap = new Map();
    this.msQueue = [];
    this.msShowing = false;
    this.alertOn = false;
  }

  init() {
    const hp = document.getElementById('hp-segs');
    hp.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'hp-seg';
      hp.appendChild(d);
    }
    document.getElementById('haz-ico').textContent = HAZ_ICONS[this.g.palette.hazard.type] || '☢';
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    const segs = document.querySelectorAll('.hp-seg');
    const hpFrac = p.hp / 100;
    segs.forEach((s, i) => {
      const th = (i + 1) / 4;
      s.classList.toggle('off', hpFrac < th - 0.24);
      s.classList.toggle('hurt', hpFrac < 0.3);
    });
    const sh = document.getElementById('shield-fill');
    sh.style.width = Math.max(0, Math.min(100, p.hp)) + '%';
    const haz = document.getElementById('haz-fill');
    haz.style.width = p.hazard + '%';
    haz.classList.toggle('low', p.hazard < 25);
    const ls = document.getElementById('ls-fill');
    ls.style.width = p.ls + '%';
    ls.classList.toggle('low', p.ls < 25);
    document.getElementById('jet-bar').style.height = p.jetFuel + '%';

    const night = g.sky.dayMix < 0.35;
    document.getElementById('env-icon').textContent = g.stormActive ? '⚠' : night ? '☾' : '☀';
    document.getElementById('env-label').textContent = g.stormActive ? g.palette.storm.label : night ? '夜晚 · ' + g.palette.hazard.nightLabel : '白昼 · ' + g.palette.hazard.label;

    this.drawCompass();
    this.updateMarkers(dt);
  }

  drawCompass() {
    const g = this.g, ctx = this.cctx;
    const W = this.compass.width, H = this.compass.height;
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

  addMarker(type, pos, ttl) {
    const icons = { na: 'Na', h2: 'H', o2: 'O₂', fe: 'Fe', cu: 'Cu' };
    const el = document.createElement('div');
    el.className = 'marker ' + type;
    el.innerHTML = `<div class="m-ico">${icons[type] || '?'}</div><div class="m-dist"></div>`;
    document.getElementById('marker-layer').appendChild(el);
    this.markers.push({ el, pos, ttl, type });
  }

  updateMarkers(dt) {
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
        m.el.style.opacity = 0;
        continue;
      }
      const d = m.pos.distanceTo(g.player.pos);
      m.el.style.opacity = m.ttl < 3 ? m.ttl / 3 : 1;
      m.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
      m.el.style.top = ((-v.y + 1) / 2 * innerHeight) + 'px';
      m.el.querySelector('.m-dist').textContent = U.fmtDist(d);
    }
  }
  clearMarkers() {
    for (const m of this.markers) m.el.remove();
    this.markers = [];
  }

  scanFlash() {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:50%;top:50%;width:10px;height:10px;border:2px solid rgba(120,230,245,.8);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30';
    document.getElementById('hud').appendChild(el);
    el.animate([
      { width: '10px', height: '10px', opacity: 1 },
      { width: '160vmax', height: '160vmax', opacity: 0 }
    ], { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove();
  }

  toast(itemId, n) {
    const key = itemId;
    let t = this.toastMap.get(key);
    if (t && document.body.contains(t.el)) {
      t.n += n;
      t.el.querySelector('.tc').textContent = '+' + t.n;
      clearTimeout(t.timer);
    } else {
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `<img src="${this.g.atlas.icon(itemId)}"><span>${ITEMS[itemId].name}</span><span class="tc">+${n}</span>`;
      document.getElementById('toasts').appendChild(el);
      t = { el, n };
      this.toastMap.set(key, t);
    }
    t.timer = setTimeout(() => {
      t.el.classList.add('fade');
      setTimeout(() => t.el.remove(), 500);
      this.toastMap.delete(key);
    }, 1800);
  }

  notify(text, kind) {
    const g = this.g;
    const el = document.createElement('div');
    el.className = 'notice ' + (kind || 'info');
    const kickers = { info: '信息 // INFO', success: '完成 // DONE', warn: '注意 // CAUTION', danger: '警报 // ALERT' };
    el.innerHTML = `<span class="n-kicker">${kickers[kind] || kickers.info}</span>${text}`;
    const stack = document.getElementById('notify-stack');
    stack.appendChild(el);
    while (stack.children.length > 5) stack.firstChild.remove();
    g.audio.notify(kind);
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 450);
    }, 5200);
  }

  alert(text, on) {
    const el = document.getElementById('alert-center');
    if (on && text) {
      el.classList.remove('hidden');
      document.getElementById('alert-text').textContent = text;
    } else el.classList.add('hidden');
  }

  milestone(kicker, title, sub) {
    this.msQueue.push({ kicker, title, sub });
    this.pumpMilestone();
  }
  pumpMilestone() {
    if (this.msShowing || this.msQueue.length === 0) return;
    const m = this.msQueue.shift();
    this.msShowing = true;
    const el = document.getElementById('milestone-pop');
    document.getElementById('ms-kicker').textContent = m.kicker;
    document.getElementById('ms-title').textContent = m.title;
    document.getElementById('ms-sub').textContent = m.sub || '';
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    this.g.audio.milestone();
    setTimeout(() => {
      el.classList.add('hidden');
      this.msShowing = false;
      this.pumpMilestone();
    }, 3700);
  }

  setMission(title, desc, cur, max) {
    const card = document.getElementById('mission-card');
    if (!title) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    document.getElementById('mission-title').textContent = title;
    document.getElementById('mission-desc').textContent = desc;
    const pw = document.getElementById('mission-prog-wrap');
    if (max > 0) {
      pw.style.display = 'flex';
      document.getElementById('mission-prog').style.width = Math.min(100, cur / max * 100) + '%';
      document.getElementById('mission-count').textContent = `${Math.min(cur, max)} / ${max}`;
    } else pw.style.display = 'none';
  }

  showPrompt(key, text, prog) {
    const el = document.getElementById('interact-hint');
    el.classList.remove('hidden');
    document.getElementById('hint-key').textContent = key;
    document.getElementById('hint-text').textContent = text;
    const ring = document.getElementById('hold-ring-fg');
    ring.style.strokeDashoffset = 113 - 113 * U.clamp(prog, 0, 1);
  }
  hidePrompt() { document.getElementById('interact-hint').classList.add('hidden'); }

  setMineProgress(p) {
    document.getElementById('mine-ring-fg').style.strokeDashoffset = 151 - 151 * U.clamp(p, 0, 1);
  }
  setHeat(h, hot) {
    const el = document.getElementById('heat-bar');
    el.style.height = U.clamp(h, 0, 1) * 100 + '%';
    el.style.background = hot ? '#ff3c2c' : '';
  }

  setFlightHud(on) {
    document.getElementById('flight-hud').classList.toggle('hidden', !on);
    document.getElementById('crosshair').classList.toggle('hidden', on);
    document.getElementById('hotbar').classList.toggle('hidden', on);
    document.getElementById('stats-left').classList.toggle('hidden', on);
    document.getElementById('stats-right').classList.toggle('hidden', on);
  }

  closeShipPanel() { this.g.ship.closePanel(); }

  planetCard(info) {
    const el = document.getElementById('planet-card');
    document.getElementById('pc-name').textContent = info.name;
    document.getElementById('pc-climate').textContent = info.climate;
    document.getElementById('pc-flora').textContent = info.flora;
    document.getElementById('pc-fauna').textContent = info.fauna;
    document.getElementById('pc-storm').textContent = info.storm;
    const res = document.getElementById('pc-res');
    res.innerHTML = '';
    for (const r of info.res) {
      const d = document.createElement('div');
      d.className = 'res-chip';
      d.style.borderColor = ITEMS[r].col || '#fff';
      d.style.color = ITEMS[r].col || '#fff';
      d.textContent = ITEMS[r].name;
      res.appendChild(d);
    }
    el.classList.remove('hidden');
    clearTimeout(this.pcT);
    this.pcT = setTimeout(() => el.classList.add('hidden'), 6000);
  }

  renderDiscoveries() {
    const g = this.g;
    const pl = document.getElementById('disc-planets');
    pl.innerHTML = '';
    for (const p of g.discoveries.planets) {
      const d = document.createElement('div');
      d.className = 'disc-row';
      d.innerHTML = `<div class="d-ico">◍</div><div>${p.name}<div style="font-size:11px;opacity:.6">${p.climate}</div></div><div class="d-sub">${p.visited}次着陆</div>`;
      pl.appendChild(d);
    }
    const sp = document.getElementById('disc-species');
    sp.innerHTML = '';
    if (g.discoveries.entries.length === 0) sp.innerHTML = '<div class="detail-empty">使用分析目镜 [F] 记录生物与植物</div>';
    for (const e of g.discoveries.entries) {
      const d = document.createElement('div');
      d.className = 'disc-row';
      const ico = e.kind === '生物' ? '❋' : e.kind === '植物' ? '❀' : '◆';
      d.innerHTML = `<div class="d-ico">${ico}</div><div>${e.name}</div><div class="d-sub">${e.kind} · ${e.planet}<br>+${e.units} ◈</div>`;
      sp.appendChild(d);
    }
    const mi = document.getElementById('disc-miles');
    mi.innerHTML = '';
    for (const def of MILESTONE_DEFS) {
      const st = g.milestones.stats[def.key] || 0;
      const tier = g.milestones.tier(def, st);
      const next = def.tiers[Math.min(tier, def.tiers.length - 1)];
      const d = document.createElement('div');
      d.className = 'mile-row';
      d.innerHTML = `<b>${def.name}</b> ${tier >= def.tiers.length ? '(满级)' : '等级 ' + tier}<span class="m-prog">${Math.floor(st)} / ${next} ${def.unit}</span>`;
      mi.appendChild(d);
    }
  }
}
