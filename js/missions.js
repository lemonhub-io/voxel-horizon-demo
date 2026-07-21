class Missions {
  constructor(game) {
    this.g = game;
    this.idx = 0;
    this.scannerUnlocked = false;
    this.shelterCount = 0;
    this.defs = this.buildDefs();
  }

  buildDefs() {
    const g = this.g;
    return [
      {
        id: 'wake', title: '寻找坠毁的星舰', desc: '沿着指南针上的白色标记，找到你的飞船。',
        prog: () => null,
        check: () => g.player && g.player.pos.distanceTo(g.ship.group.position) < 14,
        done: '找到了「拂晓之羽」—— 但它伤得不轻。'
      },
      {
        id: 'sodium', title: '危险防护告急', desc: '采集 钠 ×15：寻找黄色发光的钠光花，按住左键用激光采集。按 X 可随时消耗钠为防护充能。',
        prog: () => [g.inv.count('sodium') + (this.sodiumUsed || 0), 15],
        check: () => (g.inv.count('sodium') + (this.sodiumUsed || 0)) >= 15,
        done: '防护系统重新上线。记住：按 X 充能防护。'
      },      {
        id: 'ferrite', title: '校准多功能工具', desc: '采集 铁尘 ×25：开采灰色岩石或棕色铁屑岩。完成后解锁扫描脉冲 [C] 与分析目镜 [F]。',
        prog: () => [g.inv.count('ferrite'), 25],
        check: () => g.inv.count('ferrite') >= 25,
        done: '扫描仪校准完毕 —— 按 C 标记周围资源，按 F 分析万物。',
        onComplete: () => { this.scannerUnlocked = true; }
      },
      {
        id: 'oxygen', title: '维持呼吸', desc: '采集 氧 ×20：按 C 扫描，寻找红色的呼吸红花。按 Z 可消耗氧补充生命维持。',
        prog: () => [g.inv.count('oxygen') + (this.oxygenUsed || 0), 20],
        check: () => (g.inv.count('oxygen') + (this.oxygenUsed || 0)) >= 20,
        done: '生命维持稳定。这颗星球的空气并不欢迎你。'
      },
      {
        id: 'thruster', title: '修复起飞推进器', desc: '按 Tab 打开合成面板，用 铁尘×30 合成 金属镀层，再靠近飞船按 E 修复推进器（还需铁尘×20）。',
        prog: () => null,
        check: () => !g.ship.comps.thruster.broken,
        done: '推进器修复完成，机身恢复了平衡。'
      },
      {
        id: 'pulse', title: '修复脉冲引擎', desc: '合成 碳纳米管（碳×40，采集树木与植物），并准备 钠×15，然后在飞船面板中修复脉冲引擎。',
        prog: () => null,
        check: () => !g.ship.comps.pulse.broken,
        done: '脉冲引擎点火自检通过。'
      },
      {
        id: 'fuel', title: '加注启动燃料', desc: '采集蓝色双氢晶簇（双氢×40），合成 启动燃料 并在飞船面板加注。',
        prog: () => [Math.round(g.ship.fuel), 100],
        check: () => g.ship.fuel >= 99,
        done: '燃料舱加注完毕 —— 可以起飞了。'
      },
      {
        id: 'launch', title: '起飞！', desc: '靠近飞船按 E，点击「起飞」。鼠标转向，W/S 控制油门，空格加力，E 降落。',
        prog: () => null,
        check: () => this.launched === true,
        done: '你回到了天空。这颗星球在脚下铺展开来。'
      },
      {
        id: 'frontier', title: '天际之后', desc: '完成任意目标：① 放置 15 个方块建造庇护所 ② 用目镜分析 3 种生命 ③ 合成跃迁电池并在飞行中按 J 跃迁到新星球。',
        prog: () => [Math.min(15, this.shelterCount) + '', ''],
        progText: () => `建造 ${Math.min(15, this.shelterCount)}/15 · 分析 ${Math.min(3, g.milestones.stats.scans || 0)}/3 · 跃迁 ${Math.min(1, g.milestones.stats.warps || 0)}/1`,
        check: () => this.shelterCount >= 15 || (g.milestones.stats.scans || 0) >= 3 || (g.milestones.stats.warps || 0) >= 1,
        done: '远行者协议完成。银河的门已经敞开。'
      },
      {
        id: 'free', title: '无尽旅程', desc: '探索、建造、收集、跃迁。每颗星球都有自己的气候、生态与风暴。你的旅程没有终点。',
        prog: () => null,
        check: () => false
      }
    ];
  }

  current() { return this.defs[this.idx]; }

  onEvent(ev, data) {
    if (ev === 'launch') this.launched = true;
    if (ev === 'place') this.shelterCount++;
  }

  tick() {
    const g = this.g;
    const m = this.current();
    if (!m) return;
    if (m.check()) {
      if (m.done) g.hud.notify(m.done, 'success');
      if (m.onComplete) m.onComplete();
      g.audio.missionDone();
      g.hud.milestone('任务完成 // MILESTONE', m.title, m.done || '');
      this.idx = Math.min(this.idx + 1, this.defs.length - 1);
      this.updateCard();
    } else {
      this.updateCard();
    }
  }

  updateCard() {
    const m = this.current();
    if (!m) return;
    let cur = 0, max = 0;
    const p = m.prog ? m.prog() : null;
    let desc = m.desc;
    if (m.progText) desc = m.desc + '\n' + m.progText();
    if (p && typeof p[0] === 'number') { cur = p[0]; max = p[1]; }
    this.g.hud.setMission('任务 ' + (this.idx + 1) + '/' + this.defs.length + ' · ' + m.title, desc, cur, max);
  }

  serialize() {
    return { idx: this.idx, scanner: this.scannerUnlocked, shelter: this.shelterCount, launched: this.launched || false };
  }
  deserialize(d) {
    if (!d) return;
    this.idx = d.idx;
    this.scannerUnlocked = d.scanner;
    this.shelterCount = d.shelter || 0;
    this.launched = d.launched;
  }
}

class Milestones {
  constructor(game) {
    this.g = game;
    this.stats = { walk: 0, mined: 0, scans: 0, placed: 0, warps: 0, crafted: 0, survive: 0 };
    this.awarded = {};
  }
  tier(def, val) {
    let t = 0;
    for (const th of def.tiers) if (val >= th) t++;
    return t;
  }
  addStat(key, amt) {
    this.stats[key] = (this.stats[key] || 0) + amt;
    this.checkKey(key);
  }
  checkKey(key) {
    const def = MILESTONE_DEFS.find(d => d.key === key);
    if (!def) return;
    const t = this.tier(def, this.stats[key]);
    const prev = this.awarded[key] || 0;
    if (t > prev) {
      this.awarded[key] = t;
      const romanT = ['Ⅰ', 'Ⅱ', 'Ⅲ'][t - 1] || t;
      this.g.hud.milestone('旅程里程碑 // JOURNEY', `${def.name} ${romanT}`, def.subs[t - 1]);
      this.g.inv.units += 120 * t;
      this.g.inv.refresh();
    }
  }
  tickTime(dt) {
    this.stats.survive += dt;
    if (Math.floor(this.stats.survive) % 30 === 0) this.checkKey('survive');
  }
  serialize() { return { stats: this.stats, awarded: this.awarded }; }
  deserialize(d) {
    if (!d) return;
    this.stats = Object.assign(this.stats, d.stats);
    this.awarded = d.awarded || {};
  }
}
