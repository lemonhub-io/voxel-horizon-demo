import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OPFS
const files: Record<string, string> = {};
const mockRoot = {
  getFileHandle: vi.fn(async (name: string, opts?: { create?: boolean }) => {
    if (!files[name] && !opts?.create) throw new Error('NotFound');
    return {
      getFile: vi.fn(async () => ({
        text: vi.fn(async () => files[name] || ''),
      })),
      createWritable: vi.fn(async () => ({
        write: vi.fn(async (data: string) => { files[name] = data; }),
        close: vi.fn(async () => {}),
      })),
    };
  }),
  removeEntry: vi.fn(async (name: string) => { delete files[name]; }),
};
Object.defineProperty(navigator, 'storage', {
  value: { getDirectory: vi.fn(async () => mockRoot) },
});

// Mock localStorage
const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  },
});

import { Save } from '../save';
import { CFG, DEFAULT_SETTINGS } from '../config';

describe('Save module', () => {
  beforeEach(() => {
    for (const k in files) delete files[k];
    for (const k in storage) delete storage[k];
    vi.clearAllMocks();
  });

  describe('loadSettings (localStorage)', () => {
    it('returns defaults when nothing saved', () => {
      const s = Save.loadSettings();
      expect(s.master).toBe(DEFAULT_SETTINGS.master);
    });
    it('merges saved with defaults', () => {
      localStorage.setItem(CFG.SET_KEY, JSON.stringify({ master: 50 }));
      const s = Save.loadSettings();
      expect(s.master).toBe(50);
      expect(s.fov).toBe(DEFAULT_SETTINGS.fov);
    });
  });

  describe('saveSettings (localStorage)', () => {
    it('persists to localStorage', () => {
      Save.saveSettings({ ...DEFAULT_SETTINGS, master: 30 });
      expect(localStorage.getItem(CFG.SET_KEY)).toContain('"master":30');
    });
  });

  describe('hasSave (OPFS)', () => {
    it('returns false when no save', async () => {
      expect(await Save.hasSave()).toBe(false);
    });
    it('returns true when save exists', async () => {
      files['save.json'] = '{}';
      expect(await Save.hasSave()).toBe(true);
    });
  });

  describe('save / load (OPFS)', () => {
    it('returns null when no save', async () => {
      expect(await Save.load()).toBeNull();
    });

    it('round-trips data', async () => {
      const mockGame = {
        seed: 42, palIdx: 0, planetName: '测试', sky: { t: 0.3 },
        playTime: 100, world: { edits: new Map() },
        player: { serialize: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, hp: 100, hazard: 50, ls: 80, flash: false }) },
        inv: { serialize: () => ({ slots: [], hotbar: [], sel: 0, units: 0 }) },
        ship: { serialize: () => ({ pos: [0, 0, 0], rotY: 0, fuel: 0, thruster: true, pulse: true }) },
        missions: { serialize: () => ({ idx: 0, scanner: false, shelter: 0, launched: false }) },
        milestones: { serialize: () => ({ stats: {}, awarded: {} }) },
        discoveries: { planets: [], entries: [] },
      };
      const ok = await Save.save(mockGame as unknown as Parameters<typeof Save.save>[0]);
      expect(ok).toBe(true);
      const loaded = await Save.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.seed).toBe(42);
      expect(loaded!.planetName).toBe('测试');
    });
  });

  describe('clear (OPFS)', () => {
    it('removes save file', async () => {
      files['save.json'] = '{}';
      await Save.clear();
      expect(files['save.json']).toBeUndefined();
    });
  });
});
