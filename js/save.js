const Save = {
  save(g) {
    try {
      const edits = {};
      for (const [k, m] of g.world.edits) edits[k] = Array.from(m.entries()).flat();
      const data = {
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
  load() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  clear() { localStorage.removeItem(CFG.SAVE_KEY); },
  loadSettings() {
    try {
      const raw = localStorage.getItem(CFG.SET_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return Object.assign({ ...DEFAULT_SETTINGS }, JSON.parse(raw));
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  },
  saveSettings(s) {
    try { localStorage.setItem(CFG.SET_KEY, JSON.stringify(s)); } catch (e) {}
  }
};
