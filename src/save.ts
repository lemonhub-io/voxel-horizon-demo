import { CFG, DEFAULT_SETTINGS } from './config';
import type { Game, SaveData, Settings } from './types';

export const Save = {
  save(g: Game): boolean {
    try {
      const edits: Record<string, number[]> = {};
      for (const [k, m] of g.world.edits) edits[k] = Array.from(m.entries()).flat();
      const data: SaveData = {
        v: 1,
        seed: g.seed,
        palIdx: g.palIdx,
        planetName: g.planetName,
        time: g.sky.t,
        playTime: g.playTime,
        player: g.player.serialize(),
        inv: g.inv.serialize(),
        ship: g.ship.serialize(),
        missions: g.missions.serialize(),
        milestones: g.milestones.serialize(),
        discoveries: g.discoveries,
        edits
      };
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  },
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SaveData;
    } catch { return null; }
  },
  clear(): void { localStorage.removeItem(CFG.SAVE_KEY); },
  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(CFG.SET_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return Object.assign({ ...DEFAULT_SETTINGS }, JSON.parse(raw)) as Settings;
    } catch { return { ...DEFAULT_SETTINGS }; }
  },
  saveSettings(s: Settings): void {
    try { localStorage.setItem(CFG.SET_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
};
