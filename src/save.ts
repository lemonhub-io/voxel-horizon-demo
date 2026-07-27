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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSaveData(value: unknown): value is SaveData {
  return isRecord(value)
    && typeof value.v === 'number'
    && typeof value.seed === 'number'
    && typeof value.palIdx === 'number'
    && typeof value.planetName === 'string'
    && typeof value.time === 'number'
    && typeof value.playTime === 'number'
    && isRecord(value.player)
    && isRecord(value.inv)
    && isRecord(value.ship)
    && isRecord(value.missions)
    && isRecord(value.milestones)
    && isRecord(value.discoveries)
    && isRecord(value.edits);
}

function isSaveSlotMeta(value: unknown): value is SaveSlotMeta {
  return isRecord(value)
    && typeof value.id === 'number'
    && typeof value.planetName === 'string'
    && typeof value.climate === 'string'
    && typeof value.playTime === 'number'
    && typeof value.timestamp === 'number'
    && typeof value.playerHp === 'number';
}

function isPartialSettings(value: unknown): value is Partial<Settings> {
  if (!isRecord(value)) return false;
  const numericKeys: (keyof Omit<Settings, 'invert'>)[] = ['master', 'music', 'sfx', 'sens', 'fov', 'dist', 'touchSens'];
  return numericKeys.every(key => value[key] === undefined || typeof value[key] === 'number')
    && (value.invert === undefined || typeof value.invert === 'boolean');
}

async function readJson(dir: FileSystemDirectoryHandle, name: string): Promise<unknown | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text);
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
    climate: '',
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
      const data = await readJson(dir, slotFileName(s));
      return isSaveData(data) ? data : null;
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
  async listSlots(): Promise<(SaveSlotMeta | null)[]> {
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
      metas[slot] = null;
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
  async _loadMetas(dir: FileSystemDirectoryHandle): Promise<(SaveSlotMeta | null)[]> {
    const raw = await readJson(dir, '_meta.json');
    if (Array.isArray(raw) && raw.every(entry => entry === null || isSaveSlotMeta(entry))) return raw;
    return Array.from({ length: MAX_SLOTS }, () => null);
  },

  // Settings stay on localStorage (sync, small data)

  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(CFG.SET_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const settings = JSON.parse(raw);
      return isPartialSettings(settings) ? { ...DEFAULT_SETTINGS, ...settings } : { ...DEFAULT_SETTINGS };
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
