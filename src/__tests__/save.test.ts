import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { for (const k in storage) delete storage[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { Save } from '../save';
import { CFG, DEFAULT_SETTINGS } from '../config';

describe('Save module', () => {
  beforeEach(() => localStorageMock.clear());

  describe('loadSettings', () => {
    it('returns defaults when nothing saved', () => {
      const s = Save.loadSettings();
      expect(s.master).toBe(DEFAULT_SETTINGS.master);
      expect(s.fov).toBe(DEFAULT_SETTINGS.fov);
    });

    it('merges saved settings with defaults', () => {
      localStorageMock.setItem(CFG.SET_KEY, JSON.stringify({ master: 50 }));
      const s = Save.loadSettings();
      expect(s.master).toBe(50);
      expect(s.fov).toBe(DEFAULT_SETTINGS.fov);
    });
  });

  describe('saveSettings', () => {
    it('persists to localStorage', () => {
      const settings = { ...DEFAULT_SETTINGS, master: 30 };
      Save.saveSettings(settings);
      expect(localStorageMock.getItem(CFG.SET_KEY)).toContain('"master":30');
    });
  });

  describe('load', () => {
    it('returns null when nothing saved', () => {
      expect(Save.load()).toBeNull();
    });

    it('returns parsed data when saved', () => {
      const data = { v: 1, seed: 42, palIdx: 0 };
      localStorageMock.setItem(CFG.SAVE_KEY, JSON.stringify(data));
      const loaded = Save.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.seed).toBe(42);
    });
  });

  describe('clear', () => {
    it('removes save data', () => {
      localStorageMock.setItem(CFG.SAVE_KEY, '{}');
      Save.clear();
      expect(localStorageMock.getItem(CFG.SAVE_KEY)).toBeNull();
    });
  });
});
