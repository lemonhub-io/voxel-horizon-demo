// ============================================================
// save.ts — OPFS multi-slot save system + localStorage settings
// ============================================================

import { CFG, DEFAULT_SETTINGS } from './config';
import type { Game, SaveData, SaveSlotMeta, Settings } from './types';

const SAVES_DIR = 'saves';
const SLOT_PREFIX = 'slot-';
const CURRENT_SLOT_KEY = 'voxelhorizon_current_slot';
const MAX_SLOTS = 10;

function slotFileName(slot: number): string {
  return `${SLOT_PREFIX}${slot}.json`;
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function getSavesDir(create = false): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot();
  return root.getDirectoryHandle(SAVES_DIR, { create });
}

async function readJson<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(dir: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
}

async function removeEntry(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    // doesn't exist
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

function extractMeta(slot: number, data: SaveData): SaveSlotMeta {
  return {
    id: slot,
    planetName: data.planetName,
    climate: (data as unknown as Record<string, unknown>).climate as string || '',
    playTime: data.playTime,
    timestamp: Date.now(),
    playerHp: data.player.hp,
  };
}

export const Save = {
  /** Get current active slot */
  getCurrentSlot(): number {
    try {
      const raw = localStorage.getItem(CURRENT_SLOT_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  },

  /** Set active slot */
  setCurrentSlot(slot: number): void {
    localStorage.setItem(CURRENT_SLOT_KEY, String(slot));
  },

  /** Save game to specified slot (default: current) */
  async save(g: Game, slot?: number): Promise<boolean> {
    try {
      const s = slot ?? this.getCurrentSlot();
      const data = serializeGame(g);
      const dir = await getSavesDir(true);
      await writeJson(dir, slotFileName(s), data);
      // Also save meta for listing
      const meta = extractMeta(s, data);
      const metas = await this._loadMetas(dir);
      metas[s] = meta;
      await writeJson(dir, '_meta.json', metas);
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  },

  /** Load game from specified slot (default: current) */
  async load(slot?: number): Promise<SaveData | null> {
    try {
      const s = slot ?? this.getCurrentSlot();
      const dir = await getSavesDir(false);
      return await readJson<SaveData>(dir, slotFileName(s));
    } catch {
      return null;
    }
  },

  /** Check if any save exists */
  async hasSave(): Promise<boolean> {
    try {
      const dir = await getSavesDir(false);
      const metas = await this._loadMetas(dir);
      return metas.length > 0 && metas.some(m => m !== null);
    } catch {
      return false;
    }
  },

  /** List all save slot metadata */
  async listSlots(): Promise<SaveSlotMeta[]> {
    try {
      const dir = await getSavesDir(false);
      return await this._loadMetas(dir);
    } catch {
      return [];
    }
  },

  /** Delete a specific slot */
  async deleteSlot(slot: number): Promise<void> {
    try {
      const dir = await getSavesDir(false);
      await removeEntry(dir, slotFileName(slot));
      const metas = await this._loadMetas(dir);
      metas[slot] = null as unknown as SaveSlotMeta;
      await writeJson(dir, '_meta.json', metas);
    } catch {
      // ignore
    }
  },

  /** Delete all saves */
  async clear(): Promise<void> {
    try {
      const root = await getRoot();
      await root.removeEntry(SAVES_DIR, { recursive: true });
    } catch {
      // doesn't exist
    }
    localStorage.removeItem(CURRENT_SLOT_KEY);
  },

  /** Internal: load meta array */
  async _loadMetas(dir: FileSystemDirectoryHandle): Promise<SaveSlotMeta[]> {
    const raw = await readJson<SaveSlotMeta[]>(dir, '_meta.json');
    if (raw && Array.isArray(raw)) return raw;
    return new Array(MAX_SLOTS).fill(null) as unknown as SaveSlotMeta[];
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
