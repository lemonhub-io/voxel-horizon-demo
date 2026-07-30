/**
 * Official world archive — R2 via S3 API (cross-account) + DO SQLite mirror.
 */
import {
  OFFICIAL_DEFAULT,
  R2_WORLD_KEY,
  type EditEntry,
  type OfficialPlayerSaveV1,
  type WorldSaveV1,
} from './protocol';
import { r2ConfigFromEnv, s3GetJson, s3PutJson, type R2S3Config } from './r2S3';

export function defaultWorldSave(): WorldSaveV1 {
  return {
    v: 1,
    seed: OFFICIAL_DEFAULT.seed,
    palIdx: OFFICIAL_DEFAULT.palIdx,
    planetName: OFFICIAL_DEFAULT.planetName,
    time: OFFICIAL_DEFAULT.time,
    edits: {},
    players: {},
    updatedAt: Date.now(),
  };
}

export function isWorldSaveV1(value: unknown): value is WorldSaveV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  if (typeof v.seed !== 'number' || typeof v.palIdx !== 'number') return false;
  if (typeof v.planetName !== 'string' || typeof v.time !== 'number') return false;
  if (!v.edits || typeof v.edits !== 'object' || Array.isArray(v.edits)) return false;
  if (v.players !== undefined && (typeof v.players !== 'object' || v.players === null || Array.isArray(v.players))) return false;
  return true;
}

export function editsMapToRecord(edits: Map<string, Map<number, number>>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [k, m] of edits) {
    const arr: number[] = [];
    for (const [idx, id] of m) {
      arr.push(idx, id);
    }
    if (arr.length) out[k] = arr;
  }
  return out;
}

export function recordToEditsMap(rec: Record<string, number[]>): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const [k, arr] of Object.entries(rec)) {
    if (!Array.isArray(arr)) continue;
    const m = new Map<number, number>();
    for (let i = 0; i + 1 < arr.length; i += 2) {
      const idx = arr[i] | 0;
      const id = arr[i + 1] | 0;
      m.set(idx, id);
    }
    if (m.size) out.set(k, m);
  }
  return out;
}

export function editsMapToList(edits: Map<string, Map<number, number>>): EditEntry[] {
  const out: EditEntry[] = [];
  for (const [k, m] of edits) {
    const [cx, cz] = k.split(',').map(Number);
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
    for (const [idx, id] of m) {
      out.push({ cx, cz, idx, id });
    }
  }
  return out;
}

export function applyEditEntry(
  edits: Map<string, Map<number, number>>,
  cx: number,
  cz: number,
  idx: number,
  id: number,
): void {
  const k = `${cx},${cz}`;
  let m = edits.get(k);
  if (!m) {
    m = new Map();
    edits.set(k, m);
  }
  m.set(idx, id);
}

export function worldToSave(
  meta: { seed: number; palIdx: number; planetName: string; time: number },
  edits: Map<string, Map<number, number>>,
  players: Record<string, OfficialPlayerSaveV1> = {},
): WorldSaveV1 {
  return {
    v: 1,
    seed: meta.seed,
    palIdx: meta.palIdx,
    planetName: meta.planetName,
    time: meta.time,
    edits: editsMapToRecord(edits),
    players,
    updatedAt: Date.now(),
  };
}

/** Load from native R2 binding (same-account) if present. */
export async function loadWorldFromR2Binding(bucket: R2Bucket | undefined): Promise<WorldSaveV1 | null> {
  if (!bucket) return null;
  try {
    const obj = await bucket.get(R2_WORLD_KEY);
    if (!obj) return null;
    const data = (await obj.json()) as unknown;
    return isWorldSaveV1(data) ? data : null;
  } catch {
    return null;
  }
}

export async function saveWorldToR2Binding(
  bucket: R2Bucket | undefined,
  save: WorldSaveV1,
): Promise<boolean> {
  if (!bucket) return false;
  try {
    await bucket.put(R2_WORLD_KEY, JSON.stringify(save), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: {
        seed: String(save.seed),
        updatedAt: String(save.updatedAt),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Cross-account R2 via S3 API (Worker reverse-proxy style backend). */
export async function loadWorldFromR2S3(
  env: {
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
  },
  key: string = R2_WORLD_KEY,
): Promise<WorldSaveV1 | null> {
  const cfg = r2ConfigFromEnv(env);
  if (!cfg) return null;
  try {
    const data = await s3GetJson(cfg, key);
    if (data === null) return null;
    return isWorldSaveV1(data) ? data : null;
  } catch {
    return null;
  }
}

export async function saveWorldToR2S3(
  env: {
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
  },
  save: WorldSaveV1,
  key: string = R2_WORLD_KEY,
): Promise<boolean> {
  const cfg = r2ConfigFromEnv(env);
  if (!cfg) return false;
  try {
    await s3PutJson(cfg, key, save);
    return true;
  } catch {
    return false;
  }
}

export function describeR2Backend(env: {
  WORLD_SAVES?: R2Bucket;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_BUCKET?: string;
}): string {
  if (env.WORLD_SAVES) return 'r2-binding';
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID) {
    return `r2-s3:${env.R2_BUCKET || 'mzhub-storage'}`;
  }
  return 'do-sqlite-only';
}

export type { R2S3Config };
