import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OPFS with subdirectory support
const files: Record<string, string> = {};
const dirs = new Set<string>();

function makeDirHandle(name: string) {
  return {
    getFileHandle: vi.fn(async (fname: string, opts?: { create?: boolean }) => {
      const key = name + '/' + fname;
      if (!files[key] && !opts?.create) throw new Error('NotFound');
      return {
        getFile: vi.fn(async () => ({
          text: vi.fn(async () => files[key] || ''),
          lastModified: 1_700_000_000_000,
        })),
        createWritable: vi.fn(async () => ({
          write: vi.fn(async (data: string) => { files[key] = data; }),
          close: vi.fn(async () => {}),
          abort: vi.fn(async () => {}),
        })),
      };
    }),
    getDirectoryHandle: vi.fn(async (dname: string, opts?: { create?: boolean }) => {
      const key = name + '/' + dname;
      if (!dirs.has(key) && !opts?.create) throw new Error('NotFound');
      dirs.add(key);
      return makeDirHandle(key);
    }),
    removeEntry: vi.fn(async (fname: string, opts?: { recursive?: boolean }) => {
      const prefix = name + '/' + fname;
      delete files[prefix];
      if (opts?.recursive) {
        for (const k of Object.keys(files)) {
          if (k.startsWith(prefix + '/') || k === prefix) delete files[k];
        }
        for (const d of [...dirs]) {
          if (d.startsWith(prefix + '/') || d === prefix) dirs.delete(d);
        }
      }
    }),
  };
}

const mockRoot = makeDirHandle('');
Object.defineProperty(navigator, 'storage', {
  value: { getDirectory: vi.fn(async () => mockRoot) },
  configurable: true,
});

// Mock localStorage
const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  },
  configurable: true,
});

import { Save, MAX_SLOTS } from '../save';
import { CFG, DEFAULT_SETTINGS } from '../config';
import type { Game } from '../types';

function mockGame(overrides: Record<string, unknown> = {}): Game {
  return {
    seed: 42,
    palIdx: 0,
    planetName: '测试',
    sky: { t: 0.3 },
    playTime: 100,
    world: { edits: new Map() },
    player: {
      serialize: () => ({
        pos: [1, 2, 3],
        yaw: 0.5,
        pitch: -0.1,
        hp: 88,
        hazard: 40,
        ls: 70,
        flash: true,
      }),
    },
    inv: { serialize: () => ({ slots: [{ id: 'carbon', n: 5 }], hotbar: [null], sel: 0, units: 12 }) },
    ship: {
      serialize: () => ({
        pos: [10, 30, 10],
        rotY: 1.2,
        fuel: 50,
        thruster: false,
        pulse: true,
      }),
    },
    missions: { serialize: () => ({ idx: 2, scanner: true, shelter: 1, launched: false }) },
    milestones: { serialize: () => ({ stats: { walk: 9 }, awarded: { walk: 1 } }) },
    discoveries: {
      planets: [{ name: '测试', climate: '温带草原', visited: 1 }],
      entries: [],
    },
    ...overrides,
  } as unknown as Game;
}

describe('Save module', () => {
  beforeEach(() => {
    for (const k in files) delete files[k];
    dirs.clear();
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

  describe('currentSlot', () => {
    it('defaults to 0', () => {
      expect(Save.getCurrentSlot()).toBe(0);
    });
    it('persists slot selection', () => {
      Save.setCurrentSlot(3);
      expect(Save.getCurrentSlot()).toBe(3);
    });
    it('clamps invalid slots', () => {
      Save.setCurrentSlot(99);
      expect(Save.getCurrentSlot()).toBe(MAX_SLOTS - 1);
      Save.setCurrentSlot(-2);
      expect(Save.getCurrentSlot()).toBe(0);
    });
  });

  describe('hasSave / listSlots (OPFS)', () => {
    it('returns false when no saves dir', async () => {
      expect(await Save.hasSave()).toBe(false);
    });

    it('listSlots always has MAX_SLOTS entries', async () => {
      const slots = await Save.listSlots();
      expect(slots).toHaveLength(MAX_SLOTS);
      expect(slots.every(s => s === null)).toBe(true);
    });
  });

  describe('save / load (OPFS)', () => {
    it('returns null when no save', async () => {
      expect(await Save.load(0)).toBeNull();
    });

    it('round-trips data', async () => {
      const ok = await Save.save(mockGame(), 0);
      expect(ok).toBe(true);
      const loaded = await Save.load(0);
      expect(loaded).not.toBeNull();
      expect(loaded!.seed).toBe(42);
      expect(loaded!.planetName).toBe('测试');
      expect(loaded!.player.hp).toBe(88);
      expect(loaded!.player.flash).toBe(true);
      expect(loaded!.inv.units).toBe(12);
      expect(loaded!.missions.idx).toBe(2);
    });

    it('updates hasSave and listSlots meta including climate', async () => {
      await Save.save(mockGame(), 1);
      expect(await Save.hasSave()).toBe(true);
      const slots = await Save.listSlots();
      expect(slots).toHaveLength(MAX_SLOTS);
      expect(slots[1]).not.toBeNull();
      expect(slots[1]!.planetName).toBe('测试');
      expect(slots[1]!.climate).toBe('温带草原');
      expect(slots[1]!.playerHp).toBe(88);
      expect(slots[0]).toBeNull();
    });

    it('rebuilds meta from slot file when _meta.json is missing', async () => {
      await Save.save(mockGame(), 2);
      delete files['/saves/_meta.json'];
      expect(await Save.hasSave()).toBe(true);
      const slots = await Save.listSlots();
      expect(slots[2]?.planetName).toBe('测试');
    });

    it('rejects corrupt slot payload', async () => {
      dirs.add('/saves');
      files['/saves/slot-0.json'] = '{"not":"a save"}';
      expect(await Save.load(0)).toBeNull();
    });

    it('serializes concurrent saves without losing the last write', async () => {
      const a = mockGame({ playTime: 10, planetName: 'A' });
      const b = mockGame({ playTime: 20, planetName: 'B' });
      await Promise.all([Save.save(a, 0), Save.save(b, 0)]);
      const loaded = await Save.load(0);
      expect(loaded!.planetName).toBe('B');
      expect(loaded!.playTime).toBe(20);
    });

    it('pickSlotForNewGame prefers empty over occupied current', async () => {
      await Save.save(mockGame(), 0);
      Save.setCurrentSlot(0);
      const slot = await Save.pickSlotForNewGame();
      expect(slot).toBe(1);
    });
  });

  describe('deleteSlot / clear (OPFS)', () => {
    it('deletes a slot and updates meta', async () => {
      await Save.save(mockGame(), 0);
      await Save.deleteSlot(0);
      expect(await Save.load(0)).toBeNull();
      expect(await Save.hasSave()).toBe(false);
    });

    it('clear removes all saves', async () => {
      await Save.save(mockGame(), 0);
      await Save.save(mockGame({ planetName: '二号' }), 1);
      await Save.clear();
      expect(await Save.hasSave()).toBe(false);
      expect(await Save.load(0)).toBeNull();
    });
  });
});
