// ============================================================
// missions.ts — No Man's Sky inspired mission progression
// ============================================================

import { MILESTONE_DEFS } from './config';
import type { Game, MissionDef, MilestoneDef, MissionsSaveData, MilestonesSaveData } from './types';

export class Missions {
  g: Game;
  idx: number;
  scannerUnlocked: boolean;
  shelterCount: number;
  defs: MissionDef[];
  launched?: boolean;
  sodiumUsed?: number;
  oxygenUsed?: number;

  constructor(game: Game) {
    this.g = game;
    this.idx = 0;
    this.scannerUnlocked = false;
    this.shelterCount = 0;
    this.defs = this.buildDefs();
  }

  buildDefs(): MissionDef[] {
    const g = this.g;
    return [
      // === PHASE 1: SURVIVAL ===
      {
        id: 'wake', title: '坠毁信号', desc: '沿指南针白色标记找到坠毁的星舰。',
        prog: () => null,
        check: () => g.player && g.player.pos.distanceTo(g.ship.group.position) < 14,
        done: '找到了「拂晓之羽」。飞船严重受损，需要修复。'
      },
      {
        id: 'sodium', title: '防护系统', desc: '采集 钠×10（黄色钠光花）和 铁尘×10（灰色岩石）。按 X 消耗钠充能防护。',
        prog: () => [g.inv.count('sodium') + (this.sodiumUsed || 0) + g.inv.count('ferrite'), 20],
        check: () => (g.inv.count('sodium') + (this.sodiumUsed || 0)) >= 10 && g.inv.count('ferrite') >= 10,
        done: '基础防护就绪。你学会了在这个星球上生存。'
      },
      {
        id: 'scanner', title: '校准扫描仪', desc: '继续采集 铁尘×15，完成后解锁扫描 [C] 和分析目镜 [F]。',
        prog: () => [g.inv.count('ferrite'), 15],
        check: () => g.inv.count('ferrite') >= 15,
        done: '扫描仪校准完毕。按 C 标记资源，按 F 分析万物。',
        onComplete: () => { this.scannerUnlocked = true; }
      },
      {
        id: 'oxygen', title: '生命维持', desc: '采集 氧×15（红色花朵）。按 Z 消耗氧补充生命维持。',
        prog: () => [g.inv.count('oxygen') + (this.oxygenUsed || 0), 15],
        check: () => (g.inv.count('oxygen') + (this.oxygenUsed || 0)) >= 15,
        done: '生命维持稳定。你已经适应了这颗星球。'
      },

      // === PHASE 2: CRAFTING ===
      {
        id: 'refine', title: '材料精炼', desc: '打开合成面板 [Tab]，合成 金属镀层×1 和 碳纳米管×1。这是修复飞船的基础材料。',
        prog: () => [g.inv.count('metal_plate') + g.inv.count('nanotube'), 2],
        check: () => g.inv.count('metal_plate') >= 1 && g.inv.count('nanotube') >= 1,
        done: '材料精炼完成。这些高级材料可以修复飞船组件了。'
      },
      {
        id: 'thruster', title: '修复推进器', desc: '靠近飞船按 E，用 金属镀层×1 + 铁尘×20 修复起飞推进器。',
        prog: () => null,
        check: () => !g.ship.comps.thruster.broken,
        done: '推进器修复完成。机身恢复了平衡。'
      },
      {
        id: 'pulse', title: '修复脉冲引擎', desc: '用 碳纳米管×1 + 钠×15 修复脉冲引擎。钠需要继续采集。',
        prog: () => null,
        check: () => !g.ship.comps.pulse.broken,
        done: '脉冲引擎点火自检通过。飞船可以巡航了。'
      },

      // === PHASE 3: LAUNCH ===
      {
        id: 'fuel', title: '加注燃料', desc: '采集蓝色双氢晶簇 [C扫描]，合成 启动燃料（双氢×25），在飞船面板加注。',
        prog: () => [Math.round(g.ship.fuel), 100],
        check: () => g.ship.fuel >= 99,
        done: '燃料舱加注完毕。可以起飞了。'
      },
      {
        id: 'launch', title: '起飞！', desc: '靠近飞船按 E，点击「起飞」。W/S 油门，鼠标转向，空格加力，E 降落。',
        prog: () => null,
        check: () => this.launched === true,
        done: '你回到了天空。这颗星球在脚下铺展开来。'
      },

      // === PHASE 4: FRONTIER ===
      {
        id: 'frontier', title: '天际之后', desc: '完成任意目标：① 建造15个方块 ② 分析3种生物 ③ 跃迁到新星球',
        prog: () => [Math.min(15, this.shelterCount) + '', ''],
        progText: () => `建造 ${Math.min(15, this.shelterCount)}/15 · 分析 ${Math.min(3, g.milestones.stats.scans || 0)}/3 · 跃迁 ${Math.min(1, g.milestones.stats.warps || 0)}/1`,
        check: () => this.shelterCount >= 15 || (g.milestones.stats.scans || 0) >= 3 || (g.milestones.stats.warps || 0) >= 1,
        done: '远行者协议完成。银河的门已经敞开。'
      },
      {
        id: 'free', title: '无尽旅程', desc: '探索、建造、收集、跃迁。每颗星球都有独特的气候、生态与风暴。',
        prog: () => null,
        check: () => false
      }
    ];
  }

  current(): MissionDef { return this.defs[this.idx]; }

  onEvent(ev: string, _data?: string): void {
    if (ev === 'launch') this.launched = true;
    if (ev === 'place') this.shelterCount++;
  }

  tick(): void {
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

  updateCard(): void {
    const m = this.current();
    if (!m) return;
    let cur = 0, max = 0;
    const p = m.prog ? m.prog() : null;
    let desc = m.desc;
    if (m.progText) desc = m.desc + '\n' + m.progText();
    if (p && typeof p[0] === 'number' && typeof p[1] === 'number') { cur = p[0]; max = p[1]; }
    this.g.hud.setMission('任务 ' + (this.idx + 1) + '/' + this.defs.length + ' · ' + m.title, desc, cur, max);
  }

  serialize(): MissionsSaveData {
    return { idx: this.idx, scanner: this.scannerUnlocked, shelter: this.shelterCount, launched: this.launched || false };
  }
  deserialize(d: MissionsSaveData | undefined): void {
    if (!d) return;
    this.idx = d.idx;
    this.scannerUnlocked = d.scanner;
    this.shelterCount = d.shelter || 0;
    this.launched = d.launched;
  }
}

export class Milestones {
  g: Game;
  stats: Record<string, number>;
  awarded: Record<string, number>;

  constructor(game: Game) {
    this.g = game;
    this.stats = { walk: 0, mined: 0, scans: 0, placed: 0, warps: 0, crafted: 0, survive: 0 };
    this.awarded = {};
  }
  tier(def: MilestoneDef, val: number): number {
    let t = 0;
    for (const th of def.tiers) if (val >= th) t++;
    return t;
  }
  addStat(key: string, amt: number): void {
    this.stats[key] = (this.stats[key] || 0) + amt;
    this.checkKey(key);
  }
  checkKey(key: string): void {
    const def = MILESTONE_DEFS.find(d => d.key === key);
    if (!def) return;
    const t = this.tier(def, this.stats[key]);
    const prev = this.awarded[key] || 0;
    if (t > prev) {
      this.awarded[key] = t;
      const romanT = ['Ⅰ', 'Ⅱ', 'Ⅲ'][t - 1] || t;
      this.g.hud.milestone('旅程里程碑 // JOURNEY', `${def.name} ${romanT}`, def.subs[t - 1]);
      this.g.inv.units += 120 * t;
      this.g.inv.syncStore();
    }
  }
  tickTime(dt: number): void {
    this.stats.survive += dt;
    if (Math.floor(this.stats.survive) % 30 === 0) this.checkKey('survive');
  }
  serialize(): MilestonesSaveData { return { stats: this.stats, awarded: this.awarded }; }
  deserialize(d: MilestonesSaveData | undefined): void {
    if (!d) return;
    this.stats = {
      walk: 0, mined: 0, scans: 0, placed: 0, warps: 0, crafted: 0, survive: 0,
      ...(d.stats || {}),
    };
    this.awarded = { ...(d.awarded || {}) };
  }
}
