// ============================================================
// save.ts — OPFS-based save/load + localStorage settings
// ============================================================

import { CFG, DEFAULT_SETTINGS } from './config';
import type { Game, SaveData, Settings } from './types';

const SAVE_FILE = 'save.json';

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function getFileHandle(name: string, create = false): Promise<FileSystemFileHandle> {
  const root = await getRoot();
  return root.getFileHandle(name, { create });
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const fh = await getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(name: string, data: unknown): Promise<void> {
  const fh = await getFileHandle(name, true);
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
}

async function removeFile(name: string): Promise<void> {
  try {
    const root = await getRoot();
    await root.removeEntry(name);
  } catch {
    // file doesn't exist
  }
}

function serializeGame(g: Game): SaveData {
  const edits: Record<string, number[]> = {};
  for (const [k, m] of g.world.edits) edits[k] = Array.from(m.entries()).flat();
  return {
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
    edits,
  };
}

export const Save = {
  /** Save game state to OPFS */
  async save(g: Game): Promise<boolean> {
    try {
      const data = serializeGame(g);
      await writeJson(SAVE_FILE, data);
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  },

  /** Load game state from OPFS */
  async load(): Promise<SaveData | null> {
    try {
      return await readJson<SaveData>(SAVE_FILE);
    } catch {
      return null;
    }
  },

  /** Check if a save exists (for UI) */
  async hasSave(): Promise<boolean> {
    try {
      const root = await getRoot();
      await root.getFileHandle(SAVE_FILE);
      return true;
    } catch {
      return false;
    }
  },

  /** Delete save file from OPFS */
  async clear(): Promise<void> {
    await removeFile(SAVE_FILE);
  },

  // Settings stay on localStorage (sync, small data)

  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(CFG.SET_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return Object.assign({ ...DEFAULT_SETTINGS }, JSON.parse(raw)) as Settings;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(s: Settings): void {
    try {
      localStorage.setItem(CFG.SET_KEY, JSON.stringify(s));
    } catch { /* ignore */ }
  },
};
