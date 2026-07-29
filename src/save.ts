// ============================================================
// save.ts — OPFS multi-slot save system + localStorage settings
// ============================================================

import { CFG, DEFAULT_SETTINGS } from './config';
import type { Game, SaveData, SaveSlotMeta, Settings } from './types';

const SAVES_DIR = 'saves';
const SLOT_PREFIX = 'slot-';
const META_FILE = '_meta.json';
const CURRENT_SLOT_KEY = 'voxelhorizon_current_slot';
export const MAX_SLOTS = 10;

/** Serialize OPFS writes so auto-save / manual / unload cannot interleave. */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function slotFileName(slot: number): string {
  return `${SLOT_PREFIX}${slot}.json`;
}

function clampSlot(slot: number): number {
  if (!Number.isFinite(slot)) return 0;
  return Math.max(0, Math.min(MAX_SLOTS - 1, Math.floor(slot)));
}

function emptyMetaList(): (SaveSlotMeta | null)[] {
  return Array.from({ length: MAX_SLOTS }, () => null);
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

function isSlotItem(value: unknown): boolean {
  if (value === null) return true;
  return isRecord(value) && typeof value.id === 'string' && typeof value.n === 'number';
}

function isPlayerSave(value: unknown): boolean {
  return isRecord(value)
    && Array.isArray(value.pos)
    && value.pos.length >= 3
    && typeof value.yaw === 'number'
    && typeof value.pitch === 'number'
    && typeof value.hp === 'number';
}

function isInvSave(value: unknown): boolean {
  return isRecord(value)
    && Array.isArray(value.slots)
    && Array.isArray(value.hotbar)
    && typeof value.sel === 'number'
    && typeof value.units === 'number'
    && value.slots.every(isSlotItem)
    && value.hotbar.every(isSlotItem);
}

function isShipSave(value: unknown): boolean {
  return isRecord(value)
    && Array.isArray(value.pos)
    && value.pos.length >= 3
    && typeof value.rotY === 'number'
    && typeof value.fuel === 'number'
    && typeof value.thruster === 'boolean'
    && typeof value.pulse === 'boolean';
}

function isMissionsSave(value: unknown): boolean {
  return isRecord(value)
    && typeof value.idx === 'number'
    && typeof value.scanner === 'boolean';
}

function isMilestonesSave(value: unknown): boolean {
  return isRecord(value) && isRecord(value.stats) && isRecord(value.awarded);
}

function isDiscoveries(value: unknown): value is SaveData['discoveries'] {
  return isRecord(value)
    && Array.isArray(value.planets)
    && Array.isArray(value.entries);
}

function isEdits(value: unknown): value is SaveData['edits'] {
  if (!isRecord(value)) return false;
  return Object.values(value).every(v => Array.isArray(v) && v.every(n => typeof n === 'number'));
}

/** Accept valid saves; tolerate minor missing optional fields by normalizing. */
function normalizeSaveData(value: unknown): SaveData | null {
  if (!isRecord(value)) return null;
  if (typeof value.seed !== 'number' || typeof value.palIdx !== 'number') return null;
  if (typeof value.planetName !== 'string') return null;
  if (!isPlayerSave(value.player)) return null;
  if (!isInvSave(value.inv)) return null;
  if (!isShipSave(value.ship)) return null;
  if (!isMissionsSave(value.missions)) return null;
  if (!isMilestonesSave(value.milestones)) return null;

  const player = value.player as SaveData['player'];
  const missions = value.missions as SaveData['missions'];
  const discoveries = isDiscoveries(value.discoveries)
    ? value.discoveries
    : { planets: [], entries: [] };
  const edits = isEdits(value.edits) ? value.edits : {};

  return {
    v: typeof value.v === 'number' ? value.v : 1,
    seed: value.seed,
    palIdx: value.palIdx,
    planetName: value.planetName,
    time: typeof value.time === 'number' ? value.time : 0.3,
    playTime: typeof value.playTime === 'number' ? value.playTime : 0,
    player: {
      pos: [Number(player.pos[0]), Number(player.pos[1]), Number(player.pos[2])],
      yaw: player.yaw,
      pitch: player.pitch,
      hp: player.hp,
      hazard: typeof player.hazard === 'number' ? player.hazard : 50,
      ls: typeof player.ls === 'number' ? player.ls : 80,
      flash: typeof player.flash === 'boolean' ? player.flash : false,
    },
    inv: value.inv as SaveData['inv'],
    ship: value.ship as SaveData['ship'],
    missions: {
      idx: missions.idx,
      scanner: missions.scanner,
      shelter: typeof missions.shelter === 'number' ? missions.shelter : 0,
      launched: typeof missions.launched === 'boolean' ? missions.launched : false,
    },
    milestones: value.milestones as SaveData['milestones'],
    discoveries,
    edits,
  };
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
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readJsonWithMeta(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<{ data: unknown; lastModified: number } | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    if (!text) return null;
    return { data: JSON.parse(text), lastModified: file.lastModified || Date.now() };
  } catch {
    return null;
  }
}

async function writeJson(dir: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  try {
    await writable.write(JSON.stringify(data));
    await writable.close();
  } catch (e) {
    try {
      await writable.abort();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function removeEntry(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    // doesn't exist
  }
}

function climateFromSave(data: SaveData): string {
  const planets = data.discoveries?.planets;
  if (planets && planets.length > 0) {
    const match = planets.find(p => p.name === data.planetName) || planets[planets.length - 1];
    if (match?.climate) return match.climate;
  }
  return '';
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

function extractMeta(slot: number, data: SaveData, timestamp = Date.now()): SaveSlotMeta {
  return {
    id: slot,
    planetName: data.planetName,
    climate: climateFromSave(data),
    playTime: data.playTime,
    timestamp,
    playerHp: data.player.hp,
  };
}

/** Build slot meta from `_meta.json` + actual slot files (files win when meta is stale). */
async function loadMetaArray(dir: FileSystemDirectoryHandle): Promise<(SaveSlotMeta | null)[]> {
  const raw = await readJson(dir, META_FILE);
  const metas = emptyMetaList();
  if (Array.isArray(raw)) {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const entry = raw[i];
      if (entry === null || entry === undefined) metas[i] = null;
      else if (isSaveSlotMeta(entry)) metas[i] = { ...entry, id: i };
    }
  }

  // Rebuild missing / inconsistent meta from slot files (meta can be lost while slots remain).
  for (let i = 0; i < MAX_SLOTS; i++) {
    const packed = await readJsonWithMeta(dir, slotFileName(i));
    if (!packed) {
      metas[i] = null;
      continue;
    }
    const data = normalizeSaveData(packed.data);
    if (!data) {
      metas[i] = null;
      continue;
    }
    if (!metas[i] || metas[i]!.planetName !== data.planetName) {
      metas[i] = extractMeta(i, data, packed.lastModified);
    } else if (!metas[i]!.climate) {
      const climate = climateFromSave(data);
      if (climate) metas[i] = { ...metas[i]!, climate };
    }
  }
  return metas;
}

export const Save = {
  MAX_SLOTS,

  /** Get current active slot (0..MAX_SLOTS-1) */
  getCurrentSlot(): number {
    try {
      const raw = localStorage.getItem(CURRENT_SLOT_KEY);
      if (raw === null || raw === '') return 0;
      return clampSlot(parseInt(raw, 10));
    } catch {
      return 0;
    }
  },

  /** Set active slot */
  setCurrentSlot(slot: number): void {
    try {
      localStorage.setItem(CURRENT_SLOT_KEY, String(clampSlot(slot)));
    } catch {
      /* ignore quota / private mode */
    }
  },

  /**
   * Pick a slot for a new game: prefer current if empty, else first empty,
   * else keep current (overwrite on first save).
   */
  async pickSlotForNewGame(): Promise<number> {
    const slots = await this.listSlots();
    const cur = this.getCurrentSlot();
    if (!slots[cur]) return cur;
    const empty = slots.findIndex(s => s === null);
    if (empty >= 0) return empty;
    return cur;
  },

  /** Save game to specified slot (default: current). Serialized via write queue. */
  async save(g: Game, slot?: number): Promise<boolean> {
    return enqueueWrite(async () => {
      try {
        if (!g?.player || !g.world || !g.inv || !g.ship) {
          console.warn('save skipped: engine not ready');
          return false;
        }
        const s = clampSlot(slot ?? this.getCurrentSlot());
        this.setCurrentSlot(s);
        const data = serializeGame(g);
        const dir = await getSavesDir(true);
        await writeJson(dir, slotFileName(s), data);
        const metas = await loadMetaArray(dir);
        metas[s] = extractMeta(s, data, Date.now());
        await writeJson(dir, META_FILE, metas);
        return true;
      } catch (e) {
        console.warn('save failed', e);
        return false;
      }
    });
  },

  /** Load game from specified slot (default: current) */
  async load(slot?: number): Promise<SaveData | null> {
    try {
      const s = clampSlot(slot ?? this.getCurrentSlot());
      const dir = await getSavesDir(false);
      const packed = await readJsonWithMeta(dir, slotFileName(s));
      if (!packed) return null;
      return normalizeSaveData(packed.data);
    } catch {
      return null;
    }
  },

  /** Check if any save exists */
  async hasSave(): Promise<boolean> {
    try {
      const slots = await this.listSlots();
      return slots.some(m => m !== null);
    } catch {
      return false;
    }
  },

  /** List all save slot metadata (always length MAX_SLOTS) */
  async listSlots(): Promise<(SaveSlotMeta | null)[]> {
    try {
      const dir = await getSavesDir(false);
      return await loadMetaArray(dir);
    } catch {
      return emptyMetaList();
    }
  },

  /** Delete a specific slot */
  async deleteSlot(slot: number): Promise<void> {
    await enqueueWrite(async () => {
      try {
        const s = clampSlot(slot);
        const dir = await getSavesDir(false);
        await removeEntry(dir, slotFileName(s));
        const metas = await loadMetaArray(dir);
        metas[s] = null;
        await writeJson(dir, META_FILE, metas);
        if (this.getCurrentSlot() === s) {
          const next = metas.findIndex(m => m !== null);
          this.setCurrentSlot(next >= 0 ? next : 0);
        }
      } catch {
        // ignore
      }
    });
  },

  /** Delete all saves */
  async clear(): Promise<void> {
    await enqueueWrite(async () => {
      try {
        const root = await getRoot();
        await root.removeEntry(SAVES_DIR, { recursive: true });
      } catch {
        // doesn't exist
      }
      try {
        localStorage.removeItem(CURRENT_SLOT_KEY);
      } catch {
        /* ignore */
      }
    });
  },

  // Settings stay on localStorage (sync, small data)

  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(CFG.SET_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const settings = JSON.parse(raw) as unknown;
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
